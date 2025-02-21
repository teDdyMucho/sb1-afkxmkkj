import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dice1 as Dice, Binary as Bingo, Swords, Users as Horse } from 'lucide-react';
import { Lucky2Game } from './lucky2/lucky2-game';
import { BingoGame } from './bingo/bingo-game';
import { VersusGames } from './versus/versus-games';
import { HorseRaceGame } from './horse-race/horse-race-game';

interface GameStatus {
  lucky2: boolean;
  bingo: boolean;
  horse: boolean;
}

interface GameData {
  lucky2: {
    status: 'open' | 'closed';
    jackpot: number;
  };
  bingo: {
    status: 'open' | 'closed';
    numbers: string[];
  };
}

export function GamePanel() {
  const { user } = useAuthStore();
  const [gameStatus, setGameStatus] = useState<GameStatus>({
    lucky2: false,
    bingo: false,
    horse: false
  });
  const [gameData, setGameData] = useState<GameData>({
    lucky2: {
      status: 'closed',
      jackpot: 0
    },
    bingo: {
      status: 'closed',
      numbers: []
    }
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedGame, setSelectedGame] = useState<'lucky2' | 'bingo' | 'versus' | 'horse'>('lucky2');

  useEffect(() => {
    // Listen to Lucky2 game status
    const unsubLucky2 = onSnapshot(doc(db, 'gameRounds', 'lucky2Round'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGameStatus(prev => ({
          ...prev,
          lucky2: data.status === 'open'
        }));
        setGameData(prev => ({
          ...prev,
          lucky2: {
            status: data.status,
            jackpot: data.jackpot || 0
          }
        }));
      }
    });

    // Listen to Bingo game status
    const unsubBingo = onSnapshot(doc(db, 'gameRounds', 'bingoRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGameStatus(prev => ({
          ...prev,
          bingo: data.status === 'open'
        }));
        setGameData(prev => ({
          ...prev,
          bingo: {
            status: data.status,
            numbers: data.numbers || []
          }
        }));
      }
    });

    // Listen to Horse Race game status
    const unsubHorse = onSnapshot(doc(db, 'gameRounds', 'horseRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGameStatus(prev => ({
          ...prev,
          horse: data.status === 'open'
        }));
      }
    });

    // Listen for versus bet events
    const handleVersusBet = (event: CustomEvent) => {
      const { gameId, teamId, teamName, odds, prizePool } = event.detail;
      const betEvent = new CustomEvent('placeBet', {
        detail: { gameId, teamId, teamName, odds, prizePool }
      });
      window.dispatchEvent(betEvent);
    };

    window.addEventListener('versusBet', handleVersusBet as EventListener);

    return () => {
      unsubLucky2();
      unsubBingo();
      unsubHorse();
      window.removeEventListener('versusBet', handleVersusBet as EventListener);
    };
  }, []);

  const handleBetClick = (gameId: string, teamId: 1 | 2, teamName: string, odds: number, prizePool: number) => {
    const event = new CustomEvent('placeBet', {
      detail: { gameId, teamId, teamName, odds, prizePool }
    });
    window.dispatchEvent(event);
  };

  const games = [
    {
      id: 'lucky2',
      name: 'Lucky2',
      icon: Dice,
      color: 'from-yellow-400 via-orange-400 to-red-400',
      description: 'Pick your lucky numbers',
      status: gameStatus.lucky2 ? 'open' : 'closed'
    },
    {
      id: 'bingo',
      name: 'Bingo',
      icon: Bingo,
      color: 'from-blue-400 via-indigo-400 to-purple-400',
      description: 'Classic bingo game',
      status: gameStatus.bingo ? 'open' : 'closed'
    },
    {
      id: 'versus',
      name: 'Versus',
      icon: Swords,
      color: 'from-green-400 via-emerald-400 to-teal-400',
      description: 'Team vs Team betting'
    },
    {
      id: 'horse',
      name: 'Horse Race',
      icon: Horse,
      color: 'from-purple-400 via-pink-400 to-red-400',
      description: 'Virtual horse racing',
      status: gameStatus.horse ? 'open' : 'closed'
    }
  ] as const;

  const renderGameContent = () => {
    switch (selectedGame) {
      case 'lucky2':
        return (
          <Lucky2Game
            gameStatus={gameData.lucky2.status}
            jackpot={gameData.lucky2.jackpot}
            setError={setError}
            setMessage={setMessage}
          />
        );
      case 'bingo':
        return (
          <BingoGame
            gameStatus={gameData.bingo.status}
            bingoNumbers={gameData.bingo.numbers}
            setError={setError}
            setMessage={setMessage}
          />
        );
      case 'versus':
        return <VersusGames onBetClick={handleBetClick} />;
      case 'horse':
        return (
          <HorseRaceGame
            setError={setError}
            setMessage={setMessage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Selection Buttons */}
      <div className="grid gap-4 md:grid-cols-4">
        {games.map(({ id, name, icon: Icon, color, description, status }) => (
          <button
            key={id}
            onClick={() => setSelectedGame(id)}
            data-game={id}
            className={`group relative overflow-hidden rounded-xl p-6 shadow-lg transition-all hover:shadow-xl ${
              selectedGame === id
                ? `bg-gradient-to-br ${color} text-white`
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="relative z-10 flex items-center space-x-4">
              <Icon className={`h-12 w-12 ${selectedGame === id ? 'text-white' : `text-${color.split('-')[1]}-500`}`} />
              <div>
                <h3 className="text-xl font-bold">{name}</h3>
                <p className="mt-1 text-sm opacity-90">{description}</p>
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