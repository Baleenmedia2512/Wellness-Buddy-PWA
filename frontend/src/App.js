// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import ImageUpload from './components/ImageUpload';
import NutritionCard from './components/NutritionCard';
import SuccessSavePopup from './components/SuccessSavePopup';
import { fetchLatestBackgroundNutrition } from './services/backgroundNutritionService';
import { getUserId } from './services/getUserId';
import { saveNutritionAnalysis, deleteNutritionAnalysis } from './services/nutritionSaveService';
import TestImageGuide from './components/TestImageGuide';
import CameraTest from './components/CameraTest';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './components/Login';
import NutritionDashboard from './components/NutritionDashboard';
import { geminiService } from './services/geminiService';
import { cameraService } from './services/cameraService';
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
  const [showCameraTest, setShowCameraTest] = useState(false);
  const [showNutritionDashboard, setShowNutritionDashboard] = useState(
    localStorage.getItem('currentPage') === 'nutrition-dashboard'
  );
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOtpVerified, setIsOtpVerified] = useState(
    localStorage.getItem('isOtpVerified') === 'true'
  );
  const fileInputRef = useRef(null);

  // Success popup state - support for multiple popups with localStorage persistence
  const [successPopups, setSuccessPopups] = useState(() => {
    // Try to load popups immediately on initialization
    try {
      const saved = localStorage.getItem('wellnessBuddy_successPopups');
      if (saved) {
        const parsedPopups = JSON.parse(saved);
        const validPopups = parsedPopups.filter(popup => 
          popup && popup.id && popup.nutritionData && popup.imagePreview
        );
        return validPopups;
      }
      return [];
    } catch (error) {
      return [];
    }
  });

  // Background nutrition popup state
  const [bgNutritionPopup, setBgNutritionPopup] = useState(null);
  // Show background nutrition popup if new record exists and not acknowledged
  useEffect(() => {
    const maybeShowBgNutritionPopup = async () => {
      if (!user) return;
      // Always use DB UserID only
      let dbUserId = user.id;
      if (!dbUserId) {
        dbUserId = await getUserId(user);
      }
      if (!dbUserId) return;
      const latest = await fetchLatestBackgroundNutrition(dbUserId);
      if (!latest) return;
      // Only show if not acknowledged
      const lastAckId = localStorage.getItem('wellnessBuddy_lastBgNutritionId');
      if (String(latest.ID) !== String(lastAckId)) {
        // Try to get image preview from AnalysisData or fallback
        let imagePreview = null;
        if (latest.ImageBase64) {
          if (latest.ImageBase64.startsWith('data:image')) {
            imagePreview = latest.ImageBase64;
          } else {
            imagePreview = `data:image/jpeg;base64,${latest.ImageBase64}`;
          }
        } else if (latest.ImagePath) {
          imagePreview = latest.ImagePath;
        }
        // Parse nutrition data from AnalysisData JSON
        let nutritionData = null;
        try {
          const parsed = typeof latest.AnalysisData === 'string' ? JSON.parse(latest.AnalysisData) : latest.AnalysisData;
          // Flatten food item nutrition and set a better title
          let detailedItems = Array.isArray(parsed.foods)
            ? parsed.foods.map(item => ({
                ...item,
                calories: item.nutrition?.calories ?? 0,
                protein: item.nutrition?.protein ?? 0,
                carbs: item.nutrition?.carbs ?? 0,
                fat: item.nutrition?.fat ?? 0,
                fiber: item.nutrition?.fiber ?? 0
              }))
            : [];
          // Set a better title/category
          let category = {};
          if (detailedItems.length === 1) {
            category.name = detailedItems[0].name;
          } else if (detailedItems.length > 1) {
            category.name = `Mixed Foods (${detailedItems.length} items)`;
          } else {
            category.name = 'Food';
          }
          nutritionData = {
            ...parsed,
            nutrition: parsed.total || {},
            detailedItems,
            category
          };
        } catch {
          nutritionData = null;
        }
        
        // Only set the popup if nutritionData is valid and has meaningful values
        if (nutritionData && nutritionData.nutrition) {
          const nutrition = nutritionData.nutrition;
          const hasValidNutritionData = 
            (nutrition.calories && nutrition.calories > 0) ||
            (nutrition.protein && nutrition.protein > 0) ||
            (nutrition.carbs && nutrition.carbs > 0) ||
            (nutrition.fat && nutrition.fat > 0);
          
          if (hasValidNutritionData) {
            setBgNutritionPopup({
              id: `bg-${latest.ID}`,
              analysisId: latest.ID,
              nutritionData,
              imagePreview,
              timestamp: latest.CreatedAt
            });
          } else {
            console.log('⚠️ Skipping background nutrition popup - no meaningful nutrition data');
          }
        } else {
          console.log('⚠️ Skipping background nutrition popup - invalid nutrition data');
        }
      }
    };
    maybeShowBgNutritionPopup();
  }, [user]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Helper functions for navigation with localStorage persistence
  const showNutritionDashboardPage = () => {
    setShowNutritionDashboard(true);
    // Don't clear popups when navigating - let them persist
    localStorage.setItem('currentPage', 'nutrition-dashboard');
  };

  const showMainPage = () => {
    setShowNutritionDashboard(false);
    localStorage.setItem('currentPage', 'main');
  };

  const requestAllPermissions = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Camera permission is handled by the camera plugin when used
    // No need to request it explicitly here
    
    // Storage/media access is handled by gallery monitor
    // when it initializes
    
    // Notifications permission (Capacitor way)
    await PushNotifications.requestPermissions();

  } catch (err) {
    console.warn('❌ Permission request failed:', err);
  }
};


  const handleSaveUserCache = async (user) => {
    console.log('handleSaveUserCache is initiated');
    if (user && Capacitor.isNativePlatform()) {
      console.log('1st condition met')
        try {
          const dbUserId = await getUserId(user);
          if (dbUserId && user.email) {
            console.log('Setting GalleryMonitor current user:', dbUserId, user.email);
            GalleryMonitor.setCurrentUser(String(dbUserId), user.email);
          }
        } catch (err) {
          console.warn('Failed to set current user for background service:', err);
        }
    }
  }

  
  // Set up StatusBar to appear above content (not overlaid)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        // Simple configuration - rely on native configuration
        StatusBar.setOverlaysWebView({ overlay: false });
      }).catch((err) => {
        console.warn('StatusBar plugin not available:', err);
      });
    }
  }, []);
  

  useEffect(() => {
    const initializeGalleryMonitoring = async () => {
      if (Capacitor.isNativePlatform()) {
        // Start the gallery monitoring service
        await GalleryMonitor.initialize();
        
        // Add listener for app state changes
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            // App came to foreground - do an immediate check
            GalleryMonitor.checkGallery();
          }
        });

        // Listen for notification clicks that should open background history
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

    let cleanup;
    initializeGalleryMonitoring().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      // Clean up listeners
      App.removeAllListeners();
      if (cleanup) cleanup();
    };
  }, []);

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
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setAuthLoading(false);
      console.log('On profile creation task, make sure to set from DB here');
      // Set user context for background service when user changes
      if (user && Capacitor.isNativePlatform()) {
        handleSaveUserCache(user);
      }
    });

    return () => unsubscribe();
  }, []);

  // Camera setup for authenticated users
  // After login: request permissions and check camera
  useEffect(() => {
    if (user) {
      const checkCamera = async () => {
        try {
          const info = await cameraService.getCameraInfo();
          const message = await cameraService.getCameraStatusMessage();
          console.log('📷 Camera info:', info, message);
        } catch (error) {
          console.warn('⚠️ Camera check failed:', error);
        }
      };
      
      checkCamera();
      requestAllPermissions(); // 🔔 request permissions after login
      handleSaveUserCache(user);
    }
  }, [user]);


  // Handle OTP user restoration
  useEffect(() => {
    if (isOtpVerified && !user) {
      const otpUser = localStorage.getItem('otpUser');
      if (otpUser) {
        try {
          setUser(JSON.parse(otpUser));
          console.log('OTP user restored:', JSON.parse(otpUser));
          handleSaveUserCache(JSON.parse(otpUser));
        } catch (error) {
          console.error('❌ Failed to restore OTP user:', error);
          localStorage.removeItem('otpUser');
          setIsOtpVerified(false);
        }
      }
    }
  }, [isOtpVerified, user]);

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

  const handleImageSelect = async (file) => {
    if (!user) {
      setError('Please sign in to analyze food images');
      return;
    }

    setSelectedImage(file);
    setError(null);
    setNutritionData(null);

    // Don't clear existing popups - let them stack up
    setSaveError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageBase64 = e.target.result;
      setImagePreview(imageBase64);

      // Analyze food after preview is ready
      try {
        setLoading(true);
        const result = await geminiService.analyzeImageForNutrition(file);
        setNutritionData(result);

        // Auto-save to DB after analysis
        setSaveLoading(true);
        try {
          // Always prioritize user email for team_table lookup, fallback to other identifiers
          const userIdentifier = user.email || user.id || user.uid || 'anonymous';

          const saveRes = await saveNutritionAnalysis({
            userId: userIdentifier,
            imagePath: file.name,
            imageBase64,
            analysisResult: result,
            deviceInfo: window.navigator.userAgent
          });

          // Add new popup to the array (stack them up)
          const newPopup = {
            id: Date.now().toString(),
            analysisId: saveRes.id,
            nutritionData: result,
            imagePreview: imageBase64,
            timestamp: new Date()
          };
          setSuccessPopups(prev => {
            const updated = [...prev, newPopup];
            return updated;
          });
        } catch (err) {
          setSaveError('Failed to save analysis: ' + (err.message || 'Unknown error'));
        } finally {
          setSaveLoading(false);
        }
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
      localStorage.setItem('wellnessBuddy_lastBgNutritionId', String(bgNutritionPopup.analysisId));
      setBgNutritionPopup(null);
      return;
    }
    if (popupId) {
      setSuccessPopups(prev => {
        const filtered = prev.filter(popup => popup.id !== popupId);
        return filtered;
      });
    } else {
      setSuccessPopups([]);
    }
  };

  const handleSuccessPopupDelete = async (popupId) => {
    const popup = successPopups.find(p => p.id === popupId);
    if (!popup || !popup.analysisId) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      await deleteNutritionAnalysis({ id: popup.analysisId });
      // Remove this popup from the array
      setSuccessPopups(prev => {
        const filtered = prev.filter(p => p.id !== popupId);
        return filtered;
      });
      
      // If this was the current analysis, clear it
      if (nutritionData && popup.nutritionData === nutritionData) {
        setNutritionData(null);
        setImagePreview(null);
        setSelectedImage(null);
      }
    } catch (err) {
      console.error('❌ Failed to delete analysis:', err);
      setSaveError('Failed to delete: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const getFriendlyErrorMessage = (error) => {
    const rawMessage = error.message || '';

    if (rawMessage.includes('503') || rawMessage.includes('overloaded')) {
      return '⚡ Server is currently busy. Please try again in a few minutes.';
    } else if (rawMessage.includes('No food items detected')) {
      return '⚠️ No food items were detected in the image. Try with a clearer photo.';
    } else if (rawMessage.includes('Invalid response format')) {
      return '⚙️ Received unexpected data from server. Please try again later.';
    } else if (rawMessage.includes('network') || rawMessage.includes('Failed to fetch')) {
      return '🌐 Network issue. Please check your internet connection.';
    } else if (rawMessage.includes('API key is not configured')) {
      return '⚙️ Server is missing or invalid. Please check your setup.';
    }

    return '❌ Food analysis failed. Please try again later.';
  };

  const resetApp = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setNutritionData(null);
    setError(null);
    setUser(null);
    setIsOtpVerified(false);
    setSuccessPopups([]); // Clear all success popups
    setSaveError(null);
    localStorage.removeItem('isOtpVerified');
    localStorage.removeItem('otpUser');
    localStorage.removeItem('currentPage'); // Clear current page
    localStorage.removeItem('wellnessBuddy_successPopups'); // Clear saved popups
    
    // Also clean up any old user-specific popup keys
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('successPopups_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to clean up old popup keys:', error);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSignIn = async (forceRedirect = false) => {
    try {
      setLoading(true);
      setError(null);
      const user = await signInWithGoogle(forceRedirect);

      // For popup authentication, user is returned immediately
      if (user) {
        await saveUserToBackend(user);
        setUser(user);
      } else {
        // For redirect authentication, user will be set via auth state change
        console.log('🔄 Redirect initiated, waiting for result...');
      }
    } catch (error) {
      console.error('❌ Sign in error:', error);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Trying redirect method...');
        // Automatically retry with redirect
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

  // Handle popup sign-in specifically for web
  const handlePopupSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await signInWithGooglePopup();
      
      if (user) {
        await saveUserToBackend(user);
        setUser(user);
      }
    } catch (error) {
      console.error('❌ Popup sign-in error:', error);
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
      await fetch(`${apiBaseUrl}/api/save-google-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0],
          photoURL: user.photoURL || null,
          uid: user.uid
        })
      });
    } catch (error) {
      console.error('❌ Failed to save user to backend:', error);
      // Don't throw - user is still authenticated
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      
      // Clear user context from background service before signing out
      if (Capacitor.isNativePlatform()) {
        await GalleryMonitor.clearCurrentUser();
      }
      
      await signOutUser();
      resetApp();
    } catch (error) {
      console.error('❌ Sign out error:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = () => {
    setIsOtpVerified(true);
    localStorage.setItem('isOtpVerified', 'true');
  };

  // Loading state
  if (authLoading) {
    return <LoadingSpinner context="normal" />;
  }

  // Authentication logic
  // 1. If no Firebase user & OTP not yet verified → Show Login
  if (!user && !isOtpVerified) {
    return (
      <Login
        onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
        loading={loading}
        error={error}
        onOtpVerified={handleOtpVerified}
      />
    );
  }

  // 2. Safely check for Google User (only if user exists)
  const isGoogleUserCheck = user && isGoogleUser(user);

  // 3. If user is NOT Google & OTP not yet verified → Force OTP Login
  if (!isOtpVerified && !isGoogleUserCheck) {
    return (
      <Login
        onSignIn={isMobileDevice() ? handleSignIn : handlePopupSignIn}
        loading={loading}
        error={error}
        onOtpVerified={handleOtpVerified}
        forceOtpVerification={true}
      />
    );
  }

  // Remove success popup for a meal if deleted in dashboard (before undo expires)
  const handleDashboardMealDelete = (deletedAnalysisId) => {
    if (!deletedAnalysisId) return;
    setSuccessPopups(prev => prev.filter(p => p.analysisId !== deletedAnalysisId));
    // Also remove if it's the background popup
    if (bgNutritionPopup && bgNutritionPopup.analysisId === deletedAnalysisId) {
      setBgNutritionPopup(null);
    }
  };

  // If showing nutrition dashboard, render it as a full page
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
        onTestCamera={() => setShowCameraTest(true)}
        onShowBackgroundHistory={showNutritionDashboardPage}
        onSignOut={handleSignOut}
      />
      
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Nutrition Dashboard Floating Button */}
        {Capacitor.isNativePlatform() && (
          <div className="fixed bottom-4 right-4 z-40">
            <button
              onClick={showNutritionDashboardPage}
              className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full shadow-lg transition-colors flex items-center space-x-2"
              title="View Nutrition Dashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-medium">Stats</span>
            </button>
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

        {nutritionData && <NutritionCard data={nutritionData} />}

        {/* Success Save Popup: show both background and regular popups together */}
        <SuccessSavePopup
          popups={bgNutritionPopup ? [bgNutritionPopup, ...successPopups] : successPopups}
          onClose={handleSuccessPopupClose}
          onDelete={handleSuccessPopupDelete}
          onRestore={(popupId, popup) => {
            // Only restore if not already present
            setSuccessPopups(prev => {
              if (prev.find(p => p.id === popupId)) return prev;
              // Insert at the end (or you can insert at original index if you want)
              return [...prev, popup];
            });
          }}
        />
        {saveLoading && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
            <div className="bg-green-600 text-white px-6 py-3 rounded-t-xl shadow-lg animate-pulse font-semibold">Saving nutrition analysis...</div>
          </div>
        )}
        {saveError && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50">
            <div className="bg-red-600 text-white px-6 py-3 rounded-t-xl shadow-lg font-semibold">{saveError}</div>
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

        <TestImageGuide
          isVisible={showTestGuide}
          onClose={() => setShowTestGuide(false)}
        />

        {showCameraTest && (
          <CameraTest onClose={() => setShowCameraTest(false)} />
        )}
      </div>
    </div>
  );
}

export default WellnessBuddyApp;