import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc, getDoc, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Users as Horse, Trophy, Timer, AlertCircle, Settings, DollarSign } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

interface HorseRound {
  id: string;
  status: 'open' | 'closed' | 'completed';
  startedAt: Date;
  endedAt?: Date;
  winningNumbers?: {
    grandPrize: number[];
    firstRunnerUp: number[];
    secondRunnerUp: number[];
    consolation: number[];
  };
  rewards: {
    grandPrize: number;
    firstRunnerUp: number;
    secondRunnerUp: number;
    consolationPrize: number;
  };
  settings?: {
    minBet: number;
    maxBet: number;
    maxNumbers: number;
  };
}

interface WinningNumbersInput {
  grandPrize: string;
  firstRunnerUp: string;
  secondRunnerUp: string;
  consolation: string;
}

export function HorseRaceAdmin({ setError, setMessage }: Props) {
  const [currentRound, setCurrentRound] = useState<HorseRound | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [winningNumbers, setWinningNumbers] = useState<WinningNumbersInput>({
    grandPrize: '',
    firstRunnerUp: '',
    secondRunnerUp: '',
    consolation: ''
  });
  const [settings, setSettings] = useState({
    minBet: 10,
    maxBet: 1000,
    maxNumbers: 10,
    rewards: {
      grandPrize: 100,
      firstRunnerUp: 50,
      secondRunnerUp: 25,
      consolationPrize: 10
    }
  });

  useEffect(() => {
    // Listen to current horse race round
    const unsubRound = onSnapshot(doc(db, 'gameRounds', 'horseRound'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCurrentRound({
          id: doc.id,
          ...data,
          startedAt: data.startedAt?.toDate(),
          endedAt: data.endedAt?.toDate()
        } as HorseRound);
        
        // Update local settings if they exist
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings
          }));
        }
        if (data.rewards) {
          setSettings(prev => ({
            ...prev,
            rewards: data.rewards
          }));
        }
      }
    });

    return () => unsubRound();
  }, []);

  const startHorseRace = async () => {
    try {
      await updateDoc(doc(db, 'gameRounds', 'horseRound'), {
        status: 'open',
        startedAt: new Date(),
        settings,
        rewards: settings.rewards
      });
      setMessage('Horse race started successfully');
    } catch (err) {
      setError('Failed to start horse race');
      console.error(err);
    }
  };

  const closeHorseRace = async () => {
    try {
      await updateDoc(doc(db, 'gameRounds', 'horseRound'), {
        status: 'closed'
      });
      setMessage('Horse race betting closed');
    } catch (err) {
      setError('Failed to close horse race');
      console.error(err);
    }
  };

  const validateNumbers = (input: string): number[] => {
    const numbers = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    if (numbers.some(n => n < 1 || n > 100)) {
      throw new Error('All numbers must be between 1 and 100');
    }
    if (new Set(numbers).size !== numbers.length) {
      throw new Error('All numbers must be unique');
    }
    return numbers;
  };

  const publishResults = async () => {
    try {
      // Validate all number inputs
      const grandPrizeNumbers = validateNumbers(winningNumbers.grandPrize);
      const firstRunnerUpNumbers = validateNumbers(winningNumbers.firstRunnerUp);
      const secondRunnerUpNumbers = validateNumbers(winningNumbers.secondRunnerUp);
      const consolationNumbers = validateNumbers(winningNumbers.consolation);

      // Validate counts
      if (grandPrizeNumbers.length !== 1) throw new Error('Grand prize must have exactly 1 number');
      if (firstRunnerUpNumbers.length !== 2) throw new Error('First runner up must have exactly 2 numbers');
      if (secondRunnerUpNumbers.length !== 5) throw new Error('Second runner up must have exactly 5 numbers');
      if (consolationNumbers.length !== 25) throw new Error('Consolation must have exactly 25 numbers');

      // Check for duplicates across all categories
      const allNumbers = [...grandPrizeNumbers, ...firstRunnerUpNumbers, ...secondRunnerUpNumbers, ...consolationNumbers];
      if (new Set(allNumbers).size !== allNumbers.length) {
        throw new Error('Numbers cannot be repeated across prize categories');
      }

      await runTransaction(db, async (transaction) => {
        // Get all pending bets
        const betsQuery = query(
          collection(db, 'horseBets'),
          where('status', '==', 'pending')
        );
        const betsSnapshot = await getDocs(betsQuery);

        // Process each bet
        for (const betDoc of betsSnapshot.docs) {
          const bet = betDoc.data();
          const userRef = doc(db, 'users', bet.userId);
          const userDoc = await transaction.get(userRef);
          
          if (!userDoc.exists()) continue;

          const userData = userDoc.data();
          const betNumbers = bet.bets.map(b => b.number);
          
          let winnings = 0;
          let winType: 'grand' | 'firstRunnerUp' | 'secondRunnerUp' | 'consolation' | null = null;
          let matchedNumbers: number[] = [];

          // Check for grand prize
          const grandMatch = betNumbers.filter(n => grandPrizeNumbers.includes(n));
          if (grandMatch.length > 0) {
            winnings = Math.floor(bet.totalAmount * currentRound.rewards.grandPrize);
            winType = 'grand';
            matchedNumbers = grandMatch;
            transaction.update(userRef, {
              cash: increment(winnings)
            });
          }
          // Check for first runner up
          else if (betNumbers.some(n => firstRunnerUpNumbers.includes(n))) {
            winnings = Math.floor(bet.totalAmount * currentRound.rewards.firstRunnerUp);
            winType = 'firstRunnerUp';
            matchedNumbers = betNumbers.filter(n => firstRunnerUpNumbers.includes(n));
            transaction.update(userRef, {
              cash: increment(winnings)
            });
          }
          // Check for second runner up
          else if (betNumbers.some(n => secondRunnerUpNumbers.includes(n))) {
            winnings = Math.floor(bet.totalAmount * currentRound.rewards.secondRunnerUp);
            winType = 'secondRunnerUp';
            matchedNumbers = betNumbers.filter(n => secondRunnerUpNumbers.includes(n));
            transaction.update(userRef, {
              cash: increment(winnings)
            });
          }
          // Check for consolation
          else if (betNumbers.some(n => consolationNumbers.includes(n))) {
            winnings = Math.floor(bet.totalAmount * currentRound.rewards.consolationPrize);
            winType = 'consolation';
            matchedNumbers = betNumbers.filter(n => consolationNumbers.includes(n));
            transaction.update(userRef, {
              points: increment(winnings) // Consolation prizes are in FBT points
            });
          }

          if (winnings > 0) {
            // Add transaction record for winners
            const transactionRef = doc(collection(db, 'transactions'));
            transaction.set(transactionRef, {
              userId: bet.userId,
              username: bet.username,
              amount: winnings,
              type: 'horse_race_win',
              description: `Horse Race win - ${winType} prize`,
              timestamp: new Date(),
              matchedNumbers,
              winningType: winType,
              rewardType: winType === 'consolation' ? 'fbt' : 'cash'
            });
          }

          // Update bet status
          transaction.update(betDoc.ref, {
            status: winnings > 0 ? 'won' : 'lost',
            winningAmount: winnings,
            winningType: winType,
            matchedNumbers
          });
        }

        // Update game round with categorized winning numbers
        const roundRef = doc(db, 'gameRounds', 'horseRound');
        transaction.update(roundRef, {
          status: 'completed',
          endedAt: new Date(),
          winningNumbers: {
            grandPrize: grandPrizeNumbers,
            firstRunnerUp: firstRunnerUpNumbers,
            secondRunnerUp: secondRunnerUpNumbers,
            consolation: consolationNumbers
          }
        });
      });

      setMessage('Results published successfully');
      setIsResultsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish results');
      console.error(err);
    }
  };

  const updateSettings = async (newSettings: typeof settings) => {
    try {
      await updateDoc(doc(db, 'gameRounds', 'horseRound'), {
        settings: {
          minBet: newSettings.minBet,
          maxBet: newSettings.maxBet,
          maxNumbers: newSettings.maxNumbers
        },
        rewards: newSettings.rewards
      });
      setSettings(newSettings);
      setMessage('Settings updated successfully');
      setIsSettingsOpen(false);
    } catch (err) {
      setError('Failed to update settings');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Controls */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Horse className="h-8 w-8 text-purple-500" />
            <h2 className="text-2xl font-bold">Horse Race Controls</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              currentRound?.status === 'open'
                ? 'bg-green-100 text-green-800'
                : currentRound?.status === 'closed'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {currentRound?.status?.toUpperCase() || 'NOT STARTED'}
            </span>
            <Button
              onClick={() => setIsSettingsOpen(true)}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Button
            onClick={startHorseRace}
            disabled={currentRound?.status === 'open'}
            className="bg-green-600 hover:bg-green-700"
          >
            Start Horse Race
          </Button>

          <Button
            onClick={closeHorseRace}
            disabled={currentRound?.status !== 'open'}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            Close Betting
          </Button>

          <Button
            onClick={() => setIsResultsOpen(true)}
            disabled={currentRound?.status !== 'closed'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Publish Results
          </Button>
        </div>

        {/* Current Settings Display */}
        <div className="mt-6 grid gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">Betting Limits</h3>
            <div className="space-y-1 text-sm">
              <p>Minimum Bet: {settings.minBet} FBT</p>
              <p>Maximum Bet: {settings.maxBet} FBT</p>
              <p>Max Numbers per Player: {settings.maxNumbers}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Prize Multipliers</h3>
            <div className="space-y-1 text-sm">
              <p>Grand Prize: {settings.rewards.grandPrize}x (Cash)</p>
              <p>1st Runner Up: {settings.rewards.firstRunnerUp}x (Cash)</p>
              <p>2nd Runner Up: {settings.rewards.secondRunnerUp}x (Cash)</p>
              <p>Consolation: {settings.rewards.consolationPrize}x (FBT)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed inset-4 z-50 overflow-y-auto rounded-lg bg-white p-4 shadow-lg md:inset-auto md:left-[50%] md:top-[50%] md:h-auto md:w-[90vw] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:p-6">
            <div className="relative min-h-[calc(100vh-2rem)] md:min-h-0">
              <Dialog.Title className="mb-4 pr-6 text-lg font-semibold md:text-xl">
                Game Settings
              </Dialog.Title>

              <div className="space-y-6">
                {/* Betting Limits */}
                <div className="space-y-4">
                  <h3 className="font-medium">Betting Limits</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Minimum Bet (FBT)
                      </label>
                      <input
                        type="number"
                        value={settings.minBet}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          minBet: parseInt(e.target.value) || 0
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Maximum Bet (FBT)
                      </label>
                      <input
                        type="number"
                        value={settings.maxBet}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          maxBet: parseInt(e.target.value) || 0
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Max Numbers per Player
                      </label>
                      <input
                        type="number"
                        value={settings.maxNumbers}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          maxNumbers: parseInt(e.target.value) || 0
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Prize Multipliers */}
                <div className="space-y-4">
                  <h3 className="font-medium">Prize Multipliers</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Grand Prize (Cash)
                      </label>
                      <input
                        type="number"
                        value={settings.rewards.grandPrize}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          rewards: {
                            ...prev.rewards,
                            grandPrize: parseInt(e.target.value) || 0
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        1st Runner Up (Cash)
                      </label>
                      <input
                        type="number"
                        value={settings.rewards.firstRunnerUp}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          rewards: {
                            ...prev.rewards,
                            firstRunnerUp: parseInt(e.target.value) || 0
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        2nd Runner Up (Cash)
                      </label>
                      <input
                        type="number"
                        value={settings.rewards.secondRunnerUp}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          rewards: {
                            ...prev.rewards,
                            secondRunnerUp: parseInt(e.target.value) || 0
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Consolation Prize (FBT)
                      </label>
                      <input
                        type="number"
                        value={settings.rewards.consolationPrize}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          rewards: {
                            ...prev.rewards,
                            consolationPrize: parseInt(e.target.value) || 0
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateSettings(settings)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Save Settings
                </Button>
              </div>

              <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Results Dialog */}
      <Dialog.Root open={isResultsOpen} onOpenChange={setIsResultsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed inset-4 z-50 overflow-y-auto rounded-lg bg-white p-4 shadow-lg md:inset-auto md:left-[50%] md:top-[50%] md:h-auto md:w-[90vw] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:p-6">
            <div className="relative min-h-[calc(100vh-2rem)] md:min-h-0">
              <Dialog.Title className="mb-4 pr-6 text-lg font-semibold md:text-xl">
                Publish Results
              </Dialog.Title>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Grand Prize Winner (1 number)
                    </label>
                    <input
                      type="text"
                      value={winningNumbers.grandPrize}
                      onChange={(e) => setWinningNumbers(prev => ({
                        ...prev,
                        grandPrize: e.target.value
                      }))}
                      placeholder="Enter 1 number"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      First Runner Up (2 numbers)
                    </label>
                    <input
                      type="text"
                      value={winningNumbers.firstRunnerUp}
                      onChange={(e) => setWinningNumbers(prev => ({
                        ...prev,
                        firstRunnerUp: e.target.value
                      }))}
                      placeholder="Enter 2 numbers, comma-separated"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Second Runner Up (5 numbers)
                    </label>
                    <input
                      type="text"
                      value={winningNumbers.secondRunnerUp}
                      onChange={(e) => setWinningNumbers(prev => ({
                        ...prev,
                        secondRunnerUp: e.target.value
                      }))}
                      placeholder="Enter 5 numbers, comma-separated"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Consolation Winners (25 numbers)
                    </label>
                    <textarea
                      value={winningNumbers.consolation}
                      onChange={(e) => setWinningNumbers(prev => ({
                        ...prev,
                        consolation: e.target.value
                      }))}
                      placeholder="Enter 25 numbers, comma-separated"
                      rows={4}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>

                {/* Helper Text */}
                <div className="rounded-lg bg-blue-50 p-4">
                  <h4 className="mb-2 font-medium text-blue-800">Input Format:</h4>
                  <ul className="list-inside list-disc space-y-1 text-sm text-blue-700">
                    <li>Use comma-separated numbers (e.g., "1, 2, 3")</li>
                    <li>Numbers must be between 1 and 100</li>
                    <li>Numbers cannot be repeated across categories</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setIsResultsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={publishResults}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Publish Results
                </Button>
              </div>

              <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}