import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Copy, CircleDollarSign, Wallet, Users, History, AlertCircle, Swords, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InboxPanel } from './inbox-panel';
import { VIPPanel } from './vip-panel';
import * as Tabs from '@radix-ui/react-tabs';

interface User {
  id: string;
  username: string;
  points: number;
  cash: number;
  referralCode: string;
  referrals: string[];
  gcashNumber?: string;
  isPaid: boolean;
}

interface Referral {
  username: string;
  referrals: number;
}

interface Request {
  id: string;
  type: 'withdrawal' | 'loan';
  amount: number;
  status: 'pending' | 'approved' | 'declined';
  timestamp: Date;
}

interface Transaction {
  id: string;
  timestamp: Date;
  type: string;
  amount: number;
  description: string;
  balanceAfter?: {
    points: number;
    cash: number;
  };
}

export function UserPanel() {
  const { user } = useAuthStore();
  const [gcashNumber, setGcashNumber] = useState(user?.gcashNumber || '');
  const [isEditingGcash, setIsEditingGcash] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Listen to user document for real-time updates
    const unsubUser = onSnapshot(doc(db, 'users', user.id), (doc) => {
      if (doc.exists()) {
        useAuthStore.setState(state => ({
          ...state,
          user: { ...state.user!, ...doc.data() }
        }));
      }
    });

    // Fetch referrals
    const referralsQuery = query(
      collection(db, 'users'),
      where('referrerId', '==', user.id)
    );

    const unsubReferrals = onSnapshot(referralsQuery, (snapshot) => {
      const refs = snapshot.docs.map(doc => ({
        username: doc.data().username,
        referrals: doc.data().referrals?.length || 0
      }));
      setReferrals(refs);
    });

    // Fetch user's requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('userId', '==', user.id)
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Request[];
      setRequests(reqs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });

    // Add transaction history listener
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const trans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Transaction[];
      setTransactions(trans);
    });

    return () => {
      unsubUser();
      unsubReferrals();
      unsubRequests();
      unsubTransactions();
    };
  }, [user?.id]);

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const requestCashWithdrawal = async () => {
    if (!user) return;

    // Check if user is paid type
    if (!user.isPaid) {
      setError('Cash withdrawal is only available for paid users');
      return;
    }

    const amount = prompt('Enter withdrawal amount:');
    if (!amount) return;

    const withdrawalAmount = parseInt(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (withdrawalAmount > user.cash) {
      alert('Insufficient cash balance');
      return;
    }

    try {
      await addDoc(collection(db, 'requests'), {
        userId: user.id,
        username: user.username,
        type: 'withdrawal',
        amount: withdrawalAmount,
        status: 'pending',
        timestamp: new Date()
      });

      await updateDoc(doc(db, 'users', user.id), {
        cash: user.cash - withdrawalAmount
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.id,
        username: user.username,
        amount: -withdrawalAmount,
        type: 'withdrawal',
        description: 'Cash withdrawal request',
        timestamp: new Date(),
        balanceAfter: {
          points: user.points,
          cash: user.cash - withdrawalAmount
        }
      });
    } catch (error) {
      console.error('Failed to request withdrawal:', error);
      alert('Failed to process withdrawal request');
    }
  };

  const requestFBTLoan = async () => {
    if (!user) return;

    // Check if user is paid type
    if (!user.isPaid) {
      setError('FBT loan is only available for paid users');
      return;
    }

    const amount = prompt('Enter loan amount (in FBT points):');
    if (!amount) return;

    const loanAmount = parseInt(amount);
    if (isNaN(loanAmount) || loanAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const maxLoan = 1000;
    if (loanAmount > maxLoan) {
      alert(`Maximum loan amount is ${maxLoan} FBT`);
      return;
    }

    try {
      await addDoc(collection(db, 'requests'), {
        userId: user.id,
        username: user.username,
        type: 'loan',
        amount: loanAmount,
        status: 'pending',
        timestamp: new Date()
      });
      setMessage('Loan request submitted successfully');
    } catch (error) {
      console.error('Failed to request loan:', error);
      alert('Failed to process loan request');
    }
  };

  const updateGcashNumber = async () => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.id), {
        gcashNumber
      });
      setIsEditingGcash(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4 p-3 md:space-y-6 md:p-6">
      <Tabs.Root defaultValue="account">
        <Tabs.List className="mb-4 flex space-x-2 rounded-lg bg-gray-100 p-1">
          <Tabs.Trigger
            value="account"
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
          >
            Account
          </Tabs.Trigger>
          <Tabs.Trigger
            value="vip"
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
          >
            VIP System
          </Tabs.Trigger>
          <Tabs.Trigger
            value="inbox"
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
          >
            Inbox
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="account">
          <div className="grid gap-4 md:grid-cols-2">
            {/* User Info Card */}
            <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
              <h2 className="mb-4 text-lg font-semibold md:text-xl">Account Information</h2>
              <div className="space-y-3">
                <p className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 md:text-base">Username:</span>
                  <span className="text-sm md:text-base">{user.username}</span>
                </p>
                
                {/* Account Type Badge */}
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 md:text-base">Account Type:</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      user.isPaid 
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.isPaid ? 'Paid' : 'Free'}
                    </span>
                  </div>
                  {!user.isPaid && (
                    <p className="mt-2 text-xs text-gray-500">
                      Upgrade to Paid account to access withdrawal and loan features
                    </p>
                  )}
                </div>
                
                {/* Points and Cash - Grid on mobile */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
                    <div className="flex items-center justify-between">
                      <CircleDollarSign className="h-4 w-4 text-blue-600 md:h-5 md:w-5" />
                      <span className="text-sm font-medium text-blue-900 md:text-base">FBT Points</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-blue-700 md:text-xl">{user.points}</p>
                  </div>
                  
                  <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-3">
                    <div className="flex items-center justify-between">
                      <Wallet className="h-4 w-4 text-green-600 md:h-5 md:w-5" />
                      <span className="text-sm font-medium text-green-900 md:text-base">Cash</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-green-700 md:text-xl">{user.cash || 0}</p>
                  </div>
                </div>

                {/* Referral Code */}
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 md:text-base">Referral Code:</span>
                    <code className="rounded bg-white px-2 py-1 text-sm md:text-base">
                      {user.referralCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyReferralCode}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {copied && (
                      <span className="text-xs text-green-600 md:text-sm">Copied!</span>
                    )}
                  </div>
                </div>

                {/* GCash Number */}
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="block text-sm font-medium text-gray-600 md:text-base">GCash Number:</span>
                  {isEditingGcash ? (
                    <div className="mt-2 flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">
                      <input
                        type="text"
                        value={gcashNumber}
                        onChange={(e) => setGcashNumber(e.target.value)}
                        placeholder="Enter GCash number"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1 text-sm"
                      />
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={updateGcashNumber}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGcashNumber(user.gcashNumber || '');
                            setIsEditingGcash(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm md:text-base">{user.gcashNumber || 'Not set'}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingGcash(true)}
                      >
                        {user.gcashNumber ? 'Edit' : 'Add'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Stack on mobile */}
                <div className="mt-4 grid grid-cols-1 gap-2 md:flex md:space-x-4">
                  <Button
                    onClick={requestCashWithdrawal}
                    className="w-full bg-green-600 hover:bg-green-700 md:w-auto"
                    disabled={!user.isPaid}
                  >
                    {!user.isPaid && <Lock className="mr-2 h-4 w-4" />}
                    Withdraw Cash
                  </Button>
                  <Button
                    onClick={requestFBTLoan}
                    className="w-full bg-blue-600 hover:bg-blue-700 md:w-auto"
                    disabled={!user.isPaid}
                  >
                    {!user.isPaid && <Lock className="mr-2 h-4 w-4" />}
                    Request FBT Loan
                  </Button>
                </div>

                {/* Locked Features Message */}
                {!user.isPaid && (
                  <div className="mt-2 rounded-lg bg-yellow-50 p-3">
                    <div className="flex items-start space-x-2">
                      <Lock className="h-5 w-5 text-yellow-600" />
                      <p className="text-sm text-yellow-700">
                        Some features are locked. Contact an admin to upgrade your account.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Requests History */}
            <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
              <div className="mb-4 flex items-center space-x-2">
                <History className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold md:text-xl">Requests History</h2>
              </div>
              
              {requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-lg border p-3 md:p-4"
                    >
                      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                        <div>
                          <p className="text-sm font-medium md:text-base">
                            {request.type === 'withdrawal' ? 'Cash Withdrawal' : 'FBT Loan'}
                          </p>
                          <p className="text-xs text-gray-600 md:text-sm">
                            Amount: {request.amount} {request.type === 'withdrawal' ? 'Cash' : 'FBT'}
                          </p>
                          <p className="text-xs text-gray-600 md:text-sm">
                            {request.timestamp.toLocaleString()}
                          </p>
                        </div>
                        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold md:mt-0 md:text-sm ${
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'declined' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-500 md:text-base">No requests yet</p>
                </div>
              )}
            </div>

            {/* Referrals Card */}
            <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
              <div className="mb-4 flex items-center space-x-2">
                <Users className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold md:text-xl">Your Referrals</h2>
              </div>
              
              {referrals.length > 0 ? (
                <div className="grid gap-2 md:gap-3">
                  {referrals.map((ref, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-gray-50 p-3"
                    >
                      <span className="text-sm md:text-base">{ref.username}</span>
                      <span className="text-xs text-gray-600 md:text-sm">
                        {ref.referrals} referrals
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                  <div className="text-center">
                    <AlertCircle className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                    <p className="text-sm text-gray-500 md:text-base">
                      No referrals yet. Share your referral code to earn points!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Transaction History */}
            <div className="col-span-full overflow-hidden rounded-lg bg-white p-4 shadow-md md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History className="h-5 w-5 text-gray-500" />
                  <h2 className="text-lg font-semibold md:text-xl">Transaction History</h2>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Balance After
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                            {transaction.timestamp.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              transaction.amount > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`text-sm font-medium ${
                              transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
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
                          <td className="px-4 py-3">
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
        </Tabs.Content>

        <Tabs.Content value="vip">
          <VIPPanel />
        </Tabs.Content>

        <Tabs.Content value="inbox">
          <InboxPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default UserPanel