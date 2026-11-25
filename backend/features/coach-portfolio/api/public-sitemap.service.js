/**
 * Shared XML body for published coach public pages.
 * Served at /coach/sitemap.xml (and optionally /coach-sitemap.xml).
 */
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import * as submissionRepo from '../data/submission.repo.js';

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

function requestBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return `${proto}://${host}`.replace(/\/$/, '');
}

export async function buildCoachSitemapXml(req) {
  const baseUrl = requestBaseUrl(req);
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

  return [
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
}

export async function writeCoachSitemapResponse(req, res) {
  const body = await buildCoachSitemapXml(req);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(body);
  res.end();
}
