import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Trophy, Swords, Timer, Check } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface Props {
  onBetClick: (gameId: string, teamId: 1 | 2, teamName: string, odds: number, prizePool: number) => void;
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
  prizePool: number;
  createdAt: Date;
}

interface UserBet {
  gameId: string;
  team: 1 | 2;
}

export function VersusGames({ onBetClick }: Props) {
  const { user } = useAuthStore();
  const [games, setGames] = useState<VersusGame[]>([]);
  const [timeLeft, setTimeLeft] = useState<{ [key: string]: string }>({});
  const [userBets, setUserBets] = useState<UserBet[]>([]);

  useEffect(() => {
    // Listen to active versus games
    const gamesQuery = query(
      collection(db, 'versusGames'),
      where('status', '==', 'open')
    );

    const unsubGames = onSnapshot(gamesQuery, (snapshot) => {
      const activeGames = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as VersusGame[];

      setGames(activeGames.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });

    return () => unsubGames();
  }, []);

  // Listen to user's bets
  useEffect(() => {
    if (!user?.id) return;

    const betsQuery = query(
      collection(db, 'versusBets'),
      where('userId', '==', user.id),
      where('status', '==', 'pending')
    );

    const unsubBets = onSnapshot(betsQuery, (snapshot) => {
      const bets = snapshot.docs.map(doc => ({
        gameId: doc.data().gameId,
        team: doc.data().team
      }));
      setUserBets(bets);
    });

    return () => unsubBets();
  }, [user?.id]);

  // Update countdown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newTimeLeft: { [key: string]: string } = {};
      
      games.forEach(game => {
        const endTime = new Date(game.createdAt.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from creation
        const diff = endTime.getTime() - now.getTime();
        
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          newTimeLeft[game.id] = `${hours}h ${minutes}m ${seconds}s`;
        } else {
          newTimeLeft[game.id] = 'Ending soon';
        }
      });
      
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, [games]);

  const getUserBetForGame = (gameId: string) => {
    return userBets.find(bet => bet.gameId === gameId);
  };

  if (games.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-8 text-center shadow-md">
        <div className="space-y-4">
          <Swords className="mx-auto h-16 w-16 text-purple-400" />
          <div>
            <p className="text-xl font-semibold text-purple-900">No active games at the moment</p>
            <p className="mt-2 text-sm text-purple-600">Check back soon for exciting new matches!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {games.map((game) => {
        const userBet = getUserBetForGame(game.id);
        
        return (
          <div 
            key={game.id} 
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-white to-purple-50 shadow-lg transition-all duration-300 hover:shadow-xl"
          >
            {/* Banner Image with Gradient Overlay */}
            <div className="relative h-48">
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />
              <img
                src={game.teams.bannerImage || 'https://images.unsplash.com/photo-1511406361295-0a1ff814c0ce?w=800'}
                alt="Game Banner"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = 'https://images.unsplash.com/photo-1511406361295-0a1ff814c0ce?w=800';
                }}
              />
              {/* Prize Pool Badge */}
              <div className="absolute left-4 top-4 flex items-center space-x-2 rounded-full bg-yellow-400/90 px-4 py-2 backdrop-blur-sm">
                <Trophy className="h-4 w-4 text-yellow-900" />
                <span className="font-bold text-yellow-900">
                  {game.prizePool.toLocaleString()} FBT
                </span>
              </div>
              {/* Timer Badge */}
              <div className="absolute right-4 top-4 flex items-center space-x-2 rounded-full bg-white/90 px-4 py-2 backdrop-blur-sm">
                <Timer className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-600">
                  {timeLeft[game.id]}
                </span>
              </div>
            </div>

            {/* Teams Section */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-8">
                {/* Team 1 */}
                <div className="space-y-4">
                  <div className="group/team relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-blue-100 to-blue-50">
                    <img
                      src={game.teams.team1Image || 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400'}
                      alt={game.teams.team1}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/team:scale-110"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h4 className="text-lg font-bold drop-shadow-lg">{game.teams.team1}</h4>
                      <p className="text-sm font-medium text-blue-200">Odds: {game.odds.team1}x</p>
                    </div>
                  </div>
                  {userBet ? (
                    <Button
                      disabled
                      className={`w-full ${
                        userBet.team === 1
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {userBet.team === 1 ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Your Bet
                        </>
                      ) : (
                        'Bet Placed'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onBetClick(
                        game.id,
                        1,
                        game.teams.team1,
                        game.odds.team1,
                        game.prizePool
                      )}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white transition-all hover:from-blue-700 hover:to-blue-800"
                    >
                      Bet on {game.teams.team1}
                    </Button>
                  )}
                </div>

                {/* Team 2 */}
                <div className="space-y-4">
                  <div className="group/team relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-purple-100 to-purple-50">
                    <img
                      src={game.teams.team2Image || 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400'}
                      alt={game.teams.team2}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/team:scale-110"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h4 className="text-lg font-bold drop-shadow-lg">{game.teams.team2}</h4>
                      <p className="text-sm font-medium text-purple-200">Odds: {game.odds.team2}x</p>
                    </div>
                  </div>
                  {userBet ? (
                    <Button
                      disabled
                      className={`w-full ${
                        userBet.team === 2
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {userBet.team === 2 ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Your Bet
                        </>
                      ) : (
                        'Bet Placed'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onBetClick(
                        game.id,
                        2,
                        game.teams.team2,
                        game.odds.team2,
                        game.prizePool
                      )}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white transition-all hover:from-purple-700 hover:to-purple-800"
                    >
                      Bet on {game.teams.team2}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}