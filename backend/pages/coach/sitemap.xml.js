/**
 * Sitemap under /coach/* so MilesWeb can reach Next the same way as
 * /coach/<city>/... (App URI is only /api; /coach already works via host routing).
 *
 * Public pretty URL /coach-sitemap.xml is rewritten here by SPA .htaccess.
 */
import { writeCoachSitemapResponse } from '../../features/coach-portfolio/api/public-sitemap.service.js';

export async function getServerSideProps({ req, res }) {
  await writeCoachSitemapResponse(req, res);
  return { props: {} };
}

export default function CoachSitemapUnderCoach() {
  return null;
}
