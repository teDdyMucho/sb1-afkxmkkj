import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useState } from 'react';
import { VersusGameSettings } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: VersusGameSettings;
  onSave: (settings: VersusGameSettings) => Promise<void>;
}

export function GameSettingsDialog({ open, onOpenChange, settings, onSave }: Props) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await onSave(localSettings);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            Game Settings
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Betting Status */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Betting Status</h3>
                  <p className="text-sm text-gray-600">Enable or disable betting for new games</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalSettings(prev => ({
                    ...prev,
                    bettingEnabled: !prev.bettingEnabled
                  }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    localSettings.bettingEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localSettings.bettingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Default Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Default Game Duration (hours)
                </label>
                <input
                  type="number"
                  value={localSettings.defaultDuration}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    defaultDuration: parseInt(e.target.value) || 1
                  }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  min="1"
                  max="72"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Set the default duration for new games (1-72 hours)
                </p>
              </div>
            </div>

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
                disabled={isProcessing}
              >
                {isProcessing ? 'Saving...' : 'Save Settings'}
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