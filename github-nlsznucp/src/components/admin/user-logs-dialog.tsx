import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserLog {
  type: string;
  amount: number;
  description: string;
  timestamp: Date;
}

interface Props {
  userId: string;
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserLogsDialog({ userId, username, open, onOpenChange }: Props) {
  const [logs, setLogs] = React.useState<UserLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!open || !userId) return;

    setLoading(true);
    
    // Query user's transactions
    const logsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const userLogs = snapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as UserLog[];
      
      setLogs(userLogs);
      setLoading(false);
    });

    return () => unsubLogs();
  }, [userId, open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[800px] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <Dialog.Title className="mb-4 text-2xl font-semibold">
            {username}'s Activity Log
          </Dialog.Title>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-4">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        log.type.includes('win') ? 'bg-green-100 text-green-800' :
                        log.type.includes('bet') ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {log.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2">{log.description}</p>
                    <p className={`mt-1 font-semibold ${
                      log.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {log.amount > 0 ? '+' : ''}{log.amount} {
                        log.type.includes('cash') ? 'Cash' : 'Points'
                      }
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500">No activity logs found</p>
            )}
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