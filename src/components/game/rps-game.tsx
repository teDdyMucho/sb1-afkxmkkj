import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
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
  updateDoc, 
  writeBatch, 
  increment 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Hand, 
  Scroll, 
  Scissors as ScissorsIcon,
  Users,
  Trophy,
  X,
  Check,
  CircleDollarSign,
  Clock,
  UserCircle2,
  Plus
} from 'lucide-react';

interface RpsRoom {
  id: string;
  hostId: string;
  hostUsername: string;
  hostChoice?: 'rock' | 'paper' | 'scissors';
  guestId?: string;
  guestUsername?: string;
  guestChoice?: 'rock' | 'paper' | 'scissors';
  stake: number;
  status: 'waiting' | 'playing' | 'completed';
  winner?: string;
  roundWinner?: string;
  createdAt: Date;
  hostPaid: boolean;
  guestPaid: boolean;
}

const CHOICE_ICONS = {
  rock: Hand,
  paper: Scroll,
  scissors: ScissorsIcon
};

export function RpsGame() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<RpsRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<RpsRoom | null>(null);
  const [choice, setChoice] = useState<'rock' | 'paper' | 'scissors' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;

    // Listen to active rooms
    const roomsQuery = query(
      collection(db, 'rpsRooms'),
      where('status', 'in', ['waiting', 'playing'])
    );

    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const activeRooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as RpsRoom[];

      setRooms(activeRooms.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));

      // Update active room if user is in one
      const userRoom = activeRooms.find(room => 
        room.hostId === user.id || room.guestId === user.id
      );
      setActiveRoom(userRoom || null);
    });

    return () => unsubRooms();
  }, [user]);

  const createRoom = async () => {
    if (!user) return;

    const stake = prompt('Enter stake amount (FBT points):', '100');
    if (!stake) return;

    const stakeAmount = parseInt(stake);
    if (isNaN(stakeAmount) || stakeAmount < 10) {
      setError('Minimum stake is 10 FBT');
      return;
    }

    if (stakeAmount > user.points) {
      setError('Insufficient points');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // Deduct points from host immediately
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        if (userData.points < stakeAmount) {
          throw new Error('Insufficient points');
        }

        // Create room with hostPaid flag
        const roomRef = doc(collection(db, 'rpsRooms'));
        transaction.set(roomRef, {
          hostId: user.id,
          hostUsername: user.username,
          stake: stakeAmount,
          status: 'waiting',
          createdAt: new Date(),
          hostPaid: true,
          guestPaid: false
        });

        // Deduct points from host
        transaction.update(userRef, {
          points: increment(-stakeAmount)
        });

        // Record transaction
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: user.id,
          username: user.username,
          amount: -stakeAmount,
          type: 'rps_stake',
          description: 'Rock Paper Scissors stake',
          timestamp: new Date()
        });
      });
      
      setMessage('Room created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      console.error(err);
    }
  };

  const joinRoom = async (room: RpsRoom) => {
    if (!user || room.hostId === user.id) return;

    try {
      await runTransaction(db, async (transaction) => {
        // Check user points
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        if (userData.points < room.stake) {
          throw new Error('Insufficient points');
        }

        // Update room
        const roomRef = doc(db, 'rpsRooms', room.id);
        transaction.update(roomRef, {
          guestId: user.id,
          guestUsername: user.username,
          status: 'playing',
          guestPaid: true
        });

        // Deduct points from guest
        transaction.update(userRef, {
          points: increment(-room.stake)
        });

        // Record transaction
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          userId: user.id,
          username: user.username,
          amount: -room.stake,
          type: 'rps_stake',
          description: 'Rock Paper Scissors stake',
          timestamp: new Date()
        });
      });

      setMessage('Joined room successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      console.error(err);
    }
  };

  const makeChoice = async (selectedChoice: 'rock' | 'paper' | 'scissors') => {
    if (!activeRoom || !user) return;

    const isHost = activeRoom.hostId === user.id;
    const choiceField = isHost ? 'hostChoice' : 'guestChoice';

    try {
      const roomRef = doc(db, 'rpsRooms', activeRoom.id);
      
      // Update the player's choice
      await updateDoc(roomRef, {
        [choiceField]: selectedChoice
      });

      setChoice(selectedChoice);

      // Get the updated room data
      const roomDoc = await getDoc(roomRef);
      if (!roomDoc.exists()) {
        throw new Error('Room not found');
      }

      const updatedRoom = { id: roomDoc.id, ...roomDoc.data() } as RpsRoom;

      // Check if both players have made their choices
      if (updatedRoom.hostChoice && updatedRoom.guestChoice) {
        // Determine winner
        const result = determineWinner(updatedRoom.hostChoice, updatedRoom.guestChoice);
        const totalPrize = activeRoom.stake * 2; // Total prize pool from both players
        const houseFee = Math.floor(totalPrize * 0.05); // 5% fee from total prize
        const winningPrize = totalPrize - houseFee; // Winner gets remaining 95%

        let winnerId: string | undefined;
        let winnerUsername: string | undefined;

        if (result === 'host') {
          winnerId = updatedRoom.hostId;
          winnerUsername = updatedRoom.hostUsername;
        } else if (result === 'guest') {
          winnerId = updatedRoom.guestId;
          winnerUsername = updatedRoom.guestUsername;
        }

        const batch = writeBatch(db);

        // Record the round result
        const roundRef = doc(collection(db, 'rpsRounds'));
        batch.set(roundRef, {
          roomId: activeRoom.id,
          hostId: updatedRoom.hostId,
          hostUsername: updatedRoom.hostUsername,
          guestId: updatedRoom.guestId,
          guestUsername: updatedRoom.guestUsername,
          hostChoice: updatedRoom.hostChoice,
          guestChoice: updatedRoom.guestChoice,
          winner: winnerUsername || 'Draw',
          stake: updatedRoom.stake,
          timestamp: new Date()
        });

        // Reset choices for next round
        batch.update(roomRef, {
          hostChoice: null,
          guestChoice: null,
          roundWinner: winnerUsername || 'Draw'
        });

        if (winnerId && winnerUsername) {
          // Award prize to winner (95% of total prize pool)
          const winnerRef = doc(db, 'users', winnerId);
          batch.update(winnerRef, {
            points: increment(winningPrize)
          });

          // Record winning transaction
          const winTransactionRef = doc(collection(db, 'transactions'));
          batch.set(winTransactionRef, {
            userId: winnerId,
            username: winnerUsername,
            amount: winningPrize,
            type: 'rps_win',
            description: 'Won Rock Paper Scissors round (after 5% fee)',
            timestamp: new Date()
          });

          // Record house fee
          const feeTransactionRef = doc(collection(db, 'transactions'));
          batch.set(feeTransactionRef, {
            type: 'admin_profit',
            gameType: 'rps',
            amount: houseFee,
            description: 'Rock Paper Scissors house fee (5% of total prize)',
            timestamp: new Date()
          });
        } else {
          // In case of a draw, return stakes to both players
          const hostRef = doc(db, 'users', updatedRoom.hostId);
          const guestRef = doc(db, 'users', updatedRoom.guestId!);
          
          batch.update(hostRef, {
            points: increment(updatedRoom.stake)
          });
          batch.update(guestRef, {
            points: increment(updatedRoom.stake)
          });

          // Record refund transactions
          const hostRefundRef = doc(collection(db, 'transactions'));
          const guestRefundRef = doc(collection(db, 'transactions'));
          
          batch.set(hostRefundRef, {
            userId: updatedRoom.hostId,
            username: updatedRoom.hostUsername,
            amount: updatedRoom.stake,
            type: 'rps_draw',
            description: 'Rock Paper Scissors round draw - stake returned',
            timestamp: new Date()
          });
          
          batch.set(guestRefundRef, {
            userId: updatedRoom.guestId,
            username: updatedRoom.guestUsername,
            amount: updatedRoom.stake,
            type: 'rps_draw',
            description: 'Rock Paper Scissors round draw - stake returned',
            timestamp: new Date()
          });
        }

        await batch.commit();
        
        setMessage(winnerId 
          ? `Round ended! Winner: ${winnerUsername} (+${winningPrize} FBT after 5% fee)` 
          : 'Round ended in a draw!'
        );
        setChoice(null); // Reset choice for next round
      }
    } catch (err) {
      setError('Failed to make choice');
      console.error(err);
    }
  };

  const determineWinner = (hostChoice: string, guestChoice: string): 'host' | 'guest' | 'draw' => {
    if (hostChoice === guestChoice) return 'draw';
    
    if (
      (hostChoice === 'rock' && guestChoice === 'scissors') ||
      (hostChoice === 'paper' && guestChoice === 'rock') ||
      (hostChoice === 'scissors' && guestChoice === 'paper')
    ) {
      return 'host';
    }
    
    return 'guest';
  };

  const endGame = async () => {
    if (!activeRoom || !user || activeRoom.hostId !== user.id) return;

    if (!confirm('Are you sure you want to end this game? Stakes will be returned to both players.')) {
      return;
    }

    try {
      const batch = writeBatch(db);
      const roomRef = doc(db, 'rpsRooms', activeRoom.id);

      // Return stakes to players
      const hostRef = doc(db, 'users', activeRoom.hostId);
      batch.update(hostRef, {
        points: increment(activeRoom.stake)
      });

      // Add refund transaction for host
      const hostRefundRef = doc(collection(db, 'transactions'));
      batch.set(hostRefundRef, {
        userId: activeRoom.hostId,
        username: activeRoom.hostUsername,
        amount: activeRoom.stake,
        type: 'rps_refund',
        description: 'Rock Paper Scissors game ended by host - stake returned',
        timestamp: new Date()
      });

      if (activeRoom.guestId) {
        const guestRef = doc(db, 'users', activeRoom.guestId);
        batch.update(guestRef, {
          points: increment(activeRoom.stake)
        });

        // Add refund transaction for guest
        const guestRefundRef = doc(collection(db, 'transactions'));
        batch.set(guestRefundRef, {
          userId: activeRoom.guestId,
          username: activeRoom.guestUsername,
          amount: activeRoom.stake,
          type: 'rps_refund',
          description: 'Rock Paper Scissors game ended by host - stake returned',
          timestamp: new Date()
        });
      }

      // Update room status
      batch.update(roomRef, {
        status: 'completed',
        endedByHost: true
      });

      await batch.commit();
      setMessage('Game ended and stakes returned');
    } catch (err) {
      setError('Failed to end game');
      console.error(err);
    }
  };

  const quitGame = async () => {
    if (!activeRoom || !user || user.id === activeRoom.hostId) return;

    if (!confirm('Are you sure you want to quit? You will lose your stake.')) {
      return;
    }

    try {
      const batch = writeBatch(db);
      const roomRef = doc(db, 'rpsRooms', activeRoom.id);

      // Return stake to host
      const hostRef = doc(db, 'users', activeRoom.hostId);
      batch.update(hostRef, {
        points: increment(activeRoom.stake)
      });

      // Add refund transaction for host
      const hostRefundRef = doc(collection(db, 'transactions'));
      batch.set(hostRefundRef, {
        userId: activeRoom.hostId,
        username: activeRoom.hostUsername,
        amount: activeRoom.stake,
        type: 'rps_refund',
        description: 'Rock Paper Scissors game - opponent quit',
        timestamp: new Date()
      });

      // Update room status
      batch.update(roomRef, {
        status: 'completed',
        guestQuit: true
      });

      await batch.commit();
      setMessage('You quit the game. Your stake was forfeited.');
    } catch (err) {
      setError('Failed to quit game');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Panel */}
      <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-6 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Trophy className="h-8 w-8 text-purple-500" />
            <h2 className="text-2xl font-bold text-purple-900">Rock Paper Scissors</h2>
          </div>
          {!activeRoom && (
            <Button 
              onClick={createRoom} 
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Room
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {activeRoom ? (
          <div className="overflow-hidden rounded-lg border border-purple-100 bg-white shadow-lg">
            <div className="border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-purple-900">Active Game</h3>
                  <div className="flex items-center space-x-2 text-sm">
                    <CircleDollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700">
                      Stake: {activeRoom.stake} FBT
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 rounded-full bg-yellow-100 px-3 py-1.5">
                    <Clock className="h-4 w-4 text-yellow-700" />
                    <span className="text-sm font-medium text-yellow-800">
                      {activeRoom.status === 'waiting' ? 'Waiting for opponent' : 'Game in progress'}
                    </span>
                  </div>
                  {activeRoom.hostId === user?.id ? (
                    <Button
                      onClick={endGame}
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      End Game
                    </Button>
                  ) : (
                    <Button
                      onClick={quitGame}
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Quit Game
                    </Button>
                  )}
                </div>
              </div>
              {activeRoom.roundWinner && (
                <div className="mt-3 flex items-center space-x-2 rounded-full bg-green-100 px-3 py-1.5">
                  <Trophy className="h-4 w-4 text-green-700" />
                  <span className="text-sm font-medium text-green-800">
                    Last round winner: {activeRoom.roundWinner}
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-8 p-6 md:grid-cols-2">
              {/* Host */}
              <div className="space-y-4 rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserCircle2 className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-900">{activeRoom.hostUsername}</span>
                  </div>
                  <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                    Host
                  </span>
                </div>
                {activeRoom.hostId === user?.id && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-purple-800">Make your choice:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['rock', 'paper', 'scissors'] as const).map((option) => {
                        const Icon = CHOICE_ICONS[option];
                        return (
                          <Button
                            key={option}
                            onClick={() => makeChoice(option)}
                            disabled={!!choice}
                            variant={choice === option ? 'default' : 'outline'}
                            className={`flex flex-col items-center space-y-1 py-4 ${
                              choice === option 
                                ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700' 
                                : 'hover:border-purple-300 hover:bg-purple-50'
                            }`}
                          >
                            <Icon className="h-6 w-6" />
                            <span className="text-xs capitalize">{option}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {activeRoom.hostChoice && (
                  <div className="flex items-center justify-center rounded-full bg-green-100 py-2 text-sm font-medium text-green-800">
                    <Check className="mr-1.5 h-4 w-4" />
                    Choice made
                  </div>
                )}
              </div>

              {/* Guest */}
              <div className="space-y-4 rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-transparent p-4">
                {activeRoom.guestId ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <UserCircle2 className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-900">{activeRoom.guestUsername}</span>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        Guest
                      </span>
                    </div>
                    {activeRoom.guestId === user?.id && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-blue-800">Make your choice:</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['rock', 'paper', 'scissors'] as const).map((option) => {
                            const Icon = CHOICE_ICONS[option];
                            return (
                              <Button
                                key={option}
                                onClick={() => makeChoice(option)}
                                disabled={!!choice}
                                variant={choice === option ? 'default' : 'outline'}
                                className={`flex flex-col items-center space-y-1 py-4 ${
                                  choice === option 
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700' 
                                    : 'hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                <Icon className="h-6 w-6" />
                                <span className="text-xs capitalize">{option}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {activeRoom.guestChoice && (
                      <div className="flex items-center justify-center rounded-full bg-green-100 py-2 text-sm font-medium text-green-800">
                        <Check className="mr-1.5 h-4 w-4" />
                        Choice made
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-blue-500">
                    <div className="text-center">
                      <Users className="mx-auto h-12 w-12 opacity-50" />
                      <p className="mt-2 text-sm">Waiting for opponent...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="group relative overflow-hidden rounded-lg border border-purple-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-blue-50/50 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <UserCircle2 className="h-5 w-5 text-purple-500" />
                        <span className="font-medium text-purple-900">{room.hostUsername}'s Room</span>
                      </div>
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                        {room.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CircleDollarSign className="h-5 w-5 text-green-500" />
                        <span className="text-sm font-medium text-green-700">
                          Stake: {room.stake} FBT
                        </span>
                      </div>
                    </div>

                    {room.hostId !== user?.id && (
                      <Button
                        onClick={() => joinRoom(room)}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white transition-all hover:from-purple-700 hover:to-blue-700"
                      >
                        Join Game
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {rooms.length === 0 && (
              <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-purple-200">
                <Trophy className="h-12 w-12 text-purple-300" />
                <p className="mt-2 text-purple-600">
                  No active rooms. Create one to start playing!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}