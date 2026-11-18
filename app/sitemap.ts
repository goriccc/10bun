import type { MetadataRoute } from 'next';
import { services } from '@/content/services';
import { siteUrl } from '@/content/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = ['', '/about', '/privacy', '/terms', '/contact', ...services.map((service) => `/${service.slug}`)];
  return paths.map((path) => ({
    url: `${base}${path || '/'}`,
    lastModified: new Date('2026-11-14'),
  }));
}
