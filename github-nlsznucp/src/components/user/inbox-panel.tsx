import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail, MailOpen } from 'lucide-react';

interface Message {
  id: string;
  fromAdmin: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export function InboxPanel() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Listen to user's messages
    const messagesQuery = query(
      collection(db, 'messages'),
      where('userId', '==', user.id),
      orderBy('timestamp', 'desc')
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const userMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Message[];
      setMessages(userMessages);
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

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-6 text-xl font-semibold">Inbox</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Messages List */}
        <div className="space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                onClick={() => {
                  setSelectedMessage(message);
                  if (!message.read) {
                    markAsRead(message.id);
                  }
                }}
                className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md ${
                  selectedMessage?.id === message.id ? 'border-blue-500 bg-blue-50' :
                  message.read ? 'border-gray-200' : 'border-yellow-300 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {message.read ? (
                      <MailOpen className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Mail className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      Message from {message.fromAdmin}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {message.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {message.content}
                </p>
              </div>
            ))
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
              <p className="text-gray-500">No messages yet</p>
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="rounded-lg border p-6">
          {selectedMessage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-medium">From: {selectedMessage.fromAdmin}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedMessage.timestamp.toLocaleString()}
                  </p>
                </div>
                {selectedMessage.read ? (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    Read
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-600">
                    New
                  </span>
                )}
              </div>
              <div className="whitespace-pre-wrap">
                {selectedMessage.content}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              Select a message to view its content
            </div>
          )}
        </div>
      </div>
    </div>
  );
}