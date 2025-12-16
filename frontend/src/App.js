// src/App.js
import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useIonRouter } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Bug } from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import NutritionCard from './components/NutritionCard';
import TestImageGuide from './components/TestImageGuide';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './components/Login';
import InactiveUserModal from './components/InactiveUserModal';
import UserNotFoundModal from './components/UserNotFoundModal';
import Header from './components/Header';
import FoodCorrectionsDebugPanel from './components/FoodCorrectionsDebugPanel';
import { getUserContext, clearContextCache } from './services/userContextService';
import { initializeBackButton, cleanupBackButton } from './utils/backButtonHandler';
import { getUserId } from './services/getUserId';
import { saveNutritionAnalysis, deleteNutritionAnalysis } from './services/nutritionSaveService';
import { geminiService } from './services/geminiService';
import { imageTypeDetector } from './services/imageTypeDetector';
import { weightDetectionService } from './services/weightDetectionService';
import { duplicateDetectionService } from './services/duplicateDetectionService';
import ManualWeightEntryModal from './components/ManualWeightEntryModal';
import DuplicateFoodModal from './components/DuplicateFoodModal';
import UserProfileModal from './components/UserProfileModal';

import GalleryMonitor from './services/galleryMonitor';
import {
  signInWithGoogle,
  signInWithGooglePopup,
  signOutUser,
  handleRedirectResult,
  onAuthStateChange,
  isGoogleUser,
  isMobileDevice,
  cleanup
} from './services/firebase';

// ✅ ANDROID OPTIMIZATION: Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

