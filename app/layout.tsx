import type { Metadata, Viewport } from 'next';
import { Do_Hyeon, IBM_Plex_Sans_KR } from 'next/font/google';
import { Analytics } from '@/components/Analytics';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { siteDescription, siteName, siteUrl } from '@/content/site';
import './globals.css';

const display = Do_Hyeon({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = IBM_Plex_Sans_KR({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${siteName} 오늘의 10분`, template: `%s | ${siteName}` },
  description: siteDescription,
};

export const viewport: Viewport = {
  themeColor: '#E6E3F1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
