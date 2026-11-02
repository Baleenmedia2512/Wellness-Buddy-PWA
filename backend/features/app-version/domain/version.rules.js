/**
 * Pure semver helpers for app version policy (no I/O).
 */

/**
 * @param {unknown} raw
 * @returns {{ major: number, minor: number, patch: number }|null}
 */
export function parseSemver(raw) {
  const s = String(raw || '').trim().replace(/^v\s*/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(s);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {-1|0|1|null} null if either operand is invalid
 */
export function compareSemver(a, b) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return null;
  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;
  return 0;
}

/**
 * @param {unknown} client
 * @param {unknown} minimum
 * @returns {boolean|null} null when comparison impossible
 */
export function isAtLeastVersion(client, minimum) {
  const cmp = compareSemver(client, minimum);
  if (cmp === null) return null;
  return cmp >= 0;
}

/**
 * Resolve effective minimum during optional grace window.
 *
 * @param {{ minRequiredVersion: string, graceMinVersion?: string|null, graceUntil?: string|null, now?: Date }} input
 * @returns {string}
 */
export function resolveEffectiveMinVersion({
  minRequiredVersion,
  graceMinVersion = null,
  graceUntil = null,
  now = new Date(),
}) {
  if (graceMinVersion && graceUntil) {
    const end = new Date(graceUntil);
    if (!Number.isNaN(end.getTime()) && now.getTime() < end.getTime()) {
      const graceCmp = compareSemver(graceMinVersion, minRequiredVersion);
      if (graceCmp !== null && graceCmp < 0) {
        return graceMinVersion;
      }
    }
  }
  return minRequiredVersion;
}

/** @typedef {'ok'|'update_recommended'|'update_required'} VersionGateStatus */

/**
 * @param {{
 *   clientVersion: string,
 *   latestVersion: string,
 *   recommendedVersion: string,
 *   minRequiredVersion: string,
 *   graceMinVersion?: string|null,
 *   graceUntil?: string|null,
 *   now?: Date,
 * }} input
 * @returns {VersionGateStatus}
 */
export function evaluateVersionGate({
  clientVersion,
  latestVersion,
  recommendedVersion,
  minRequiredVersion,
  graceMinVersion = null,
  graceUntil = null,
  now = new Date(),
}) {
  void latestVersion;
  const effectiveMin = resolveEffectiveMinVersion({
    minRequiredVersion,
    graceMinVersion,
    graceUntil,
    now,
  });

  const meetsMin = isAtLeastVersion(clientVersion, effectiveMin);
  if (meetsMin === false) return 'update_required';
  if (meetsMin === null) return 'ok';

  const meetsRecommended = isAtLeastVersion(clientVersion, recommendedVersion);
  if (meetsRecommended === false) return 'update_recommended';

  return 'ok';
}
