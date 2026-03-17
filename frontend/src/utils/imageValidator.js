/**
 * Image Validator Utility
 * Validates images for freshness to prevent fraud (old/proxy images)
 * Supports multiple image formats: JPEG, PNG, HEIF/HEIC, WebP, and more
 */

/**
 * Detect image format from file signature
 * @param {DataView} dataView - DataView of image file
 * @returns {string} - Image format type
 */
function detectImageFormat(dataView) {
  // JPEG: FF D8 FF
  if (dataView.getUint16(0, false) === 0xFFD8) {
    return 'jpeg';
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (dataView.getUint32(0, false) === 0x89504E47) {
    return 'png';
  }
  
  // WebP: RIFF....WEBP
  if (dataView.getUint32(0, false) === 0x52494646 && // "RIFF"
      dataView.getUint32(8, false) === 0x57454250) { // "WEBP"
    return 'webp';
  }
  
  // HEIF/HEIC: ....ftyp and contains 'heic' or 'mif1'
  if (dataView.byteLength > 12) {
    const ftyp = String.fromCharCode(
      dataView.getUint8(4),
      dataView.getUint8(5),
      dataView.getUint8(6),
      dataView.getUint8(7)
    );
    if (ftyp === 'ftyp') {
      const brand = String.fromCharCode(
        dataView.getUint8(8),
        dataView.getUint8(9),
        dataView.getUint8(10),
        dataView.getUint8(11)
      );
      if (brand === 'heic' || brand === 'mif1' || brand === 'msf1' || brand === 'hevc') {
        return 'heif';
      }
    }
  }
  
  // GIF: GIF87a or GIF89a
  const gif = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2)
  );
  if (gif === 'GIF') {
    return 'gif';
  }
  
  // BMP: BM
  if (dataView.getUint16(0, false) === 0x424D) {
    return 'bmp';
  }
  
  // TIFF: II (little-endian) or MM (big-endian)
  const tiff = dataView.getUint16(0, false);
  if (tiff === 0x4949 || tiff === 0x4D4D) {
    return 'tiff';
  }
  
  return 'unknown';
}

/**
 * Extract EXIF metadata from JPEG image
 */
function extractExifFromJPEG(dataView) {
  let offset = 2; // Skip JPEG signature
  const length = dataView.byteLength;
  
  while (offset < length - 4) {
    if (dataView.getUint16(offset, false) === 0xFFE1) {
      // APP1 marker (EXIF)
      const exifLength = dataView.getUint16(offset + 2, false);
      const exifStart = offset + 4;
      
      // Check for EXIF header
      if (exifStart + 6 < length && dataView.getUint32(exifStart, false) === 0x45786966) { // "Exif"
        // Try to extract DateTime
        return extractDateTime(dataView, exifStart + 6, exifLength - 6);
      }
    }
    
    // Move to next marker
    if (offset + 2 < length) {
      const markerLength = dataView.getUint16(offset + 2, false);
      offset += 2 + markerLength;
    } else {
      break;
    }
  }
  
  return null;
}

/**
 * Extract EXIF metadata from PNG image
 * PNG stores EXIF in eXIf chunk or tEXt/iTXt chunks
 */
