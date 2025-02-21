import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  writeBatch,
  getDoc,
  updateDoc,
  getDocs,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Image as ImageIcon, Edit2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface TeamBet {
  userId: string;
  amount: number;
  team: 1 | 2;
}

interface VersusGame {
  id: string;
  status: string;
  teams: {
    team1: string;
    team2: string;
    team1Image: string;
    team2Image: string;
    bannerImage: string;
  };
  odds: {
    team1: number;
    team2: number;
  };
  bets: TeamBet[];
  totalBets: number;
  createdAt: Date;
}

const MIN_ODDS = 1.1;
const MAX_ODDS = 10.0;
const HOUSE_EDGE = 0.1; // 10% house edge

function calculateOdds(team1Total: number, team2Total: number): { team1: number; team2: number } {
  if (team1Total === 0 && team2Total === 0) {
    return { team1: 2.0, team2: 2.0 };
  }

  const total = team1Total + team2Total;
  const impliedTeam1 = team1Total / total;
  const impliedTeam2 = team2Total / total;

  // Apply house edge and calculate true odds
  const team1Odds = Math.min(MAX_ODDS, Math.max(MIN_ODDS, (1 / impliedTeam1) * (1 + HOUSE_EDGE)));
  const team2Odds = Math.min(MAX_ODDS, Math.max(MIN_ODDS, (1 / impliedTeam2) * (1 + HOUSE_EDGE)));

  return {
    team1: Number(team1Odds.toFixed(2)),
    team2: Number(team2Odds.toFixed(2))
  };
}

