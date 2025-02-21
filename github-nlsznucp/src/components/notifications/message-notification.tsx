import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MessageCircle, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface Message {
  id: string;
  fromAdmin: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export function MessageNotification() {
  const { user } = useAuthStore();
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Listen to unread messages
    const messagesQuery = query(
      collection(db, 'messages'),
      where('userId', '==', user.id),
      where('read', '==', false)
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Message[];
      setUnreadMessages(messages);
    });

    return () => unsubMessages();
  }, [user?.id]);

  const markAsRead = async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        read: true
      });
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };

  if (unreadMessages.length === 0) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      {/* Floating Notification - Adjusted for mobile */}
      <Dialog.Trigger asChild>
        <button className="fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl md:bottom-24 md:right-6 md:h-12 md:w-12">
          <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
            {unreadMessages.length}
          </div>
          <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      </Dialog.Trigger>

      {/* Message Dialog - Full screen on mobile */}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-4 z-50 overflow-hidden rounded-lg bg-white shadow-xl md:left-[50%] md:top-[50%] md:w-[90vw] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:p-6">
          <Dialog.Title className="border-b p-4 text-lg font-semibold md:border-none md:p-0 md:text-xl">
            Unread Messages
          </Dialog.Title>

          <div className="h-[calc(100%-8rem)] space-y-3 overflow-y-auto p-4 md:max-h-[60vh] md:space-y-4 md:p-0 md:pt-4">
            {unreadMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border p-3 transition-colors hover:bg-gray-50 md:p-4"
                onClick={() => markAsRead(message.id)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-600 md:text-base">
                    From: {message.fromAdmin}
                  </span>
                  <span className="text-xs text-gray-500 md:text-sm">
                    {message.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 md:text-base">{message.content}</p>
              </div>
            ))}
          </div>

          <div className="absolute right-2 top-2 md:right-4 md:top-4">
            <Dialog.Close className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4 md:h-5 md:w-5" />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}