function WellnessValleyApp() {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL ;
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [savedNutritionMealId, setSavedNutritionMealId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState('analyzing'); // 'analyzing' | 'saving'
  const [error, setError] = useState(null);
  const [showTestGuide, setShowTestGuide] = useState(false);
  const [showDashboard, setShowDashboard] = useState(
    localStorage.getItem('currentPage') === 'dashboard' || 
    localStorage.getItem('currentPage') === 'nutrition-dashboard' ||
    localStorage.getItem('currentPage') === 'weight-tracking' ||
    localStorage.getItem('currentPage') === 'weight-insights'
  );
  const [dashboardInitialTab, setDashboardInitialTab] = useState(null); // 'nutrition' | 'weight' | null
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOtpVerified, setIsOtpVerified] = useState(
    localStorage.getItem('isOtpVerified') === 'true'
  );
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true); // Track if user is active
  const [showManualWeightModal, setShowManualWeightModal] = useState(false);
  const [currentWeightImage, setCurrentWeightImage] = useState(null);
  const [imageType, setImageType] = useState(null); // 'food' | 'weight'
  const [weightResult, setWeightResult] = useState(null); // Store weight detection results
  const fileInputRef = useRef(null);
  
  // Duplicate food detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // Duplicate weight detection state
  const [showDuplicateWeightModal, setShowDuplicateWeightModal] = useState(false);
  const [duplicateWeightInfo, setDuplicateWeightInfo] = useState(null);
  const [pendingWeightSaveData, setPendingWeightSaveData] = useState(null);

  // New user profile modal state - show profile page for first-time users
  const [showNewUserProfileModal, setShowNewUserProfileModal] = useState(false);
  
  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // User context state - stored and reused for AI personalization
  const [userContext, setUserContext] = useState(null);
  const [userContextLoading, setUserContextLoading] = useState(false);

  // Admin dashboard state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // ---------- Helpers for BgNutrition fast-path + ack -----------------

  // // Make a compact, user-friendly title from foods[]
  // const titleFromFoods = (foods = []) => {
  //   const list = Array.isArray(foods) ? foods : [];
  //   const count = list.length;
  //   if (count === 0) return 'Food';
  //   const safe = (v) => (v?.toString?.() || '').trim();
  //   const first = safe(list[0]?.name) || 'Food';
  //   if (count === 1) return first;
  //   if (count === 2) {
  //     const second = safe(list[1]?.name) || 'another item';
  //     return `${first} & ${second}`;
  //   }
  //   return `${first} + ${count - 1} more`;
  // };

  // const loadCachedBgPopup = () => {
  //   try {
  //     const raw = localStorage.getItem('wellnessBuddy_cachedBgPopup');
  //     if (!raw) return null;
  //     const cached = JSON.parse(raw);
  //     if (!cached?.analysisId) return null;
  //     const ackId = localStorage.getItem('wellnessBuddy_lastBgNutritionId');
  //     if (ackId && String(ackId) === String(cached.analysisId)) return null;

  //     // Optional TTL (6h) to avoid very old resurfacing
  //     const MAX_AGE_MS = 1000 * 60 * 60 * 6;
  //     if (cached.cachedAt && Date.now() - cached.cachedAt > MAX_AGE_MS) {
  //       localStorage.removeItem('wellnessBuddy_cachedBgPopup');
  //       return null;
  //     }
  //     return cached;
  //   } catch {
  //     return null;
  //   }
  // };

  // const persistBgCache = (popup) => {
  //   try {
  //     localStorage.setItem(
  //       'wellnessBuddy_cachedBgPopup',
  //       JSON.stringify({ ...popup, cachedAt: Date.now() })
  //     );
  //   } catch {}
  // };

  // const clearBgCache = () => {
  //   try { localStorage.removeItem('wellnessBuddy_cachedBgPopup'); } catch {}
  // };

  // const ackBgPopup = (analysisId) => {
  //   try {
  //     if (analysisId != null) {
  //       localStorage.setItem('wellnessBuddy_lastBgNutritionId', String(analysisId));
  //     }
      // clearBgCache(); // ensure it won’t repaint on refresh
    // } catch {}
  // };

  // --------------------------------------------------------------------

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
      if (showDashboard) {
        showMainPage();
        return true;
      }
      return ionRouter.canGoBack() && ionRouter.goBack();
    };
    
    initializeBackButton(goBack, showToast, !showDashboard);
    return () => cleanupBackButton();
  }, [ionRouter, showDashboard]);



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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
  const showDashboardPage = useCallback(async () => {
    // Re-check user status in real-time before opening dashboard
    if (user) {
      const isActive = await checkUserStatus(user);
      if (!isActive) {
        setError('Your account is inactive. Please contact support to reactivate.');
        return;
      }
    }
    
    // Clear nutrition data and image preview when switching to dashboard
    if (nutritionData) setNutritionData(null);
    if (imagePreview) setImagePreview(null);
    
    // Set the initial tab based on the last analyzed image type
    if (imageType === 'weight') {
      setDashboardInitialTab('weight');
    } else if (imageType === 'food') {
      setDashboardInitialTab('nutrition');
    } else {
      setDashboardInitialTab(null); // Use default/last used tab
    }
    setShowDashboard(true);
    localStorage.setItem('currentPage', 'dashboard');
  }, [user, checkUserStatus, nutritionData, imagePreview, imageType]);

  const showMainPage = () => {
    setShowDashboard(false);
    setDashboardInitialTab(null); // Clear initial tab when going back
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
            showDashboardPage();
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
  }, [showDashboardPage]);

  // Handle redirect result on app load
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const resultUser = await handleRedirectResult();
        if (resultUser) {
          // Get the database UserId for the user
          const dbUserId = await getUserId(resultUser);
          if (dbUserId) {
            resultUser.id = dbUserId;
            console.log('✅ [Redirect] Attached database UserId to user object:', resultUser.id);
          }
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
        // Get database UserId if not already attached
        if (!user.id) {
          const dbUserId = await getUserId(user);
          if (dbUserId) {
            user.id = dbUserId;
            console.log('✅ [Auth State] Attached database UserId to user object:', user.id);
          }
        }
        
        // Load user context for AI personalization
        if (user.id) {
          console.log('🔄 [Auth State] Loading user context...');
          setUserContextLoading(true);
          try {
            const context = await getUserContext(user.id);
            setUserContext(context);
            console.log('✅ [Auth State] User context stored in state');
          } catch (error) {
            console.error('❌ [Auth State] Failed to load context:', error);
          } finally {
            setUserContextLoading(false);
          }
        }
        
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
  
  // Subscribe to user context updates (from profile edits, food corrections, etc.)
  useEffect(() => {
    if (!user?.id) return;
    
    const { subscribeToContextUpdates } = require('./services/userContextService');
    const unsubscribe = subscribeToContextUpdates((updatedContext) => {
      console.log('✅ [App] User context updated in state:', {
        corrections: updatedContext?.personalCorrections?.length || 0,
        diet: updatedContext?.dietPreference
      });
      setUserContext(updatedContext);
    });
    
    return unsubscribe;
  }, [user?.id]);

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
            
            // Get database UserId if not already attached
            if (!parsedUser.id) {
              const dbUserId = await getUserId(parsedUser);
              if (dbUserId) {
                parsedUser.id = dbUserId;
                console.log('✅ [OTP Restore] Attached database UserId to user object:', parsedUser.id);
              }
            }
            
            // Load user context for AI personalization
            if (parsedUser.id) {
              console.log('🔄 [OTP Restore] Loading user context...');
              setUserContextLoading(true);
              try {
                const context = await getUserContext(parsedUser.id);
                setUserContext(context);
                console.log('✅ [OTP Restore] User context stored in state');
              } catch (error) {
                console.error('❌ [OTP Restore] Failed to load context:', error);
              } finally {
                setUserContextLoading(false);
              }
            }
            
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


  // Auto-dismiss save error after 5 seconds
  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => {
        setSaveError(null);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer); // Cleanup on unmount or when saveError changes
    }
  }, [saveError]);

  // ✅ ANDROID PERFORMANCE: Optimized image compression with async processing
  const compressImage = (base64, quality = 0.7, maxWidth = 1920) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { 
          alpha: false,  // Disable alpha for JPEG (faster)
          willReadFrequently: false 
        });
        const img = new Image();
        
        img.onload = () => {
          try {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > maxWidth) {
              height = Math.floor((height * maxWidth) / width);
              width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Use faster rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with specified quality
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            // Clean up
            canvas.width = 0;
            canvas.height = 0;
            img.src = '';
            
            resolve(compressedBase64);
          } catch (err) {
            reject(err);
          }
        };
        
        img.onerror = (err) => reject(new Error('Failed to load image for compression'));
        img.src = base64;
      } catch (err) {
        reject(err);
      }
    });
  };

  /**
   * Perform actual weight save to database (called after duplicate check)
   */
  const performWeightSave = async (weightData, imageBase64, cachedUserId = null) => {
    try {
      // Use cached userId if provided, otherwise get it
      let userId = cachedUserId || user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }
      
      if (!userId) {
        throw new Error('User not authenticated or not found in database');
      }

      const payload = {
        userId,
        weightValue: weightData.weightValue,
        unit: weightData.unit,
        bmi: weightData.bmi,
        bodyFat: weightData.bodyFat,
        muscleMass: weightData.muscleMass,
        bmr: weightData.bmr,
        imageBase64ToSave: imageBase64
      };

      // console.log('💾 Saving weight entry...', { weightValue: weightData.weightValue, unit: weightData.unit });

      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save weight entry');
      }

      console.log('✅ Weight entry saved successfully');
      
      // Hide saving overlay
      setSaveLoading(false);
      setLoadingState('idle');
      
      // Show success popup (similar to nutrition save)
      setError(null);
      

      
      // Keep imagePreview and selectedImage visible (like food images)
      // Don't reset them here
      
    } catch (err) {
      console.error('❌ Save weight error:', err);
      setSaveLoading(false);
      setLoadingState('idle');
      setError(err.message || 'Failed to save weight entry');
      throw err;
    }
  };

  /**
   * Save weight entry to database with duplicate check
   */
  const saveWeightEntry = async (weightData, imageBase64) => {
    try {
      // Get the actual database UserId from team_table
      let userId = user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }
      
      if (!userId) {
        throw new Error('User not authenticated or not found in database');
      }

      // Check for duplicate weight before saving (fail-safe: proceed if check fails)
      try {
        const duplicateCheck = await duplicateDetectionService.checkForDuplicateWeight({
          userId: userId,
          weightValue: weightData.weightValue,
          unit: weightData.unit || 'kg'
        });
        
        if (duplicateCheck.isDuplicate) {
          // Found duplicate - hide saving overlay and show confirmation modal
          // console.log('⚠️ Duplicate weight detected:', duplicateCheck);
          setSaveLoading(false); // Hide saving overlay while showing duplicate modal
          setLoadingState('idle');
          setDuplicateWeightInfo(duplicateCheck);
          setPendingWeightSaveData({
            weightData: weightData,
            imageBase64: imageBase64,
            userId: userId  // Cache userId for later use
          });
          setShowDuplicateWeightModal(true);
          return; // Stop here to wait for user confirmation
        }
      } catch (duplicateCheckErr) {
        // If duplicate check fails, log it but continue with save (fail-open)
        console.warn('⚠️ Duplicate check failed, proceeding with save:', duplicateCheckErr);
      }
      
      // No duplicate or duplicate check failed - proceed with save (pass cached userId)
      await performWeightSave(weightData, imageBase64, userId);
      
    } catch (err) {
      console.error('❌ Save weight error:', err);
      setError(err.message || 'Failed to save weight entry');
      throw err;
    }
  };

  /**
   * Handle manual weight entry from modal
   */
  const handleManualWeightSave = async (manualData) => {
    try {
      setShowManualWeightModal(false); // Close modal first
      setLoadingState('saving');
      setSaveLoading(true); // Show saving overlay
      setImageType('weight'); // Ensure weight type is set
      
      await saveWeightEntry(
        {
          weightValue: manualData.weightValue,
          unit: manualData.unit,
          bmi: null,
          bodyFat: null,
          muscleMass: null,
          bmr: manualData.bmr || null
        },
        currentWeightImage
      );
      
      setCurrentWeightImage(null);
      setLoading(false);
      
    } catch (err) {
      console.error('❌ Manual weight save error:', err);
      throw err; // Re-throw to show error in modal
    }
  };

  // Helper function to perform nutrition save
  const performNutritionSave = async (saveData) => {
    try {
      setSaveLoading(true);
      
      const saveRes = await saveNutritionAnalysis(saveData);

      if (process.env.NODE_ENV !== 'production') {
        // console.log('✅ Save successful:', saveRes);
      }
      
      // Store meal ID for NutritionCard auto-save updates
      setSavedNutritionMealId(saveRes.id || saveRes.insertId);

      // ✅ ANDROID FIX: Don't auto-show popup - data is saved silently
      // Users can view saved data from Dashboard/Insights button
    } catch (err) {
      console.error('❌ Save failed:', err.message);
      const friendlySaveError = getFriendlyErrorMessage(err);
      setSaveError(friendlySaveError);
      throw err;
    } finally {
      setSaveLoading(false);
    }
  };

  // Handle duplicate modal confirmation
  const handleDuplicateConfirm = async () => {
    // Edge case: Prevent double-click/double-tap
    if (!showDuplicateModal) {
      console.warn('Duplicate confirm called but modal already closed');
      return;
    }
    
    // Edge case: No pending data (shouldn't happen but be safe)
    if (!pendingSaveData) {
      console.error('No pending save data found');
      setShowDuplicateModal(false);
      setSaveLoading(false);
      return;
    }
    
    // Edge case: Validate pending data structure
    if (!pendingSaveData.userId || !pendingSaveData.analysisResult) {
      console.error('Invalid pending save data:', pendingSaveData);
      setShowDuplicateModal(false);
      setSaveLoading(false);
      setPendingSaveData(null);
      setDuplicateInfo(null);
      return;
    }
    
    try {
      await performNutritionSave(pendingSaveData);
    } catch (err) {
      // Error already handled in performNutritionSave
      console.error('Error during duplicate confirm save:', err);
    } finally {
      // Close modal and cleanup state after save completes
      setShowDuplicateModal(false);
      setPendingSaveData(null);
      setDuplicateInfo(null);
    }
  };

  // Handle duplicate modal cancellation
  const handleDuplicateCancel = () => {
    // Edge case: Prevent double-click/double-tap
    if (!showDuplicateModal) {
      console.warn('Duplicate cancel called but modal already closed');
      return;
    }
    
    setShowDuplicateModal(false);
    setPendingSaveData(null);
    setDuplicateInfo(null);
    setSaveLoading(false);
    
    // Clear the analysis and image to allow new upload
    // Edge case: Check if states exist before clearing
    if (nutritionData) setNutritionData(null);
    if (imagePreview) setImagePreview(null);
    if (selectedImage) setSelectedImage(null);
    
    // Reset ALL file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }
  };

  // Handle duplicate weight modal confirmation
  const handleDuplicateWeightConfirm = async () => {
    if (pendingWeightSaveData) {
      try {
        setSaveLoading(true); // Show saving overlay
        setLoadingState('saving');
        // Use cached userId from pendingWeightSaveData
        await performWeightSave(
          pendingWeightSaveData.weightData, 
          pendingWeightSaveData.imageBase64,
          pendingWeightSaveData.userId
        );
      } catch (err) {
        console.error('❌ Weight save error after duplicate confirmation:', err);
      } finally {
        // Close modal and reset state after save completes
        setShowDuplicateWeightModal(false);
        setPendingWeightSaveData(null);
        setDuplicateWeightInfo(null);
      }
    }
  };

  // Handle duplicate weight modal cancellation
  const handleDuplicateWeightCancel = () => {
    setShowDuplicateWeightModal(false);
    setPendingWeightSaveData(null);
    setDuplicateWeightInfo(null);
    setLoading(false);
    
    // Clear the weight data and image to allow new upload
    setWeightResult(null);
    setImagePreview(null);
    setSelectedImage(null);
    
    // Reset ALL file inputs to allow selecting the same image again
    if (fileInputRef.current && fileInputRef.current.resetInputs) {
      fileInputRef.current.resetInputs();
    }
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
    setWeightResult(null);
    setImageType(null);
    setSaveError(null);
    setLoadingState('analyzing'); // Reset to analyzing state

    // ✅ ANDROID PERFORMANCE: Use async FileReader for non-blocking operation
    try {
      setLoading(true); // Show loading immediately
      
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // ✅ ANDROID PERFORMANCE: Intelligent compression based on platform and size
      const isAndroid = Capacitor.isNativePlatform();
      const imageSizeMB = imageBase64.length / (1024 * 1024);
      
      let processedImage = imageBase64;
      let compressionApplied = false;
      
      // Aggressive compression for Android or large images
      if (isAndroid) {
        // Android: Always compress for speed
        if (imageSizeMB > 0.5) { // > 500KB
          const maxWidth = 1280; // Optimal for Android
          const quality = imageSizeMB > 2 ? 0.75 : 0.85; // More aggressive for larger images
          processedImage = await compressImage(imageBase64, quality, maxWidth);
          compressionApplied = true;
        }
      } else {
        // Web: Compress only if needed
        if (imageSizeMB > 2) { // > 2MB
          processedImage = await compressImage(imageBase64, 0.8, 1920);
          compressionApplied = true;
        }
      }
      
      if (compressionApplied && process.env.NODE_ENV !== 'production') {
        const newSizeMB = processedImage.length / (1024 * 1024);
        // console.log(`🗜️ Image compressed: ${imageSizeMB.toFixed(2)}MB → ${newSizeMB.toFixed(2)}MB (${((1 - newSizeMB/imageSizeMB) * 100).toFixed(1)}% reduction)`);
      }
      
      // Set preview immediately for better UX
      setImagePreview(processedImage);

      // ✅ NEW: Detect if image is weight scale or food using Gemini AI
      const detectedType = await imageTypeDetector.detectImageType(file);
      
      if (detectedType.type === 'weight' && detectedType.confidence > 0.6) {
        // It's a weight scale - try to extract weight
        console.log('🔍 Weight scale detected, extracting metrics...');
        setImageType('weight');


        // const FORCE_MANUAL_ENTRY = true; // Set to false to restore normal behavior
        // if (FORCE_MANUAL_ENTRY) {
        //   console.log('🧪 TEST MODE: Forcing manual weight entry modal');
        //   setCurrentWeightImage(processedImage);
        //   setShowManualWeightModal(true);
        //   setLoading(false);
        //   return;
        // }
        
        const detectedWeight = await weightDetectionService.extractWeightFromImage(file);
        
        if (detectedWeight.success && detectedWeight.weightValue) {
          // Successfully detected weight - save to database AND show result
          // console.log('✅ Weight detected:', detectedWeight);
          
          // Convert lbs to kg if needed
          let weightToSave = { ...detectedWeight };
          if (detectedWeight.unit === 'lbs') {
            console.log(`🔄 Converting ${detectedWeight.weightValue} lbs to kg...`);
            weightToSave.weightValue = weightDetectionService.convertWeight(
              detectedWeight.weightValue, 
              'lbs', 
              'kg'
            );
            weightToSave.unit = 'kg';
            console.log(`✅ Converted to ${weightToSave.weightValue} kg`);
          }
          
          setWeightResult(weightToSave); // Store for display below upload box
          setLoadingState('saving');
          setSaveLoading(true); // Show saving overlay
          await saveWeightEntry(weightToSave, processedImage);
          // Don't clear imagePreview or return - let it show like food images
        } else {
          // Weight detection failed - show manual entry modal
          console.log('⚠️ Weight detection failed, opening manual entry modal');
          setCurrentWeightImage(processedImage);
          setShowManualWeightModal(true);
          setLoading(false);
          return;
        }
        
        setLoading(false);
        return;
      }
      
      // It's a food image
      setImageType('food');

      // ✅ ANDROID PERFORMANCE: Start food analysis in parallel with preview rendering
      // ✅ AI PERSONALIZATION: Use stored user context for instant personalization
      try {
        // Use pre-loaded user context (no fetch delay!)
        console.log('🎯 [AI Personalization] Using stored context:', {
          available: !!userContext,
          corrections: userContext?.personalCorrections?.length || 0,
          diet: userContext?.dietPreference
        });
        
        // Show rate limiting message if needed
        setLoadingState('analyzing'); // Ensure we show "Analyzing..." state
        
        const result = await geminiService.analyzeImageForNutrition(file, user?.id, userContext);
        setNutritionData(result);

        // Check for duplicate food before saving
        setLoadingState('saving'); // Switch to saving state
        setSaveLoading(true);
        try {
          // Edge case: User might be null or invalid
          if (!user) {
            console.error('No user available for duplicate check');
            throw new Error('Please sign in to save nutrition data');
          }
          
          const userIdentifier = user.email || user.id || user.uid || 'anonymous';
          
          // Get actual userId for duplicate check
          let actualUserId = user?.id;
          if (!actualUserId) {
            try {
              actualUserId = await getUserId(user);
            } catch (userIdError) {
              console.error('Failed to get userId:', userIdError);
              // Edge case: If userId lookup fails, proceed without duplicate check
              await performNutritionSave({
                userId: userIdentifier,
                imagePath: file.name,
                imageBase64: processedImage,
                analysisResult: result,
                deviceInfo: window.navigator.userAgent
              });
              return;
            }
          }
          
          // Edge case: userId still invalid after lookup
          if (!actualUserId) {
            console.warn('Could not determine userId, skipping duplicate check');
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent
            });
            return;
          }
          
          // Check for duplicates in current meal time slot
          let duplicateCheck;
          try {
            duplicateCheck = await duplicateDetectionService.checkForDuplicateFood({
              userId: actualUserId,
              analysisResult: result
            });
          } catch (duplicateError) {
            // Edge case: Duplicate check failed (network error, etc.)
            console.error('Duplicate check failed, proceeding with save:', duplicateError);
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent
            });
            return;
          }
          
          // Edge case: Invalid duplicate check response
          if (!duplicateCheck || typeof duplicateCheck !== 'object') {
            console.warn('Invalid duplicate check response, proceeding with save');
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent
            });
            return;
          }
          
          if (duplicateCheck.isDuplicate) {
            // Found duplicate - show confirmation modal
            console.log('⚠️ Duplicate food detected:', duplicateCheck);
            setDuplicateInfo(duplicateCheck);
            setPendingSaveData({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent
            });
            setShowDuplicateModal(true);
            setSaveLoading(false);
          } else {
            // No duplicate - proceed with save
            await performNutritionSave({
              userId: userIdentifier,
              imagePath: file.name,
              imageBase64: processedImage,
              analysisResult: result,
              deviceInfo: window.navigator.userAgent
            });
          }
        } catch (err) {
          // Handle save errors
          console.error('❌ Save failed:', err.message);
          
          const friendlySaveError = getFriendlyErrorMessage(err);
          setSaveError(friendlySaveError);
          setSaveLoading(false);
        }
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        console.error('❌ Gemini analysis error:', err);
      }
    } catch (err) {
      // Better error handling for undefined or missing error messages
      let errorMessage = 'Unknown error occurred';
      if (err) {
        if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.toString && err.toString() !== '[object Object]') {
          errorMessage = err.toString();
        }
      }
      
      // Provide more specific error messages for common Android gallery issues
      if (errorMessage === 'Unknown error occurred' || errorMessage.includes('undefined')) {
        errorMessage = 'Could not read the selected image. Please try selecting a different image or use the camera.';
      }
      
      setError('Failed to process image: ' + errorMessage);
      console.error('❌ Image processing error:', err);
    } finally {
      setLoading(false);
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
    setSaveError(null);
    setLoadingState('analyzing'); // Reset loading state
    
    // Clear weight-related states
    setWeightResult(null);
    setImageType(null);
    setCurrentWeightImage(null);
    setShowManualWeightModal(false);
    setShowDuplicateWeightModal(false);
    setDuplicateWeightInfo(null);
    setPendingWeightSaveData(null);
    
    // Clear duplicate food states
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setPendingSaveData(null);
    
    localStorage.removeItem('isOtpVerified');
    localStorage.removeItem('otpUser');
    localStorage.removeItem('currentPage');

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
          const saveResult = await saveUserToBackend(user);
          console.log('📦 [handleSignIn] saveResult:', saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          console.log('🆕 [handleSignIn] isNewUser:', isNewUser);
          
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
            // Show profile modal for new users to complete their profile
            if (isNewUser) {
              console.log('🆕 [handleSignIn] New user - showing profile modal');
              // Small delay to ensure user state is set before showing modal
              setTimeout(() => {
                setShowNewUserProfileModal(true);
              }, 500);
            }
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
          const saveResult = await saveUserToBackend(user);
          console.log('📦 [handlePopupSignIn] saveResult:', saveResult);
          const isNewUser = saveResult?.isNewUser === true;
          console.log('🆕 [handlePopupSignIn] isNewUser:', isNewUser);
          
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
            // Show profile modal for new users to complete their profile
            if (isNewUser) {
              console.log('🆕 [handlePopupSignIn] New user - showing profile modal');
              // Small delay to ensure user state is set before showing modal
              setTimeout(() => {
                setShowNewUserProfileModal(true);
              }, 500);
            }
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
        console.log('✅ [saveUserToBackend] User saved successfully, isNewUser:', data.isNewUser);
        
        // If this is a new user, trigger the profile modal
        if (data.isNewUser) {
          console.log('🆕 [saveUserToBackend] New user detected, will show profile modal');
        }
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
      
      // Clear user context cache
      clearContextCache();
      setUserContext(null);
      setUserContextLoading(false);
      console.log('🗑️ [Sign Out] User context cache and state cleared');
      
      if (Capacitor.isNativePlatform()) {
        try {
          await GalleryMonitor.clearCurrentUser();
        } catch (clearError) {
          console.error('⚠️ Failed to clear GalleryMonitor user (method may not exist):', clearError);
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

  const handleOtpVerified = async (isNewUser = false) => {
    console.log('🔐 [handleOtpVerified] Called with isNewUser:', isNewUser);
    
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
        setUser(parsedUser);
        
        // Show profile modal for new users
        if (isNewUser || parsedUser.isNewUser) {
          console.log('🆕 [handleOtpVerified] New user - showing profile modal');
          setTimeout(() => {
            setShowNewUserProfileModal(true);
          }, 500);
        }
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



  // Full page dashboard with lazy loading (replaces Nutrition Dashboard, Weight Tracking, Weight Insights)
  if (showDashboard) {
    return (
      <Suspense fallback={<LoadingSpinner context="normal" />}>
        <Dashboard
          user={user}
          onBack={showMainPage}
          apiBaseUrl={apiBaseUrl}
          initialTab={dashboardInitialTab}
        />
      </Suspense>
    );
  }

  // Main app interface
  return (
    <div className="min-h-screen h-screen w-screen bg-gradient-to-br from-green-50 to-green-100">
      <Header
        user={user}
        onShowBackgroundHistory={showDashboardPage}
        onShowAdminDashboard={() => setShowAdminDashboard(true)}
        onSignOut={handleSignOut}
      />
      
      {/* Debug Panel Button */}
      <button
        onClick={() => setShowDebugPanel(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 bg-yellow-500 hover:bg-yellow-600 text-white p-3 md:p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
        title="Open Food Corrections Debug Panel"
        aria-label="Open Food Corrections Debug Panel"
      >
        <Bug className="h-5 w-5 md:h-6 md:w-6" />
      </button>

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
          loadingState={loadingState}
          imageType={imageType}
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

        {imageType === 'food' && nutritionData && <NutritionCard 
          data={nutritionData} 
          user={user} 
          imagePreview={imagePreview} 
          selectedImage={selectedImage}
          savedMealId={savedNutritionMealId}
          onClose={() => {
            setNutritionData(null);
            setImagePreview(null);
            setSelectedImage(null);
            setSavedNutritionMealId(null);
          }}
        />}
        
        {imageType === 'weight' && weightResult && (
          <div className="bg-white rounded-xl shadow-lg border-2 border-white-200 p-6">
              <h2 className="text-xl font-bold text-green-700 mb-4 flex items-center">
              Weight Analysis
            </h2>
            
            {/* <div className="grid grid-cols-2 gap-4"> */}
            <div className="">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 text-center flex flex-col items-center">
  <p className="text-sm text-purple-600 font-medium mb-1">Weight</p>

  <p className="text-3xl font-bold text-purple-700">
    {weightResult.weightValue}
    <span className="text-lg font-normal ml-1">{weightResult.unit}</span>
  </p>

</div>
              
              {/* <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <p className="text-sm text-blue-600 font-medium mb-1">BMI</p>
                <p className="text-3xl font-bold text-blue-700">
                  {weightResult.bmi || '--'}
                </p>
              </div> */}
              
              {/* <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <p className="text-sm text-green-600 font-medium mb-1">Body Fat</p>
                <p className="text-3xl font-bold text-green-700">
                  {weightResult.bodyFat ? `${weightResult.bodyFat}%` : '--%'}
                </p>
              </div> */}
              
              {/* <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                <p className="text-sm text-orange-600 font-medium mb-1">Muscle Mass</p>
                <p className="text-3xl font-bold text-orange-700">
                  {weightResult.muscleMass ? `${weightResult.muscleMass} kg` : '-- kg'}
                </p>
              </div> */}
              
              {/* <div className="bg-red-50 rounded-lg p-4 border border-red-100 col-span-2">
                <p className="text-sm text-red-600 font-medium mb-1">BMR (Basal Metabolic Rate)</p>
                <p className="text-3xl font-bold text-red-700">
                  {weightResult.bmr ? `${weightResult.bmr} cal` : '-- cal'}
                </p>
              </div> */}
            </div>
            
            {/* <div className="mt-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
              <p className="text-xs text-purple-600 font-medium mb-1">✓ Saved Successfully</p>
              <p className="text-xs text-gray-600">Your weight entry has been recorded. View details in the Weight Dashboard.</p>
            </div> */}
          </div>
        )}



        {/* Saving Toast */}
        {saveLoading && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
            <div className="bg-green-600 text-white px-6 py-3 rounded-t-xl shadow-lg animate-pulse font-semibold">
              {imageType === 'weight' ? 'Saving weight entry...' : 'Saving nutrition analysis...'}
            </div>
          </div>
        )}
        
        {/* Error Toast */}
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
                <li>1. Take a clear photo of your food or weight</li>
                <li>2. Make sure the food or weight are well-lit and visible</li>
                <li>3. View detailed nutrition breakdown for detected foods or weights</li>
              </ol>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="font-semibold text-green-700 mb-2">💡 Tips for better results:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Take photos in good lighting conditions </li>
              <li>• Ensure food items or weights are clearly visible</li>
              <li>• Avoid cluttered backgrounds </li>
              <li>• For text queries, be specific about preparation methods </li>
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

      {/* Manual Weight Entry Modal */}
      <ManualWeightEntryModal
        isOpen={showManualWeightModal}
        onClose={() => {
          setShowManualWeightModal(false);
          setCurrentWeightImage(null);
          setLoading(false);
        }}
        onSave={handleManualWeightSave}
        imagePreview={currentWeightImage}
      />

      {/* Duplicate Food Modal */}
      {showDuplicateModal && duplicateInfo && (
        <DuplicateFoodModal
          foodName={duplicateInfo.originalFoodName || duplicateInfo.duplicateFoodName}
          mealType={duplicateInfo.mealType}
          onConfirm={handleDuplicateConfirm}
          onCancel={handleDuplicateCancel}
        />
      )}

      {/* Duplicate Weight Modal */}
      {showDuplicateWeightModal && duplicateWeightInfo && (
        <DuplicateFoodModal
          isWeight={true}
          weightValue={duplicateWeightInfo.existingWeight}
          unit={duplicateWeightInfo.unit}
          timeDifference={duplicateWeightInfo.timeDifference}
          onConfirm={handleDuplicateWeightConfirm}
          onCancel={handleDuplicateWeightCancel}
        />
      )}

      {/* New User Profile Modal - shown for first-time users to complete their profile */}
      <UserProfileModal
        isOpen={showNewUserProfileModal}
        onClose={() => setShowNewUserProfileModal(false)}
        user={user}
        onProfileUpdate={() => {
          console.log('✅ [NewUserProfile] Profile updated successfully');
        }}
      />
      
      {/* Food Corrections Debug Panel (Always Visible for Testing) */}
      <FoodCorrectionsDebugPanel
        userId={user?.id}
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />

      {/* Admin Dashboard */}
      {showAdminDashboard && (
        <Suspense fallback={<LoadingSpinner message="Loading admin dashboard..." />}>
          <AdminDashboard
            onClose={() => setShowAdminDashboard(false)}
            user={user}
          />
        </Suspense>
      )}
    </div>
  );
}

export default WellnessValleyApp;
