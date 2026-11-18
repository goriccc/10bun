import { HomeHub } from '@/components/HomeHub';
import { siteDescription, siteName } from '@/content/site';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `${siteName} 오늘의 10분`,
  description: siteDescription,
};

export default function HomePage() {
  return <HomeHub />;
}
