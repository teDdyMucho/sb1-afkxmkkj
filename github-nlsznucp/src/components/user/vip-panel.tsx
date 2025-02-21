import { useState, useEffect } from 'react';
import { useVIPStore } from '@/store/vip-store';
import { Button } from '@/components/ui/button';
import { Crown, Users, Plus, Trash2, Copy, Check } from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';

interface VIPRequest {
  id: string;
  type: 'vip_upgrade';
  currentLevel: number;
  targetLevel: number;
  status: 'pending' | 'approved' | 'declined';
  timestamp: Date;
}

const VIP_COSTS = {
  1: 100,
  2: 300,
  3: 600,
  4: 1200,
  5: 2400
};

export function VIPPanel() {
  const { user } = useAuthStore();
  const vipStore = useVIPStore();
  const [copiedCode, setCopiedCode] = useState(false);
  const [upgradeRequest, setUpgradeRequest] = useState<VIPRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [vipData, setVipData] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Listen to user's VIP data
    const unsubUser = onSnapshot(doc(db, 'users', user.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setVipData({
          vipLevel: data.vipLevel || 1,
          referrals: data.referrals || {},
          maxReferrals: data.maxReferrals || {},
          rewards: data.rewards || {}
        });
      }
    });

    // Listen to user's VIP upgrade requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('userId', '==', user.id),
      where('type', '==', 'vip_upgrade'),
      where('status', '==', 'pending')
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const request = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
          timestamp: snapshot.docs[0].data().timestamp.toDate()
        } as VIPRequest;
        setUpgradeRequest(request);
      } else {
        setUpgradeRequest(null);
      }
    });

    return () => {
      unsubUser();
      unsubRequests();
    };
  }, [user?.id]);

  const copyReferralCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUpgrade = async (targetLevel: number) => {
    if (isProcessing || !user) return;

    const cost = VIP_COSTS[targetLevel as keyof typeof VIP_COSTS];
    if (!confirm(`Request upgrade to VIP${targetLevel}? Cost: ${cost} PHP`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await vipStore.requestUpgrade(user.id, targetLevel);
      alert('Upgrade request submitted! Please wait for admin approval.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to request upgrade');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderVIPLevel = (level: number) => {
    if (!vipData || level > vipData.vipLevel) return null;

    const vipKey = `vip${level}` as keyof typeof vipData.referrals;
    const referrals = vipData.referrals[vipKey] || [];
    const maxReferrals = vipData.maxReferrals[vipKey] || 10;
    const reward = VIP_COSTS[level as keyof typeof VIP_COSTS];

    return (
      <div key={`vip-level-${level}`} className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <h2 className="text-xl font-bold">VIP {level}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">
              {referrals.length} / {maxReferrals} Slots
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 p-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-gray-700">
              Reward per Slot: {reward} FBT ({reward} PHP)
            </p>
            <p className="text-sm font-medium text-gray-700">
              Total FBT: {referrals.length * reward}
            </p>
            <p className="text-sm font-medium text-gray-700">
              Total PHP: {referrals.length * reward}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: maxReferrals }).map((_, index) => (
            <div
              key={`slot-${level}-${index}`}
              className={`flex h-16 items-center justify-center rounded-lg border-2 p-2 text-center text-sm ${
                index < referrals.length
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              {index < referrals.length ? (
                <span className="break-all text-blue-700">{referrals[index]}</span>
              ) : (
                <span className="text-gray-400">Empty Slot</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!vipData) return null;

  return (
    <div className="space-y-6">
      {/* Referral Code */}
      <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white shadow-md">
        <h2 className="mb-4 text-2xl font-bold">Your Referral Code</h2>
        <div className="flex items-center space-x-2">
          <code className="flex-1 rounded-lg bg-white/20 px-4 py-2 font-mono">
            {user?.referralCode}
          </code>
          <Button
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={copyReferralCode}
          >
            {copiedCode ? (
              <Check className="h-5 w-5" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* VIP Costs Info */}
      <div className="rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-amber-900">VIP Level Costs</h3>
        <div className="grid gap-3 md:grid-cols-5">
          {Object.entries(VIP_COSTS).map(([level, cost]) => (
            <div key={level} className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-900">VIP {level}</span>
                <span className="text-amber-600">{cost} PHP</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Request Status */}
      {upgradeRequest && (
        <div className="rounded-lg bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-yellow-800">
                Pending VIP Upgrade Request
              </h3>
              <p className="mt-1 text-sm text-yellow-600">
                Requesting upgrade from VIP{upgradeRequest.currentLevel} to VIP{upgradeRequest.targetLevel}
              </p>
            </div>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
              Pending Approval
            </span>
          </div>
        </div>
      )}

      {/* VIP Levels */}
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map(level => renderVIPLevel(level))}
      </div>

      {/* Upgrade Buttons */}
      {!upgradeRequest && vipData.vipLevel < 5 && (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleUpgrade(vipData.vipLevel + 1)}
            disabled={isProcessing}
            className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white hover:from-yellow-600 hover:to-amber-600"
          >
            <Crown className="mr-2 h-4 w-4" />
            Request VIP {vipData.vipLevel + 1} Upgrade
          </Button>
        </div>
      )}
    </div>
  );
}