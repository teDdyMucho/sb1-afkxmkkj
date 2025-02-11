import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Transaction {
  id: string;
  timestamp: Date;
  type: string;
  amount: number;
  description: string;
  username?: string;
  balanceAfter?: {
    points: number;
    cash: number;
  };
}

export function TransactionsAdmin() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const transactionsQuery = query(
      collection(db, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const trans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Transaction[];
      setTransactions(trans);
    });

    return () => unsubTransactions();
  }, []);

  return (
    <div className="rounded-lg bg-white shadow-md">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Balance After
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {transaction.timestamp.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        transaction.type === 'admin_profit'
                          ? 'bg-purple-100 text-purple-800'
                          : transaction.amount > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {transaction.username || 'System'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={`flex items-center text-sm ${
                        transaction.type === 'admin_profit'
                          ? 'text-purple-600'
                          : transaction.amount > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {transaction.amount > 0 ? (
                          <ArrowUpRight className="mr-1 h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="mr-1 h-4 w-4" />
                        )}
                        {Math.abs(transaction.amount)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {transaction.balanceAfter ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className="text-blue-600">FBT:</span>
                            <span>{transaction.balanceAfter.points}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-green-600">Cash:</span>
                            <span>{transaction.balanceAfter.cash}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate text-sm text-gray-900">
                        {transaction.description}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {transactions.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                No transactions found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}