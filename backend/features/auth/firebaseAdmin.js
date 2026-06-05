// Lazy singleton wrapper around firebase-admin so cold-start is paid once.
// Used by auth.service.js → firebasePhoneLogin() to verify ID tokens minted
// by the client-side Firebase Phone Auth flow.
//
// Required env vars (set in Vercel project settings):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY    (escape newlines with \n; we re-hydrate below)
//
// All three must come from the SAME service account JSON downloaded from
// Firebase Console → Project Settings → Service accounts → Generate new
// private key. Project must match the projectId used by the frontend
// (frontend/src/shared/services/firebase.js).

import admin from 'firebase-admin';
import logger from '../../shared/lib/logger.js';

let appPromise = null;

function buildCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'firebase-admin not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }
  // Vercel env vars cannot contain real newlines — they are stored escaped as
  // the two-char sequence `\n`. Re-hydrate before handing to the SDK.
  const privateKey = rawKey.replace(/\\n/g, '\n');
  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdmin() {
  if (!appPromise) {
    appPromise = (async () => {
      if (admin.apps.length > 0) return admin.app();
      const creds = buildCredentials();
      const app = admin.initializeApp({
        credential: admin.credential.cert(creds),
        projectId: creds.projectId,
      });
      logger.debug('🔥 firebase-admin initialized for project:', creds.projectId);
      return app;
    })();
  }
  return appPromise;
}

/**
 * Verify a Firebase ID token and return the decoded claims. Throws on any
 * verification failure — callers map to 401.
 */
export async function verifyFirebaseIdToken(idToken) {
  await getFirebaseAdmin();
  return admin.auth().verifyIdToken(String(idToken || ''), /* checkRevoked */ true);
}
