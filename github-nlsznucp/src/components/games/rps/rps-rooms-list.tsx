import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trophy, CircleDollarSign, UserCircle2 } from 'lucide-react';

interface Props {
  onGameSelect: (id: string) => void;
  onGameJoin: (id: string) => void;
  setError: (error: string) => void;
  showLeaderboard: boolean;
}

interface RpsRoom {
  id: string;
  hostId: string;
  hostUsername: string;
  stake: number;
  status: string;
  createdAt: Date;
}

export function RpsRoomsList({ onGameSelect, onGameJoin, setError, showLeaderboard }: Props) {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<RpsRoom[]>([]);

  useEffect(() => {
    // Listen to available rooms
    const roomsQuery = query(
      collection(db, 'rpsRooms'),
      where('status', '==', 'waiting')
    );

    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const availableRooms = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate()
        }))
        .filter(room => room.hostId !== user?.id) as RpsRoom[];
      
      setRooms(availableRooms.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });

    return () => unsubRooms();
  }, [user?.id]);

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

      onGameJoin(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      console.error(err);
    }
  };

  if (rooms.length === 0) {
    return (
      <div className="mt-6 flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-purple-200">
        <Trophy className="h-12 w-12 text-purple-300" />
        <p className="mt-2 text-purple-600">
          No active rooms. Create one to start playing!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="group relative overflow-hidden rounded-lg border border-purple-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
        >
          <div className="relative z-10 space-y-4">
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

            <Button
              onClick={() => joinRoom(room)}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white transition-all hover:from-purple-700 hover:to-blue-700"
            >
              Join Game
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}