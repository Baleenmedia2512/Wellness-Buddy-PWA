/**
 * One-off: add sample client reviews to the published demo portfolio.
 * Run from backend/: node scripts/seed-demo-portfolio-testimonials.mjs
 */
import 'dotenv/config';
import { getPrisma } from '../shared/lib/prisma.js';

const DEMO_SLUG = 'coimbatore/demo-rs-puram';

const SAMPLE_TESTIMONIALS = [
  {
    name: 'Priya',
    quote: 'Simple daily habits — and I finally feel light and consistent.',
    rating: 5,
  },
  {
    name: 'Karthik',
    quote: 'Clear guidance, kind support. My energy and discipline both improved.',
    rating: 4,
  },
  {
    name: 'Anitha',
    quote: 'The check-ins kept me accountable without pressure. Highly recommend.',
    rating: 5,
  },
];

async function main() {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT Id AS id, FormJson AS formJson
     FROM coach_portfolio_submissions_table
     WHERE PublicSlug = ?
     LIMIT 1`,
    DEMO_SLUG,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.id) {
    throw new Error(`No submission found for PublicSlug=${DEMO_SLUG}`);
  }

  let form = {};
  try {
    form = typeof row.formJson === 'string' ? JSON.parse(row.formJson) : (row.formJson || {});
  } catch {
    form = {};
  }
  if (!form.mediaBrand || typeof form.mediaBrand !== 'object') form.mediaBrand = {};
  form.mediaBrand.testimonials = SAMPLE_TESTIMONIALS;

  await prisma.$executeRawUnsafe(
    `UPDATE coach_portfolio_submissions_table
     SET FormJson = ?
     WHERE Id = ?`,
    JSON.stringify(form),
    Number(row.id),
  );

  console.log(`Updated Id=${row.id} with ${SAMPLE_TESTIMONIALS.length} sample testimonials.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
