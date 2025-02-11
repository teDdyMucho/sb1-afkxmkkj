import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { VersusGameSettings } from './types';

interface Props {
  settings: VersusGameSettings;
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

export function CreateGameForm({ settings, setError, setMessage }: Props) {
  const [newGame, setNewGame] = useState({
    team1: '',
    team2: '',
    team1Image: '',
    team2Image: '',
    bannerImage: ''
  });

  const startVersus = async () => {
    if (!newGame.team1 || !newGame.team2) {
      setError('Please enter both team names');
      return;
    }

    try {
      // Calculate end time based on settings
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + settings.defaultDuration);

      await addDoc(collection(db, 'versusGames'), {
        status: 'open',
        startedAt: new Date(),
        createdAt: new Date(),
        endTime,
        bettingEnabled: settings.bettingEnabled,
        teams: {
          team1: newGame.team1,
          team2: newGame.team2,
          team1Image: newGame.team1Image,
          team2Image: newGame.team2Image,
          bannerImage: newGame.bannerImage
        },
        odds: { team1: 2.0, team2: 2.0 },
        bets: [],
        totalBets: 0,
        prizePool: 0
      });

      setMessage('New versus game started');
      setNewGame({
        team1: '',
        team2: '',
        team1Image: '',
        team2Image: '',
        bannerImage: ''
      });
    } catch (err) {
      setError('Failed to start versus game');
      console.error(err);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">Create New Versus Game</h2>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Team 1 Name
            </label>
            <input
              type="text"
              value={newGame.team1}
              onChange={(e) => setNewGame(prev => ({ ...prev, team1: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <label className="mt-2 block text-sm font-medium text-gray-700">
              Team 1 Image URL
            </label>
            <input
              type="url"
              value={newGame.team1Image}
              onChange={(e) => setNewGame(prev => ({ ...prev, team1Image: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="https://example.com/team1.jpg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Team 2 Name
            </label>
            <input
              type="text"
              value={newGame.team2}
              onChange={(e) => setNewGame(prev => ({ ...prev, team2: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <label className="mt-2 block text-sm font-medium text-gray-700">
              Team 2 Image URL
            </label>
            <input
              type="url"
              value={newGame.team2Image}
              onChange={(e) => setNewGame(prev => ({ ...prev, team2Image: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="https://example.com/team2.jpg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Banner Image URL
          </label>
          <input
            type="url"
            value={newGame.bannerImage}
            onChange={(e) => setNewGame(prev => ({ ...prev, bannerImage: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="https://example.com/banner.jpg"
          />
        </div>

        <Button
          onClick={startVersus}
          className="mt-4 bg-green-600 hover:bg-green-700"
        >
          Create New Game
        </Button>
      </div>
    </div>
  );
}