import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props {
  gameStatus: string;
  jackpot: number;
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface Bet {
  id: string;
  numbers: number[];
  betAmount: number;
  result: 'pending' | 'won Cash' | 'won FBT' | 'lost';
  winnings: number;
  placedAt: Date;
}

export function Lucky2Game({ gameStatus, jackpot, setError, setMessage }: Props) {
  const { user } = useAuthStore();
  const [numbers, setNumbers] = useState({ num1: '', num2: '' });
  const [betAmount, setBetAmount] = useState('10');
  const [currentBet, setCurrentBet] = useState<Bet | null>(null);
  const [previousBets, setPreviousBets] = useState<Bet[]>([]);

  // Add real-time points update
  useEffect(() => {
    if (!user?.id) return;

    // Update user points every second
    const pointsInterval = setInterval(async () => {
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Update local user state with latest points
        useAuthStore.setState(state => ({
          ...state,
          user: {
            ...state.user!,
            points: userData.points
          }
        }));
      }
    }, 1000);

    return () => clearInterval(pointsInterval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Listen to user's current bet
    const currentBetQuery = query(
      collection(db, 'bets'),
      where('userId', '==', user.id),
      where('roundId', '==', 'lucky2Round'),
      where('result', '==', 'pending')
    );
    const unsubCurrentBet = onSnapshot(currentBetQuery, (snapshot) => {
      if (!snapshot.empty) {
        const betDoc = snapshot.docs[0];
        setCurrentBet({
          id: betDoc.id,
          ...betDoc.data(),
          placedAt: betDoc.data().placedAt.toDate()
        } as Bet);
      } else {
        setCurrentBet(null);
      }
    });

    // Listen to user's previous bets
    const previousBetsQuery = query(
      collection(db, 'bets'),
      where('userId', '==', user.id)
    );
    const unsubPreviousBets = onSnapshot(previousBetsQuery, (snapshot) => {
      const bets = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          placedAt: doc.data().placedAt.toDate()
        } as Bet))
        .filter(bet => bet.result !== 'pending')
        .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())
        .slice(0, 10);
      setPreviousBets(bets);
    });

    return () => {
      unsubCurrentBet();
      unsubPreviousBets();
    };
  }, [user?.id]);

  const handleLucky2Bet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!user) {
      setError('Please log in to place a bet');
      return;
    }

    const num1 = parseInt(numbers.num1);
    const num2 = parseInt(numbers.num2);
    const amount = parseInt(betAmount);

    if (!num1 || !num2 || num1 === num2 || num1 < 1 || num1 > 60 || num2 < 1 || num2 > 60) {
      setError('Please pick two different numbers between 1 and 60');
      return;
    }

    if (amount < 10 || amount > 50) {
      setError('Bet amount must be between 10 and 50 points');
      return;
    }

    if (user.points < amount) {
      setError('Insufficient points');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        if (userData.points < amount) {
          throw new Error('Insufficient points');
        }

        // Create bet
        const betRef = doc(collection(db, 'bets'));
        transaction.set(betRef, {
          userId: user.id,
          username: user.username,
          numbers: [num1, num2],
          betAmount: amount,
          roundId: 'lucky2Round',
          placedAt: new Date(),
          result: 'pending',
          winnings: 0
        });

        // Update user's points
        transaction.update(userRef, {
          points: userData.points - amount
        });

        // Add transaction record
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: user.id,
          username: user.username,
          amount: -amount,
          type: 'bet',
          description: `Placed bet on numbers ${num1} and ${num2}`,
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

      setMessage('Bet placed successfully!');
      setNumbers({ num1: '', num2: '' });
      setBetAmount('10');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet');
      console.error(err);
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
      <h2 className="mb-4 text-xl font-bold md:text-2xl">Lucky2 Game</h2>
      
      <div className="mb-4 rounded-md bg-gray-50 p-3 md:mb-6 md:p-4">
        <h3 className="mb-2 font-semibold">Game Rules:</h3>
        <ul className="list-inside list-disc space-y-1 text-xs text-gray-600 md:text-sm">
          <li>Pick 2 different numbers between 1 and 60</li>
          <li>Bet between 10 and 50 points</li>
          <li>Match both numbers: Win the Jackpot Prize in Cash!</li>
          <li>Match one number: Win 50x your bet in Points</li>
        </ul>
      </div>

      <div className="mb-4 overflow-hidden rounded-md bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 p-4 text-white md:mb-6 md:p-6">
        <h3 className="mb-1 text-lg font-bold md:mb-2 md:text-2xl">Current Jackpot</h3>
        <p className="text-2xl font-bold md:text-4xl">₱{jackpot.toLocaleString()}</p>
      </div>

      <div className="mb-4 rounded-md bg-gray-50 p-3 md:mb-6 md:p-4">
        <p className="text-base md:text-lg">
          Status: {' '}
          <span className={`font-semibold ${
            gameStatus === 'open' ? 'text-green-600' :
            gameStatus === 'closed' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {gameStatus === 'open' ? 'Betting Open' :
             gameStatus === 'closed' ? 'Betting Closed' :
             'Results Published'}
          </span>
        </p>
      </div>

      {currentBet ? (
        <div className="rounded-md bg-blue-50 p-3 md:p-4">
          <h3 className="mb-2 font-semibold">Your Current Bet</h3>
          <div className="space-y-1 text-sm md:text-base">
            <p>Numbers: {currentBet.numbers.join(', ')}</p>
            <p>Amount: {currentBet.betAmount} points</p>
            <p>Status: {currentBet.result}</p>
            {currentBet.winnings > 0 && (
              <p className="mt-2 font-semibold text-green-600">
                Winnings: {currentBet.winnings}
              </p>
            )}
          </div>
        </div>
      ) : gameStatus === 'open' ? (
        <form onSubmit={handleLucky2Bet} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                First Number (1-60)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={numbers.num1}
                onChange={(e) => setNumbers(prev => ({ ...prev, num1: e.target.value }))}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Second Number (1-60)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={numbers.num2}
                onChange={(e) => setNumbers(prev => ({ ...prev, num2: e.target.value }))}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Bet Amount (10-50 points)
            </label>
            <input
              type="number"
              min="10"
              max="50"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <Button type="submit" className="w-full">
            Place Bet
          </Button>
        </form>
      ) : (
        <p className="text-center text-gray-600">
          Betting is currently closed. Please wait for the next round.
        </p>
      )}

      {/* Previous Bets */}
      {previousBets.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-4 text-lg font-semibold md:text-xl">Previous Bets</h3>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:px-6 md:py-3">
                        Time
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:px-6 md:py-3">
                        Numbers
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:px-6 md:py-3">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:px-6 md:py-3">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {previousBets.map((bet) => (
                      <tr key={bet.id} className="text-xs md:text-sm">
                        <td className="whitespace-nowrap px-3 py-2 md:px-6 md:py-4">
                          {bet.placedAt.toLocaleTimeString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 md:px-6 md:py-4">
                          {bet.numbers.join(', ')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 md:px-6 md:py-4">
                          {bet.betAmount}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 md:px-6 md:py-4">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            bet.result.includes('won') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {bet.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}