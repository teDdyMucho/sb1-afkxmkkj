import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VersusGameSettings } from './types';

interface Props {
  setError: (error: string) => void;
  setMessage: (message: string) => void;
}

export function useVersusSettings({ setError, setMessage }: Props) {
  const [settings, setSettings] = useState<VersusGameSettings>({
    bettingEnabled: true,
    defaultDuration: 24
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Listen to settings document
    const settingsRef = doc(db, 'settings', 'versus');
    
    const unsubSettings = onSnapshot(settingsRef, async (docSnapshot) => {
      if (!docSnapshot.exists()) {
        // Initialize default settings if they don't exist
        try {
          const defaultSettings: VersusGameSettings = {
            bettingEnabled: true,
            defaultDuration: 24
          };
          await setDoc(settingsRef, defaultSettings);
          setSettings(defaultSettings);
        } catch (err) {
          console.error('Failed to initialize settings:', err);
          setError('Failed to initialize game settings');
        }
      } else {
        setSettings(docSnapshot.data() as VersusGameSettings);
      }
    });

    return () => unsubSettings();
  }, [setError]);

  const updateSettings = async (newSettings: VersusGameSettings) => {
    try {
      await setDoc(doc(db, 'settings', 'versus'), newSettings);
      setMessage('Settings updated successfully');
    } catch (err) {
      setError('Failed to update settings');
      console.error(err);
    }
  };

  return {
    settings,
    isSettingsOpen,
    setIsSettingsOpen,
    updateSettings
  };
}