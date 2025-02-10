import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  runTransaction, 
  addDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  writeBatch,
  increment,
  orderBy,
  limit 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trophy, Timer, Check, X, Plus, Crown } from 'lucide-react';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface Winner {
  username: string;
  numbers: number[];
  betAmount: number;
  winnings: number;
  timestamp: Date;
  type: 'jackpot' | 'points';
}

interface BetCount {
  number: number;
  count: number;
}

interface ActiveBet {
  id: string;
  username: string;
  numbers: number[];
  betAmount: number;
  placedAt: Date;
}

interface GameResult {
  id: string;
  gameType: 'lucky2';
  winningNumbers: number[];
  timestamp: Date;
}

export function Lucky2Admin({ setError, setMessage }: Props) {
  const [gameStatus, setGameStatus] = useState('closed');
  const [betCounts, setBetCounts] = useState<BetCount[]>([]);
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [previousResults, setPreviousResults] = useState<GameResult[]>([]);
  const [winningNumbers, setWinningNumbers] = useState({ num1: '', num2: '' });
  const [currentJackpot, setCurrentJackpot] = useState(0);
  const [recentWinners, setRecentWinners] = useState<Winner[]>([]);

  // Initialize Lucky2 round
  useEffect(() => {
    const initLucky2Round = async () => {
      try {
        const roundRef = doc(db, 'gameRounds', 'lucky2Round');
        const roundDoc = await getDoc(roundRef);
        
        if (!roundDoc.exists()) {
          await setDoc(roundRef, {
            status: 'closed',
            gameType: 'lucky2',
            jackpot: 0,
            numbers: [],
            totalBets: 0,
            startedAt: null,
            endedAt: null
          });
          console.log('Lucky2 round initialized successfully');
        }
      } catch (err) {
        console.error('Failed to initialize Lucky2 round:', err);
        setError('Failed to initialize Lucky2 game. Please try refreshing the page.');
      }
    };

    initLucky2Round();
  }, [setError]);

  // Listen to game state and bets
  useEffect(() => {
    // Listen to game status and jackpot
    const unsubGame = onSnapshot(doc(db, 'gameRounds', 'lucky2Round'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGameStatus(data.status);
        setCurrentJackpot(data.jackpot || 0);
      }
    });

    // Listen to active bets
    const betsQuery = query(
      collection(db, 'bets'),
      where('roundId', '==', 'lucky2Round'),
      where('result', '==', 'pending')
    );
    const unsubBets = onSnapshot(betsQuery, (snapshot) => {
      // Update number counts
      const numberCounts = new Array(60).fill(0);
      const bets: ActiveBet[] = [];
      
      snapshot.docs.forEach(doc => {
        const bet = doc.data();
        bet.numbers.forEach((num: number) => {
          numberCounts[num - 1]++;
        });
        bets.push({
          id: doc.id,
          username: bet.username,
          numbers: bet.numbers,
          betAmount: bet.betAmount,
          placedAt: bet.placedAt.toDate()
        });
      });
      
      const counts: BetCount[] = numberCounts
        .map((count, index) => ({
          number: index + 1,
          count
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
      
      setBetCounts(counts);
      setActiveBets(bets.sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()));
    });

    // Listen to previous results
    const resultsQuery = query(
      collection(db, 'gameResults'),
      where('gameType', '==', 'lucky2')
    );
    const unsubResults = onSnapshot(resultsQuery, (snapshot) => {
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as GameResult[];
      setPreviousResults(results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });

    return () => {
      unsubGame();
      unsubBets();
      unsubResults();
    };
  }, []);

  // Add new useEffect for recent winners
  useEffect(() => {
    const winnersQuery = query(
      collection(db, 'transactions'),
      where('type', 'in', ['lucky2_jackpot', 'lucky2_win']),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubWinners = onSnapshot(winnersQuery, (snapshot) => {
      const winners = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          username: data.username,
          numbers: data.numbers || [],
          betAmount: data.betAmount || 0,
          winnings: data.amount,
          timestamp: data.timestamp.toDate(),
          type: data.type === 'lucky2_jackpot' ? 'jackpot' : 'points'
        };
      });
      setRecentWinners(winners);
    });

    return () => unsubWinners();
  }, []);

  const startLucky2 = async () => {
    try {
      await updateDoc(doc(db, 'gameRounds', 'lucky2Round'), {
        status: 'open',
        startedAt: new Date(),
        gameType: 'lucky2'
      });
      setMessage('Lucky2 betting round started');
    } catch (err) {
      setError('Failed to start betting round');
      console.error(err);
    }
  };

  const closeLucky2 = async () => {
    try {
      await updateDoc(doc(db, 'gameRounds', 'lucky2Round'), {
        status: 'closed'
      });
      setMessage('Lucky2 betting round closed');
    } catch (err) {
      setError('Failed to close betting round');
      console.error(err);
    }
  };

  const setJackpot = async () => {
    const amount = prompt('Enter jackpot amount:');
    if (!amount) return;

    const jackpot = parseInt(amount);
    if (isNaN(jackpot) || jackpot < 0) {
      setError('Please enter a valid jackpot amount');
      return;
    }

    try {
      await updateDoc(doc(db, 'gameRounds', 'lucky2Round'), {
        jackpot
      });
      setMessage(`Jackpot set to ₱${jackpot.toLocaleString()}`);
    } catch (err) {
      setError('Failed to set jackpot');
      console.error(err);
    }
  };

  const publishResults = async () => {
    const num1 = parseInt(winningNumbers.num1);
    const num2 = parseInt(winningNumbers.num2);

    if (!num1 || !num2 || num1 === num2 || num1 < 1 || num1 > 60 || num2 < 1 || num2 > 60) {
      setError('Please enter two different valid numbers (1-60)');
      return;
    }

    try {
      // Save results
      await addDoc(collection(db, 'gameResults'), {
        gameType: 'lucky2',
        winningNumbers: [num1, num2],
        timestamp: new Date()
      });

      // Process bets
      const betsQuery = query(
        collection(db, 'bets'),
        where('roundId', '==', 'lucky2Round'),
        where('result', '==', 'pending')
      );
      const betsSnapshot = await getDocs(betsQuery);

      for (const betDoc of betsSnapshot.docs) {
        const bet = betDoc.data();
        const matches = bet.numbers.filter((n: number) => n === num1 || n === num2).length;

        let winnings = 0;
        let result = 'lost';

        if (matches === 2) {
          winnings = currentJackpot;
          result = 'won Cash';
          
          await updateDoc(doc(db, 'users', bet.userId), {
            cash: increment(currentJackpot)
          });
        } else if (matches === 1) {
          winnings = bet.betAmount * 50;
          result = 'won FBT';
          
          await updateDoc(doc(db, 'users', bet.userId), {
            points: increment(winnings)
          });
        }

        await updateDoc(betDoc.ref, {
          result,
          winnings
        });

        // Add transaction record
        if (winnings > 0) {
          await addDoc(collection(db, 'transactions'), {
            userId: bet.userId,
            username: bet.username,
            amount: winnings,
            type: result === 'won Cash' ? 'lucky2_jackpot' : 'lucky2_win',
            description: `Lucky2 win - ${matches} number${matches > 1 ? 's' : ''} matched`,
            timestamp: new Date(),
            numbers: bet.numbers,
            betAmount: bet.betAmount
          });
        }
      }

      // Reset game
      await updateDoc(doc(db, 'gameRounds', 'lucky2Round'), {
        status: 'closed',
        jackpot: 0,
        winningNumbers: [num1, num2]
      });

      setMessage('Lucky2 results published and processed successfully');
      setWinningNumbers({ num1: '', num2: '' });
    } catch (err) {
      setError('Failed to publish results');
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Game Controls */}
      <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
        <h2 className="mb-4 text-lg font-semibold md:text-xl">Lucky2 Controls</h2>
        
        {/* Quick Stats */}
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Timer className="h-4 w-4 text-purple-600 md:h-5 md:w-5" />
                <h3 className="text-sm font-medium text-purple-900 md:text-base">Status</h3>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium md:text-sm ${
                gameStatus === 'open' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {gameStatus === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trophy className="h-4 w-4 text-yellow-600 md:h-5 md:w-5" />
                <h3 className="text-sm font-medium text-yellow-900 md:text-base">Jackpot</h3>
              </div>
              <span className="text-sm font-medium text-yellow-900 md:text-base">
                ₱{currentJackpot.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:flex md:space-x-4">
          <Button
            onClick={startLucky2}
            disabled={gameStatus === 'open'}
            className="w-full bg-green-600 hover:bg-green-700 md:w-auto"
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            Start Lucky2
          </Button>
          <Button
            onClick={closeLucky2}
            disabled={gameStatus !== 'open'}
            className="w-full bg-red-600 hover:bg-red-700 md:w-auto"
            size="sm"
          >
            <X className="mr-1 h-4 w-4" />
            Close Lucky2
          </Button>
          <Button
            onClick={setJackpot}
            className="w-full bg-yellow-600 hover:bg-yellow-700 md:w-auto"
            size="sm"
          >
            <Trophy className="mr-1 h-4 w-4" />
            Set Jackpot
          </Button>
        </div>

        {gameStatus === 'closed' && (
          <div className="mt-4 space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">Publish Results</h3>
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Number (1-60)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={winningNumbers.num1}
                  onChange={(e) => setWinningNumbers(prev => ({ ...prev, num1: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:text-base"
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
                  value={winningNumbers.num2}
                  onChange={(e) => setWinningNumbers(prev => ({ ...prev, num2: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:text-base"
                />
              </div>
            </div>
            <Button
              onClick={publishResults}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Check className="mr-1 h-4 w-4" />
              Publish Results
            </Button>
          </div>
        )}
      </div>

      {/* Recent Winners */}
      <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 p-4 shadow-md md:p-6">
        <div className="mb-4 flex items-center space-x-3">
          <Crown className="h-5 w-5 text-yellow-600 md:h-6 md:w-6" />
          <h2 className="text-lg font-semibold text-yellow-900 md:text-xl">Recent Winners</h2>
        </div>
        
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {recentWinners.map((winner, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-lg bg-white p-3 shadow-sm transition-all hover:shadow-md md:p-4"
            >
              <div className="absolute right-0 top-0 h-16 w-16">
                <div className={`absolute right-[-18px] top-[12px] w-[170px] rotate-45 text-center text-xs font-semibold md:text-sm ${
                  winner.type === 'jackpot' 
                    ? 'bg-yellow-500 text-yellow-950'
                    : 'bg-green-500 text-green-950'
                }`}>
                  {winner.type === 'jackpot' ? 'JACKPOT' : '50x WIN'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 md:text-base">{winner.username}</span>
                  <span className="text-xs text-gray-500 md:text-sm">
                    {winner.timestamp.toLocaleTimeString()}
                  </span>
                </div>

                {winner.numbers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600 md:text-sm">Numbers:</span>
                    <div className="flex space-x-1">
                      {winner.numbers.map((num, i) => (
                        <span
                          key={i}
                          className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800"
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs md:text-sm">
                  <span className="text-gray-600">
                    Bet: {winner.betAmount} FBT
                  </span>
                  <span className={`font-medium ${
                    winner.type === 'jackpot' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    Won: {winner.winnings} {winner.type === 'jackpot' ? 'CASH' : 'FBT'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {recentWinners.length === 0 && (
            <div className="col-span-full flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-yellow-200">
              <p className="text-sm text-yellow-600 md:text-base">No recent winners</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Bets */}
      {activeBets.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
          <h2 className="mb-4 text-lg font-semibold md:text-xl">Active Bets</h2>
          <div className="space-y-3 md:space-y-4">
            {activeBets.map((bet) => (
              <div
                key={bet.id}
                className="rounded-lg border p-3 md:p-4"
              >
                <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                  <div>
                    <p className="text-sm font-medium md:text-base">{bet.username}</p>
                    <p className="text-xs text-gray-600 md:text-sm">
                      Numbers: {bet.numbers.join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between md:flex-col md:items-end">
                    <p className="text-sm font-medium text-green-600 md:text-base">
                      {bet.betAmount} FBT
                    </p>
                    <p className="text-xs text-gray-600 md:text-sm">
                      {bet.placedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Previous Results */}
      {previousResults.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
          <h2 className="mb-4 text-lg font-semibold md:text-xl">Previous Results</h2>
          <div className="space-y-3 md:space-y-4">
            {previousResults.map((result) => (
              <div
                key={result.id}
                className="rounded-lg border p-3 md:p-4"
              >
                <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                  <div>
                    <p className="text-sm font-medium md:text-base">
                      Winning Numbers: {result.winningNumbers.join(', ')}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 md:text-sm">
                    {result.timestamp.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}