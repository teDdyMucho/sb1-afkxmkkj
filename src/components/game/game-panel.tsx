import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dice1 as Dice, Binary as Bingo, Swords, Hand as HandRock } from 'lucide-react';
import { Lucky2Game } from './lucky2-game';
import { BingoGame } from './bingo-game';
import { RpsGame } from './rps-game';

interface GameInfo {
  status: string;
  jackpot?: number;
  gameType?: 'lucky2' | 'bingo' | 'versus' | 'rps';
  numbers?: string[];
  teams?: {
    team1: string;
    team2: string;
  };
  odds?: {
    team1: number;
    team2: number;
  };
}

export function GamePanel() {
  const { user } = useAuthStore();
  const [lucky2Status, setLucky2Status] = useState('closed');
  const [bingoStatus, setBingoStatus] = useState('closed');
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [lucky2Jackpot, setLucky2Jackpot] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [bingoNumbers, setBingoNumbers] = useState<string[]>([]);
  const [selectedGame, setSelectedGame] = useState<'lucky2' | 'bingo' | 'versus' | 'rps'>('lucky2');

  useEffect(() => {
    if (!user) return;

    // Listen to Lucky2 game status
    const unsubLucky2 = onSnapshot(doc(db, 'gameRounds', 'lucky2Round'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as GameInfo;
        setLucky2Status(data.status);
        setLucky2Jackpot(data.jackpot || 0);
        if (data.status === 'open') {
          setActiveGame('lucky2');
        }
      }
    });

    // Listen to Bingo game status
    const unsubBingo = onSnapshot(doc(db, 'gameRounds', 'bingoRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as GameInfo;
        setBingoStatus(data.status);
        setBingoNumbers(data.numbers || []);
        if (data.status === 'open') {
          setActiveGame('bingo');
        }
      }
    });

    return () => {
      unsubLucky2();
      unsubBingo();
    };
  }, [user]);

  const games = [
    {
      id: 'lucky2',
      name: 'Lucky2',
      icon: Dice,
      color: 'from-yellow-400 via-orange-400 to-red-400',
      description: 'Pick your lucky numbers',
      status: lucky2Status
    },
    {
      id: 'bingo',
      name: 'Bingo',
      icon: Bingo,
      color: 'from-blue-400 via-indigo-400 to-purple-400',
      description: 'Classic bingo game',
      status: bingoStatus
    },
    {
      id: 'versus',
      name: 'Versus',
      icon: Swords,
      color: 'from-green-400 via-emerald-400 to-teal-400',
      description: 'Team vs Team betting'
    },
    {
      id: 'rps',
      name: 'Rock Paper Scissors',
      icon: HandRock,
      color: 'from-purple-400 via-pink-400 to-red-400',
      description: 'Player vs Player RPS'
    }
  ] as const;

  const renderGameContent = () => {
    switch (selectedGame) {
      case 'lucky2':
        return (
          <Lucky2Game
            gameStatus={lucky2Status}
            jackpot={lucky2Jackpot}
            setError={setError}
            setMessage={setMessage}
          />
        );
      case 'bingo':
        return (
          <BingoGame
            gameStatus={bingoStatus}
            bingoNumbers={bingoNumbers}
            setError={setError}
            setMessage={setMessage}
          />
        );
      case 'versus':
        return null; // Versus game content will be handled separately
      case 'rps':
        return <RpsGame />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Selection Buttons */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {games.map(({ id, name, icon: Icon, color, description, status }) => (
          <button
            key={id}
            onClick={() => setSelectedGame(id)}
            data-game={id}
            className={`group relative overflow-hidden rounded-xl p-6 shadow-lg transition-all hover:shadow-xl ${
              selectedGame === id
                ? `bg-gradient-to-br ${color} text-white`
                : `bg-gradient-to-br from-${color.split('-')[1]}-50 via-${color.split('-')[3]}-50 to-${color.split('-')[5]}-50 text-gray-700 hover:from-${color.split('-')[1]}-100 hover:via-${color.split('-')[3]}-100 hover:to-${color.split('-')[5]}-100`
            }`}
          >
            <div className="relative z-10 flex flex-col items-center space-y-4">
              <Icon className={`h-12 w-12 ${selectedGame === id ? 'text-white' : `text-${color.split('-')[1]}-500`}`} />
              <div className="text-center">
                <h3 className="text-xl font-bold">{name}</h3>
                <p className="mt-1 text-sm opacity-80">{description}</p>
                {status && (
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${
                    status === 'open' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {status === 'open' ? 'LIVE' : 'Closed'}
                  </span>
                )}
              </div>
            </div>
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-70" />
          </button>
        ))}
      </div>

      {/* Game Content */}
      <div className="mt-8">
        {renderGameContent()}
      </div>

      {/* Error and Message Display */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}
    </div>
  );
}