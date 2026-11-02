/**
 * Map team_table.recovered_health_issues (jsonb / string) → string[].
 * @param {unknown} raw
 * @returns {string[]}
 */
export function mapTeamRecoveredHealthIssues(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}
