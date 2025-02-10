import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { collection, query, where, getDocs, doc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateReferralCode } from '@/lib/utils';
import { AuthPanel } from '@/components/auth/auth-panel';
import { UserPanel } from '@/components/user/user-panel';
import { GamePanel } from '@/components/games/game-panel';
import { AdminPanel } from '@/components/admin/admin-panel';
import { Header } from '@/components/header';
import { HomePanel } from '@/components/home/home-panel';
import { ChatBubble } from '@/components/chat/chat-bubble';
import { MessageNotification } from '@/components/notifications/message-notification';
import * as Dialog from '@radix-ui/react-dialog';
import { X, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ActivePanel = 'home' | 'user' | 'game' | 'admin' | null;

interface BetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  odds: number;
  prizePool: number;
  onBet: (amount: number) => Promise<void>;
}

function BetDialog({ open, onOpenChange, teamName, odds, prizePool, onBet }: BetDialogProps) {
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuthStore();
  const [potentialWin, setPotentialWin] = useState(0);

  useEffect(() => {
    if (amount && odds) {
      const betAmount = parseInt(amount);
      if (!isNaN(betAmount)) {
        const winnings = Math.floor(betAmount * odds * 0.9);
        setPotentialWin(winnings);
      }
    } else {
      setPotentialWin(0);
    }
  }, [amount, odds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const betAmount = parseInt(amount);
    if (!betAmount || betAmount < 10) return;

    setIsProcessing(true);
    try {
      await onBet(betAmount);
      onOpenChange(false);
      setAmount('');
    } catch (error) {
      console.error('Bet error:', error);
      alert(error instanceof Error ? error.message : 'Failed to place bet');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 shadow-lg md:p-6">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            Place Bet on {teamName}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Bet Amount (min. 10 FBT)
              </label>
              <input
                type="number"
                min="10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter bet amount"
                disabled={isProcessing}
              />
              {amount && (
                <div className="mt-2 space-y-1">
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-800">
                      Current Odds: {odds.toFixed(2)}x
                    </p>
                    <p className="text-lg font-bold text-green-900">
                      Potential Win: {potentialWin.toLocaleString()} FBT
                    </p>
                    <p className="text-xs text-green-600">
                      (after 10% platform fee)
                    </p>
                  </div>
                  <p className="text-sm text-blue-600">
                    Current Prize Pool: {prizePool.toLocaleString()} FBT
                  </p>
                </div>
              )}
              <p className="mt-2 text-sm text-gray-600">
                Your balance: {user?.points || 0} FBT
              </p>
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
                disabled={isProcessing || !amount || parseInt(amount) < 10 || parseInt(amount) > (user?.points || 0)}
              >
                {isProcessing ? 'Processing...' : 'Place Bet'}
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

function App() {
  const { user } = useAuthStore();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<{
    gameId: string;
    teamId: 1 | 2;
    teamName: string;
    odds: number;
    prizePool: number;
  } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // Initialize admin account if needed
    const createAdminIfNotExists = async () => {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", "admin"));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        await setDoc(doc(collection(db, "users")), {
          username: "admin",
          password: "admin",
          referralCode: generateReferralCode(),
          points: 0,
          cash: 0,
          isAdmin: true,
          approved: true,
          createdAt: new Date()
        });
      }
    };

    createAdminIfNotExists();
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1) as ActivePanel;
      if (hash === 'home' || hash === 'user' || hash === 'game' || (hash === 'admin' && user?.isAdmin)) {
        setActivePanel(hash);
      } else {
        setActivePanel('home');
      }
    };

    // Set initial panel based on current hash
    handleHash();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [user?.isAdmin]);

  if (!user) {
    return <AuthPanel />;
  }

  const handleBetClick = (gameId: string, teamId: 1 | 2, teamName: string, odds: number, prizePool: number) => {
    setSelectedBet({ gameId, teamId, teamName, odds, prizePool });
    setBetDialogOpen(true);
  };

  const handlePlaceBet = async (amount: number) => {
    if (!selectedBet || !user) return;

    try {
      await runTransaction(db, async (transaction) => {
        // Check if user already has a bet on this game
        const existingBetsQuery = query(
          collection(db, 'versusBets'),
          where('gameId', '==', selectedBet.gameId),
          where('userId', '==', user.id),
          where('status', '==', 'pending')
        );
        const existingBetsSnapshot = await getDocs(existingBetsQuery);
        
        if (!existingBetsSnapshot.empty) {
          throw new Error('You already have a bet on this game');
        }

        // Get user document
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        if (userData.points < amount) {
          throw new Error('Insufficient points');
        }

        // Get game document
        const gameRef = doc(db, 'versusGames', selectedBet.gameId);
        const gameDoc = await transaction.get(gameRef);
        
        if (!gameDoc.exists()) {
          throw new Error('Game not found');
        }

        const gameData = gameDoc.data();
        if (gameData.status !== 'open') {
          throw new Error('Game is not open for betting');
        }

        // Calculate new total bets and update odds
        const team1Total = selectedBet.teamId === 1 
          ? (gameData.totalBets1 || 0) + amount 
          : (gameData.totalBets1 || 0);
        const team2Total = selectedBet.teamId === 2 
          ? (gameData.totalBets2 || 0) + amount 
          : (gameData.totalBets2 || 0);

        // Calculate new odds based on bet distribution
        const totalBets = team1Total + team2Total;
        const MIN_ODDS = 1.1;
        const MAX_ODDS = 10.0;
        const HOUSE_EDGE = 0.1; // 10% house edge

        let team1Odds = 2.0;
        let team2Odds = 2.0;

        if (totalBets > 0) {
          const team1Ratio = team1Total / totalBets;
          const team2Ratio = team2Total / totalBets;

          // Apply house edge and calculate true odds
          team1Odds = Math.min(MAX_ODDS, Math.max(MIN_ODDS, (1 / team1Ratio) * (1 + HOUSE_EDGE)));
          team2Odds = Math.min(MAX_ODDS, Math.max(MIN_ODDS, (1 / team2Ratio) * (1 + HOUSE_EDGE)));
        }

        const potentialWin = Math.floor(amount * (selectedBet.teamId === 1 ? team1Odds : team2Odds) * 0.9);

        // Create bet
        const betRef = doc(collection(db, 'versusBets'));
        transaction.set(betRef, {
          gameId: selectedBet.gameId,
          userId: user.id,
          username: user.username,
          team: selectedBet.teamId,
          amount,
          odds: selectedBet.teamId === 1 ? team1Odds : team2Odds,
          potentialWin,
          status: 'pending',
          timestamp: new Date()
        });

        // Update user's points
        transaction.update(userRef, {
          points: userData.points - amount
        });

        // Update game's prize pool and odds
        transaction.update(gameRef, {
          prizePool: (gameData.prizePool || 0) + amount,
          totalBets1: team1Total,
          totalBets2: team2Total,
          odds: {
            team1: Number(team1Odds.toFixed(2)),
            team2: Number(team2Odds.toFixed(2))
          }
        });

        // Add transaction record
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: user.id,
          username: user.username,
          amount: -amount,
          type: 'versus_bet',
          description: `Bet on ${selectedBet.teamName}`,
          timestamp: new Date()
        });

        // Update local user state
        useAuthStore.setState(state => ({
          ...state,
          user: {
            ...state.user!,
            points: userData.points - amount
          }
        }));
      });
    } catch (error) {
      console.error('Place bet error:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="space-y-6 md:space-y-8">
          {activePanel === 'home' && <HomePanel onBetClick={handleBetClick} />}
          {activePanel === 'user' && <UserPanel />}
          {activePanel === 'game' && <GamePanel />}
          {activePanel === 'admin' && user.isAdmin && <AdminPanel />}
        </div>
      </main>

      {/* Offline Status */}
      {isOffline && (
        <div className="fixed bottom-20 left-4 z-50 flex items-center space-x-2 rounded-lg bg-yellow-100 px-4 py-2 text-yellow-800 shadow-lg md:bottom-24">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">Offline mode - Changes will sync when connection is restored</span>
        </div>
      )}

      {/* Bet Dialog */}
      {selectedBet && (
        <BetDialog
          open={betDialogOpen}
          onOpenChange={setBetDialogOpen}
          teamName={selectedBet.teamName}
          odds={selectedBet.odds}
          prizePool={selectedBet.prizePool}
          onBet={handlePlaceBet}
        />
      )}
      
      <ChatBubble />
      <MessageNotification />
    </div>
  );
}

export default App;