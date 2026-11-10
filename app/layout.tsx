import type { Metadata } from 'next';
import { Bebas_Neue, Figtree } from 'next/font/google';
import './globals.css';

const display = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'C127 Hub',
  description: 'One place for Commission 127 families, churches, coaches and follow-up. Demo with sample data.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
