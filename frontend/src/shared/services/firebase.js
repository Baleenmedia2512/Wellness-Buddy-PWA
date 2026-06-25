import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signInWithCredential,
  onAuthStateChanged,
  updateProfile,
  deleteUser
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@southdevs/capacitor-google-auth';
import { debugLog } from '../utils/logger.js';

//  Firebase config — platform-aware
const isIOS = Capacitor.getPlatform() === 'ios';

const firebaseConfig = isIOS
  ? {
      // ✅ iOS config (from GoogleService-Info.plist)
      apiKey: 'AIzaSyAMxCgoyyy8im3F8BQCjWK3xmEA9qYP8rc',
      authDomain: 'wellness-buddy-5de14.firebaseapp.com',
      projectId: 'wellness-buddy-5de14',
      storageBucket: 'wellness-buddy-5de14.firebasestorage.app',
      messagingSenderId: '610941252952',
      appId: '1:610941252952:ios:2606191e4b774dd457e12d',
    }
  : {
      // ✅ Android / Web config
      apiKey: 'AIzaSyBy_z0qbRVyCz2UkHR-PAYorEYXTWDzCps',
      authDomain: 'wellness-valley.firebaseapp.com',
      projectId: 'wellness-valley',
      storageBucket: 'wellness-valley.firebasestorage.app',
      messagingSenderId: '499376291787',
      appId: '1:499376291787:android:7f587d91cbb40b5be9404e',
    };

// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 🔐 Google Provider for web
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 🧠 Enhanced device detection
const isMobile = () => {
  // Check user agent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);
  
  // Check for touch support and small screen
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isSmallScreen = window.innerWidth <= 768;
  
  // Check for mobile-specific properties
  const isMobilePlatform = /iPhone|iPad|iPod|Android/i.test(navigator.platform);
  
  // Return true if any mobile indicator is present
  return isMobileUA || (hasTouch && isSmallScreen) || isMobilePlatform;
};

const isCapacitorNative = () => {
  return Capacitor.isNativePlatform();
};

// 🔁 Enhanced redirect tracking
const REDIRECT_KEY = 'google_auth_redirect_pending';
const REDIRECT_TIMESTAMP_KEY = 'google_auth_redirect_timestamp';
const REDIRECT_TIMEOUT = 5 * 60 * 1000;

const setRedirectPending = () => {
  sessionStorage.setItem(REDIRECT_KEY, 'true');
  sessionStorage.setItem(REDIRECT_TIMESTAMP_KEY, Date.now().toString());
};

const isRedirectPending = () => {
  const pending = sessionStorage.getItem(REDIRECT_KEY) === 'true';
  const timestamp = sessionStorage.getItem(REDIRECT_TIMESTAMP_KEY);
  if (!pending || !timestamp) return false;

  if (Date.now() - parseInt(timestamp) > REDIRECT_TIMEOUT) {
    clearRedirectPending();
    return false;
  }
  return true;
};

const clearRedirectPending = () => {
  sessionStorage.removeItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_TIMESTAMP_KEY);
};

// 🚀 Enhanced Google Sign-In for Web and Android
export const signInWithGoogle = async (forceRedirect = false) => {
  try {
    // Check if running in Capacitor (Android/iOS app)
    if (Capacitor.isNativePlatform()) {

      // ✅ Always re-initialize Google Auth before signing in
      // This is required after disconnect() was called on iOS sign-out
      await GoogleAuth.initialize({
        scopes: ['profile', 'email'],
        serverClientId: '499376291787-gkivhgcdsc3tep13m6a3khlgtgksfuq8.apps.googleusercontent.com',
        forceCodeForRefreshToken: true
      });

      // Sign in with native Google Auth
      const result = await GoogleAuth.signIn();
      
      // Get additional user info from Google Auth result
      // Process the image URL to handle potential issues
      let processedPhotoUrl = result.imageUrl;
      if (processedPhotoUrl) {
        // Remove any size restrictions and get highest quality
        processedPhotoUrl = processedPhotoUrl
          .replace('s96-c', 's384-c')  // Increase size
          .replace(/\?.*$/, '');  // Remove any query parameters that might cause issues
        
        // Ensure HTTPS
        if (!processedPhotoUrl.startsWith('https://')) {
          processedPhotoUrl = processedPhotoUrl.replace('http://', 'https://');
        }
      }

      const userInfo = {
        displayName: result.name,
        email: result.email,
        photoURL: processedPhotoUrl
      };

      // Create Firebase credential from Google result
      const credential = GoogleAuthProvider.credential(result.authentication.idToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Always update with high quality photo URL
      if (userInfo.photoURL) {
        try {
          // Add cache buster and ensure HTTPS
          const timestamp = new Date().getTime();
          const photoURL = userInfo.photoURL.includes('?') 
            ? `${userInfo.photoURL}&t=${timestamp}` 
            : `${userInfo.photoURL}?t=${timestamp}`;

          await updateProfile(userCredential.user, {
            photoURL: photoURL
          });
          debugLog('✅ Profile photo updated with high quality version');
        } catch (error) {
          console.warn('⚠️ Failed to update profile photo:', error);
        }
      }
      
      return userCredential.user;
    } else {
      // Web-based authentication - ALWAYS use popup since redirect doesn't work
      debugLog('🔍 Sign-in attempt:', {
        isMobile: isMobile(),
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        hasTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
      });
      
      debugLog('🖥️ Using popup flow');
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error) {
    clearRedirectPending();

    // Handle popup blocked - provide helpful error message
    if (error.code === 'auth/popup-blocked') {
      console.error('🚫 Popup blocked by browser');
      throw new Error('Popup was blocked. Please allow popups for this site or try again.');
    }

    if (error.code === 'auth/popup-closed-by-user') {
      debugLog('ℹ️ User closed popup');
      throw new Error('Sign-in was cancelled. Please try again.');
    }

    // Handle unauthorized domain - suggest email sign-in
    if (error.code === 'auth/unauthorized-domain') {
      console.error('🚫 Unauthorized domain for Google Sign-in. Domain must be added to Firebase Console → Authentication → Authorized domains.');
      const err = new Error('Google sign-in is not available on this domain. Please use email sign-in instead.');
      err.code = 'auth/unauthorized-domain';
      throw err;
    }

    // Handle native Google Auth errors
    if (error.message?.includes('User cancelled the flow')) {
      throw new Error('Sign-in was cancelled. Please try again.');
    }

    // Handle Google Play Services DEVELOPER_ERROR (code 10)
    // This occurs when the app's SHA certificate fingerprint is not registered
    // in Firebase Console → Project Settings → Android app → SHA fingerprints
    if (
      error.message?.includes('DEVELOPER_ERROR') ||
      error.message?.startsWith('10:') ||
      error.message?.trim() === '10'
    ) {
      const err = new Error(
        'Google Sign-In is not configured for this app build. Please contact support. (Error: DEVELOPER_ERROR)'
      );
      err.code = 'auth/developer-error';
      console.error('❌ Google Sign-in DEVELOPER_ERROR: SHA fingerprint not registered in Firebase Console');
      throw err;
    }

    console.error('❌ Google Sign-in error:', error);
    throw error;
  }
};

// 🪟 Web-only popup login
export const signInWithGooglePopup = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked by your browser. Please allow popups and try again.');
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled. Please try again.');
    }
    if (error.code === 'auth/unauthorized-domain') {
      const err = new Error('Google sign-in is not available on this domain. Please use email sign-in instead.');
      err.code = 'auth/unauthorized-domain';
      throw err;
    }
    throw error;
  }
};

