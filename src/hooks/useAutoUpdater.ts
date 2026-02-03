import { useState, useEffect } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';

type CheckResult = 'up-to-date' | 'update-available' | 'error' | null;

export function useAutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult>(null);

  const installUpdateNow = async (update: Update) => {
    setIsInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.error('Failed to install update:', error);
      setIsInstalling(false);
    }
  };

  const checkForUpdates = async () => {
    setIsChecking(true);
    setCheckResult(null);
    try {
      const update = await check();

      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo(update);
        setCheckResult('update-available');

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
      } else {
        setCheckResult('up-to-date');
        // Clear the "up to date" message after 3 seconds
        setTimeout(() => setCheckResult(null), 3000);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setCheckResult('error');
      // Clear error message after 3 seconds
      setTimeout(() => setCheckResult(null), 3000);
    } finally {
      setIsChecking(false);
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
    checkResult,
    checkForUpdates
  };
}
