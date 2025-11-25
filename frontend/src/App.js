// src/App.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useIonRouter } from '@ionic/react';
import ImageUpload from './components/ImageUpload';
import NutritionCard from './components/NutritionCard';
import SuccessSavePopup from './components/SuccessSavePopup';
import { initializeBackButton, cleanupBackButton } from './utils/backButtonHandler';
import { fetchLatestBackgroundNutrition } from './services/backgroundNutritionService';
import { getUserId } from './services/getUserId';
import { saveNutritionAnalysis, deleteNutritionAnalysis } from './services/nutritionSaveService';
import TestImageGuide from './components/TestImageGuide';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './components/Login';
import NutritionDashboard from './components/NutritionDashboard';
import InactiveUserModal from './components/InactiveUserModal';
import UserNotFoundModal from './components/UserNotFoundModal';
import { geminiService } from './services/geminiService';
import {
  signInWithGoogle,
  signInWithGooglePopup,
  signOutUser,
  handleRedirectResult,
  onAuthStateChange,
  isGoogleUser,
  isMobileDevice,
  isNativePlatform,
  cleanup
} from './services/firebase';
import Header from './components/Header';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import GalleryMonitor from './services/galleryMonitor';
import { PushNotifications } from '@capacitor/push-notifications';

function WellnessBuddyApp() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTestGuide, setShowTestGuide] = useState(false);
  const [showNutritionDashboard, setShowNutritionDashboard] = useState(
    localStorage.getItem('currentPage') === 'nutrition-dashboard'
  );
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOtpVerified, setIsOtpVerified] = useState(
    localStorage.getItem('isOtpVerified') === 'true'
  );
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true); // Track if user is active
  const fileInputRef = useRef(null);

  // ---------- Helpers for BgNutrition fast-path + ack -----------------

  // Make a compact, user-friendly title from foods[]
  const titleFromFoods = (foods = []) => {
    const list = Array.isArray(foods) ? foods : [];
    const count = list.length;
    if (count === 0) return 'Food';
    const safe = (v) => (v?.toString?.() || '').trim();
    const first = safe(list[0]?.name) || 'Food';
    if (count === 1) return first;
    if (count === 2) {
      const second = safe(list[1]?.name) || 'another item';
      return `${first} & ${second}`;
    }
    return `${first} + ${count - 1} more`;
  };

  const loadCachedBgPopup = () => {
    try {
      const raw = localStorage.getItem('wellnessBuddy_cachedBgPopup');
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached?.analysisId) return null;
      const ackId = localStorage.getItem('wellnessBuddy_lastBgNutritionId');
      if (ackId && String(ackId) === String(cached.analysisId)) return null;

      // Optional TTL (6h) to avoid very old resurfacing
      const MAX_AGE_MS = 1000 * 60 * 60 * 6;
      if (cached.cachedAt && Date.now() - cached.cachedAt > MAX_AGE_MS) {
        localStorage.removeItem('wellnessBuddy_cachedBgPopup');
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  };

  const persistBgCache = (popup) => {
    try {
      localStorage.setItem(
        'wellnessBuddy_cachedBgPopup',
        JSON.stringify({ ...popup, cachedAt: Date.now() })
      );
    } catch {}
  };

  const clearBgCache = () => {
    try { localStorage.removeItem('wellnessBuddy_cachedBgPopup'); } catch {}
  };

  const ackBgPopup = (analysisId) => {
    try {
      if (analysisId != null) {
        localStorage.setItem('wellnessBuddy_lastBgNutritionId', String(analysisId));
      }
      clearBgCache(); // ensure it won’t repaint on refresh
    } catch {}
  };

  // --------------------------------------------------------------------

  // Success popup state - support for multiple popups with localStorage persistence
  const [successPopups, setSuccessPopups] = useState(() => {
    try {
      const saved = localStorage.getItem('wellnessBuddy_successPopups');
      if (saved) {
        const parsedPopups = JSON.parse(saved);
        const validPopups = parsedPopups.filter(
          (popup) => popup && popup.id && popup.nutritionData && popup.imagePreview
        );
        return validPopups;
      }
      return [];
    } catch {
      return [];
    }
  });

  // Navigation hook for back button handling
  const ionRouter = useIonRouter();

  // Toast state for back button exit message
  const [toast, setToast] = useState({ message: '', visible: false });

  // Show toast message
  const showToast = (message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  };

  // Initialize back button handler
  useEffect(() => {
    const goBack = () => {
      if (showNutritionDashboard) {
        setShowNutritionDashboard(false);
        localStorage.setItem('currentPage', 'main');
        return true;
      }
      return ionRouter.canGoBack() && ionRouter.goBack();
    };
    
    initializeBackButton(goBack, showToast, !showNutritionDashboard);
    return () => cleanupBackButton();
  }, [ionRouter, showNutritionDashboard]);

  // Background nutrition popup state — hydrate instantly from cache
  const [bgNutritionPopup, setBgNutritionPopup] = useState(() => loadCachedBgPopup());

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Add a ref to track if status check is in progress
  const statusCheckInProgress = useRef(false);
  
  // Add a ref to track if sign-out is in progress
  const signOutInProgress = useRef(false);

  // Check user status (Active/Inactive) using lookup-user-id API
  const checkUserStatus = useCallback(async (user) => {
    if (!user) {
      return true; // If no user, skip check
    }
    
    // Skip status check if this is a fresh Google sign-in that's being saved
    const isFreshSignIn = sessionStorage.getItem('freshGoogleSignIn') === 'true';
    if (isFreshSignIn) {
      return true; // Skip check, allow access - sign-in handler will check after save
    }
    
    // Prevent multiple simultaneous checks
    if (statusCheckInProgress.current) {
      return true; // Skip if already checking
    }
    
    try {
      statusCheckInProgress.current = true;
      
      const userEmail = user.email || user.Email;
      
      if (!userEmail) {
        return true;
      }
      
      const response = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });

      const data = await response.json();
      
      // User not found in database
      if (!data.success || data.userNotFound) {
        setShowUserNotFoundModal(true);
        setIsUserActive(false);
        return false;
      }
      
      // User found but inactive
      if (data.success && !data.isActive) {
        setShowInactiveModal(true);
        setIsUserActive(false);
        return false;
      }
      
      // User is active - clear any modal states
      setShowInactiveModal(false);
      setShowUserNotFoundModal(false);
      setIsUserActive(true);
      
      return true;
    } catch (error) {
      console.error('Error checking user status:', error);
      // On error, allow user to continue (fail-open)
      setIsUserActive(true);
      return true;
    } finally {
      statusCheckInProgress.current = false;
    }
  }, [apiBaseUrl]);

  // Helper functions for navigation with localStorage persistence
  const showNutritionDashboardPage = useCallback(async () => {
    // Re-check user status in real-time before opening dashboard
    if (user) {
      const isActive = await checkUserStatus(user);
      if (!isActive) {
        setError('Your account is inactive. Please contact support to reactivate.');
        return;
      }
    }
    setShowNutritionDashboard(true);
    localStorage.setItem('currentPage', 'nutrition-dashboard');
  }, [user, checkUserStatus]);

  const showMainPage = () => {
    setShowNutritionDashboard(false);
    localStorage.setItem('currentPage', 'main');
  };

  const requestAllPermissions = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await PushNotifications.requestPermissions();
    } catch (err) {
      console.warn('❌ Permission request failed:', err);
    }
  };

  const handleInactiveModalClose = async () => {
    setShowInactiveModal(false);
    
    // Add small delay to ensure modal is visible before sign out
    await new Promise(resolve => setTimeout(resolve, 300));
    
    await handleSignOut();
  };

  const handleUserNotFoundModalClose = async () => {
    setShowUserNotFoundModal(false);
    
    // Add small delay to ensure modal is visible before sign out
    await new Promise(resolve => setTimeout(resolve, 300));
    
    await handleSignOut();
  };

  // Show background nutrition popup if new record exists and not acknowledged
  useEffect(() => {
    const maybeShowBgNutritionPopup = async () => {
      if (!user) return;
      
      // Skip status check for fresh sign-ins (being handled by sign-in flow)
      const isFreshSignIn = sessionStorage.getItem('freshGoogleSignIn') === 'true';
      if (isFreshSignIn) {
        return;
      }
      
      // Re-check user status in real-time
      const isActive = await checkUserStatus(user);
      if (!isActive) return;

      // Always use DB UserID only
      let dbUserId = user.id;
      if (!dbUserId) dbUserId = await getUserId(user);
      if (!dbUserId) return;

      const latest = await fetchLatestBackgroundNutrition(dbUserId);
      if (!latest) return;

      // Only show if not acknowledged
      const lastAckId = localStorage.getItem('wellnessBuddy_lastBgNutritionId');
      if (String(latest.ID) === String(lastAckId)) return;

      // Build image
      let imagePreview = null;
      if (latest.ImageBase64) {
        imagePreview = latest.ImageBase64.startsWith('data:image')
          ? latest.ImageBase64
          : `data:image/jpeg;base64,${latest.ImageBase64}`;
      } else if (latest.ImagePath) {
        imagePreview = latest.ImagePath;
      }

      // Parse nutrition
      let parsed, nutritionData;
      try {
        parsed = typeof latest.AnalysisData === 'string'
          ? JSON.parse(latest.AnalysisData)
          : latest.AnalysisData;

        const detailedItems = Array.isArray(parsed.foods)
          ? parsed.foods.map((item) => ({
              ...item,
              calories: item.nutrition?.calories ?? 0,
              protein: item.nutrition?.protein ?? 0,
              carbs: item.nutrition?.carbs ?? 0,
              fat: item.nutrition?.fat ?? 0,
              fiber: item.nutrition?.fiber ?? 0
            }))
          : [];

        // Title like: "Idli", "Idli & Sambar", "Idli + 2 more"
        const category = { name: titleFromFoods(detailedItems) };

        nutritionData = {
          ...parsed,
          nutrition: parsed?.total || {},
          detailedItems,
          category
        };
      } catch {
        nutritionData = null;
      }

      // Guard: only meaningful nutrition
      const n = nutritionData?.nutrition;
      const meaningful =
        n && ((n.calories > 0) || (n.protein > 0) || (n.carbs > 0) || (n.fat > 0));
      if (!meaningful) return;

      const popup = {
        id: `bg-${latest.ID}`,
        analysisId: latest.ID,
        nutritionData,
        imagePreview,
        timestamp: latest.CreatedAt
      };

      setBgNutritionPopup(popup);
      persistBgCache(popup); // cache for instant paint on next refresh
    };

    maybeShowBgNutritionPopup();
  }, [user, checkUserStatus]);

  const handleSaveUserCache = async (user) => {
    if (user && Capacitor.isNativePlatform()) {
      try {
        const dbUserId = await getUserId(user);
        if (dbUserId && user.email) {
          GalleryMonitor.setCurrentUser(String(dbUserId), user.email);
        }
      } catch (err) {
        console.warn('Failed to set current user for background service:', err);
      }
    }
  };

  // Set up StatusBar to appear above content (not overlaid)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar')
        .then(({ StatusBar }) => {
          StatusBar.setOverlaysWebView({ overlay: false });
        })
        .catch((err) => {
          console.warn('StatusBar plugin not available:', err);
        });
    }
  }, []);

  useEffect(() => {
    const initializeGalleryMonitoring = async () => {
      if (Capacitor.isNativePlatform()) {
        await GalleryMonitor.initialize();

        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            GalleryMonitor.checkGallery();
          }
        });

        const { GalleryMonitorPlugin } = await import('./plugins/galleryMonitorPlugin');
        const listener = await GalleryMonitorPlugin.addListener('notificationClicked', (data) => {
          if (data && data.action === 'openBackgroundHistory') {
            showNutritionDashboardPage();
          }
        });

        return () => {
          listener.remove();
        };
      }
    };

    let cleanupFn;
    initializeGalleryMonitoring().then((fn) => {
      cleanupFn = fn;
    });

    return () => {
      App.removeAllListeners();
      if (cleanupFn) cleanupFn();
    };
  }, [showNutritionDashboardPage]);

  // Handle redirect result on app load
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const resultUser = await handleRedirectResult();
        if (resultUser) {
          setUser(resultUser);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error('❌ Redirect result error:', error);
        setError('Authentication failed. Please try again.');
        setAuthLoading(false);
      }
    };
    checkRedirectResult();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      // If sign-out is in progress, ignore auth state changes
      if (signOutInProgress.current) {
        return;
      }

      if (user) {
        // Skip status check if this is a fresh Google sign-in that's being saved
        // The handleSignIn/handlePopupSignIn functions will handle status check after save
        const isFreshSignIn = sessionStorage.getItem('freshGoogleSignIn') === 'true';
        
        if (!isFreshSignIn) {
          // Check user status before allowing access (for existing sessions)
          const isActive = await checkUserStatus(user);
          
          if (!isActive) {
            // Don't clear user state immediately - let modal show first
            // Modal close handler will sign out and clear state
            setUser(user); // Keep user state so modal can show user email
            setAuthLoading(false);
            return;
          }
        } else {
          // Don't clear the flag here - let the sign-in handler clear it after save completes
          console.log('🔐 [Auth State] Fresh sign-in detected, skipping status check');
        }
      }
      
      setUser(user);
      setAuthLoading(false);
      
      // Skip handleSaveUserCache for fresh sign-ins - let sign-in handler do it after save
      const isFreshSignIn = sessionStorage.getItem('freshGoogleSignIn') === 'true';
      if (user && Capacitor.isNativePlatform() && !isFreshSignIn) {
        handleSaveUserCache(user);
      } else if (isFreshSignIn) {
        console.log('🔐 [Auth State] Skipping handleSaveUserCache for fresh sign-in');
      }
    });
    return () => unsubscribe();
  }, [checkUserStatus]);

  // Setup for authenticated users
  useEffect(() => {
    if (user) {
      requestAllPermissions();
      handleSaveUserCache(user);
    }
  }, [user]);

  // Handle OTP user restoration
  useEffect(() => {
    const restoreOtpUser = async () => {
      if (isOtpVerified && !user) {
        const otpUser = localStorage.getItem('otpUser');
        
        if (otpUser) {
          try {
            const parsedUser = JSON.parse(otpUser);
            
            // Check user status before restoring
            const isActive = await checkUserStatus(parsedUser);
            
            if (!isActive) {
              // Set user state so modal can show
              setUser(parsedUser);
              // Modal close handler will clear localStorage
              return;
            }
            
            setUser(parsedUser);
            handleSaveUserCache(parsedUser);
          } catch (error) {
            console.error('Failed to restore OTP user:', error);
            localStorage.removeItem('otpUser');
            setIsOtpVerified(false);
          }
        }
      }
    };
    
    restoreOtpUser();
  }, [isOtpVerified, user, checkUserStatus]);

  // Periodic user status check (every 60 seconds)
  useEffect(() => {
    if (!user) return;

    const statusCheckInterval = setInterval(async () => {
      await checkUserStatus(user);
    }, 60000); // Check every 60 seconds

    return () => clearInterval(statusCheckInterval);
  }, [user, checkUserStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Persist popups to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('wellnessBuddy_successPopups', JSON.stringify(successPopups));
    } catch (error) {
      console.error('❌ Failed to save popups to localStorage:', error);
    }
  }, [successPopups]);

  // Auto-dismiss save error after 5 seconds
  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => {
        setSaveError(null);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer); // Cleanup on unmount or when saveError changes
    }
  }, [saveError]);

  // Helper function to compress images
  const compressImage = (base64, quality = 0.7) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1920px width)
        let { width, height } = img;
        const maxWidth = 1920;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      
      img.src = base64;
    });
  };

  const handleImageSelect = async (file) => {
    if (!user) {
      setError('Please sign in to analyze food images');
      return;
    }

    // Re-check user status in real-time before analysis
    const isActive = await checkUserStatus(user);
    if (!isActive) {
      setError('Your account is inactive. Please contact support to reactivate.');
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('📸 Image file is too large. Please choose a smaller image (max 10MB).');
      return;
    }

    setSelectedImage(file);
    setError(null);
    setNutritionData(null);
    setSaveError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      let imageBase64 = e.target.result;
      
      // Compress large images for better upload success
      if (imageBase64.length > 2 * 1024 * 1024) { // 2MB base64 limit
        try {
          imageBase64 = await compressImage(imageBase64, 0.7); // 70% quality
        } catch (compressError) {
          console.warn('⚠️ Image compression failed, using original:', compressError);
        }
      }
      
      setImagePreview(imageBase64);

      try {
        setLoading(true);
        const result = await geminiService.analyzeImageForNutrition(file);
        setNutritionData(result);

        // Auto-save to DB disabled for now
        // setSaveLoading(true);
        // try {
        //   const userIdentifier = user.email || user.id || user.uid || 'anonymous';

        //   const saveRes = await saveNutritionAnalysis({
        //     userId: userIdentifier,
        //     imagePath: file.name,
        //     imageBase64,
        //     analysisResult: result,
        //     deviceInfo: window.navigator.userAgent
        //   });

        //   const newPopup = {
        //     id: Date.now().toString(),
        //     analysisId: saveRes.id,
        //     nutritionData: result,
        //     imagePreview: imageBase64,
        //     timestamp: new Date()
        //   };
        //   setSuccessPopups((prev) => [...prev, newPopup]);
        // } catch (err) {
        //   // Debug: Log detailed error info
        //   console.error('❌ Save failed:', {
        //     error: err,
        //     message: err.message,
        //     stack: err.stack,
        //     apiBaseUrl: apiBaseUrl,
        //     userIdentifier: user.email || user.id || user.uid || 'anonymous'
        //   });
          
        //   const friendlySaveError = getFriendlyErrorMessage(err);
        //   setSaveError(friendlySaveError);
        // } finally {
        //   setSaveLoading(false);
        // }
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        console.error('❌ Gemini analysis error:', err);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // Success popup handlers
  const handleSuccessPopupClose = (popupId) => {
    // If closing background nutrition popup
    if (bgNutritionPopup && popupId === bgNutritionPopup.id) {
      ackBgPopup(bgNutritionPopup.analysisId); // mark as acknowledged + clear cache
      setBgNutritionPopup(null);
      return;
    }
    if (popupId) {
      setSuccessPopups((prev) => prev.filter((popup) => popup.id !== popupId));
    } else {
      setSuccessPopups([]);
    }
  };

  const handleSuccessPopupDelete = async (popupId) => {
    // Special-case delete for bg popup -> just acknowledge and hide
    if (bgNutritionPopup && popupId === bgNutritionPopup.id) {
      ackBgPopup(bgNutritionPopup.analysisId);
      setBgNutritionPopup(null);
      return;
    }

    // Normal saved popups
    const popup = successPopups.find((p) => p.id === popupId);
    if (!popup || !popup.analysisId) return;

    try {
      await deleteNutritionAnalysis({ id: popup.analysisId });
      setSuccessPopups((prev) => prev.filter((p) => p.id !== popupId));

      if (nutritionData && popup.nutritionData === nutritionData) {
        setNutritionData(null);
        setImagePreview(null);
        setSelectedImage(null);
      }
    } catch (err) {
      console.error('Failed to delete analysis:', err);
      setSaveError('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  const getFriendlyErrorMessage = (error) => {
    const rawMessage = error.message || '';
    
    // Server and network errors
    if (rawMessage.includes('503') || rawMessage.includes('overloaded')) {
      return '⚡ Server is currently busy. Please try again in a few minutes.';
    } else if (rawMessage.includes('Server returned an unexpected response format')) {
      return '💾 Unable to save your analysis right now. Your food data is still displayed above!';
    } else if (rawMessage.includes('Image file is too large')) {
      return '📸 Image file is too large. Please try with a smaller photo (max 10MB).';
    } else if (rawMessage.includes('network') || rawMessage.includes('Failed to fetch')) {
      return '🌐 Network issue. Please check your internet connection and try again.';
    } else if (rawMessage.includes('500') || rawMessage.includes('Internal Server Error')) {
      return '⚙️ Server error occurred. Please try again in a few moments.';
    } else if (rawMessage.includes('timeout')) {
      return '⏱️ Request timed out. Please try again with better internet connection.';
    }
    
    // AI analysis errors
    else if (rawMessage.includes('No food items detected')) {
      return '⚠️ No food items were detected in the image. Try with a clearer photo.';
    } else if (rawMessage.includes('Invalid response format')) {
      return '🤖 AI returned unexpected data. Please try analyzing the image again.';
    } else if (rawMessage.includes('API key is not configured')) {
      return '⚙️ AI service is not available right now. Please try again later.';
    } else if (rawMessage.includes('models/') && rawMessage.includes('not found')) {
      return '🤖 AI model is not available. Please try again later.';
    }
    
    // Generic fallback
    else if (rawMessage.toLowerCase().includes('analysis')) {
      return '🍽️ Unable to save your food analysis. The nutrition data is still shown above!';
    }
    
    return '❌ Something went wrong. Please try again later.';
  };

  const resetApp = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setNutritionData(null);
    setError(null);
    setUser(null);
    setIsOtpVerified(false);
    setSuccessPopups([]);
    setSaveError(null);
    localStorage.removeItem('isOtpVerified');
    localStorage.removeItem('otpUser');
    localStorage.removeItem('currentPage');
    localStorage.removeItem('wellnessBuddy_successPopups');
    clearBgCache();

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('successPopups_')) {
          localStorage.removeItem(key);
        }
      }
    } catch {}

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSignIn = async (forceRedirect = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Flag should already be set by Login component
      // But set it here too for redirect flow safety
      if (!sessionStorage.getItem('freshGoogleSignIn')) {
        sessionStorage.setItem('freshGoogleSignIn', 'true');
      }
      
      // Safety timeout to clear flag if something goes wrong (30 seconds for slow sign-in)
      const safetyTimeout = setTimeout(() => {
        sessionStorage.removeItem('freshGoogleSignIn');
      }, 30000);
      
      const user = await signInWithGoogle(forceRedirect);
      if (user) {
        try {
          // Save user to backend first
          await saveUserToBackend(user);
          
          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);
          
          // ⚠️ CRITICAL: Check if sign-out was triggered while we were saving
          if (signOutInProgress.current) {
            sessionStorage.removeItem('freshGoogleSignIn');
            return;
          }
          
          // ✅ CRITICAL: Clear the fresh sign-in flag NOW
          // This ensures checkUserStatus will run (not skip) for user validation
          sessionStorage.removeItem('freshGoogleSignIn');
          
          // Now set up GalleryMonitor with the saved user
          if (Capacitor.isNativePlatform()) {
            await handleSaveUserCache(user);
            
            // Check again if sign-out was triggered
            if (signOutInProgress.current) {
              return;
            }
          }
          
          // Now check user status after ensuring DB record exists
          // Flag is cleared, so checkUserStatus will actually run the check
          const isActive = await checkUserStatus(user);
          
          // Check again if sign-out was triggered during status check
          if (signOutInProgress.current) {
            return;
          }
          
          if (isActive) {
            setUser(user);
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error('⚠️ Backend save/check failed, allowing user access:', saveError);
          setError('Warning: Could not verify account status. You can still use the app.');
          setUser(user); // Allow access despite backend failure
          clearTimeout(safetyTimeout); // Clear timeout even on error
          sessionStorage.removeItem('freshGoogleSignIn'); // Clean up flag
        }
        
        // Flag is already cleared above - no need to clear again
      } else {
        console.log('🔄 Redirect initiated, waiting for result...');
        // Don't clear timeout yet for redirect flow
      }
    } catch (error) {
      console.error('❌ Sign in error:', error);
      sessionStorage.removeItem('freshGoogleSignIn'); // Clean up on error
      
      if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Trying redirect method...');
        setTimeout(() => {
          handleSignIn(true);
        }, 1000);
        return;
      }
      if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
        setLoading(false);
        return;
      }
      setError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePopupSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Flag is already set by Login component before this function is called
      // Safety timeout to clear flag if something goes wrong (30 seconds for slow sign-in)
      const safetyTimeout = setTimeout(() => {
        sessionStorage.removeItem('freshGoogleSignIn');
      }, 30000);
      
      const user = await signInWithGooglePopup();
      
      if (user) {
        try {
          // Save user to backend first
          await saveUserToBackend(user);
          
          // Clear the safety timeout immediately after save completes
          clearTimeout(safetyTimeout);
          
          // ⚠️ CRITICAL: Check if sign-out was triggered while we were saving
          if (signOutInProgress.current) {
            sessionStorage.removeItem('freshGoogleSignIn');
            return;
          }
          
          // ✅ CRITICAL: Clear the fresh sign-in flag NOW
          // This ensures checkUserStatus will run (not skip) for user validation
          sessionStorage.removeItem('freshGoogleSignIn');
          
          // Now set up GalleryMonitor with the saved user
          if (Capacitor.isNativePlatform()) {
            await handleSaveUserCache(user);
            
            // Check again if sign-out was triggered
            if (signOutInProgress.current) {
              return;
            }
          }
          
          // Now check user status after ensuring DB record exists
          // Flag is cleared, so checkUserStatus will actually run the check
          const isActive = await checkUserStatus(user);
          
          // Check again if sign-out was triggered during status check
          if (signOutInProgress.current) {
            return;
          }
          
          if (isActive) {
            setUser(user);
          } else {
            // User was saved but is inactive or not found - modal will show
            setUser(user); // Keep user state so modal can show user email
          }
        } catch (saveError) {
          // If save fails, still allow user to proceed (fail-open for backend issues)
          console.error('⚠️ Backend save/check failed, allowing user access:', saveError);
          setError('Warning: Could not verify account status. You can still use the app.');
          setUser(user); // Allow access despite backend failure
          clearTimeout(safetyTimeout); // Clear timeout even on error
          sessionStorage.removeItem('freshGoogleSignIn'); // Clean up flag
        }
        
        // Flag is already cleared above - no need to clear again
      }
    } catch (error) {
      console.error('❌ Popup sign-in error:', error);
      sessionStorage.removeItem('freshGoogleSignIn'); // Clean up on error
      setError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getAuthErrorMessage = (error) => {
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        return 'Sign in was cancelled. Please try again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      default:
        return error.message || 'Authentication failed. Please try again.';
    }
  };

  const saveUserToBackend = async (user) => {
    try {
      
      const response = await fetch(`${apiBaseUrl}/api/save-google-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null,
          uid: user.uid
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save user: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [saveUserToBackend] User saved successfully');
      } else {
        console.warn('⚠️ [saveUserToBackend] Save completed with warning:', data);
      }
      
      return data;
    } catch (error) {
      console.error('❌ [saveUserToBackend] Failed to save user to backend:', error);
      throw error; // Re-throw so caller can handle
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      
      // Set sign-out in progress flag to prevent concurrent sign-in
      signOutInProgress.current = true;
      
      // Clear the fresh sign-in flag immediately to prevent re-login issues
      sessionStorage.removeItem('freshGoogleSignIn');
      
      if (Capacitor.isNativePlatform()) {
        try {
          await GalleryMonitor.clearCurrentUser();
        } catch (clearError) {
          console.warn('⚠️ Failed to clear GalleryMonitor user (method may not exist):', clearError);
          // Continue with sign out even if this fails
        }
      }
      await signOutUser();
      resetApp();
    } catch (error) {
      console.error('❌ Sign out error:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
      // Reset the sign-out flag after a delay to allow cleanup
      setTimeout(() => {
        signOutInProgress.current = false;
      }, 1000);
    }
  };

  const handleOtpVerified = async () => {
    // Get the OTP user from localStorage
    const otpUser = localStorage.getItem('otpUser');
    
    if (otpUser) {
      try {
        const parsedUser = JSON.parse(otpUser);
        
        // Check user status before allowing access
        const isActive = await checkUserStatus(parsedUser);
        
        if (!isActive) {
          // Set user state so modal can show user email
          setUser(parsedUser);
          // Set OTP verified to false to prevent login completion
          setIsOtpVerified(false);
          // Don't set isOtpVerified to true - keep at login screen with modal
          return;
        }
        
        setIsOtpVerified(true);
        localStorage.setItem('isOtpVerified', 'true');
      } catch (error) {
        console.error('Failed to check OTP user status:', error);
      }
    } else {
      // No OTP user found, proceed with verification
      setIsOtpVerified(true);
      localStorage.setItem('isOtpVerified', 'true');
    }
  };

  // Loading state
  if (authLoading) {
    return <LoadingSpinner context="normal" />;
  }

  // Authentication flow
  if (!user && !isOtpVerified) {
    return (
      <>
        <Login
          onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
          loading={loading}
          error={error}
          onOtpVerified={handleOtpVerified}
        />
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={user?.email}
            onClose={handleInactiveModalClose}
          />
        )}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email}
            onClose={handleUserNotFoundModalClose}
          />
        )}
      </>
    );
  }
  const isGoogleUserCheck = user && isGoogleUser(user);
  if (!isOtpVerified && !isGoogleUserCheck) {
    return (
      <>
        <Login
          onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
          loading={loading}
          error={error}
          onOtpVerified={handleOtpVerified}
          forceOtpVerification={true}
        />
        {showInactiveModal && (
          <InactiveUserModal
            userEmail={user?.email}
            onClose={handleInactiveModalClose}
          />
        )}
        {showUserNotFoundModal && (
          <UserNotFoundModal
            userEmail={user?.email}
            onClose={handleUserNotFoundModalClose}
          />
        )}
      </>
    );
  }

  // Remove success popup for a meal if deleted in dashboard (before undo expires)
  const handleDashboardMealDelete = (deletedAnalysisId) => {
    if (!deletedAnalysisId) return;
    setSuccessPopups((prev) => prev.filter((p) => p.analysisId !== deletedAnalysisId));
    if (bgNutritionPopup && bgNutritionPopup.analysisId === deletedAnalysisId) {
      ackBgPopup(deletedAnalysisId); // mark acknowledged and clear cache
      setBgNutritionPopup(null);
    }
  };

  // Full page dashboard
  if (showNutritionDashboard) {
    return (
      <NutritionDashboard
        user={user}
        onBack={showMainPage}
        apiBaseUrl={apiBaseUrl}
        onMealDelete={handleDashboardMealDelete}
      />
    );
    }

  // Main app interface
  return (
    <div className="min-h-screen h-screen w-screen bg-gradient-to-br from-green-50 to-green-100">
      <Header
        user={user}
        onShowBackgroundHistory={showNutritionDashboardPage}
        onSignOut={handleSignOut}
      />

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Back button toast message */}
        {toast.visible && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-xl z-[9999] text-sm border border-gray-200">
            {toast.message}
          </div>
        )}

        <ImageUpload
          onImageSelect={handleImageSelect}
          imagePreview={imagePreview}
          loading={loading}
          ref={fileInputRef}
        />

        {error && (
          <div className="bg-white border border-red-200 text-red-600 px-4 py-3 rounded-xl shadow-sm flex items-start space-x-3">
            <div className="text-xl">⚠️</div>
            <div className="flex-1">
              <p className="font-semibold">Error</p>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {nutritionData && <NutritionCard 
          data={nutritionData} 
          user={user} 
          imagePreview={imagePreview} 
          selectedImage={selectedImage}
          onSaveSuccess={() => {
            setNutritionData(null);
            setImagePreview(null);
            setSelectedImage(null);
          }}
        />}

        {/* Success Save Popup: show both background and regular popups together */}
        <SuccessSavePopup
          popups={bgNutritionPopup ? [bgNutritionPopup, ...successPopups] : successPopups}
          onClose={handleSuccessPopupClose}
          onDelete={handleSuccessPopupDelete}
          onRestore={(popupId, popup, indexHint, meta) => {
            // If this is the background popup, put it back at the head
            if (popupId?.startsWith?.('bg-')) {
              setBgNutritionPopup(popup);
              persistBgCache(popup); // keep cache fresh
              // also ensure it doesn't exist in successPopups
              setSuccessPopups((prev) => prev.filter((p) => p.id !== popupId));
              return;
            }

            // Normal saved popup: reinsert at its previous position
            setSuccessPopups((prev) => {
              if (prev.find((p) => p.id === popupId)) return prev;
              let insertAt = typeof indexHint === 'number' ? indexHint : prev.length;
              if (meta?.hasBgHead) insertAt = Math.max(0, insertAt - 1);
              insertAt = Math.max(0, Math.min(insertAt, prev.length));
              const next = prev.slice();
              next.splice(insertAt, 0, popup);
              return next;
            });
          }}
        />

        {saveLoading && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
            <div className="bg-green-600 text-white px-6 py-3 rounded-t-xl shadow-lg animate-pulse font-semibold">
              Saving nutrition analysis...
            </div>
          </div>
        )}
        {saveError && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
            <div className="bg-red-600 text-white px-6 py-3 rounded-t-xl shadow-lg font-semibold">
              {saveError}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-green-200 p-4">
          <h3 className="font-semibold text-green-700 mb-2">📋 How to use:</h3>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-green-600 mb-1">📸 Image Analysis:</h4>
              <ol className="text-sm text-gray-600 space-y-1 ml-4">
                <li>1. Take a clear photo of your food</li>
                <li>2. Make sure the food is well-lit and visible</li>
                <li>3. View detailed nutrition breakdown for detected foods</li>
              </ol>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="font-semibold text-green-700 mb-2">💡 Tips for better results:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Take photos in good lighting conditions</li>
              <li>• Ensure food items are clearly visible</li>
              <li>• Avoid cluttered backgrounds</li>
              <li>• For text queries, be specific about preparation methods</li>
            </ul>
          </div>
        </div>

        <TestImageGuide isVisible={showTestGuide} onClose={() => setShowTestGuide(false)} />
      </div>

      {/* Inactive User Modal */}
      {showInactiveModal && (
        <InactiveUserModal 
          userEmail={user?.email || user?.Email || 'your account'}
          onClose={handleInactiveModalClose} 
        />
      )}
      
      {/* User Not Found Modal */}
      {showUserNotFoundModal && (
        <UserNotFoundModal 
          userEmail={user?.email || user?.Email || 'your account'}
          onClose={handleUserNotFoundModalClose} 
        />
      )}
    </div>
  );
}

export default WellnessBuddyApp;