function extractExifFromPNG(dataView) {
  let offset = 8; // Skip PNG signature
  const length = dataView.byteLength;
  
  while (offset < length - 12) {
    const chunkLength = dataView.getUint32(offset, false);
    const chunkType = String.fromCharCode(
      dataView.getUint8(offset + 4),
      dataView.getUint8(offset + 5),
      dataView.getUint8(offset + 6),
      dataView.getUint8(offset + 7)
    );
    
    // eXIf chunk contains EXIF data
    if (chunkType === 'eXIf') {
      return extractDateTime(dataView, offset + 8, chunkLength);
    }
    
    // tEXt chunk might contain creation time
    if (chunkType === 'tEXt' || chunkType === 'iTXt') {
      const textData = [];
      for (let i = 0; i < Math.min(chunkLength, 200); i++) {
        textData.push(dataView.getUint8(offset + 8 + i));
      }
      const text = String.fromCharCode.apply(null, textData);
      
      // Look for Creation Time or Date keywords
      const dateMatch = text.match(/(\d{4}[-:]\d{2}[-:]\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        const dateStr = dateMatch[1].replace(/:/g, '-').replace(/[-](\d{2}[-]\d{2}[\sT])/, ':$1');
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Move to next chunk
    offset += 12 + chunkLength; // 4 (length) + 4 (type) + chunkLength + 4 (CRC)
    
    // Check for IEND chunk (end of PNG)
    if (chunkType === 'IEND') break;
  }
  
  return null;
}

/**
 * Extract EXIF metadata from WebP image
 * WebP can contain EXIF in VP8X extended format
 */
function extractExifFromWebP(dataView) {
  // WebP format: RIFF....WEBP + chunks
  let offset = 12; // Skip RIFF header
  const length = dataView.byteLength;
  
  while (offset < length - 8) {
    const chunkFourCC = String.fromCharCode(
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3)
    );
    
    const chunkSize = dataView.getUint32(offset + 4, true); // Little-endian
    
    // EXIF chunk
    if (chunkFourCC === 'EXIF') {
      return extractDateTime(dataView, offset + 8, chunkSize);
    }
    
    offset += 8 + chunkSize + (chunkSize % 2); // Chunks are padded to even size
  }
  
  return null;
}

/**
 * Extract EXIF metadata from HEIF/HEIC image
 * HEIF stores EXIF in meta box
 */
function extractExifFromHEIF(dataView) {
  // HEIF format is based on ISOBMFF (MP4 container)
  // This is a simplified parser - HEIF structure is complex
  let offset = 0;
  const length = dataView.byteLength;
  
  while (offset < length - 8) {
    const boxSize = dataView.getUint32(offset, false);
    if (boxSize === 0 || offset + boxSize > length) break;
    
    const boxType = String.fromCharCode(
      dataView.getUint8(offset + 4),
      dataView.getUint8(offset + 5),
      dataView.getUint8(offset + 6),
      dataView.getUint8(offset + 7)
    );
    
    // Look for meta box which contains EXIF
    if (boxType === 'meta') {
      // Search within meta box for EXIF data
      return extractDateTime(dataView, offset + 8, Math.min(boxSize - 8, 10000));
    }
    
    offset += boxSize;
  }
  
  return null;
}

/**
 * Extract EXIF metadata from image file - supports all formats
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
        
        // Detect image format
        const format = detectImageFormat(dataView);
        console.log(`📸 Image format detected: ${format} (${file.name})`);
        
        let exifDate = null;
        
        // Extract EXIF based on format
        switch (format) {
          case 'jpeg':
            exifDate = extractExifFromJPEG(dataView);
            break;
          
          case 'png':
            exifDate = extractExifFromPNG(dataView);
            break;
          
          case 'webp':
            exifDate = extractExifFromWebP(dataView);
            break;
          
          case 'heif':
            exifDate = extractExifFromHEIF(dataView);
            break;
          
          case 'tiff':
            // TIFF format already contains EXIF-like structure
            exifDate = extractDateTime(dataView, 0, Math.min(dataView.byteLength, 65536));
            break;
          
          default:
            // For other formats (GIF, BMP, etc.), try generic search
            console.log(`⚠️ Unsupported format for EXIF extraction: ${format}`);
            break;
        }
        
        if (exifDate && !isNaN(exifDate.getTime())) {
          console.log(`✅ EXIF date extracted from ${format}:`, exifDate.toISOString());
          resolve({
            hasExif: true,
            dateTime: exifDate,
            fileModified: new Date(file.lastModified),
            fileName: file.name,
            format: format
          });
        } else {
          // No EXIF date found - fall back to file modified date
          console.log(`⚠️ No EXIF date found in ${format}, using file modified date`);
          resolve({
            hasExif: false,
            fileModified: new Date(file.lastModified),
            fileName: file.name,
            format: format,
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
    
    reader.readAsArrayBuffer(file.slice(0, 131072)); // Read first 128KB (increased for larger headers)
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
 * Validate if image was taken during valid education timing
 * @param {File} file - Image file to validate
 * @param {Object} educationWindow - Education timing window {start: 'HH:MM:SS', end: 'HH:MM:SS'}
 * @returns {Promise<Object>} - Validation result with EXIF timestamp
 */
export async function validateImageForEducation(file, educationWindow = { start: '05:00:00', end: '23:59:00' }) {
  try {
    const metadata = await extractImageMetadata(file);
    
    // Use EXIF date if available, otherwise fall back to file modified date
    const imageDate = metadata.hasExif ? metadata.dateTime : metadata.fileModified;
    
    if (!imageDate || isNaN(imageDate.getTime())) {
      return {
        isValid: false,
        reason: 'proxy',
        message: '🚨 PROXY ALERT: Unable to verify image date. Please take a fresh photo.',
        details: 'Image metadata is missing or corrupted.',
        imageTimestamp: null
      };
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const imageDateOnly = new Date(imageDate.getFullYear(), imageDate.getMonth(), imageDate.getDate());
    
    // Calculate days difference
    const daysDiff = Math.floor((todayStart - imageDateOnly) / (1000 * 60 * 60 * 24));
    
    // Get image time in HH:MM:SS format
    const imageTimeStr = imageDate.toTimeString().substring(0, 8);
    
    console.log('📅 Image Education Timing Check:', {
      imageDate: imageDate.toISOString(),
      imageTime: imageTimeStr,
      today: todayStart.toISOString(),
      daysDiff,
      educationWindow,
      hasExif: metadata.hasExif
    });
    
    // Check if image is from today
    if (daysDiff !== 0) {
      return {
        isValid: false,
        reason: 'proxy',
        message: daysDiff < 0 
          ? '🚨 PROXY ALERT: Image date is in the future. Please check your device clock.'
          : `🚨 PROXY ALERT: This image is ${daysDiff} day(s) old. Please take a fresh photo TODAY during education hours.`,
        details: `Image date: ${imageDate.toLocaleDateString()} ${imageTimeStr}. Only images from TODAY during education timing (${educationWindow.start} - ${educationWindow.end}) are allowed.`,
        imageDate,
        imageTimestamp: imageDate.toISOString(),
        daysDiff
      };
    }
    
    // Check if image time is within education window
    if (imageTimeStr < educationWindow.start || imageTimeStr > educationWindow.end) {
      return {
        isValid: false,
        reason: 'proxy',
        message: `🚨 PROXY ALERT: Image was taken at ${imageTimeStr}, outside education hours (${educationWindow.start} - ${educationWindow.end}).`,
        details: `Education timing validation failed. Please take a photo during valid education hours only.`,
        imageDate,
        imageTimestamp: imageDate.toISOString(),
        imageTime: imageTimeStr,
        educationWindow
      };
    }
    
    // Image is valid - from today and within education timing
    return {
      isValid: true,
      reason: 'valid',
      message: '✅ Image verified - taken today during education hours',
      imageDate,
      imageTimestamp: imageDate.toISOString(),
      imageTime: imageTimeStr,
      hasExif: metadata.hasExif,
      daysDiff: 0
    };
  } catch (error) {
    console.error('Error validating image for education:', error);
    return {
      isValid: false,
      reason: 'error',
      message: '🚨 PROXY ALERT: Unable to validate image. Please try again.',
      details: error.message,
      imageTimestamp: null
    };
  }
}

/**
 * Validate if image was taken today (fresh image) - for non-education images
 * @param {File} file - Image file to validate
 * @param {number} allowedDaysOld - Maximum age in days (default: 0 = today only)
 * @returns {Promise<Object>} - Validation result
 */
export async function validateImageFreshness(file, allowedDaysOld = 0) {
  try {
    console.log('📸 File info:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      lastModifiedDate: new Date(file.lastModified).toISOString()
    });
    
    const metadata = await extractImageMetadata(file);
    
    // Use EXIF date if available, otherwise fall back to file modified date
    const imageDate = metadata.hasExif ? metadata.dateTime : metadata.fileModified;
    
    console.log('📊 Metadata extracted:', {
      hasExif: metadata.hasExif,
      imageDate: imageDate ? imageDate.toISOString() : 'null',
      reason: metadata.reason
    });
    
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
      imageDateOnly: imageDateOnly.toISOString(),
      today: todayStart.toISOString(),
      now: now.toISOString(),
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