function ImageEditDialog({ 
  open, 
  onOpenChange, 
  currentUrl,
  onSave,
  title
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string;
  onSave: (url: string) => Promise<void>;
  title: string;
}) {
  const [url, setUrl] = useState(currentUrl);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await onSave(url);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            {title}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Image URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>

            {url && (
              <div className="rounded-lg border p-2">
                <img
                  src={url}
                  alt="Preview"
                  className="h-48 w-full rounded-lg object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = 'https://via.placeholder.com/400x300?text=Invalid+Image+URL';
                  }}
                />
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || !url}
              >
                {isProcessing ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function VersusAdmin({ setError, setMessage }: Props) {
  const [activeGames, setActiveGames] = useState<VersusGame[]>([]);
  const [newGame, setNewGame] = useState({
    team1: '',
    team2: '',
    team1Image: '',
    team2Image: '',
    bannerImage: ''
  });
  const [editingImage, setEditingImage] = useState<{
    gameId: string;
    type: 'team1' | 'team2' | 'banner';
    currentUrl: string;
  } | null>(null);

  useEffect(() => {
    // Listen to all active versus games
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

  const handleImageEdit = async (url: string) => {
    if (!editingImage) return;

    try {
      const batch = writeBatch(db);
      const gameRef = doc(db, 'versusGames', editingImage.gameId);
      const currentGame = activeGames.find(g => g.id === editingImage.gameId);

      if (currentGame) {
        batch.update(gameRef, {
          teams: {
            ...currentGame.teams,
            [`${editingImage.type}Image`]: url
          }
        });
        await batch.commit();
        setMessage('Image updated successfully');
      }

      setEditingImage(null);
    } catch (err) {
      setError('Failed to update image');
      console.error(err);
    }
  };

  const startVersus = async () => {
    if (!newGame.team1 || !newGame.team2) {
      setError('Please enter both team names');
      return;
    }

    try {
      await addDoc(collection(db, 'versusGames'), {
        status: 'open',
        startedAt: new Date(),
        createdAt: new Date(),
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

  const setInitialFunds = async (gameId: string) => {
    const amount = prompt('Enter initial prize pool amount:');
    if (!amount) return;

    const funds = parseInt(amount);
    if (isNaN(funds) || funds < 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const batch = writeBatch(db);
      const gameRef = doc(db, 'versusGames', gameId);

      // Update game's prize pool using increment
      batch.update(gameRef, {
        prizePool: increment(funds)
      });

      // Record transaction
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, {
        type: 'admin_versus_fund',
        amount: funds,
        description: 'Initial versus game funding',
        timestamp: new Date()
      });

      await batch.commit();
      setMessage(`Added ${funds} FBT to prize pool`);
    } catch (err) {
      setError('Failed to set initial funds');
      console.error(err);
    }
  };

  const endVersus = async (gameId: string) => {
    const winner = prompt('Enter winning team (1 or 2):');
    if (!winner || (winner !== '1' && winner !== '2')) {
      setError('Please enter a valid team number (1 or 2)');
      return;
    }

    try {
      const batch = writeBatch(db);
      const gameRef = doc(db, 'versusGames', gameId);
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        setError('Game not found');
        return;
      }

      const game = gameDoc.data() as VersusGame;
      const winningTeam = parseInt(winner) as 1 | 2;
      const winningOdds = winningTeam === 1 ? game.odds.team1 : game.odds.team2;

      // Get all bets for this game
      const betsQuery = query(
        collection(db, 'versusBets'),
        where('gameId', '==', gameId),
        where('status', '==', 'pending')
      );
      const betsSnapshot = await getDocs(betsQuery);

      // Calculate total bets and house fee
      const totalBets = game.prizePool;
      const houseFee = Math.floor(totalBets * 0.1); // 10% house fee
      let totalWinnings = 0;

      // Process winners
      for (const betDoc of betsSnapshot.docs) {
        const bet = betDoc.data();
        const betRef = doc(db, 'versusBets', betDoc.id);

        if (bet.team === winningTeam) {
          // Calculate winnings (90% of potential win)
          const winnings = Math.floor(bet.amount * winningOdds * 0.9);
          totalWinnings += winnings;

          // Update user's cash balance using increment
          const userRef = doc(db, 'users', bet.userId);
          batch.update(userRef, {
            cash: increment(winnings)
          });

          // Add win transaction
          const winTransactionRef = doc(collection(db, 'transactions'));
          batch.set(winTransactionRef, {
            userId: bet.userId,
            username: bet.username,
            amount: winnings,
            type: 'versus_win',
            description: `Won versus bet on ${winningTeam === 1 ? game.teams.team1 : game.teams.team2} (after 10% fee)`,
            timestamp: new Date()
          });

          // Update bet status
          batch.update(betRef, {
            status: 'won',
            winnings,
            completedAt: new Date()
          });
        } else {
          // Update losing bet status
          batch.update(betRef, {
            status: 'lost',
            winnings: 0,
            completedAt: new Date()
          });
        }
      }

      // Record house profit
      const profitRef = doc(collection(db, 'transactions'));
      batch.set(profitRef, {
        type: 'admin_profit',
        gameType: 'versus',
        amount: houseFee,
        description: 'Versus game house fee (10% of total bets)',
        timestamp: new Date()
      });

      // Update game status
      batch.update(gameRef, {
        status: 'completed',
        winner: winner === '1' ? game.teams.team1 : game.teams.team2,
        endedAt: new Date(),
        totalWinnings,
        houseFee
      });

      await batch.commit();
      setMessage(`Game ended - Winners received ${totalWinnings} CASH (House fee: ${houseFee})`);
    } catch (err) {
      setError('Failed to end versus game');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Game */}
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

      {/* Active Games */}
      {activeGames.map((game) => (
        <div key={game.id} className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">
              {game.teams.team1} vs {game.teams.team2}
            </h3>
            <p className="text-sm text-gray-500">
              Started: {game.createdAt.toLocaleString()}
            </p>
          </div>

          {/* Game Banner */}
          <div className="relative mb-6">
            {game.teams.bannerImage ? (
              <>
                <img
                  src={game.teams.bannerImage}
                  alt="Game Banner"
                  className="h-48 w-full rounded-lg object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = 'https://via.placeholder.com/800x400?text=Banner+Image';
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-2 bg-white/80 hover:bg-white"
                  onClick={() => setEditingImage({
                    gameId: game.id,
                    type: 'banner',
                    currentUrl: game.teams.bannerImage
                  })}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-gray-100">
                <Button
                  variant="ghost"
                  onClick={() => setEditingImage({
                    gameId: game.id,
                    type: 'banner',
                    currentUrl: ''
                  })}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Add Banner Image
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Team 1 */}
            <div className="space-y-4">
              <div className="relative rounded-lg border p-4">
                <h4 className="font-medium">{game.teams.team1}</h4>

                <div className="relative mt-4">
                  {game.teams.team1Image ? (
                    <>
                      <img
                        src={game.teams.team1Image}
                        alt={game.teams.team1}
                        className="h-32 w-full rounded-lg object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = 'https://via.placeholder.com/400x300?text=Team+1+Image';
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-2 bg-white/80 hover:bg-white"
                        onClick={() => setEditingImage({
                          gameId: game.id,
                          type: 'team1',
                          currentUrl: game.teams.team1Image
                        })}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-gray-100">
                      <Button
                        variant="ghost"
                        onClick={() => setEditingImage({
                          gameId: game.id,
                          type: 'team1',
                          currentUrl: ''
                        })}
                      >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Add Team Image
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700">Current Odds</p>
                  <p className="text-2xl font-bold text-blue-600">{game.odds.team1}x</p>
                </div>
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-4">
              <div className="relative rounded-lg border p-4">
                <h4 className="font-medium">{game.teams.team2}</h4>

                <div className="relative mt-4">
                  {game.teams.team2Image ? (
                    <>
                      <img
                        src={game.teams.team2Image}
                        alt={game.teams.team2}
                        className="h-32 w-full rounded-lg object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = 'https://via.placeholder.com/400x300?text=Team+2+Image';
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-2 bg-white/80 hover:bg-white"
                        onClick={() => setEditingImage({
                          gameId: game.id,
                          type: 'team2',
                          currentUrl: game.teams.team2Image
                        })}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-gray-100">
                      <Button
                        variant="ghost"
                        onClick={() => setEditingImage({
                          gameId: game.id,
                          type: 'team2',
                          currentUrl: ''
                        })}
                      >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Add Team Image
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700">Current Odds</p>
                  <p className="text-2xl font-bold text-blue-600">{game.odds.team2}x</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex space-x-4">
            <Button
              onClick={() => setInitialFunds(game.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              Set Initial Funds
            </Button>
            <Button
              onClick={() => endVersus(game.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              End Game
            </Button>
          </div>
        </div>
      ))}

      {/* Image Edit Dialog */}
      {editingImage && (
        <ImageEditDialog
          open={!!editingImage}
          onOpenChange={(open) => !open && setEditingImage(null)}
          currentUrl={editingImage.currentUrl}
          onSave={handleImageEdit}
          title={`Edit ${
            editingImage.type === 'banner' ? 'Banner' :
            editingImage.type === 'team1' ? 'Team 1' : 'Team 2'
          } Image`}
        />
      )}
    </div>
  );
}