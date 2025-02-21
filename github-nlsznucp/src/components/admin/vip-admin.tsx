import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Users, Plus, Trash2, Search, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { doc, collection, query, where, getDocs, updateDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as Dialog from '@radix-ui/react-dialog';
import { DEFAULT_VIP_DATA } from '@/store/vip-store';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface VIPUser {
  id: string;
  username: string;
  vipLevel: number;
  referralCode: string;
  referrals: {
    vip1: string[];
    vip2: string[];
    vip3: string[];
    vip4: string[];
    vip5: string[];
  };
  maxReferrals: {
    vip1: number;
    vip2: number;
    vip3: number;
    vip4: number;
    vip5: number;
  };
  rewards: {
    vip1: number;
    vip2: number;
    vip3: number;
    vip4: number;
    vip5: number;
  };
}

interface VIPRequest {
  id: string;
  userId: string;
  username: string;
  type: 'vip_upgrade';
  currentLevel: number;
  targetLevel: number;
  status: 'pending' | 'approved' | 'declined';
  timestamp: Date;
}

export function VIPAdmin({ setError, setMessage }: Props) {
  const [vipUsers, setVipUsers] = useState<VIPUser[]>([]);
  const [vipRequests, setVipRequests] = useState<VIPRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<VIPUser | null>(null);
  const [selectedVipLevel, setSelectedVipLevel] = useState<number | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // Listen to VIP users
    const vipQuery = query(
      collection(db, 'users'),
      where('vipLevel', '>', 0)
    );

    const unsubVip = onSnapshot(vipQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username,
          vipLevel: data.vipLevel || 1,
          referralCode: data.referralCode,
          referrals: {
            ...DEFAULT_VIP_DATA.referrals,
            ...data.referrals
          },
          maxReferrals: {
            ...DEFAULT_VIP_DATA.maxReferrals,
            ...data.maxReferrals
          },
          rewards: {
            ...DEFAULT_VIP_DATA.rewards,
            ...data.rewards
          }
        } as VIPUser;
      });
      setVipUsers(users.sort((a, b) => b.vipLevel - a.vipLevel));
    });

    // Listen to VIP upgrade requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('type', '==', 'vip_upgrade'),
      where('status', '==', 'pending')
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as VIPRequest[];
      setVipRequests(requests.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });

    return () => {
      unsubVip();
      unsubRequests();
    };
  }, []);

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddSlot = async () => {
    if (!selectedUser || selectedVipLevel === null || !newSlotName.trim()) return;

    try {
      const vipKey = `vip${selectedVipLevel}` as keyof VIPUser['referrals'];
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Get current referrals for this VIP level
      const currentReferrals = selectedUser.referrals[vipKey] || [];
      const maxReferrals = selectedUser.maxReferrals[vipKey] || DEFAULT_VIP_DATA.maxReferrals[vipKey];

      if (currentReferrals.length >= maxReferrals) {
        throw new Error(`Maximum slots (${maxReferrals}) reached for VIP${selectedVipLevel}`);
      }

      // Add new slot name to referrals
      await updateDoc(userRef, {
        [`referrals.${vipKey}`]: [...currentReferrals, newSlotName.trim()]
      });

      setMessage('Slot added successfully');
      setNewSlotName('');
      setIsAddingSlot(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add slot');
      console.error(error);
    }
  };

  const handleDeleteSlot = async (userId: string, vipLevel: number, slotIndex: number) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;

    try {
      const vipKey = `vip${vipLevel}` as keyof VIPUser['referrals'];
      const userRef = doc(db, 'users', userId);
      const user = vipUsers.find(u => u.id === userId);
      
      if (!user) return;

      const currentReferrals = [...(user.referrals[vipKey] || [])];
      currentReferrals.splice(slotIndex, 1);

      await updateDoc(userRef, {
        [`referrals.${vipKey}`]: currentReferrals
      });

      setMessage('Slot deleted successfully');
    } catch (error) {
      setError('Failed to delete slot');
      console.error(error);
    }
  };

  const handleResetVIP = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s VIP data? This will remove all slots and set VIP level to 1.')) {
      return;
    }

    setIsResetting(true);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        vipLevel: 1,
        referrals: DEFAULT_VIP_DATA.referrals,
        maxReferrals: DEFAULT_VIP_DATA.maxReferrals,
        rewards: DEFAULT_VIP_DATA.rewards
      });
      setMessage('VIP data reset successfully');
    } catch (error) {
      setError('Failed to reset VIP data');
      console.error(error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleUpgradeRequest = async (request: VIPRequest, approve: boolean) => {
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'requests', request.id);
      const userRef = doc(db, 'users', request.userId);

      if (approve) {
        // Calculate new max referrals (add 10 slots for each level below current)
        const newMaxReferrals = { ...DEFAULT_VIP_DATA.maxReferrals };
        for (let level = 1; level < request.targetLevel; level++) {
          const vipKey = `vip${level}` as keyof typeof newMaxReferrals;
          newMaxReferrals[vipKey] += 10;
        }

        // Update user's VIP level and max referrals
        batch.update(userRef, {
          vipLevel: request.targetLevel,
          maxReferrals: newMaxReferrals
        });
      }

      // Update request status
      batch.update(requestRef, {
        status: approve ? 'approved' : 'declined',
        processedAt: new Date()
      });

      await batch.commit();
      setMessage(`VIP upgrade request ${approve ? 'approved' : 'declined'}`);
    } catch (error) {
      setError(`Failed to ${approve ? 'approve' : 'decline'} upgrade request`);
      console.error(error);
    }
  };

  const filteredUsers = searchQuery
    ? vipUsers.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.referralCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : vipUsers;

  return (
    <div className="space-y-6">
      {/* VIP Upgrade Requests */}
      {vipRequests.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold">Pending VIP Upgrades</h2>
          <div className="space-y-4">
            {vipRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
                <div>
                  <p className="font-medium">{request.username}</p>
                  <p className="text-sm text-gray-600">
                    Requesting upgrade from VIP{request.currentLevel} to VIP{request.targetLevel}
                  </p>
                  <p className="text-xs text-gray-500">{request.timestamp.toLocaleString()}</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleUpgradeRequest(request, true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleUpgradeRequest(request, false)}
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Crown className="h-8 w-8 text-yellow-500" />
          <h2 className="text-2xl font-bold">VIP Members</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border pl-9 pr-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* VIP Users List */}
      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <div key={user.id} className="overflow-hidden rounded-lg bg-white shadow">
            {/* User Header */}
            <div className="flex items-center justify-between bg-gray-50 p-4">
              <div 
                className="flex cursor-pointer items-center space-x-4"
                onClick={() => toggleUserExpanded(user.id)}
              >
                <Crown className="h-5 w-5 text-yellow-500" />
                <div>
                  <h3 className="font-medium">{user.username}</h3>
                  <p className="text-sm text-gray-500">
                    VIP Level {user.vipLevel} • Code: {user.referralCode}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResetVIP(user.id)}
                  disabled={isResetting}
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset VIP
                </Button>
                {expandedUsers.includes(user.id) ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* VIP Slots */}
            {expandedUsers.includes(user.id) && (
              <div className="divide-y divide-gray-100">
                {Array.from({ length: user.vipLevel }).map((_, index) => {
                  const level = index + 1;
                  const vipKey = `vip${level}` as keyof VIPUser['referrals'];
                  const slots = user.referrals[vipKey] || [];
                  const maxSlots = user.maxReferrals[vipKey] || DEFAULT_VIP_DATA.maxReferrals[vipKey];
                  const reward = user.rewards[vipKey] || DEFAULT_VIP_DATA.rewards[vipKey];

                  return (
                    <div key={level} className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">VIP {level} Slots</h4>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            {slots.length} / {maxSlots}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedVipLevel(level);
                            setIsAddingSlot(true);
                          }}
                          disabled={slots.length >= maxSlots}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add Slot
                        </Button>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                        {slots.map((slot, slotIndex) => (
                          <div
                            key={slotIndex}
                            className="flex items-center justify-between rounded-lg border bg-gray-50 p-2"
                          >
                            <span className="text-sm">{slot}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDeleteSlot(user.id, level, slotIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {Array.from({ length: maxSlots - slots.length }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="flex h-10 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50"
                          >
                            <span className="text-sm text-gray-400">Empty Slot</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-500">No VIP members found</p>
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog.Root open={isAddingSlot} onOpenChange={setIsAddingSlot}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
            <Dialog.Title className="mb-4 text-xl font-semibold">
              Add VIP{selectedVipLevel} Slot
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slot Name
                </label>
                <input
                  type="text"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Enter slot name"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingSlot(false);
                    setNewSlotName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSlot}
                  disabled={!newSlotName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add Slot
                </Button>
              </div>
            </div>

            <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}