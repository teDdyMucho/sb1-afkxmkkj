import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDoc, writeBatch, deleteDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserLogsDialog } from './user-logs-dialog';
import { SendMessageDialog } from './send-message-dialog';
import { Trash2, Ban, MessageSquare, Search, DollarSign, CircleDollarSign } from 'lucide-react';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface User {
  id: string;
  username: string;
  points: number;
  cash: number;
  referralCode: string;
  referrals: string[];
  approved: boolean;
  disabled?: boolean;
  gcashNumber?: string;
  isPaid?: boolean;
}

interface Request {
  id: string;
  userId: string;
  username: string;
  type: 'withdrawal' | 'loan';
  amount: number;
  status: 'pending' | 'approved' | 'declined';
  timestamp: Date;
}

export function UsersAdmin({ setError, setMessage }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [messageDialogState, setMessageDialogState] = useState<{
    open: boolean;
    userId: string;
    username: string;
  }>({
    open: false,
    userId: '',
    username: ''
  });
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    // Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersList);
      setFilteredUsers(usersList);
    });

    // Listen to requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const requestsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as Request[];
      setRequests(requestsList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });

    return () => {
      unsubUsers();
      unsubRequests();
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const toggleUserType = async (userId: string, currentIsPaid: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isPaid: !currentIsPaid
      });
      setMessage(`User type updated to ${!currentIsPaid ? 'Paid' : 'Free'}`);
    } catch (err) {
      setError('Failed to update user type');
      console.error(err);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      const batch = writeBatch(db);
      
      batch.update(userRef, { approved: true });

      if (userData.referralPending && userData.referrerId) {
        const referrerRef = doc(db, 'users', userData.referrerId);
        const referrerDoc = await getDoc(referrerRef);
        
        if (referrerDoc.exists()) {
          const referrerData = referrerDoc.data();
          
          batch.update(referrerRef, {
            points: (referrerData.points || 0) + 50,
            referrals: [...(referrerData.referrals || []), userData.username]
          });

          const transactionRef = doc(collection(db, 'transactions'));
          batch.set(transactionRef, {
            userId: userData.referrerId,
            username: referrerData.username,
            amount: 50,
            type: 'referral_bonus',
            description: `Referral bonus for ${userData.username}`,
            timestamp: new Date()
          });

          batch.update(userRef, { referralPending: false });
        }
      }

      await batch.commit();
      setMessage('User approved successfully');
    } catch (err) {
      setError('Failed to approve user');
      console.error(err);
    }
  };

  const toggleDisableUser = async (userId: string, currentDisabledState: boolean) => {
    if (!confirm(`Are you sure you want to ${currentDisabledState ? 'enable' : 'disable'} this user?`)) {
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        disabled: !currentDisabledState
      });
      setMessage(`User ${currentDisabledState ? 'enabled' : 'disabled'} successfully`);
    } catch (err) {
      setError(`Failed to ${currentDisabledState ? 'enable' : 'disable'} user`);
      console.error(err);
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to permanently delete user ${username}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));

      await addDoc(collection(db, 'transactions'), {
        userId,
        username,
        type: 'user_deleted',
        description: 'User account deleted by admin',
        timestamp: new Date()
      });

      setMessage('User deleted successfully');
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  const updateUserBalance = async (userId: string, type: 'points' | 'cash') => {
    const newAmount = prompt(`Enter new ${type} amount:`);
    if (newAmount === null) return;

    const amount = parseInt(newAmount);
    if (isNaN(amount)) {
      setError('Please enter a valid number');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentAmount = userData[type] || 0;
      const difference = amount - currentAmount;

      await updateDoc(userRef, {
        [type]: increment(difference)
      });

      await addDoc(collection(db, 'transactions'), {
        userId,
        username: userData.username,
        amount: difference,
        type: `admin_${type}_update`,
        description: `Admin adjusted ${type} by ${difference >= 0 ? '+' : ''}${difference}`,
        timestamp: new Date()
      });

      setMessage(`User ${type} updated successfully`);
    } catch (err) {
      setError(`Failed to update user ${type}`);
      console.error(err);
    }
  };

  const showUserLogs = (user: User) => {
    setSelectedUser({ id: user.id, username: user.username });
    setIsLogsOpen(true);
  };

  const openMessageDialog = (userId: string, username: string) => {
    setMessageDialogState({
      open: true,
      userId,
      username
    });
  };

  const handleRequest = async (request: Request, approve: boolean) => {
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'requests', request.id);
      const userRef = doc(db, 'users', request.userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();

      if (approve) {
        if (request.type === 'withdrawal') {
          // For withdrawals, cash was already deducted when request was made
          batch.update(requestRef, {
            status: 'approved',
            processedAt: new Date()
          });
        } else if (request.type === 'loan') {
          // For loans, add FBT points
          batch.update(userRef, {
            points: increment(request.amount)
          });

          batch.update(requestRef, {
            status: 'approved',
            processedAt: new Date()
          });

          // Add transaction record
          const transactionRef = doc(collection(db, 'transactions'));
          batch.set(transactionRef, {
            userId: request.userId,
            username: request.username,
            amount: request.amount,
            type: 'loan_approved',
            description: 'FBT loan approved',
            timestamp: new Date(),
            balanceAfter: {
              points: (userData.points || 0) + request.amount,
              cash: userData.cash || 0
            }
          });
        }
      } else {
        if (request.type === 'withdrawal') {
          // Return the cash to user's balance
          batch.update(userRef, {
            cash: increment(request.amount)
          });

          // Add transaction record
          const transactionRef = doc(collection(db, 'transactions'));
          batch.set(transactionRef, {
            userId: request.userId,
            username: request.username,
            amount: request.amount,
            type: 'withdrawal_declined',
            description: 'Cash withdrawal declined - amount returned',
            timestamp: new Date(),
            balanceAfter: {
              points: userData.points || 0,
              cash: (userData.cash || 0) + request.amount
            }
          });
        }

        batch.update(requestRef, {
          status: 'declined',
          processedAt: new Date()
        });
      }

      await batch.commit();
      setMessage(`Request ${approve ? 'approved' : 'declined'} successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process request');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">Pending Requests</h2>
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col items-start justify-between space-y-4 rounded-lg border p-4 md:flex-row md:items-center md:space-y-0"
              >
                <div className="flex items-center space-x-4">
                  {request.type === 'withdrawal' ? (
                    <DollarSign className="h-8 w-8 text-green-500" />
                  ) : (
                    <CircleDollarSign className="h-8 w-8 text-blue-500" />
                  )}
                  <div>
                    <p className="font-medium">{request.username}</p>
                    <p className="text-sm text-gray-600">
                      {request.type === 'withdrawal' ? 'Cash Withdrawal' : 'FBT Loan'}: {request.amount} {request.type === 'withdrawal' ? 'Cash' : 'FBT'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex w-full space-x-2 md:w-auto">
                  <Button
                    onClick={() => handleRequest(request, true)}
                    className="flex-1 bg-green-600 hover:bg-green-700 md:flex-none"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleRequest(request, false)}
                    variant="outline"
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50 md:flex-none"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Management */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Users Management</h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-gray-300 pl-9 pr-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cash
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  GCash
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => showUserLogs(user)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    user.disabled ? 'bg-red-50' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    {user.username}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {user.points}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {user.cash || 0}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {user.gcashNumber || 'Not set'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex space-x-2">
                      {user.approved ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          Approved
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                          Pending
                        </span>
                      )}
                      {user.disabled && (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                          Disabled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleUserType(user.id, user.isPaid || false);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        user.isPaid ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          user.isPaid ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">{user.isPaid ? 'Paid' : 'Free'}</span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                      {!user.approved && (
                        <Button
                          onClick={() => approveUser(user.id)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                      )}
                      <Button
                        onClick={() => updateUserBalance(user.id, 'points')}
                        size="sm"
                      >
                        Edit Points
                      </Button>
                      <Button
                        onClick={() => updateUserBalance(user.id, 'cash')}
                        size="sm"
                      >
                        Edit Cash
                      </Button>
                      <Button
                        onClick={() => openMessageDialog(user.id, user.username)}
                        size="sm"
                        variant="outline"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        <MessageSquare className="mr-1 h-4 w-4" />
                        Message
                      </Button>
                      <Button
                        onClick={() => toggleDisableUser(user.id, user.disabled || false)}
                        size="sm"
                        variant="outline"
                        className={user.disabled ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}
                      >
                        <Ban className="mr-1 h-4 w-4" />
                        {user.disabled ? 'Enable' : 'Disable'}
                      </Button>
                      <Button
                        onClick={() => deleteUser(user.id, user.username)}
                        size="sm"
                        variant="outline"
                        className="border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <UserLogsDialog
          userId={selectedUser.id}
          username={selectedUser.username}
          open={isLogsOpen}
          onOpenChange={setIsLogsOpen}
        />
      )}

      <SendMessageDialog
        userId={messageDialogState.userId}
        username={messageDialogState.username}
        open={messageDialogState.open}
        onOpenChange={(open) => setMessageDialogState(prev => ({ ...prev, open }))}
        onMessageSent={() => {
          setMessage('Message sent successfully');
        }}
      />
    </div>
  );
}