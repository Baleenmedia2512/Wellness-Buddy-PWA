// src/services/cameraService.js

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { validateImageFreshness } from '../utils/imageValidator';
import { debugLog } from '../utils/logger.js';

class CameraService {
  isNativeApp() {
    return Capacitor.isNativePlatform();
  }

  async takePhoto(validateForEducation = false) {
    if (this.isNativeApp()) {
      // ✅ ANDROID PERFORMANCE: Use Base64 instead of Uri for faster processing
      try {
        const photo = await Camera.getPhoto({
          quality: 85, // Slightly lower quality for faster processing
          resultType: CameraResultType.Base64, // Direct base64 - faster than Uri
          source: CameraSource.Camera,
          allowEditing: false,
          saveToGallery: false, // Don't save to gallery for faster processing
          correctOrientation: true, // Fix orientation issues
          width: 1280, // Limit size for faster processing
          height: 1280
        });

        // Convert base64 to data URL
        const dataUrl = `data:image/jpeg;base64,${photo.base64String}`;
        
        // Convert to File object for compatibility
        const blob = await this.base64ToBlob(dataUrl);
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });

        // 🚨 Validate image freshness for education logs (prevent proxy/old images)
        if (validateForEducation) {
          const validation = await validateImageFreshness(file, 0); // Only today's images
          
          if (!validation.isValid) {
            return {
              success: false,
              error: validation.message,
              reason: 'proxy',
              details: validation.details
            };
          }
          
          debugLog('✅ Image validated:', validation.message);
        }

        return {
          success: true,
          src: dataUrl,
          file: file
        };
      } catch (err) {
        console.error('Native camera failed:', err);
        return { success: false, error: err.message };
      }
    } else {
      // ✅ Web - fallback to <input type="file" />
      return new Promise(async (resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';

        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) {
            resolve({ success: false, error: 'No file selected' });
            return;
          }

          // 🚨 Validate image freshness for education logs (prevent proxy/old images)
          if (validateForEducation) {
            const validation = await validateImageFreshness(file, 0); // Only today's images
            
            if (!validation.isValid) {
              resolve({
                success: false,
                error: validation.message,
                reason: 'proxy',
                details: validation.details
              });
              return;
            }
            
            debugLog('✅ Image validated:', validation.message);
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              success: true,
              src: reader.result,
              file
            });
          };
          reader.readAsDataURL(file);
        };

        input.click();
      });
    }
  }

  // Helper to convert base64 to Blob
  async base64ToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return await response.blob();
  }

  async selectFromGallery(validateForEducation = false) {
    if (this.isNativeApp()) {
      // ✅ ANDROID PERFORMANCE: Use Base64 for faster processing
      try {
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Base64,
          source: CameraSource.Photos,
          allowEditing: false,
          correctOrientation: true,
          width: 1280,
          height: 1280
        });

        const dataUrl = `data:image/jpeg;base64,${photo.base64String}`;
        const blob = await this.base64ToBlob(dataUrl);
        const file = new File([blob], `gallery-${Date.now()}.jpg`, { type: 'image/jpeg' });

        // 🚨 Validate image freshness for education logs (prevent proxy/old images)
        if (validateForEducation) {
          const validation = await validateImageFreshness(file, 0); // Only today's images
          
          if (!validation.isValid) {
            return {
              success: false,
              error: validation.message,
              reason: 'proxy',
              details: validation.details
            };
          }
          
          debugLog('✅ Image validated:', validation.message);
        }

        return {
          success: true,
          src: dataUrl,
          file: file
        };
      } catch (err) {
        console.error('Gallery selection failed:', err);
        return { success: false, error: err.message };
      }
    } else {
      // Web fallback
      return new Promise(async (resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) {
            resolve({ success: false, error: 'No file selected' });
            return;
          }

          // 🚨 Validate image freshness for education logs (prevent proxy/old images)
          if (validateForEducation) {
            const validation = await validateImageFreshness(file, 0); // Only today's images
            
            if (!validation.isValid) {
              resolve({
                success: false,
                error: validation.message,
                reason: 'proxy',
                details: validation.details
              });
              return;
            }
            
            debugLog('✅ Image validated:', validation.message);
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              success: true,
              src: reader.result,
              file
            });
          };
          reader.readAsDataURL(file);
        };

        input.click();
      });
    }
  }
}

export const cameraService = new CameraService();
