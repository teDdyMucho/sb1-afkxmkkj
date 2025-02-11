import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Users, Settings, TrendingUp, Gift, Network } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ReferralSettings {
  enabled: boolean;
  generations: {
    [key: number]: {
      bonus: number;
      enabled: boolean;
    };
  };
  maxReferrals: number;
}

interface ReferralStats {
  totalReferrals: number;
  activeReferrers: number;
  totalBonusesPaid: number;
  referralsByGeneration: {
    [key: number]: number;
  };
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
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            Referral System Settings
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* System Status */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">System Status</h3>
                  <p className="text-sm text-gray-600">Enable or disable the entire referral system</p>
                </div>
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
            </div>

            {/* Generation Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Generation Bonuses</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5].map((gen) => (
                  <div key={gen} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-medium">Generation {gen}</span>
                      <button
                        type="button"
                        onClick={() => setLocalSettings(prev => ({
                          ...prev,
                          generations: {
                            ...prev.generations,
                            [gen]: {
                              ...prev.generations[gen],
                              enabled: !prev.generations[gen]?.enabled
                            }
                          }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          localSettings.generations[gen]?.enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            localSettings.generations[gen]?.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Bonus Points
                      </label>
                      <input
                        type="number"
                        value={localSettings.generations[gen]?.bonus || 0}
                        onChange={(e) => setLocalSettings(prev => ({
                          ...prev,
                          generations: {
                            ...prev.generations,
                            [gen]: {
                              ...prev.generations[gen],
                              bonus: parseInt(e.target.value) || 0
                            }
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                        min="0"
                        disabled={!localSettings.generations[gen]?.enabled}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Max Referrals */}
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

export function ReferralPanel() {
  const [settings, setSettings] = useState<ReferralSettings>({
    enabled: true,
    generations: {
      1: { bonus: 50, enabled: true },
      2: { bonus: 25, enabled: true },
      3: { bonus: 10, enabled: true },
      4: { bonus: 5, enabled: true },
      5: { bonus: 2, enabled: true }
    },
    maxReferrals: 10
  });
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    activeReferrers: 0,
    totalBonusesPaid: 0,
    referralsByGeneration: {}
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Listen to referral settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'referral'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as ReferralSettings);
      }
    });

    // Calculate referral statistics
    const calculateStats = async () => {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      let totalRefs = 0;
      let activeRefs = 0;
      let totalBonuses = 0;
      const genStats: { [key: number]: number } = {};

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.referrals?.length > 0) {
          totalRefs += userData.referrals.length;
          activeRefs++;
          
          // Count referrals by generation
          for (let i = 1; i <= 5; i++) {
            const genRefs = userData[`generation${i}Referrals`]?.length || 0;
            genStats[i] = (genStats[i] || 0) + genRefs;
          }
        }
        if (userData.referralBonusesEarned) {
          totalBonuses += userData.referralBonusesEarned;
        }
      });

      setStats({
        totalReferrals: totalRefs,
        activeReferrers: activeRefs,
        totalBonusesPaid: totalBonuses,
        referralsByGeneration: genStats
      });
    };

    calculateStats();

    return () => {
      unsubSettings();
    };
  }, []);

  const updateSettings = async (newSettings: ReferralSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'referral'), newSettings);
    } catch (err) {
      console.error('Failed to update referral settings:', err);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Network className="h-8 w-8 text-blue-500" />
          <h2 className="text-2xl font-semibold">Referral System</h2>
        </div>
        <Button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center space-x-2"
        >
          <Settings className="h-4 w-4" />
          <span>Configure</span>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
          <div className="flex items-center justify-between">
            <Users className="h-8 w-8 text-blue-500" />
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
              settings.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {settings.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-blue-600">Total Referrals</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{stats.totalReferrals}</p>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 p-4">
          <TrendingUp className="h-8 w-8 text-purple-500" />
          <p className="mt-2 text-sm font-medium text-purple-600">Active Referrers</p>
          <p className="mt-1 text-2xl font-bold text-purple-900">{stats.activeReferrers}</p>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4">
          <Gift className="h-8 w-8 text-green-500" />
          <p className="mt-2 text-sm font-medium text-green-600">Total Bonuses Paid</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{stats.totalBonusesPaid} FBT</p>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
          <Settings className="h-8 w-8 text-yellow-500" />
          <p className="mt-2 text-sm font-medium text-yellow-600">Max Referrals</p>
          <p className="mt-1 text-2xl font-bold text-yellow-900">{settings.maxReferrals}</p>
        </div>
      </div>

      {/* Generation Stats */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold">Generation Statistics</h3>
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((gen) => (
            <div
              key={gen}
              className={`rounded-lg border p-4 ${
                settings.generations[gen]?.enabled
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Gen {gen}</span>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  settings.generations[gen]?.enabled
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {settings.generations[gen]?.enabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Bonus</span>
                  <span className="font-medium">{settings.generations[gen]?.bonus} FBT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Referrals</span>
                  <span className="font-medium">{stats.referralsByGeneration[gen] || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ReferralSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSave={updateSettings}
      />
    </div>
  );
}