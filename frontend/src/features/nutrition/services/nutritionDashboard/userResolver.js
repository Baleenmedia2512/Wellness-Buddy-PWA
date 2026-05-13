// Dashboard-specific user-id resolver.
// Differs from nutritionPersistence/userIdLookup.resolveTeamUserId:
//   - Returns the literal 'DEMO_USER' sentinel for demo accounts.
//   - Returns null on failure (does not throw) so the dashboard can render empty.

const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];

export const isDemoAccount = (email) =>
  !!email && DEMO_ACCOUNTS.includes(String(email).toLowerCase().trim());

export async function resolveDashboardUserId(user, apiBaseUrl) {
  if (isDemoAccount(user?.email)) return 'DEMO_USER';
  if (user?.id) return user.id;
  if (!user?.email) return null;

  try {
    const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    const data = await res.json();
    return data.success && data.userId ? data.userId : null;
  } catch (error) {
    console.error('[NutritionDashboard] Failed to resolve userId:', error);
    return null;
  }
}
