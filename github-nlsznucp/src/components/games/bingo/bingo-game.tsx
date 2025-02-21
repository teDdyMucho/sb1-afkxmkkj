import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BingoCard } from './bingo-card';
import { Info } from 'lucide-react';

interface Props {
  gameStatus: string;
  bingoNumbers: string[];
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface BingoPlayer {
  id: string;
  cardNumbers: number[];
  matchedNumbers: number[];
  claimedBingo: boolean;
}

// Generate unique numbers for a column
const generateUniqueNumbers = (min: number, max: number, count: number): number[] => {
  const numbers = new Set<number>();
  while (numbers.size < count) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    numbers.add(num);
  }
  return Array.from(numbers);
};

// Generate a valid bingo card with center as bonus
const generateBingoCard = (): number[] => {
  const card: number[] = [];
  
  // Generate numbers for each column (B, I, N, G, O)
  for (let col = 0; col < 5; col++) {
    const min = col * 15 + 1;
    const max = min + 14;
    const columnNumbers = generateUniqueNumbers(min, max, 5);
    
    // Add numbers to card
    for (let row = 0; row < 5; row++) {
      const index = row * 5 + col;
      // Center square (index 12) is special bonus number 0
      if (row === 2 && col === 2) {
        card[index] = 0; // Use 0 to represent the bonus space
      } else {
        card[index] = columnNumbers[row];
      }
    }
  }
  
  return card;
};

// Check for bingo win
const checkBingo = (cardNumbers: number[], matchedNumbers: number[]): boolean => {
  // Convert to 5x5 grid
  const grid: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false));
  
  // Mark matched numbers
  for (let i = 0; i < 25; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    // Center is always matched (index 12 is center)
    if (i === 12) {
      grid[row][col] = true;
    } else {
      grid[row][col] = matchedNumbers.includes(cardNumbers[i]);
    }
  }

  // Check rows
  for (let row = 0; row < 5; row++) {
    if (grid[row].every(cell => cell)) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (grid.every(row => row[col])) return true;
  }

  // Check diagonals
  if (grid.every((row, i) => row[i])) return true;
  if (grid.every((row, i) => row[4 - i])) return true;

  return false;
};

