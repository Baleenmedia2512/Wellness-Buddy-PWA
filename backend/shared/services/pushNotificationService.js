/**
 * pushNotificationService.js — Firebase Cloud Messaging integration
 * 
 * Sends push notifications to Android and iOS devices
 * Requires Firebase service account key
 */

import admin from 'firebase-admin';
import logger from '../lib/logger.js';

// Initialize Firebase Admin SDK (only once)
let firebaseInitialized = false;

async function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });

    firebaseInitialized = true;

    logger.info('Firebase Admin SDK initialized successfully', {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    });

  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', {
      error: error.message,
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
    });

    throw error;
  }
}

/**
 * Send push notification to a user
 * 
 * @param {string} pushToken - User's FCM device token
 * @param {Object} notification - Notification payload
 * @returns {Promise<boolean>} - Success status
 */
async function sendPushNotification(pushToken, notification) {
  if (!pushToken) {
    logger.warn('Cannot send notification: no push token provided');
    return false;
  }
  
  try {
    // Initialize Firebase if not already done
    if (!firebaseInitialized) {
      await initializeFirebase();
    }
    
    const message = {
      token: pushToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'wellness_tasks'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };
    
    const response = await admin.messaging().send(message);
    
    logger.info('Push notification sent successfully', {
      pushToken: pushToken.substring(0, 20) + '...',
      messageId: response
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to send push notification', {
      error: error.message,
      errorCode: error.code,
      pushToken: pushToken ? pushToken.substring(0, 20) + '...' : 'null'
    });
    
    // Token might be invalid/expired - return false so caller can handle
    return false;
  }
}

/**
 * Send notification to multiple devices (batch)
 * 
 * @param {Array<string>} pushTokens - Array of FCM tokens
 * @param {Object} notification - Notification payload
 * @returns {Promise<Object>} - { successCount, failureCount, invalidTokens }
 */
async function sendBatchNotifications(pushTokens, notification) {
  if (!pushTokens || pushTokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }
  
  try {
    if (!firebaseInitialized) {
      await initializeFirebase();
    }
    
    const messages = pushTokens.map(token => ({
      token,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      }
    }));
    
    const response = await admin.messaging().sendEach(messages);
    
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
        invalidTokens.push(pushTokens[idx]);
      }
    });
    
    logger.info('Batch notifications sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens: invalidTokens.length
    });
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens
    };
  } catch (error) {
    logger.error('Failed to send batch notifications', {
      error: error.message,
      tokenCount: pushTokens.length
    });
    
    return {
      successCount: 0,
      failureCount: pushTokens.length,
      invalidTokens: []
    };
  }
}

export {
  sendPushNotification,
  sendBatchNotifications
};
