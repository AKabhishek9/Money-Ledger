import type { Metadata, Viewport } from 'next';
import { Inter, Fira_Code } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import RegisterSW from '@/components/sw/RegisterSW';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'optional', // FIXED: PERF-9 — prevent FOUT for numeric amounts
  preload: false,
});

export const metadata: Metadata = {
  title: 'Money Ledger - Personal Ledger',
  description: 'Your offline-first smart accounting notebook',
  icons: { icon: '/icon.png' },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Money Ledger' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F0F11',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${firaCode.variable}`}>
      <body>
        <AuthProvider>
          <RegisterSW />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
