import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Timer } from 'lucide-react';
import { VersusGameSettings, VersusGame } from './types';
import { GameSettingsDialog } from './game-settings-dialog';
import { CreateGameForm } from './create-game-form';
import { GameCard } from './game-card';
import { useVersusSettings } from './use-versus-settings';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

export function VersusAdmin({ setError, setMessage }: Props) {
  const [activeGames, setActiveGames] = useState<VersusGame[]>([]);
  const { settings, isSettingsOpen, setIsSettingsOpen, updateSettings } = useVersusSettings({ setError, setMessage });

  useEffect(() => {
    // Listen to active versus games
    const gamesQuery = query(
      collection(db, 'versusGames'),
      where('status', '==', 'open')
    );

    const unsubGames = onSnapshot(gamesQuery, (snapshot) => {
      const games = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as VersusGame[];
      setActiveGames(games.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });

    return () => unsubGames();
  }, []);

  return (
    <div className="space-y-6">
      {/* Settings Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setIsSettingsOpen(true)}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <Timer className="h-4 w-4" />
          <span>Game Settings</span>
        </Button>
      </div>

      {/* Create New Game */}
      <CreateGameForm settings={settings} setError={setError} setMessage={setMessage} />

      {/* Active Games */}
      {activeGames.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          setError={setError}
          setMessage={setMessage}
        />
      ))}

      {/* Settings Dialog */}
      <GameSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSave={updateSettings}
      />
    </div>
  );
}