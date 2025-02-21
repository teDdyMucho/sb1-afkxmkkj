import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Hand, Scroll, Scissors as ScissorsIcon, Check, Trophy, UserCircle2 } from 'lucide-react';
import { RpsGameControls } from './rps-game-controls';
import { RpsRematchDialog } from './rps-rematch-dialog';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

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
  rematchRequested: boolean;
  hostWantsRematch: boolean;
  guestWantsRematch: boolean;
}

export function RpsActiveGame({ setError, setMessage }: Props) {
  const { user } = useAuthStore();
  const [activeRoom, setActiveRoom] = useState<RpsRoom | null>(null);
  const [choice, setChoice] = useState<'rock' | 'paper' | 'scissors' | null>(null);
  const [showRematchDialog, setShowRematchDialog] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Listen to user's active room
    const roomsQuery = query(
      collection(db, 'rpsRooms'),
      where('status', 'in', ['waiting', 'playing']),
      where('hostId', '==', user.id)
    );

    const guestRoomsQuery = query(
      collection(db, 'rpsRooms'),
      where('status', 'in', ['waiting', 'playing']),
      where('guestId', '==', user.id)
    );

    const unsubHost = onSnapshot(roomsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const room = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
          createdAt: snapshot.docs[0].data().createdAt.toDate()
        } as RpsRoom;
        setActiveRoom(room);
        if (room.rematchRequested) {
          setShowRematchDialog(true);
        }
      }
    });

    const unsubGuest = onSnapshot(guestRoomsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const room = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
          createdAt: snapshot.docs[0].data().createdAt.toDate()
        } as RpsRoom;
        setActiveRoom(room);
        if (room.rematchRequested) {
          setShowRematchDialog(true);
        }
      }
    });

    return () => {
      unsubHost();
      unsubGuest();
    };
  }, [user?.id]);

  const handleRematchResponse = async (accept: boolean) => {
    if (!activeRoom || !user) return;

    const isHost = activeRoom.hostId === user.id;
    
    try {
      if (accept) {
        // Check if user has enough points for rematch
        if (user.points < activeRoom.stake) {
          setError('Insufficient points for rematch');
          return;
        }

        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', user.id);
          const userDoc = await transaction.get(userRef);
          
          if (!userDoc.exists()) {
            throw new Error('User not found');
          }

          const userData = userDoc.data();
          if (userData.points < activeRoom.stake) {
            throw new Error('Insufficient points');
          }

          // Update room with rematch response
          const roomRef = doc(db, 'rpsRooms', activeRoom.id);
          transaction.update(roomRef, {
            [isHost ? 'hostWantsRematch' : 'guestWantsRematch']: true,
            [isHost ? 'hostPaid' : 'guestPaid']: true
          });

          // Deduct points
          transaction.update(userRef, {
            points: increment(-activeRoom.stake)
          });

          // Record transaction
          const transactionRef = doc(collection(db, 'transactions'));
          transaction.set(transactionRef, {
            userId: user.id,
            username: user.username,
            amount: -activeRoom.stake,
            type: 'rps_rematch_stake',
            description: 'Rock Paper Scissors rematch stake',
            timestamp: new Date()
          });
        });

        setMessage('Rematch accepted');
      } else {
        // Decline rematch and end game
        const batch = writeBatch(db);
        const roomRef = doc(db, 'rpsRooms', activeRoom.id);
        
        batch.update(roomRef, {
          status: 'completed',
          rematchDeclined: true
        });

        // Refund the other player if they already paid
        const otherPlayerId = isHost ? activeRoom.guestId : activeRoom.hostId;
        if (otherPlayerId && ((isHost && activeRoom.guestPaid) || (!isHost && activeRoom.hostPaid))) {
          const otherPlayerRef = doc(db, 'users', otherPlayerId);
          batch.update(otherPlayerRef, {
            points: increment(activeRoom.stake)
          });
        }

        await batch.commit();
        setMessage('Rematch declined');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to rematch');
      console.error(err);
    } finally {
      setShowRematchDialog(false);
    }
  };

  if (!activeRoom) return null;

  return (
    <div className="space-y-4">
      <RpsGameControls
        room={activeRoom}
        choice={choice}
        setChoice={setChoice}
        setError={setError}
        setMessage={setMessage}
      />

      <RpsRematchDialog
        open={showRematchDialog}
        onOpenChange={setShowRematchDialog}
        onResponse={handleRematchResponse}
        stake={activeRoom.stake}
      />
    </div>
  );
}