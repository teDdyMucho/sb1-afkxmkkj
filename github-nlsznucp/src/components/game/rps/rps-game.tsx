import { useState } from 'react';
import { RpsRoomsList } from './rps-rooms-list';
import { RpsActiveGame } from './rps-active-game';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { doc, collection, setDoc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

export function RpsGame({ setError, setMessage }: Props) {
  const { user } = useAuthStore();
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const createRoom = async () => {
    if (!user || isCreatingRoom) return;

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

    setIsCreatingRoom(true);

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
          guestPaid: false,
          rematchRequested: false,
          hostWantsRematch: false,
          guestWantsRematch: false
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
    } finally {
      setIsCreatingRoom(false);
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
          <Button 
            onClick={createRoom} 
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
            disabled={isCreatingRoom}
          >
            <Trophy className="mr-2 h-4 w-4" />
            Create Room
          </Button>
        </div>

        <RpsActiveGame setError={setError} setMessage={setMessage} />
        <RpsRoomsList setError={setError} setMessage={setMessage} />
      </div>
    </div>
  );
}