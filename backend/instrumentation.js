/**
 * Next.js server boot. Warms the Prisma pool so the first user is not
 * paying the MilesWeb handshake. Failure here must not stop the API.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (!process.env.MYSQL_DATABASE_URL) return;
  const { connectPrisma } = await import('./shared/lib/prisma.js');
  await connectPrisma();
}
