/**
 * Fast Client-Side EXIF Metadata Parser
 * Extracts GPS Coordinates (Latitude, Longitude) and Capture Timestamp (DateTimeOriginal)
 */

const ExifParser = {
  /**
   * Parse an image File or Blob to extract EXIF GPS & Date
   * @param {File|Blob} file
   * @returns {Promise<{latitude: number|null, longitude: number|null, dateTime: Date|null, rawDateTime: string|null}>}
   */
  async extractMetadata(file) {
    try {
      const buffer = await file.arrayBuffer();
      const dataView = new DataView(buffer);

      // Check JPEG SOI marker (0xFFD8)
      if (dataView.getUint16(0, false) !== 0xFFD8) {
        return { latitude: null, longitude: null, dateTime: null, rawDateTime: null };
      }

      let offset = 2;
      const length = dataView.byteLength;

      while (offset < length) {
        if (dataView.getUint8(offset) !== 0xFF) {
          break;
        }

        const marker = dataView.getUint8(offset + 1);
        // APP1 marker (0xFFE1) contains EXIF
        if (marker === 0xE1) {
          const exifData = this.parseApp1(dataView, offset + 4);
          if (exifData) return exifData;
        }

        offset += 2 + dataView.getUint16(offset + 2, false);
      }

      return { latitude: null, longitude: null, dateTime: null, rawDateTime: null };
    } catch (e) {
      console.warn('Exif parsing skipped or failed:', e);
      return { latitude: null, longitude: null, dateTime: null, rawDateTime: null };
    }
  },

  parseApp1(dataView, offset) {
    // Check "Exif\0\0" header
    if (dataView.getUint32(offset, false) !== 0x45786966 || dataView.getUint16(offset + 4, false) !== 0x0000) {
      return null;
    }

    const tiffOffset = offset + 6;
    const isLittleEndian = dataView.getUint16(tiffOffset, false) === 0x4949; // II or MM

    // First IFD offset
    const ifdOffset = dataView.getUint32(tiffOffset + 4, isLittleEndian);
    return this.readIFD(dataView, tiffOffset, tiffOffset + ifdOffset, isLittleEndian);
  },

  readIFD(dataView, tiffOffset, ifdOffset, isLittleEndian) {
    let result = { latitude: null, longitude: null, dateTime: null, rawDateTime: null };
    if (ifdOffset >= dataView.byteLength - 2) return result;

    const numEntries = dataView.getUint16(ifdOffset, isLittleEndian);
    let exifSubIfdOffset = 0;
    let gpsIfdOffset = 0;

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > dataView.byteLength) break;

      const tag = dataView.getUint16(entryOffset, isLittleEndian);

      if (tag === 0x8769) { // Exif IFD Pointer
        exifSubIfdOffset = dataView.getUint32(entryOffset + 8, isLittleEndian);
      } else if (tag === 0x8825) { // GPS Info IFD Pointer
        gpsIfdOffset = dataView.getUint32(entryOffset + 8, isLittleEndian);
      } else if (tag === 0x0132) { // DateTime
        result.rawDateTime = this.readString(dataView, tiffOffset, entryOffset, isLittleEndian);
      }
    }

    // Read Exif Sub IFD for DateTimeOriginal
    if (exifSubIfdOffset) {
      const subOffset = tiffOffset + exifSubIfdOffset;
      if (subOffset < dataView.byteLength - 2) {
        const subEntries = dataView.getUint16(subOffset, isLittleEndian);
        for (let i = 0; i < subEntries; i++) {
          const entryOffset = subOffset + 2 + i * 12;
          if (entryOffset + 12 > dataView.byteLength) break;
          const tag = dataView.getUint16(entryOffset, isLittleEndian);
          if (tag === 0x9003 || tag === 0x9004) { // DateTimeOriginal / DateTimeDigitized
            result.rawDateTime = this.readString(dataView, tiffOffset, entryOffset, isLittleEndian);
            break;
          }
        }
      }
    }

    // Read GPS IFD
    if (gpsIfdOffset) {
      const gpsOffset = tiffOffset + gpsIfdOffset;
      if (gpsOffset < dataView.byteLength - 2) {
        const gpsEntries = dataView.getUint16(gpsOffset, isLittleEndian);
        let latRef = 'N', lonRef = 'E';
        let latValues = null, lonValues = null;

        for (let i = 0; i < gpsEntries; i++) {
          const entryOffset = gpsOffset + 2 + i * 12;
          if (entryOffset + 12 > dataView.byteLength) break;
          const tag = dataView.getUint16(entryOffset, isLittleEndian);

          if (tag === 1) { // GPSLatitudeRef
            latRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
          } else if (tag === 2) { // GPSLatitude
            latValues = this.readRationalArray(dataView, tiffOffset, entryOffset, 3, isLittleEndian);
          } else if (tag === 3) { // GPSLongitudeRef
            lonRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
          } else if (tag === 4) { // GPSLongitude
            lonValues = this.readRationalArray(dataView, tiffOffset, entryOffset, 3, isLittleEndian);
          }
        }

        if (latValues && lonValues) {
          result.latitude = this.convertDMSToDD(latValues, latRef);
          result.longitude = this.convertDMSToDD(lonValues, lonRef);
        }
      }
    }

    // Parse DateTime string: "YYYY:MM:DD HH:MM:SS"
    // Validate chặt: máy ảnh chưa set giờ ghi "0000:00:00 00:00:00" (→ 30/11/1899),
    // chuỗi rác tạo Invalid Date → watermark hiển thị "NaN Tháng NaN"
    if (result.rawDateTime) {
      const parts = result.rawDateTime.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split(':').map(v => parseInt(v, 10));
        const timeParts = parts[1].split(':').map(v => parseInt(v, 10));
        const [y, mo, d] = dateParts;
        const [h, mi, s] = timeParts;
        const valid =
          dateParts.length === 3 && timeParts.length === 3 &&
          [y, mo, d, h, mi, s].every(Number.isFinite) &&
          y >= 1970 && y <= 2200 &&
          mo >= 1 && mo <= 12 &&
          d >= 1 && d <= 31 &&
          h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && s >= 0 && s <= 60;
        if (valid) {
          const parsed = new Date(y, mo - 1, d, h, mi, s);
          if (!isNaN(parsed.getTime())) result.dateTime = parsed;
        }
      }
    }

    return result;
  },

  readString(dataView, tiffOffset, entryOffset, isLittleEndian) {
    const length = dataView.getUint32(entryOffset + 4, isLittleEndian);
    const valueOffset = (length <= 4) ? (entryOffset + 8) : (tiffOffset + dataView.getUint32(entryOffset + 8, isLittleEndian));
    let str = '';
    for (let i = 0; i < length - 1; i++) {
      if (valueOffset + i >= dataView.byteLength) break;
      str += String.fromCharCode(dataView.getUint8(valueOffset + i));
    }
    return str.trim();
  },

  readRationalArray(dataView, tiffOffset, entryOffset, count, isLittleEndian) {
    const valueOffset = tiffOffset + dataView.getUint32(entryOffset + 8, isLittleEndian);
    const numbers = [];
    for (let i = 0; i < count; i++) {
      const pos = valueOffset + i * 8;
      if (pos + 8 > dataView.byteLength) break;
      const numerator = dataView.getUint32(pos, isLittleEndian);
      const denominator = dataView.getUint32(pos + 4, isLittleEndian);
      numbers.push(denominator ? (numerator / denominator) : 0);
    }
    return numbers;
  },

  convertDMSToDD(dms, ref) {
    if (!dms || dms.length < 3) return null;
    let dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
    if (ref === 'S' || ref === 'W') dd = -dd;
    return parseFloat(dd.toFixed(6));
  }
};

if (typeof window !== 'undefined') window.ExifParser = ExifParser;
if (typeof globalThis !== 'undefined') globalThis.ExifParser = ExifParser;
