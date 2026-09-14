'use client';

import type { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * `attribute="data-theme"` matches the selector the token CSS files use
 * (`[data-theme="dark"]` in `theme/dark.css`) — changing this here must be
 * changed there too.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
