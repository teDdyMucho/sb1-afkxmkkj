import { useState, useEffect } from 'react';
import { VersusGames } from '@/components/games/versus/versus-games';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dice1 as Dice, Binary as Bingo, Swords, Users as Horse } from 'lucide-react';

interface GameStatus {
  lucky2: boolean;
  bingo: boolean;
  horse: boolean;
}

export function HomePanel() {
  const [activeGames, setActiveGames] = useState<GameStatus>({
    lucky2: false,
    bingo: false,
    horse: false
  });

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

    // Listen to Horse Race game status
    const unsubHorse = onSnapshot(doc(db, 'gameRounds', 'horseRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setActiveGames(prev => ({
          ...prev,
          horse: data.status === 'open'
        }));
      }
    });

    return () => {
      unsubLucky2();
      unsubBingo();
      unsubHorse();
    };
  }, []);

  const navigateToGame = (game: 'lucky2' | 'bingo' | 'horse' | 'game') => {
    window.location.hash = 'game';
    // Add a small delay to ensure the game panel is mounted
    setTimeout(() => {
      const gameButton = document.querySelector(`[data-game="${game}"]`) as HTMLButtonElement;
      if (gameButton) {
        gameButton.click();
      }
    }, 100);
  };

  const handleBetClick = (gameId: string, teamId: 1 | 2, teamName: string, odds: number, prizePool: number) => {
    // Navigate to game panel and let it handle the betting
    window.location.hash = 'game';
    
    // Add a small delay to ensure the game panel is mounted and can handle the bet
    setTimeout(() => {
      const event = new CustomEvent('versusBet', {
        detail: { gameId, teamId, teamName, odds, prizePool }
      });
      window.dispatchEvent(event);
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

        {/* Horse Race Game Button */}
        {activeGames.horse && (
          <button
            onClick={() => navigateToGame('horse')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-8 text-white shadow-lg transition-all hover:shadow-xl"
          >
            <div className="relative z-10 flex items-center space-x-4">
              <Horse className="h-12 w-12 text-white" />
              <div>
                <h3 className="text-xl font-bold">Horse Race</h3>
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
      </div>
      
      {/* Active Versus Games */}
      <div>
        <div className="mb-6 flex items-center space-x-4">
          <Swords className="h-8 w-8 text-purple-500" />
          <h2 className="text-2xl font-semibold">Active Games</h2>
        </div>
        <VersusGames onBetClick={handleBetClick} />
      </div>
    </div>
  );
}