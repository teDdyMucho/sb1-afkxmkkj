import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Users as Horse, Trophy, AlertCircle, Timer, Plus, Minus } from 'lucide-react';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface NumberBet {
  number: number;
  amount: number;
  minBet?: number;
  maxBet?: number;
}

interface HorseBet {
  id: string;
  userId: string;
  username: string;
  bets: NumberBet[];
  totalAmount: number;
  timestamp: Date;
  status: 'pending' | 'won' | 'lost';
  winningAmount?: number;
  winningType?: 'grand' | 'second' | 'third' | 'consolation';
}

interface HorseRound {
  id: string;
  status: 'open' | 'closed' | 'completed';
  startedAt: Date;
  endedAt?: Date;
  winningNumbers?: number[];
  rewards: {
    grandPrize: number;
    secondPrize: number;
    thirdPrize: number;
    consolationPrize: number;
  };
}

export function HorseRaceGame({ setError, setMessage }: Props) {
  const { user } = useAuthStore();
  const [currentRound, setCurrentRound] = useState<HorseRound | null>(null);
  const [userBets, setUserBets] = useState<HorseBet[]>([]);
  const [selectedBets, setSelectedBets] = useState<NumberBet[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [betAmounts, setBetAmounts] = useState<{ [key: number]: string }>({});
  const [minBet] = useState(10);
  const [maxBet] = useState(1000);

  useEffect(() => {
    // Listen to current horse race round
    const unsubRound = onSnapshot(doc(db, 'gameRounds', 'horseRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCurrentRound({
          id: doc.id,
          ...data,
          startedAt: data.startedAt?.toDate(),
          endedAt: data.endedAt?.toDate()
        } as HorseRound);
      }
    });

    // Listen to user's bets if user is logged in
    if (user?.id) {
      const betsQuery = query(
        collection(db, 'horseBets'),
        where('userId', '==', user.id),
        where('status', '==', 'pending')
      );

      const unsubBets = onSnapshot(betsQuery, (snapshot) => {
        const bets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate()
        })) as HorseBet[];
        setUserBets(bets);
      });

      return () => {
        unsubRound();
        unsubBets();
      };
    }

    return () => unsubRound();
  }, [user?.id]);

  const updateBetAmount = (number: number, value: string) => {
    // Update the input value immediately for responsive UI
    setBetAmounts(prev => ({
      ...prev,
      [number]: value
    }));

    // Convert to number for validation
    const amount = parseInt(value);
    
    // Remove the bet if amount is 0 or invalid
    if (!amount || isNaN(amount)) {
      setSelectedBets(prev => prev.filter(bet => bet.number !== number));
      return;
    }

    // Validate bet amount
    if (amount < minBet) {
      setError(`Minimum bet amount is ${minBet} FBT`);
      return;
    }

    if (amount > maxBet) {
      setError(`Maximum bet amount is ${maxBet} FBT per number`);
      return;
    }

    // Calculate total of other bets
    const otherBetsTotal = selectedBets
      .filter(bet => bet.number !== number)
      .reduce((sum, bet) => sum + bet.amount, 0);

    // Check if total would exceed user's points
    if (otherBetsTotal + amount > (user?.points || 0)) {
      setError('Total bet amount exceeds available points');
      return;
    }

    setSelectedBets(prev => {
      const existingBet = prev.find(bet => bet.number === number);
      const otherBets = prev.filter(bet => bet.number !== number);
      
      return [...otherBets, { number, amount }].sort((a, b) => a.number - b.number);
    });
  };

  const getTotalBetAmount = () => {
    return selectedBets.reduce((sum, bet) => sum + bet.amount, 0);
  };

  const placeBet = async () => {
    if (!user || !currentRound) return;

    if (selectedBets.length === 0) {
      setError('Please select at least one number');
      return;
    }

    if (selectedBets.length > 10) {
      setError('Maximum 10 numbers allowed');
      return;
    }

    const totalAmount = getTotalBetAmount();
    if (totalAmount === 0) {
      setError('Please enter bet amounts');
      return;
    }

    if (totalAmount > user.points) {
      setError('Insufficient points');
      return;
    }

    setIsProcessing(true);

    try {
      await runTransaction(db, async (transaction) => {
        // Check user's current points
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        if (userData.points < totalAmount) {
          throw new Error('Insufficient points');
        }

        // Create bet
        const betRef = doc(collection(db, 'horseBets'));
        transaction.set(betRef, {
          userId: user.id,
          username: user.username,
          bets: selectedBets,
          totalAmount,
          roundId: currentRound.id,
          timestamp: new Date(),
          status: 'pending'
        });

        // Update user's points
        transaction.update(userRef, {
          points: userData.points - totalAmount
        });

        // Add transaction record
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: user.id,
          username: user.username,
          amount: -totalAmount,
          type: 'horse_race_bet',
          description: `Horse Race bet on numbers: ${selectedBets.map(bet => `${bet.number} (${bet.amount} FBT)`).join(', ')}`,
          timestamp: new Date()
        });

        // Update local user state
        useAuthStore.setState(state => ({
          ...state,
          user: {
            ...state.user!,
            points: userData.points - totalAmount
          }
        }));
      });

      setMessage('Bet placed successfully!');
      setSelectedBets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentRound) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg bg-gray-50 p-8">
        <div className="text-center">
          <Horse className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">No active horse race round</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Game Header */}
      <div className="rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Horse className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Virtual Horse Race</h2>
              <p className="mt-1 text-purple-200">
                Pick your lucky numbers and win big!
              </p>
            </div>
          </div>
          <div className="rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
            <span className="font-medium">Status: </span>
            <span className={`rounded-full px-2 py-1 text-sm ${
              currentRound.status === 'open'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}>
              {currentRound.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Game Rules */}
      <div className="rounded-lg bg-yellow-50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-yellow-800">Game Rules</h3>
        <ul className="list-inside list-disc space-y-2 text-yellow-700">
          <li>Pick up to 10 numbers between 1 and 100</li>
          <li>Set your bet amount for each number</li>
          <li>Total bets cannot exceed your available FBT points</li>
          <li>
            Prizes:
            <ul className="ml-6 mt-2 list-inside list-disc space-y-1">
              <li>Grand Prize (1 winner): {currentRound.rewards.grandPrize}x Cash Points</li>
              <li>Second Prize (2 winners): {currentRound.rewards.secondPrize}x Cash Points</li>
              <li>Third Prize (5 winners): {currentRound.rewards.thirdPrize}x Cash Points</li>
              <li>Consolation (25 winners): {currentRound.rewards.consolationPrize}x FBT points</li>
            </ul>
          </li>
        </ul>
      </div>

      {currentRound.status === 'open' ? (
        <>
          {/* Number Selection Grid */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select Your Numbers</h3>
              <div className="text-sm text-gray-600">
                Total Bet: {getTotalBetAmount()} / {user?.points || 0} FBT
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10">
              {Array.from({ length: 100 }, (_, i) => i + 1).map((number) => {
                const bet = selectedBets.find(b => b.number === number);
                const isSelected = !!bet;
                const existingBet = userBets.some(b => 
                  b.bets.some(bet => bet.number === number)
                );

                return (
                  <div
                    key={number}
                    className="relative rounded-lg border p-2 transition-all md:p-3"
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-sm font-medium md:text-base">{number}</span>
                      {!existingBet && (
                        <input
                          type="number"
                          value={betAmounts[number] || ''}
                          onChange={(e) => updateBetAmount(number, e.target.value)}
                          className="h-8 w-full rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 md:h-10 md:text-sm"
                          placeholder={`${minBet}`}
                          min={minBet}
                          max={maxBet}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add bet limits info */}
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800">Bet Limits:</p>
                  <p className="text-xs text-blue-600">
                    Minimum: {minBet} FBT per number
                  </p>
                  <p className="text-xs text-blue-600">
                    Maximum: {maxBet} FBT per number
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-800">
                    Total Bet: {getTotalBetAmount()} FBT
                  </p>
                  <p className="text-xs text-blue-600">
                    Available: {user?.points || 0} FBT
                  </p>
                </div>
              </div>
            </div>

            {/* Place Bet Button */}
            <div className="mt-6">
              <Button
                onClick={placeBet}
                disabled={isProcessing || selectedBets.length === 0 || getTotalBetAmount() === 0}
                className="h-12 w-full bg-purple-600 hover:bg-purple-700 md:h-10"
              >
                Place Bet ({getTotalBetAmount()} FBT)
              </Button>
            </div>
          </div>

          {/* Active Bets */}
          {userBets.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-lg">
              <h3 className="mb-4 text-lg font-semibold">Your Active Bets</h3>
              <div className="overflow-x-auto rounded-lg border">
                <div className="min-w-[640px] divide-y divide-gray-200">
                  {userBets.map((bet) => (
                    <div
                      key={bet.id}
                      className="p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            {bet.bets.map((numberBet, index) => (
                              <span
                                key={index}
                                className="rounded-full bg-purple-100 px-3 py-1 text-sm"
                              >
                                {numberBet.number} ({numberBet.amount} FBT)
                              </span>
                            ))}
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            Total Bet: {bet.totalAmount} FBT
                          </p>
                        </div>
                        <span className="text-sm text-gray-500">
                          {bet.timestamp.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : currentRound.status === 'completed' && currentRound.winningNumbers ? (
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold">Winning Numbers</h3>
          <div className="flex flex-wrap gap-2">
            {currentRound.winningNumbers.map((number, index) => (
              <span
                key={index}
                className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700"
              >
                {number}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <div className="flex items-center justify-center space-x-2 text-yellow-600">
            <Timer className="h-6 w-6" />
            <p className="text-lg font-medium">Waiting for results...</p>
          </div>
        </div>
      )}
    </div>
  );
}