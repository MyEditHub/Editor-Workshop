import { useState, useEffect } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';

export function useAutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      const update = await check();
      
      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo(update);
        
        // Show dialog to user
        const confirmed = await ask(
          `A new version ${update.version} is available!\n\n${update.body || 'New features and improvements'}\n\nWould you like to install it now?`,
          { 
            title: 'Update Available',
            kind: 'info'
          }
        );
        
        if (confirmed) {
          await installUpdateNow(update);
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdateNow = async (update: Update) => {
    setIsInstalling(true);
    try {
      // Download and install the update
      await update.downloadAndInstall();
      
      // Restart the app to apply the update
      await relaunch();
    } catch (error) {
      console.error('Failed to install update:', error);
      setIsInstalling(false);
    }
  };

  // Check for updates on mount
  useEffect(() => {
    // Only check in production builds
    if (import.meta.env.PROD) {
      checkForUpdates();
    }
  }, []);

  return {
    updateAvailable,
    updateInfo,
    isChecking,
    isInstalling,
    checkForUpdates
  };
}
