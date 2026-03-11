/**
 * Image Validator Utility
 * Validates images for freshness to prevent fraud (old/proxy images)
 */

/**
 * Extract EXIF metadata from image file
 * @param {File} file - Image file
 * @returns {Promise<Object>} - EXIF data including creation date
 */
export async function extractImageMetadata(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target.result;
        const dataView = new DataView(arrayBuffer);
        
        // Check for JPEG signature
        if (dataView.getUint16(0, false) !== 0xFFD8) {
          resolve({ hasExif: false, reason: 'Not a JPEG image' });
          return;
        }
        
        // Find EXIF data
        let offset = 2;
        const length = dataView.byteLength;
        let exifDate = null;
        
        while (offset < length) {
          if (dataView.getUint16(offset, false) === 0xFFE1) {
            // APP1 marker (EXIF)
            const exifLength = dataView.getUint16(offset + 2, false);
            const exifStart = offset + 4;
            
            // Check for EXIF header
            if (dataView.getUint32(exifStart, false) === 0x45786966) { // "Exif"
              // Try to extract DateTime
              exifDate = extractDateTime(dataView, exifStart + 6, exifLength - 6);
              break;
            }
          }
          offset += 2 + dataView.getUint16(offset + 2, false);
        }
        
        if (exifDate) {
          resolve({
            hasExif: true,
            dateTime: exifDate,
            fileModified: new Date(file.lastModified),
            fileName: file.name
          });
        } else {
          // No EXIF date found - fall back to file modified date
          resolve({
            hasExif: false,
            fileModified: new Date(file.lastModified),
            fileName: file.name,
            reason: 'No EXIF date found'
          });
        }
      } catch (error) {
        console.error('Error extracting EXIF:', error);
        resolve({
          hasExif: false,
          fileModified: new Date(file.lastModified),
          fileName: file.name,
          reason: error.message
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        hasExif: false,
        fileModified: new Date(file.lastModified),
        fileName: file.name,
        reason: 'File read error'
      });
    };
    
    reader.readAsArrayBuffer(file.slice(0, 65536)); // Read first 64KB (EXIF is usually in first few KB)
  });
}

/**
 * Extract DateTime from EXIF data (simplified parser)
 */
function extractDateTime(dataView, offset, length) {
  try {
    // This is a simplified EXIF parser - for production, consider using a library
    // Searching for common EXIF date tags (0x9003 - DateTimeOriginal, 0x0132 - DateTime)
    const maxOffset = offset + Math.min(length, 10000);
    
    for (let i = offset; i < maxOffset - 20; i++) {
      // Look for date pattern: YYYY:MM:DD HH:MM:SS
      const str = String.fromCharCode(
        dataView.getUint8(i),
        dataView.getUint8(i + 1),
        dataView.getUint8(i + 2),
        dataView.getUint8(i + 3),
        dataView.getUint8(i + 4)
      );
      
      if (str.match(/\d{4}:/)) {
        // Found potential date
        const dateStr = String.fromCharCode.apply(null,
          Array.from({ length: 19 }, (_, idx) => dataView.getUint8(i + idx))
        );
        
        if (dateStr.match(/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/)) {
          // Convert EXIF format (YYYY:MM:DD HH:MM:SS) to JavaScript Date
          const parts = dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
          return new Date(parts);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing DateTime:', error);
    return null;
  }
}

/**
 * Validate if image was taken today (fresh image)
 * @param {File} file - Image file to validate
 * @param {number} allowedDaysOld - Maximum age in days (default: 0 = today only)
 * @returns {Promise<Object>} - Validation result
 */
export async function validateImageFreshness(file, allowedDaysOld = 0) {
  try {
    const metadata = await extractImageMetadata(file);
    
    // Use EXIF date if available, otherwise fall back to file modified date
    const imageDate = metadata.hasExif ? metadata.dateTime : metadata.fileModified;
    
    if (!imageDate || isNaN(imageDate.getTime())) {
      return {
        isValid: false,
        reason: 'proxy',
        message: '🚨 PROXY ALERT: Unable to verify image date. Please take a fresh photo.',
        details: 'Image metadata is missing or corrupted.'
      };
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const imageDateOnly = new Date(imageDate.getFullYear(), imageDate.getMonth(), imageDate.getDate());
    
    // Calculate days difference
    const daysDiff = Math.floor((todayStart - imageDateOnly) / (1000 * 60 * 60 * 24));
    
    console.log('📅 Image Freshness Check:', {
      imageDate: imageDate.toISOString(),
      today: todayStart.toISOString(),
      daysDiff,
      allowedDaysOld,
      hasExif: metadata.hasExif
    });
    
    if (daysDiff > allowedDaysOld) {
      return {
        isValid: false,
        reason: 'proxy',
        message: `🚨 PROXY ALERT: This image is ${daysDiff} day(s) old. Please take a fresh photo TODAY.`,
        details: `Image date: ${imageDate.toLocaleDateString()}. Using old images is not allowed.`,
        imageDate,
        daysDiff
      };
    }
    
    if (daysDiff < 0) {
      // Future date - likely device clock issue or tampered
      return {
        isValid: false,
        reason: 'proxy',
        message: '🚨 PROXY ALERT: Image date is in the future. Please check your device clock.',
        details: 'This may indicate device clock tampering or incorrect settings.',
        imageDate,
        daysDiff
      };
    }
    
    return {
      isValid: true,
      reason: 'fresh',
      message: '✅ Image verified as fresh (taken today)',
      imageDate,
      daysDiff,
      hasExif: metadata.hasExif
    };
    
  } catch (error) {
    console.error('Error validating image freshness:', error);
    return {
      isValid: false,
      reason: 'error',
      message: '⚠️ Unable to validate image. Please try taking a new photo.',
      details: error.message
    };
  }
}
