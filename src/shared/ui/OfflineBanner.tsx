import { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '@shared/lib/connectivity';
import { cn } from '@shared/lib/utils';

/* eslint-disable react-hooks/set-state-in-effect */
type BannerState = 'offline' | 'done' | 'hidden';

/**
 * Fixed slim banner rendered at the very top of the viewport (above all content).
 *
 * - Offline:   orange, "Offline — running on cached data"
 * - Syncing:   green,  "Back online — syncing N actions..."
 * - Done:      green, fades out after 3 seconds
 * - Online/idle: renders nothing
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      setBannerState('offline');
      setVisible(true);
      if (fadeTimer.current) {
        clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
      return;
    }

    if (bannerState === 'offline') {
      setBannerState('done');
      fadeTimer.current = setTimeout(() => {
        setVisible(false);
        setBannerState('hidden');
      }, 3000);
    }
  }, [bannerState, isOnline]);

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  if (!visible) return null;

  const isOffline = bannerState === 'offline';
  const isDone = bannerState === 'done';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center py-1 px-3',
        'text-xs font-medium text-white transition-opacity duration-700',
        isOffline ? 'bg-orange-500' : 'bg-green-600',
        isDone ? 'opacity-0' : 'opacity-100'
      )}
    >
      {bannerState === 'offline' && 'Offline \u2014 running on cached data'}
      {bannerState === 'done' && 'All actions synced'}
    </div>
  );
}
