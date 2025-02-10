import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';

interface Props {
  userId: string;
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageSent: () => void;
}

export function SendMessageDialog({ userId, username, open, onOpenChange, onMessageSent }: Props) {
  const { user: admin } = useAuthStore();
  const [message, setMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !admin?.isAdmin) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        userId,
        fromAdmin: admin.username,
        content: message.trim(),
        timestamp: new Date(),
        read: false
      });

      setMessage('');
      onMessageSent();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            Send Message to {username}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Message Content
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 block h-32 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="Type your message here..."
                required
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sending || !message.trim()}
              >
                {sending ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </form>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}