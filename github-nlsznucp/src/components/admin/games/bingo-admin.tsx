import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  runTransaction,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trash2, RotateCcw, Play, StopCircle, Plus, Check, Users, DollarSign, Trophy, Image as ImageIcon, Edit2 } from 'lucide-react';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface BingoPlayer {
  id: string;
  username: string;
  userId: string;
  cardNumbers: number[];
  matchedNumbers: number[];
  claimedBingo: boolean;
  points?: number;
}

export function BingoAdmin({ setError, setMessage }: Props) {
  const [gameStatus, setGameStatus] = useState('closed');
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [bingoClaimers, setBingoClaimers] = useState<BingoPlayer[]>([]);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [bingoNumbers, setBingoNumbers] = useState<string[]>([]);
  const [isSettingBuyIn, setIsSettingBuyIn] = useState(false);
  const [newBuyInAmount, setNewBuyInAmount] = useState('');
  const [rewardType, setRewardType] = useState<'fbt' | 'cash'>('fbt');
  const [jackpotAmount, setJackpotAmount] = useState(0);
  const [isSettingJackpot, setIsSettingJackpot] = useState(false);
  const [newJackpotAmount, setNewJackpotAmount] = useState('');

  // Initialize Bingo round
  useEffect(() => {
    const initBingoRound = async () => {
      try {
        const roundRef = doc(db, 'gameRounds', 'bingoRound');
        const roundDoc = await getDoc(roundRef);
        
        if (!roundDoc.exists()) {
          await setDoc(roundRef, {
            status: 'closed',
            gameType: 'bingo',
            buyInAmount: 100,
            bingoJackpot: 0,
            bingoRewardType: 'fbt',
            numbers: []
          });
        }
      } catch (err) {
        console.error('Failed to initialize Bingo round:', err);
      }
    };

    initBingoRound();
  }, []);

  // Listen to game state and players
  useEffect(() => {
    // Listen to game status
    const unsubGame = onSnapshot(doc(db, 'gameRounds', 'bingoRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGameStatus(data.status || 'closed');
        setBingoNumbers(data.numbers || []);
        setBuyInAmount(data.buyInAmount || 100);
        setRewardType(data.bingoRewardType || 'fbt');
        setJackpotAmount(data.bingoJackpot || 0);
      }
    });

    // Listen to bingo players
    const playersQuery = query(
      collection(db, 'bingoBets'),
      where('roundId', '==', 'bingoRound'),
      where('status', '==', 'active')
    );
    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      const activePlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        username: doc.data().username || '',
        userId: doc.data().userId || '',
        cardNumbers: doc.data().cardNumbers || [],
        matchedNumbers: doc.data().matchedNumbers || [],
        claimedBingo: doc.data().claimedBingo || false,
        points: doc.data().points || 0
      }));
      
      setPlayers(activePlayers);
      setBingoClaimers(activePlayers.filter(p => p.claimedBingo));
    });

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, []);

  const updateBuyInAmount = async () => {
    const amount = parseInt(newBuyInAmount);
    if (isNaN(amount) || amount < 1) {
      setError('Please enter a valid buy-in amount');
      return;
    }

    try {
      await updateDoc(doc(db, 'gameRounds', 'bingoRound'), {
        buyInAmount: amount
      });
      setBuyInAmount(amount);
      setIsSettingBuyIn(false);
      setNewBuyInAmount('');
      setMessage(`Buy-in amount updated to ${amount} FBT`);
    } catch (err) {
      setError('Failed to update buy-in amount');
      console.error(err);
    }
  };

  const updateJackpot = async () => {
    const amount = parseInt(newJackpotAmount);
    if (isNaN(amount) || amount < 1) {
      setError('Please enter a valid jackpot amount');
      return;
    }

    try {
      await updateDoc(doc(db, 'gameRounds', 'bingoRound'), {
        bingoJackpot: amount
      });
      setJackpotAmount(amount);
      setIsSettingJackpot(false);
      setNewJackpotAmount('');
      setMessage(`Jackpot amount updated to ${amount} ${rewardType.toUpperCase()}`);
    } catch (err) {
      setError('Failed to update jackpot amount');
      console.error(err);
    }
  };

  const toggleRewardType = async () => {
    const newType = rewardType === 'fbt' ? 'cash' : 'fbt';
    try {
      await updateDoc(doc(db, 'gameRounds', 'bingoRound'), {
        bingoRewardType: newType
      });
      setRewardType(newType);
      setMessage(`Reward type changed to ${newType.toUpperCase()}`);
    } catch (err) {
      setError('Failed to update reward type');
      console.error(err);
    }
  };

  const startBingo = async () => {
    const amount = prompt('Enter buy-in amount (FBT points):', '100');
    if (!amount) return;

    const buyIn = parseInt(amount);
    if (isNaN(buyIn) || buyIn < 1) {
      setError('Please enter a valid buy-in amount');
      return;
    }

    try {
      const batch = writeBatch(db);

      // Reset all active bingo bets
      const activeBetsQuery = query(
        collection(db, 'bingoBets'),
        where('status', '==', 'active')
      );
      const activeBetsSnapshot = await getDocs(activeBetsQuery);
      activeBetsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          claimedBingo: false,
          matchedNumbers: []
        });
      });

      // Set up new game
      batch.set(doc(db, 'gameRounds', 'bingoRound'), {
        status: 'open',
        startedAt: new Date(),
        gameType: 'bingo',
        buyInAmount: buyIn,
        numbers: [],
        prize: 0,
        totalPrize: 0
      });
      
      await batch.commit();
      
      setBingoNumbers([]);
      setMessage('Bingo game started and all previous claims reset');
    } catch (err) {
      console.error('Start bingo error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start bingo game');
    }
  };

  const addBingoNumber = async () => {
    const number = prompt('Enter the next bingo number (1-75):');
    if (!number) return;

    const num = parseInt(number);
    if (isNaN(num) || num < 1 || num > 75) {
      setError('Please enter a valid number between 1 and 75');
      return;
    }

    if (bingoNumbers.includes(number)) {
      setError('This number has already been called');
      return;
    }

    try {
      const newNumbers = [...bingoNumbers, number];
      
      // Update game round with new number
      await updateDoc(doc(db, 'gameRounds', 'bingoRound'), {
        numbers: newNumbers
      });

      // Update matched numbers for all players
      const batch = writeBatch(db);
      let updatesCount = 0;

      for (const player of players) {
        const cardIndex = player.cardNumbers.indexOf(num);
        if (cardIndex !== -1) {
          const newMatchedNumbers = [...player.matchedNumbers, num];
          batch.update(doc(db, 'bingoBets', player.id), {
            matchedNumbers: newMatchedNumbers
          });
          updatesCount++;
        }
      }

      if (updatesCount > 0) {
        await batch.commit();
      }

      setMessage(`Bingo number ${num} added${updatesCount > 0 ? ` (${updatesCount} cards updated)` : ''}`);
    } catch (err) {
      setError('Failed to add bingo number');
      console.error(err);
    }
  };

  const verifyAndEndBingo = async (playerId: string) => {
    try {
      const player = players.find(p => p.id === playerId);
      if (!player) {
        setError('Player not found');
        return;
      }

      // Update winner's balance based on reward type using increment
      await updateDoc(doc(db, 'users', player.userId), {
        [rewardType === 'fbt' ? 'points' : 'cash']: increment(jackpotAmount)
      });

      // Update game status
      await updateDoc(doc(db, 'gameRounds', 'bingoRound'), {
        status: 'closed',
        winner: player.username,
        prize: jackpotAmount,
        totalPrize: 0,
        gameType: null
      });

      // Add transaction record
      await addDoc(collection(db, 'transactions'), {
        userId: player.userId,
        username: player.username,
        amount: jackpotAmount,
        type: 'bingo_win',
        description: `Won Bingo game (${rewardType.toUpperCase()})`,
        timestamp: new Date()
      });

      // Mark all bets as completed
      const batch = writeBatch(db);
      players.forEach(p => {
        batch.update(doc(db, 'bingoBets', p.id), {
          status: 'completed',
          completedAt: new Date(),
          isWinner: p.id === playerId
        });
      });
      await batch.commit();

      setMessage(`Bingo game ended - ${player.username} won ${jackpotAmount} ${rewardType.toUpperCase()}!`);
      setBingoNumbers([]);
    } catch (err) {
      setError('Failed to end bingo game');
      console.error(err);
    }
  };

  const resetGame = async () => {
    if (!confirm('Are you sure you want to reset the game? This will refund all players and their cards.')) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // Reset game round
      batch.update(doc(db, 'gameRounds', 'bingoRound'), {
        status: 'closed',
        numbers: [],
        winner: null,
        prize: 0,
        totalPrize: 0,
        gameType: null
      });

      // Get all active bingo bets
      const betsQuery = query(
        collection(db, 'bingoBets'),
        where('roundId', '==', 'bingoRound'),
        where('status', '==', 'active')
      );
      const betsSnapshot = await getDocs(betsQuery);
      
      // Process refunds in parallel
      const refundPromises = betsSnapshot.docs.map(async (betDoc) => {
        const bet = betDoc.data();
        
        // Refund player using increment to avoid race conditions
        const userRef = doc(db, 'users', bet.userId);
        await updateDoc(userRef, {
          points: increment(bet.buyInAmount)
        });

        // Add refund transaction
        await addDoc(collection(db, 'transactions'), {
          userId: bet.userId,
          username: bet.username,
          amount: bet.buyInAmount,
          type: 'bingo_refund',
          description: 'Bingo game reset - stake refunded',
          timestamp: new Date()
        });

        // Mark bet as refunded
        batch.update(betDoc.ref, {
          status: 'refunded',
          refundedAt: new Date()
        });
      });

      // Wait for all refunds to complete
      await Promise.all(refundPromises);
      await batch.commit();

      setMessage('Game reset successfully and all players refunded');
    } catch (err) {
      setError('Failed to reset game');
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Game Controls */}
      <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
        <h2 className="mb-4 text-lg font-semibold md:text-xl">Bingo Controls</h2>
        
        {/* Quick Stats */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="rounded-lg bg-blue-50 p-3 md:p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500 md:h-6 md:w-6" />
              <div>
                <p className="text-xs font-medium text-blue-600 md:text-sm">Players</p>
                <p className="text-sm font-bold md:text-base">{players.length}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg bg-green-50 p-3 md:p-4">
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-green-500 md:h-6 md:w-6" />
              <div>
                <p className="text-xs font-medium text-green-600 md:text-sm">Claims</p>
                <p className="text-sm font-bold md:text-base">{bingoClaimers.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-yellow-50 p-3 md:p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-yellow-500 md:h-6 md:w-6" />
              <div>
                <p className="text-xs font-medium text-yellow-600 md:text-sm">Buy-in</p>
                {isSettingBuyIn ? (
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      value={newBuyInAmount}
                      onChange={(e) => setNewBuyInAmount(e.target.value)}
                      className="w-16 rounded border px-1 py-0.5 text-xs"
                      placeholder="Amount"
                    />
                    <Button
                      size="sm"
                      className="h-6 px-2 py-0"
                      onClick={updateBuyInAmount}
                    >
                      Set
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <p className="text-sm font-bold md:text-base">{buyInAmount} FBT</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 py-0"
                      onClick={() => setIsSettingBuyIn(true)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 p-3 md:p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-purple-500 md:h-6 md:w-6" />
              <div>
                <p className="text-xs font-medium text-purple-600 md:text-sm">Jackpot</p>
                {isSettingJackpot ? (
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      value={newJackpotAmount}
                      onChange={(e) => setNewJackpotAmount(e.target.value)}
                      className="w-16 rounded border px-1 py-0.5 text-xs"
                      placeholder="Amount"
                    />
                    <Button
                      size="sm"
                      className="h-6 px-2 py-0"
                      onClick={updateJackpot}
                    >
                      Set
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <p className="text-sm font-bold md:text-base">
                      {jackpotAmount} {rewardType.toUpperCase()}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 py-0"
                      onClick={() => setIsSettingJackpot(true)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reward Type Toggle */}
        <div className="mb-4">
          <Button
            onClick={toggleRewardType}
            variant="outline"
            size="sm"
            className={rewardType === 'fbt' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}
          >
            Reward Type: {rewardType.toUpperCase()}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 md:flex-nowrap md:space-x-4">
          <Button
            onClick={startBingo}
            disabled={gameStatus === 'open'}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Play className="mr-1 h-4 w-4 md:h-5 md:w-5" />
            <span className="text-xs md:text-sm">Start Bingo</span>
          </Button>
          
          <Button
            onClick={addBingoNumber}
            disabled={gameStatus !== 'open'}
            className="flex-1"
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4 md:h-5 md:w-5" />
            <span className="text-xs md:text-sm">Add Number</span>
          </Button>
          
          <Button
            onClick={resetGame}
            variant="outline"
            className="flex-1 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
            size="sm"
          >
            <RotateCcw className="mr-1 h-4 w-4 md:h-5 md:w-5" />
            <span className="text-xs md:text-sm">Reset</span>
          </Button>
        </div>

        {/* Called Numbers */}
        {bingoNumbers.length > 0 && (
          <div className="mt-4 rounded-lg border p-3 md:p-4">
            <h3 className="mb-2 text-sm font-medium md:text-base">Called Numbers</h3>
            <div className="flex flex-wrap gap-2">
              {bingoNumbers.map((num, index) => (
                <span
                  key={index}
                  className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 md:text-sm"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bingo Claims */}
      {bingoClaimers.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
          <h3 className="mb-3 text-lg font-semibold text-yellow-800">
            Bingo Claims ({bingoClaimers.length})
          </h3>
          <div className="space-y-2">
            {bingoClaimers.map((player) => (
              <div
                key={player.id}
                className="flex flex-col space-y-2 rounded-lg bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between md:space-y-0"
              >
                <span className="font-medium">{player.username}</span>
                <Button
                  onClick={() => verifyAndEndBingo(player.id)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Verify & Award
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Players List */}
      {players.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-md md:p-6">
          <h3 className="mb-4 text-lg font-semibold">Active Players</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {players.map((player) => (
              <div
                key={player.id}
                className={`rounded-lg border p-4 ${
                  player.claimedBingo ? 'border-yellow-300 bg-yellow-50' : ''
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-medium">{player.username}</h4>
                  {player.claimedBingo && (
                    <span className="rounded-full bg-yellow-200 px-2 py-1 text-xs font-semibold text-yellow-800">
                      Claimed Bingo!
                    </span>
                  )}
                </div>
                
                {/* Bingo Card */}
                <div className="grid grid-cols-5 gap-1">
                  {player.cardNumbers.map((num, i) => (
                    <div
                      key={i}
                      className={`flex h-6 w-6 items-center justify-center rounded text-xs md:h-8 md:w-8 md:text-sm ${
                        player.matchedNumbers.includes(num)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}