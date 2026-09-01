import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://aurum-guard-trading.a4jin69.chatgpt.site'),
  title: 'Aurum Guard — Gold & Silver Trading Intelligence',
  description:
    'A risk-first paper-trading dashboard for explainable gold and silver signals, position sizing and news-risk awareness.',
  openGraph: {
    title: 'Aurum Guard — Gold & Silver Trading Intelligence',
    description:
      'Risk-first gold and silver intelligence with explainable paper-trading signals, position sizing and news-risk awareness.',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'Aurum Guard trading intelligence dashboard' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aurum Guard — Gold & Silver Trading Intelligence',
    description:
      'Risk-first gold and silver intelligence with explainable paper-trading signals, position sizing and news-risk awareness.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
