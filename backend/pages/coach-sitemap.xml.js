/**
 * Sitemap of all published coach public websites.
 * URL: /coach-sitemap.xml
 *
 * On MilesWeb, prefer /coach/sitemap.xml (same Node path as portfolio pages).
 * SPA .htaccess rewrites /coach-sitemap.xml → /coach/sitemap.xml.
 */
import { writeCoachSitemapResponse } from '../features/coach-portfolio/api/public-sitemap.service.js';

export async function getServerSideProps({ req, res }) {
  await writeCoachSitemapResponse(req, res);
  return { props: {} };
}

export default function CoachSitemap() {
  return null;
}
