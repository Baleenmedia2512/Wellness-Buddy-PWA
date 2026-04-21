import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signInWithCredential,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@southdevs/capacitor-google-auth';

//  Firebase config
const firebaseConfig = {
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
    // Check if running in Capacitor (Android app)
    if (Capacitor.isNativePlatform()) {
      
      // Initialize Google Auth for Capacitor
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
          console.log('✅ Profile photo updated with high quality version');
        } catch (error) {
          console.warn('⚠️ Failed to update profile photo:', error);
        }
      }
      
      return userCredential.user;
    } else {
      // Web-based authentication - ALWAYS use popup since redirect doesn't work
      console.log('🔍 Sign-in attempt:', {
        isMobile: isMobile(),
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        hasTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
      });
      
      console.log('🖥️ Using popup flow');
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
      console.log('ℹ️ User closed popup');
      throw new Error('Sign-in was cancelled. Please try again.');
    }

    // Handle native Google Auth errors
    if (error.message?.includes('User cancelled the flow')) {
      throw new Error('Sign-in was cancelled. Please try again.');
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
    throw error;
  }
};

// 🔄 Get redirect result
export const handleRedirectResult = async () => {
  try {
    console.log('🔍 Checking for redirect result...');
    
    if (!isRedirectPending()) {
      console.log('ℹ️ No redirect pending');
      return null;
    }

    console.log('⏳ Redirect pending, getting result...');
    const result = await getRedirectResult(auth);
    
    if (result?.user) {
      console.log('✅ Redirect result successful:', result.user.email);
      clearRedirectPending();
      return result.user;
    } else {
      console.log('ℹ️ No user in redirect result');
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

// 🚪 Enhanced Sign out for Web and Android
export const signOutUser = async () => {
  try {
    clearRedirectPending();
    
    // Sign out from Firebase
    await auth.signOut();
    
    // If running on native platform, also sign out from native Google Auth
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleAuth.signOut();
      } catch (error) {
        console.warn('⚠️ Native Google Sign-Out warning:', error);
        // Don't throw - Firebase sign-out was successful
      }
    }
    
  } catch (error) {
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
        console.log('✅ Auth state: User authenticated');
      } else {
        console.log('❌ Auth state: User not authenticated');
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
