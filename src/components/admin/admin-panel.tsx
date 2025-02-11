import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Lucky2Admin } from './games/lucky2-admin';
import { BingoAdmin } from './games/bingo-admin';
import { VersusAdmin } from './games/versus-admin';
import { UsersAdmin } from './users-admin';
import { TransactionsAdmin } from './transactions-admin';
import { ProfitPanel } from './profit-panel';
import { ReferralPanel } from './referral-panel';
import { 
  AlertCircle, 
  CheckCircle2, 
  Dice1, 
  Binary, 
  Swords, 
  Users, 
  Receipt,
  TrendingUp,
  DollarSign,
  BarChart3,
  Network
} from 'lucide-react';

type AdminSection = 'lucky2' | 'bingo' | 'versus' | 'users' | 'transactions' | 'referrals';

export function AdminPanel() {
  const { user } = useAuthStore();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>('lucky2');

  if (!user?.isAdmin) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg bg-red-50 p-6 text-center">
        <div className="space-y-2">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="text-lg font-semibold text-red-700">Access denied</p>
          <p className="text-sm text-red-600">Admin privileges required</p>
        </div>
      </div>
    );
  }

  const sections = [
    { 
      id: 'lucky2', 
      label: 'Lucky2 Game', 
      icon: Dice1, 
      color: 'from-yellow-500 to-orange-500',
      description: 'Manage Lucky2 game rounds and jackpots'
    },
    { 
      id: 'bingo', 
      label: 'Bingo Game', 
      icon: Binary, 
      color: 'from-blue-500 to-indigo-500',
      description: 'Control Bingo sessions and prizes'
    },
    { 
      id: 'versus', 
      label: 'Versus Game', 
      icon: Swords, 
      color: 'from-purple-500 to-pink-500',
      description: 'Set up and manage versus matches'
    },
    { 
      id: 'users', 
      label: 'Users', 
      icon: Users, 
      color: 'from-green-500 to-emerald-500',
      description: 'Manage user accounts and permissions'
    },
    { 
      id: 'transactions', 
      label: 'Transactions', 
      icon: Receipt, 
      color: 'from-red-500 to-rose-500',
      description: 'View and track all transactions'
    },
    {
      id: 'referrals',
      label: 'Referrals',
      icon: Network,
      color: 'from-blue-500 to-purple-500',
      description: 'Manage referral system and bonuses'
    }
  ] as const;

  return (
    <div className="relative space-y-6">
      {/* Notifications - Now at the top */}
      <div className="sticky top-16 z-50 space-y-2 px-4">
        {error && (
          <div className="flex w-full animate-in fade-in slide-in-from-top items-center rounded-lg bg-red-50 p-4 shadow-lg">
            <AlertCircle className="mr-3 h-5 w-5 text-red-400" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {message && (
          <div className="flex w-full animate-in fade-in slide-in-from-top items-center rounded-lg bg-green-50 p-4 shadow-lg">
            <CheckCircle2 className="mr-3 h-5 w-5 text-green-400" />
            <p className="text-sm text-green-700">{message}</p>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">Daily Profit</p>
              <p className="mt-1 text-2xl font-bold">₱25,420</p>
            </div>
            <TrendingUp className="h-8 w-8 opacity-80" />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">Active Users</p>
              <p className="mt-1 text-2xl font-bold">142</p>
            </div>
            <Users className="h-8 w-8 opacity-80" />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">Total Bets</p>
              <p className="mt-1 text-2xl font-bold">1,284</p>
            </div>
            <DollarSign className="h-8 w-8 opacity-80" />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">Win Rate</p>
              <p className="mt-1 text-2xl font-bold">32.4%</p>
            </div>
            <BarChart3 className="h-8 w-8 opacity-80" />
          </div>
        </div>
      </div>

      {/* Admin Functions Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ id, label, icon: Icon, color, description }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`group relative overflow-hidden rounded-xl p-6 text-left transition-all hover:shadow-lg ${
              activeSection === id 
                ? `bg-gradient-to-br ${color} text-white` 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="relative z-10 flex items-center space-x-4">
              <div className={`rounded-full ${
                activeSection === id 
                  ? 'bg-white/20' 
                  : `bg-gradient-to-br ${color} text-white`
              } p-3`}>
                <Icon className="h-8 w-8" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${
                  activeSection === id ? 'text-white' : 'text-gray-900'
                }`}>
                  {label}
                </h3>
                <p className={`mt-1 text-sm ${
                  activeSection === id ? 'text-white/80' : 'text-gray-500'
                }`}>
                  {description}
                </p>
              </div>
            </div>
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {/* Content Section */}
      <div className="overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="p-6">
          {activeSection === 'lucky2' && (
            <Lucky2Admin setError={setError} setMessage={setMessage} />
          )}
          {activeSection === 'bingo' && (
            <BingoAdmin setError={setError} setMessage={setMessage} />
          )}
          {activeSection === 'versus' && (
            <VersusAdmin setError={setError} setMessage={setMessage} />
          )}
          {activeSection === 'users' && (
            <UsersAdmin setError={setError} setMessage={setMessage} />
          )}
          {activeSection === 'transactions' && (
            <TransactionsAdmin />
          )}
          {activeSection === 'referrals' && (
            <ReferralPanel />
          )}
        </div>
      </div>
    </div>
  );
}