// 🔄 Get redirect result
export const handleRedirectResult = async () => {
  try {
    debugLog('🔍 Checking for redirect result...');
    
    if (!isRedirectPending()) {
      debugLog('ℹ️ No redirect pending');
      return null;
    }

    debugLog('⏳ Redirect pending, getting result...');
    const result = await getRedirectResult(auth);
    
    if (result?.user) {
      debugLog('✅ Redirect result successful:', result.user.email);
      clearRedirectPending();
      return result.user;
    } else {
      debugLog('ℹ️ No user in redirect result');
      return null;
    }
  } catch (error) {
    clearRedirectPending();

    const ignorableErrors = [
      'auth/no-current-user',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/user-cancelled'
    ];

    if (ignorableErrors.includes(error.code)) {
      return null;
    }

    console.error('handleRedirectResult error:', error);
    throw error;
  }
};

// 🚪 Enhanced Sign out for Web, Android and iOS
export const signOutUser = async () => {
  try {
    clearRedirectPending();

    // ✅ Set a persistent sign-out flag BEFORE any async calls
    // This stops onAuthStateChanged from re-logging in on iOS
    localStorage.setItem('userSignedOut', 'true');

    // Sign out from Firebase first
    await auth.signOut();

    // If running on native platform, fully revoke Google token
    if (Capacitor.isNativePlatform()) {
      try {
        // Step 1: signOut() clears in-memory session
        await GoogleAuth.signOut();
      } catch (e) {
        console.warn('⚠️ GoogleAuth.signOut() warning:', e);
      }
      try {
        // Step 2: disconnect() removes token from iOS Keychain — prevents silent re-auth
        await GoogleAuth.disconnect();
      } catch (disconnectError) {
        console.warn('⚠️ GoogleAuth.disconnect() warning (non-fatal):', disconnectError);
        // Non-fatal — Firebase sign-out already succeeded
      }
    }

  } catch (error) {
    // Even if Firebase signOut fails, set the flag so UI clears
    localStorage.setItem('userSignedOut', 'true');
    console.error('Sign out error:', error);
    throw error;
  }
};

// 👀 Auth state observer
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(
    auth,
    (user) => {
      if (user) {
        debugLog('✅ Auth state: User authenticated');
      } else {
        debugLog('❌ Auth state: User not authenticated');
      }
      callback(user);
    },
    (error) => {
      console.error('Auth state change error:', error);
      callback(null);
    }
  );
};

// 🔍 Check user
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
};

export const isUserSignedIn = () => auth.currentUser !== null;

export const getUserInfo = () => {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    providerData: user.providerData
  };
};

export const isGoogleUser = (user = null) => {
  const currentUser = user || auth.currentUser;
  return currentUser?.providerData?.[0]?.providerId === 'google.com';
};

export const getAuthMethod = (user = null) => {
  const currentUser = user || auth.currentUser;
  if (!currentUser) return null;
  const providerId = currentUser.providerData?.[0]?.providerId;
  switch (providerId) {
    case 'google.com': return 'google';
    case 'phone': return 'phone';
    default: return 'unknown';
  }
};

export const isMobileDevice = isMobile;
export const isNativePlatform = isCapacitorNative;

export const cleanup = () => clearRedirectPending();

// 🗑️ Delete the Firebase Auth user account permanently (called on account deletion)
export const deleteFirebaseUser = async () => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await deleteUser(currentUser);
      debugLog('✅ [deleteFirebaseUser] Firebase Auth user deleted successfully');
    } else {
      console.warn('⚠️ [deleteFirebaseUser] No current Firebase user to delete');
    }
  } catch (error) {
    // "requires-recent-login" means the session is too old — not fatal for deletion flow
    console.warn('⚠️ [deleteFirebaseUser] Could not delete Firebase user (non-fatal):', error.code, error.message);
  }
};