export function BingoGame({ gameStatus, bingoNumbers, setError, setMessage }: Props) {
  const { user } = useAuthStore();
  const [bingoCards, setBingoCards] = useState<BingoPlayer[]>([]);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rewardType, setRewardType] = useState<'fbt' | 'cash'>('fbt');
  const [jackpotAmount, setJackpotAmount] = useState(0);

  useEffect(() => {
    // Listen to game status and settings
    const unsubGame = onSnapshot(doc(db, 'gameRounds', 'bingoRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setBuyInAmount(data.buyInAmount || 100);
        setRewardType(data.bingoRewardType || 'fbt');
        setJackpotAmount(data.bingoJackpot || 0);
      }
    });

    // Listen to player's bingo cards
    if (user?.id) {
      const bingoQuery = query(
        collection(db, 'bingoBets'),
        where('userId', '==', user.id),
        where('roundId', '==', 'bingoRound'),
        where('status', '==', 'active')
      );

      const unsubBingo = onSnapshot(bingoQuery, (snapshot) => {
        if (!snapshot.empty) {
          const cards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            cardNumbers: doc.data().cardNumbers || [],
            matchedNumbers: doc.data().matchedNumbers || [],
            claimedBingo: doc.data().claimedBingo || false
          })) as BingoPlayer[];
          setBingoCards(cards);
        } else {
          setBingoCards([]);
        }
      });

      return () => {
        unsubGame();
        unsubBingo();
      };
    }

    return () => unsubGame();
  }, [user?.id]);

  const handleBingoBuyIn = async () => {
    if (!user) {
      setError('Please log in to play Bingo');
      return;
    }

    if (isProcessing) {
      return;
    }

    if (!user.points) {
      setError('You have no points available');
      return;
    }

    if (user.points < buyInAmount) {
      setError(`Insufficient points. You need ${buyInAmount} points to play Bingo. You have ${user.points} points.`);
      return;
    }

    if (bingoCards.length >= 3) {
      setError('You already have the maximum number of cards (3)');
      return;
    }

    setIsProcessing(true);

    try {
      await runTransaction(db, async (transaction) => {
        // Get user document
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        const currentPoints = userData.points || 0;

        if (currentPoints < buyInAmount) {
          throw new Error(`Insufficient points. You need ${buyInAmount} points but have ${currentPoints} points.`);
        }

        // Generate card
        const cardNumbers = generateBingoCard();

        // Create bingo entry
        const bingoRef = doc(collection(db, 'bingoBets'));
        transaction.set(bingoRef, {
          userId: user.id,
          username: user.username,
          roundId: 'bingoRound',
          cardNumbers,
          matchedNumbers: [],
          claimedBingo: false,
          status: 'active',
          placedAt: new Date(),
          buyInAmount
        });

        // Update user's points
        transaction.update(userRef, {
          points: currentPoints - buyInAmount
        });

        // Add transaction record
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: user.id,
          username: user.username,
          amount: -buyInAmount,
          type: 'bingo_buy_in',
          description: `Bingo game buy-in (Card ${bingoCards.length + 1}/3)`,
          timestamp: new Date()
        });

        // Update local user state
        useAuthStore.setState(state => ({
          ...state,
          user: {
            ...state.user!,
            points: currentPoints - buyInAmount
          }
        }));
      });

      setMessage('Successfully bought a new Bingo card!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy Bingo card');
      console.error('Bingo buy-in error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const claimBingo = async (cardId: string, cardNumbers: number[], matchedNumbers: number[]) => {
    if (!user) return;

    // Double check bingo before claiming
    const isValidBingo = checkBingo(cardNumbers, matchedNumbers);
    if (!isValidBingo) {
      setError('Invalid bingo pattern detected');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, 'bingoBets', cardId);
        transaction.update(betRef, {
          claimedBingo: true,
          claimedAt: new Date()
        });
      });
      
      setMessage('Bingo claim submitted! Please wait for verification.');
    } catch (err) {
      setError('Failed to claim bingo');
      console.error(err);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-2xl font-bold">Bingo Game</h2>
      
      <div className="mb-6 space-y-4">
        {/* Game Rules */}
        <div className="rounded-md bg-gray-50 p-4">
          <h3 className="mb-2 font-semibold">Game Rules:</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
            <li>Buy-in: {buyInAmount} FBT points per card</li>
            <li>Match any row, column, or diagonal to win!</li>
            <li>Center square is a FREE space!</li>
            <li>Maximum 3 cards per player</li>
            <li>Your current points: {user?.points || 0}</li>
          </ul>
        </div>

        {/* Jackpot Display */}
        <div className="rounded-md bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white">
          <h3 className="mb-2 text-lg font-semibold">Bingo Jackpot</h3>
          <p className="text-3xl font-bold">
            {jackpotAmount} {rewardType.toUpperCase()}
          </p>
        </div>
      </div>

      {bingoCards.length > 0 ? (
        <div className="space-y-8">
          {/* Cards Grid */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {bingoCards.map((card, index) => (
              <div key={card.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Card {index + 1}</h3>
                  {card.claimedBingo && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                      Bingo Claimed!
                    </span>
                  )}
                </div>
                <BingoCard
                  numbers={card.cardNumbers}
                  calledNumbers={card.matchedNumbers}
                  onBingo={() => claimBingo(card.id, card.cardNumbers, card.matchedNumbers)}
                  hasBingo={checkBingo(card.cardNumbers, card.matchedNumbers)}
                  claimedBingo={card.claimedBingo}
                />
              </div>
            ))}
            {bingoCards.length < 3 && gameStatus === 'open' && (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
                <Button
                  onClick={handleBingoBuyIn}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isProcessing || (user?.points || 0) < buyInAmount}
                >
                  Buy Another Card
                </Button>
              </div>
            )}
          </div>

          {/* Called Numbers */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-4 text-lg font-semibold">Called Numbers</h3>
            <div className="flex flex-wrap gap-2">
              {bingoNumbers.map((num, index) => (
                <span
                  key={index}
                  className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : gameStatus === 'open' ? (
        <div className="text-center">
          <div className="mb-4 rounded-lg bg-blue-50 p-4">
            <div className="flex items-start">
              <Info className="mr-3 h-5 w-5 text-blue-400" />
              <p className="text-sm text-blue-700">
                You can buy up to 3 Bingo cards to increase your chances of winning!
              </p>
            </div>
          </div>
          <Button
            onClick={handleBingoBuyIn}
            className="bg-green-600 hover:bg-green-700"
            disabled={isProcessing || (user?.points || 0) < buyInAmount}
          >
            {isProcessing ? 'Processing...' : 'Buy Bingo Card'}
          </Button>
          {(user?.points || 0) < buyInAmount && (
            <p className="mt-2 text-sm text-red-600">
              You need {buyInAmount} points to play. You have {user?.points || 0} points.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-lg bg-gray-50 p-8">
          <div className="text-center">
            <Info className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-600">
              No active Bingo game. Please wait for the next round.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}