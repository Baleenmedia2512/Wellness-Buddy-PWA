/**
 * Sitemap of all published coach public websites.
 * URL: /coach-sitemap.xml
 *
 * Submit this in Google Search Console (or link from robots.txt).
 */
import { isEnabled } from '../shared/lib/feature-flags.js';
import * as submissionRepo from '../features/coach-portfolio/data/submission.repo.js';

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function getServerSideProps({ req, res }) {
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`.replace(/\/$/, '');

  let urls = [];
  if (isEnabled('ff.coach-portfolio')) {
    try {
      const rows = await submissionRepo.listPublishedPublicSlugs({ limit: 5000 });
      urls = rows.map((row) => {
        const loc = `${baseUrl}/coach/${row.publicSlug}`;
        const lastmod = toIsoDate(row.updatedAt);
        return { loc, lastmod };
      });
    } catch {
      urls = [];
    }
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => {
      const parts = [
        '  <url>',
        `    <loc>${escapeXml(u.loc)}</loc>`,
      ];
      if (u.lastmod) parts.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
      parts.push('    <changefreq>weekly</changefreq>');
      parts.push('    <priority>0.7</priority>');
      parts.push('  </url>');
      return parts.join('\n');
    }),
    '</urlset>',
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(body);
  res.end();
  return { props: {} };
}

export default function CoachSitemap() {
  return null;
}
