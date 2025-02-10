import { useState, useEffect } from 'react';
import { VersusGames } from '@/components/game/versus-games';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dice1 as Dice, Binary as Bingo, Swords, Users, Trophy } from 'lucide-react';

interface Props {
  onBetClick: (gameId: string, teamId: 1 | 2, teamName: string, odds: number, prizePool: number) => void;
}

interface GameStatus {
  lucky2: boolean;
  bingo: boolean;
}

interface RpsRoom {
  id: string;
  hostUsername: string;
  stake: number;
  status: string;
  createdAt: Date;
}

export function HomePanel({ onBetClick }: Props) {
  const [activeGames, setActiveGames] = useState<GameStatus>({
    lucky2: false,
    bingo: false
  });
  const [rpsRooms, setRpsRooms] = useState<RpsRoom[]>([]);

  useEffect(() => {
    // Listen to Lucky2 game status
    const unsubLucky2 = onSnapshot(doc(db, 'gameRounds', 'lucky2Round'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setActiveGames(prev => ({
          ...prev,
          lucky2: data.status === 'open'
        }));
      }
    });

    // Listen to Bingo game status
    const unsubBingo = onSnapshot(doc(db, 'gameRounds', 'bingoRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setActiveGames(prev => ({
          ...prev,
          bingo: data.status === 'open'
        }));
      }
    });

    // Listen to active RPS rooms
    const rpsQuery = query(
      collection(db, 'rpsRooms'),
      where('status', '==', 'waiting')
    );

    const unsubRps = onSnapshot(rpsQuery, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as RpsRoom[];
      setRpsRooms(rooms.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });

    return () => {
      unsubLucky2();
      unsubBingo();
      unsubRps();
    };
  }, []);

  const navigateToGame = (game: 'lucky2' | 'bingo' | 'game') => {
    window.location.hash = 'game';
    // Add a small delay to ensure the game panel is mounted
    setTimeout(() => {
      const gameButton = document.querySelector(`[data-game="${game}"]`) as HTMLButtonElement;
      if (gameButton) {
        gameButton.click();
      }
    }, 100);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Welcome to Flower Bet</h1>
      
      {/* Quick Access Game Buttons - Only shown when active */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Lucky2 Game Button */}
        {activeGames.lucky2 && (
          <button
            onClick={() => navigateToGame('lucky2')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 p-8 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <div className="relative z-10 flex items-center space-x-4">
              <Dice className="h-12 w-12 text-white" />
              <div>
                <h3 className="text-xl font-bold">Lucky2</h3>
                <p className="mt-1 text-sm opacity-90">
                  Game is LIVE! Click to play!
                </p>
              </div>
            </div>
            <div className="absolute right-4 top-4">
              <span className="flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
              </span>
            </div>
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-70" />
          </button>
        )}

        {/* Bingo Game Button */}
        {activeGames.bingo && (
          <button
            onClick={() => navigateToGame('bingo')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-400 p-8 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <div className="relative z-10 flex items-center space-x-4">
              <Bingo className="h-12 w-12 text-white" />
              <div>
                <h3 className="text-xl font-bold">Bingo</h3>
                <p className="mt-1 text-sm opacity-90">
                  Game is LIVE! Click to play!
                </p>
              </div>
            </div>
            <div className="absolute right-4 top-4">
              <span className="flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
              </span>
            </div>
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-70" />
          </button>
        )}

        {/* RPS Rooms */}
        {rpsRooms.length > 0 && (
          <button
            onClick={() => navigateToGame('game')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-8 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <div className="relative z-10 space-y-4">
              <div className="flex items-center space-x-4">
                <Users className="h-12 w-12 text-white" />
                <div>
                  <h3 className="text-xl font-bold">Active RPS Rooms</h3>
                  <p className="mt-1 text-sm opacity-90">
                    {rpsRooms.length} room{rpsRooms.length !== 1 ? 's' : ''} waiting!
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {rpsRooms.slice(0, 2).map(room => (
                  <div key={room.id} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm">
                    <span className="font-medium">{room.hostUsername}</span>
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-4 w-4" />
                      <span>{room.stake} FBT</span>
                    </div>
                  </div>
                ))}
                {rpsRooms.length > 2 && (
                  <p className="text-center text-sm">
                    +{rpsRooms.length - 2} more rooms
                  </p>
                )}
              </div>
            </div>
            <div className="absolute right-4 top-4">
              <span className="flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
              </span>
            </div>
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-70" />
          </button>
        )}
      </div>
      
      {/* Active Versus Games */}
      <div>
        <div className="mb-6 flex items-center space-x-4">
          <Swords className="h-8 w-8 text-purple-500" />
          <h2 className="text-2xl font-semibold">Active Games</h2>
        </div>
        <VersusGames onBetClick={onBetClick} />
      </div>
    </div>
  );
}