import type { Metadata, Viewport } from 'next';
import { Golos_Text, Oswald } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { Shell } from '@/components/shell';
import { THEME_KEY } from '@/lib/theme-key';
import './globals.css';

// Self-hosted at build time (no runtime requests to Google).
const body = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body',
  display: 'swap',
});
// Condensed display face for titles, numbers and primary actions.
const display = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-display-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Gym Tracker',
  description: 'Workouts, sets and progress in Telegram',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  // Keep the layout stable when the mobile keyboard opens.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The Telegram SDK writes theme CSS variables onto <html> before hydration.
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
        {/* Theme chosen in settings, applied before first paint (see src/lib/theme.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
