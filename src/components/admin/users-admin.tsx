import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDoc, writeBatch, deleteDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserLogsDialog } from './user-logs-dialog';
import { SendMessageDialog } from './send-message-dialog';
import { Trash2, Ban, MessageSquare, Search, DollarSign, Users, Settings } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

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

interface ReferralSettings {
  referralBonus: number;
  maxReferrals: number;
  enabled: boolean;
}

function ReferralSettingsDialog({ 
  open, 
  onOpenChange,
  settings,
  onSave
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReferralSettings;
  onSave: (settings: ReferralSettings) => Promise<void>;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await onSave(localSettings);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            Referral System Settings
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Enable Referral System</span>
              <button
                type="button"
                onClick={() => setLocalSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Referral Bonus (FBT Points)
              </label>
              <input
                type="number"
                value={localSettings.referralBonus}
                onChange={(e) => setLocalSettings(prev => ({ 
                  ...prev, 
                  referralBonus: parseInt(e.target.value) || 0 
                }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Maximum Referrals per User
              </label>
              <input
                type="number"
                value={localSettings.maxReferrals}
                onChange={(e) => setLocalSettings(prev => ({ 
                  ...prev, 
                  maxReferrals: parseInt(e.target.value) || 0 
                }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                min="0"
                required
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing}
              >
                {isProcessing ? 'Saving...' : 'Save Settings'}
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

export function UsersAdmin({ setError, setMessage }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings>({
    referralBonus: 50,
    maxReferrals: 10,
    enabled: true
  });
  const [messageDialogState, setMessageDialogState] = useState<{
    open: boolean;
    userId: string;
    username: string;
  }>({
    open: false,
    userId: '',
    username: ''
  });

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

    // Listen to referral settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'referral'), (doc) => {
      if (doc.exists()) {
        setReferralSettings(doc.data() as ReferralSettings);
      }
    });

    return () => {
      unsubUsers();
      unsubSettings();
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

  const updateReferralSettings = async (newSettings: ReferralSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'referral'), newSettings);
      setMessage('Referral settings updated successfully');
    } catch (err) {
      setError('Failed to update referral settings');
      console.error(err);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Referral System Controls */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-semibold">Referral System</h2>
          </div>
          <Button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Configure</span>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-600">Status</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {referralSettings.enabled ? 'Active' : 'Disabled'}
            </p>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm font-medium text-green-600">Referral Bonus</p>
            <p className="mt-1 text-2xl font-bold text-green-900">
              {referralSettings.referralBonus} FBT
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-600">Max Referrals</p>
            <p className="mt-1 text-2xl font-bold text-purple-900">
              {referralSettings.maxReferrals} users
            </p>
          </div>
        </div>
      </div>

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

      <ReferralSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={referralSettings}
        onSave={updateReferralSettings}
      />
    </div>
  );
}