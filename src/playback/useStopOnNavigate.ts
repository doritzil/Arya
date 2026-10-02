import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { usePlayback } from './coordinator';

/** Sheets slide over the screen that's playing; opening one isn't leaving it. */
const isOverlay = (path: string) => path.startsWith('/sheets/');

/**
 * Playback belongs to the screen it started on: moving to another screen (a tab, a song page, back)
 * stops it. Mounted once in the root layout.
 */
export function useStopOnNavigate() {
  const pathname = usePathname();
  const base = useRef(pathname);
  useEffect(() => {
    if (isOverlay(pathname)) return;
    if (pathname !== base.current && usePlayback.getState().source) usePlayback.getState().stop();
    base.current = pathname;
  }, [pathname]);
}
