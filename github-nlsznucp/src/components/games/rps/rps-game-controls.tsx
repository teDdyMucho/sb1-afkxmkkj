import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { doc, updateDoc, writeBatch, increment, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Hand, Scroll, Scissors as ScissorsIcon, Check, Trophy, UserCircle2 } from 'lucide-react';

interface Props {
  room: RpsRoom;
  choice: 'rock' | 'paper' | 'scissors' | null;
  setChoice: (choice: 'rock' | 'paper' | 'scissors' | null) => void;
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

const CHOICE_ICONS = {
  rock: Hand,
  paper: Scroll,
  scissors: ScissorsIcon
};

export function RpsGameControls({ room, choice, setChoice, setError, setMessage }: Props) {
  const { user } = useAuthStore();
  if (!user) return null;

  const makeChoice = async (selectedChoice: 'rock' | 'paper' | 'scissors') => {
    if (!room || !user) return;

    const isHost = room.hostId === user.id;
    const choiceField = isHost ? 'hostChoice' : 'guestChoice';

    try {
      const roomRef = doc(db, 'rpsRooms', room.id);
      
      // Update the player's choice
      await updateDoc(roomRef, {
        [choiceField]: selectedChoice
      });

      setChoice(selectedChoice);
      setMessage('Choice made successfully');

      // Process round result if both players have chosen
      if ((isHost && room.guestChoice) || (!isHost && room.hostChoice)) {
        const otherChoice = isHost ? room.guestChoice : room.hostChoice;
        const result = determineWinner(selectedChoice, otherChoice!);
        
        const batch = writeBatch(db);
        const totalPrize = room.stake * 2;
        const houseFee = Math.floor(totalPrize * 0.05);
        const winningPrize = totalPrize - houseFee;

        let winnerId: string | undefined;
        let winnerUsername: string | undefined;

        if (result === 'host') {
          winnerId = room.hostId;
          winnerUsername = room.hostUsername;
        } else if (result === 'guest') {
          winnerId = room.guestId;
          winnerUsername = room.guestUsername;
        }

        if (winnerId && winnerUsername) {
          // Award prize to winner
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
          const hostRef = doc(db, 'users', room.hostId);
          const guestRef = doc(db, 'users', room.guestId!);
          
          batch.update(hostRef, {
            points: increment(room.stake)
          });
          batch.update(guestRef, {
            points: increment(room.stake)
          });

          // Record refund transactions
          const hostRefundRef = doc(collection(db, 'transactions'));
          const guestRefundRef = doc(collection(db, 'transactions'));
          
          batch.set(hostRefundRef, {
            userId: room.hostId,
            username: room.hostUsername,
            amount: room.stake,
            type: 'rps_draw',
            description: 'Rock Paper Scissors round draw - stake returned',
            timestamp: new Date()
          });
          
          batch.set(guestRefundRef, {
            userId: room.guestId,
            username: room.guestUsername,
            amount: room.stake,
            type: 'rps_draw',
            description: 'Rock Paper Scissors round draw - stake returned',
            timestamp: new Date()
          });
        }

        // Update room with round result and enable rematch option
        batch.update(roomRef, {
          roundWinner: winnerUsername || 'Draw',
          rematchRequested: true,
          hostWantsRematch: false,
          guestWantsRematch: false,
          hostPaid: false,
          guestPaid: false,
          hostChoice: null,
          guestChoice: null
        });

        await batch.commit();
        setChoice(null);
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

  const isHost = room.hostId === user.id;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Host */}
      <div className="space-y-4 rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCircle2 className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-900">{room.hostUsername}</span>
          </div>
          <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
            Host
          </span>
        </div>
        {isHost && (
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
        {room.hostChoice && (
          <div className="flex items-center justify-center rounded-full bg-green-100 py-2 text-sm font-medium text-green-800">
            <Check className="mr-1.5 h-4 w-4" />
            Choice made
          </div>
        )}
      </div>

      {/* Guest */}
      <div className="space-y-4 rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-transparent p-4">
        {room.guestId ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCircle2 className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">{room.guestUsername}</span>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                Guest
              </span>
            </div>
            {!isHost && (
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
            {room.guestChoice && (
              <div className="flex items-center justify-center rounded-full bg-green-100 py-2 text-sm font-medium text-green-800">
                <Check className="mr-1.5 h-4 w-4" />
                Choice made
              </div>
            )}
          </>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-blue-500">
            <div className="text-center">
              <Trophy className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-2 text-sm">Waiting for opponent...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}