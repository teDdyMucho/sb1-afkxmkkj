import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { X, Trophy } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResponse: (accept: boolean) => void;
  stake: number;
}

export function RpsRematchDialog({ open, onOpenChange, onResponse, stake }: Props) {
  const { user } = useAuthStore();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center space-x-3">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <Dialog.Title className="text-xl font-semibold">
              Rematch Requested
            </Dialog.Title>
          </div>

          <div className="mb-6 space-y-2">
            <p className="text-gray-600">
              Your opponent wants a rematch! The stake will be {stake} FBT points.
            </p>
            <p className="text-sm text-gray-500">
              Your current balance: {user?.points || 0} FBT
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => onResponse(false)}
              className="border-red-500 text-red-600 hover:bg-red-50"
            >
              Decline
            </Button>
            <Button
              onClick={() => onResponse(true)}
              disabled={!user || user.points < stake}
              className="bg-green-600 hover:bg-green-700"
            >
              Accept Rematch
            </Button>
          </div>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}