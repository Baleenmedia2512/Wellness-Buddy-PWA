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
 * Parse an EXIF date string "YYYY:MM:DD HH:MM:SS" into a local-time Date.
 * The result is treated as device local time (NOT UTC).
 * We append a fake UTC marker so JS Date parses it as-is, then we store
 * the numeric local values explicitly to avoid any UTC shift.
 */
function parseExifDateString(dateStr) {
  // dateStr format: "2026:03:25 07:30:00"
  const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  // Construct as local time — month is 0-indexed in JS Date
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Read a null-terminated ASCII string from dataView at given offset.
 */
function readAsciiString(dataView, offset, maxLen) {
  let str = '';
  for (let i = 0; i < maxLen; i++) {
    const byte = dataView.getUint8(offset + i);
    if (byte === 0) break;
    str += String.fromCharCode(byte);
  }
  return str;
}

/**
 * Extract DateTime from EXIF IFD structure.
 * Specifically targets:
 *   1st priority → DateTimeOriginal (tag 0x9003) — actual camera shutter time in LOCAL time
 *   2nd priority → DateTimeDigitized (tag 0x9004) — digitized time in LOCAL time
 *   3rd priority → DateTime (tag 0x0132) — file change time in LOCAL time
 *
 * GPS timestamps (tag 0x0007 inside GPSInfo IFD) are always UTC and are intentionally
 * IGNORED here to prevent the 07:07 UTC vs 07:30 IST mismatch.
 */
function extractDateTime(dataView, offset, length) {
  try {
    const end = offset + Math.min(length, dataView.byteLength - offset);

    // ── Step 1: Determine byte-order (endianness) from TIFF header ──────────
    // TIFF header starts at offset (right after "Exif\0\0")
    // "II" (0x4949) = little-endian, "MM" (0x4D4D) = big-endian
    let littleEndian = true;
    if (offset + 2 <= end) {
      const bom = dataView.getUint16(offset, false); // always read as big-endian first
      if (bom === 0x4D4D) littleEndian = false;      // "MM" → big-endian
      else if (bom === 0x4949) littleEndian = true;  // "II" → little-endian
    }

    const readUint16 = (off) => dataView.getUint16(off, littleEndian);
    const readUint32 = (off) => dataView.getUint32(off, littleEndian);

    // ── Step 2: Get IFD0 offset from TIFF header ─────────────────────────────
    // TIFF header: 2 bytes BOM + 2 bytes magic (0x002A) + 4 bytes IFD0 offset
    const ifd0Offset = offset + readUint32(offset + 4);
    if (ifd0Offset + 2 > end) return null;

    // ── Step 3: Walk IFD0 to find Exif SubIFD pointer (tag 0x8769) ───────────
    const ifd0Count = readUint16(ifd0Offset);
    let dateTimeVal = null;       // tag 0x0132 fallback
    let exifSubIFDOffset = null;  // tag 0x8769 → points to Exif SubIFD

    for (let e = 0; e < ifd0Count; e++) {
      const entryOff = ifd0Offset + 2 + e * 12;
      if (entryOff + 12 > end) break;
      const tag = readUint16(entryOff);

      if (tag === 0x0132) {
        // DateTime tag — value is ASCII string at offset or inline
        const valueOffset = offset + readUint32(entryOff + 8);
        if (valueOffset + 19 <= end) {
          const str = readAsciiString(dataView, valueOffset, 20);
          if (str.match(/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/)) {
            dateTimeVal = str;
          }
        }
      } else if (tag === 0x8769) {
        // Exif SubIFD pointer
        exifSubIFDOffset = offset + readUint32(entryOff + 8);
      }
    }

    // ── Step 4: Walk Exif SubIFD for DateTimeOriginal (0x9003) ───────────────
    if (exifSubIFDOffset && exifSubIFDOffset + 2 <= end) {
      const subCount = readUint16(exifSubIFDOffset);
      let dateTimeOriginal = null;
      let dateTimeDigitized = null;

      for (let e = 0; e < subCount; e++) {
        const entryOff = exifSubIFDOffset + 2 + e * 12;
        if (entryOff + 12 > end) break;
        const tag = readUint16(entryOff);

        if (tag === 0x9003 || tag === 0x9004) {
          // DateTimeOriginal (0x9003) or DateTimeDigitized (0x9004)
          const valueOffset = offset + readUint32(entryOff + 8);
          if (valueOffset + 19 <= end) {
            const str = readAsciiString(dataView, valueOffset, 20);
            if (str.match(/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/)) {
              if (tag === 0x9003) dateTimeOriginal = str;
              else dateTimeDigitized = str;
            }
          }
        }
      }

      // Priority: DateTimeOriginal > DateTimeDigitized > DateTime
      const best = dateTimeOriginal || dateTimeDigitized || dateTimeVal;
      if (best) {
        const parsed = parseExifDateString(best);
        if (parsed && !isNaN(parsed.getTime())) {
          console.log('✅ EXIF tag used:', dateTimeOriginal ? 'DateTimeOriginal(0x9003)' : dateTimeDigitized ? 'DateTimeDigitized(0x9004)' : 'DateTime(0x0132)', '→', best);
          return parsed;
        }
      }
    }

    // ── Step 5: Fallback to DateTime from IFD0 if no SubIFD found ────────────
    if (dateTimeVal) {
      const parsed = parseExifDateString(dateTimeVal);
      if (parsed && !isNaN(parsed.getTime())) {
        console.log('✅ EXIF fallback DateTime(0x0132) used →', dateTimeVal);
        return parsed;
      }
    }

    // ── Step 6: Last resort — raw byte scan (only for non-standard files) ────
    console.warn('⚠️ EXIF IFD parse failed, falling back to raw byte scan');
    const maxOffset = Math.min(end, offset + 10000);
    for (let i = offset; i < maxOffset - 20; i++) {
      const c0 = dataView.getUint8(i);
      // Quick pre-filter: first char must be '2' (year 2xxx)
      if (c0 !== 50) continue; // '2' = 0x32 = 50
      const dateStr = String.fromCharCode.apply(null,
        Array.from({ length: 19 }, (_, idx) => dataView.getUint8(i + idx))
      );
      if (dateStr.match(/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // Skip GPS-related UTC patterns (GPS bytes often appear before DateTimeOriginal)
        // We can't 100% guarantee this is local time in raw scan, but it's a last resort
        const parsed = parseExifDateString(dateStr);
        if (parsed && !isNaN(parsed.getTime())) {
          console.warn('⚠️ Raw byte scan fallback used — time may be UTC:', dateStr);
          return parsed;
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
 * Convert a local-time Date to an ISO-8601 string that PRESERVES the local time
 * by appending the device's actual UTC offset (e.g. "+05:30").
 * This prevents .toISOString() from silently converting local time to UTC.
 *
 * Example on IST device: 07:30 local → "2026-03-25T07:30:00+05:30"
 * The backend receives this, parses the +05:30 correctly, and stores 07:30 IST.
 */
function toLocalISOString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset(); // getTimezoneOffset() returns negative for IST
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const tzStr = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${tzStr}`;
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
        message: '🚨 Unable to verify image date. Please take a fresh photo.',
        details: 'Image metadata is missing or corrupted.',
        imageTimestamp: null
      };
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const imageDateOnly = new Date(imageDate.getFullYear(), imageDate.getMonth(), imageDate.getDate());
    
    // Calculate days difference
    const daysDiff = Math.floor((todayStart - imageDateOnly) / (1000 * 60 * 60 * 24));
    
    // Get image time in HH:MM:SS format using LOCAL time (not UTC)
    const imageTimeStr = imageDate.toTimeString().substring(0, 8);

    // Build a timezone-aware ISO string so the backend gets the exact local time
    // e.g. "2026-03-25T07:30:00+05:30" instead of "2026-03-25T02:00:00.000Z"
    const imageTimestampLocal = toLocalISOString(imageDate);
    
    console.log('📅 Image Education Timing Check:', {
      imageDate: imageTimestampLocal,
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
          ? '🚨 Image date is in the future. Please check your device clock.'
          : `🚨 This image is ${daysDiff} day(s) old. Please take a fresh photo TODAY.`,
        details: `Image date: ${imageDate.toLocaleDateString()} ${imageTimeStr}. Only images from TODAY are allowed to prevent proxy submissions.`,
        imageDate,
        imageTimestamp: imageTimestampLocal,
        daysDiff
      };
    }
    
    // ✅ Image is valid - from today (no time window restriction on frontend)
    // Backend will handle on-time vs late marking based on upload time
    console.log('✅ Education image validated - taken today at', imageTimeStr);
    return {
      isValid: true,
      reason: 'valid',
      message: '✅ Image verified - taken today',
      imageDate,
      imageTimestamp: imageTimestampLocal,
      imageTime: imageTimeStr,
      hasExif: metadata.hasExif,
      daysDiff: 0
    };
  } catch (error) {
    console.error('Error validating image for education:', error);
    return {
      isValid: false,
      reason: 'error',
      message: '🚨 Unable to validate image. Please try again.',
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
        message: 'Unable to verify image date. Please take a fresh photo.',
        details: 'Image is missing or corrupted.'
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
        message: `🚨 This image is ${daysDiff} day(s) old. Please take a fresh photo TODAY.`,
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
        message: '🚨 Image date is in the future. Please check your device clock.',
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
