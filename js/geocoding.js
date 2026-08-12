/**
 * Geolocation & Reverse Geocoding Service
 * Uses Browser Geolocation API and OpenStreetMap Nominatim for Vietnam & Global Address Resolution
 */

const GeoService = {
  /**
   * Get device current GPS position
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Trình duyệt không hỗ trợ Geolocation'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: parseFloat(position.coords.latitude.toFixed(6)),
            longitude: parseFloat(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy || 16)
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  /**
   * Reverse geocode coordinates to structured address using OpenStreetMap Nominatim
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<{line1: string, line2: string, city: string, ward: string, country: string, fullAddress: string, raw: object}>}
   */
  async reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=vi`;

      // Timeout 8s bằng AbortController — tránh treo UI nhiều phút khi mạng nghẽn
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      let response;
      try {
        response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error('Lỗi khi tra cứu địa chỉ từ toạ độ');
      }

      const data = await response.json();
      // Nominatim trả HTTP 200 kèm body {"error": "Unable to geocode"} cho toạ độ không tra được
      if (data.error) {
        throw new Error(data.error);
      }
      const addr = data.address || {};

      // Parse components according to Vietnam structure
      const houseNumber = addr.house_number || '';
      const road = addr.road || addr.street || addr.suburb_district || '';
      const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || '';
      const district = addr.city_district || addr.district || addr.county || '';
      const city = addr.city || addr.state || addr.province || 'Hà Nội';
      const country = addr.country || 'Việt Nam';

      let streetPart = [houseNumber, road].filter(Boolean).join(' ');
      if (!streetPart) streetPart = ward || 'Vị trí hiện tại';

      const wardLower = ward.toLowerCase();
      let wardPart = wardLower.startsWith('phường') || wardLower.startsWith('p.') ? ward : (ward ? `P. ${ward}` : '');
      // So sánh không phân biệt hoa/thường: Nominatim trả "Thành phố Thủ Đức" (p thường)
      const cityLower = city.toLowerCase();
      let cityPart = cityLower.includes('thành phố') || cityLower.includes('tỉnh') ? city : `Thành Phố ${city}`;

      // Typical Timemark single/multi line format
      const line1 = [streetPart, cityPart, wardPart].filter(Boolean).join(', ');
      const line2 = district ? `${district}, ${city}` : cityPart;

      return {
        line1: line1 || data.display_name,
        line2: line2 || cityPart,
        street: streetPart,
        ward: wardPart || ward,
        district: district,
        city: cityPart,
        country: country,
        fullAddress: data.display_name,
        raw: addr
      };
    } catch (e) {
      console.warn('Reverse geocoding error:', e);
      // Fallback trung tính: chỉ hiển thị toạ độ, KHÔNG bịa tên thành phố
      return {
        line1: `Vị trí toạ độ (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
        line2: '',
        street: 'Toạ độ GPS',
        ward: '',
        district: '',
        city: '',
        country: 'Việt Nam',
        fullAddress: `Toạ độ: ${lat}, ${lon}`
      };
    }
  },

  // Day-of-week & month name lookup tables
  daysOfWeekVi: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
  daysOfWeekEn: ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat'],
  monthsEn: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  /**
   * Format date into various presets
   */
  formatDate(date, preset = 'vietnamese') {
    const d = date instanceof Date ? date : new Date();
    const day = d.getDate().toString().padStart(2, '0');
    const dayUnpadded = d.getDate().toString();
    const month = (d.getMonth() + 1).toString();
    const monthPadded = (d.getMonth() + 1).toString().padStart(2, '0');
    const monthEn = this.monthsEn[d.getMonth()];
    const year = d.getFullYear();

    switch (preset) {
      case 'eng':
        // e.g. "11 Aug 2026" (Chuẩn 2 ảnh mới)
        return `${dayUnpadded} ${monthEn} ${year}`;
      case 'vietnamese':
        // e.g. "07 Tháng 8, 2026" or "11 Tháng 8, 2026"
        return `${day} Tháng ${month}, ${year}`;
      case 'slash':
        // e.g. "08/07/2026"
        return `${day}/${monthPadded}/${year}`;
      case 'cjk':
        // e.g. "2026年5月19日"
        return `${year}年${month}月${day}日`;
      case 'iso':
        // e.g. "2026-08-11"
        return `${year}-${monthPadded}-${day}`;
      default:
        return `${day} Tháng ${month}, ${year}`;
    }
  },

  /**
   * Forward geocode: gõ địa chỉ -> tra toạ độ GPS + địa chỉ chuẩn hoá (Nominatim /search)
   * @param {string} query - địa chỉ tự do, ví dụ "167 Nguyễn Ngọc Vũ, Cầu Giấy, Hà Nội"
   * @returns {Promise<Array<{latitude, longitude, displayName, line1, street, ward, district, city, country}>>}
   */
  async forwardGeocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&accept-language=vi`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error('Máy chủ tra cứu địa chỉ trả lỗi ' + response.status);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const addr = item.address || {};
      const houseNumber = addr.house_number || '';
      const road = addr.road || addr.street || '';
      const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || '';
      const district = addr.city_district || addr.district || addr.county || '';
      const city = addr.city || addr.state || addr.province || '';
      const country = addr.country || 'Việt Nam';

      let streetPart = [houseNumber, road].filter(Boolean).join(' ');
      if (!streetPart) streetPart = item.name || ward || district || city;

      const wardLower = (ward || '').toLowerCase();
      const wardPart = ward ? (wardLower.startsWith('phường') || wardLower.startsWith('p.') ? ward : `P. ${ward}`) : '';
      const cityLower = (city || '').toLowerCase();
      const cityPart = city ? (cityLower.includes('thành phố') || cityLower.includes('tỉnh') ? city : `Thành Phố ${city}`) : '';

      return {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        displayName: item.display_name || '',
        line1: [streetPart, wardPart].filter(Boolean).join(', '),
        street: streetPart,
        ward: wardPart,
        district: district,
        city: cityPart,
        country: country
      };
    }).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  },

  /**
   * Format time into HH:mm or HH:mm:ss
   */
  formatTime(date, includeSeconds = false) {
    const d = date instanceof Date ? date : new Date();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
  },

  /**
   * Cộng thêm số phút vào chuỗi giờ "HH:mm" hoặc "HH:mm:ss" (cuộn vòng 24h, giữ nguyên
   * định dạng & phần giây). Nếu chuỗi không đúng dạng giờ thì trả nguyên vẹn.
   * Dùng cho tính năng lệch giờ nhẹ giữa các ảnh trong loạt tải hàng loạt.
   */
  addMinutesToTime(timeStr, minutes) {
    if (!minutes) return timeStr;
    const m = String(timeStr).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return timeStr;
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    const sec = m[3];
    let total = (h * 60 + mi + minutes) % (24 * 60);
    if (total < 0) total += 24 * 60;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return sec != null ? `${hh}:${mm}:${sec}` : `${hh}:${mm}`;
  },

  /**
   * Get day of week string in Vietnamese
   */
  getDayOfWeekVi(date) {
    const d = date instanceof Date ? date : new Date();
    return this.daysOfWeekVi[d.getDay()];
  },

  /**
   * Get day of week string in English (e.g. "Tues", "Wed")
   */
  getDayOfWeekEn(date) {
    const d = date instanceof Date ? date : new Date();
    return this.daysOfWeekEn[d.getDay()];
  },

  // Bảng chữ "không nhầm lẫn" cho mã xác thực — loại I/O (chữ) và 0/1 (số).
  // Căn cứ: 28/28 ký tự trên 2 ảnh mẫu thật đều tránh 0/O/1/I (xác suất trùng
  // ngẫu nhiên chỉ ~3.7% → là quy ước sinh ID thật). Đây CHỈ là định dạng bề
  // mặt của con tem trang trí — KHÔNG phải token do máy chủ Timemark cấp và
  // KHÔNG thể tra cứu "Verified" trên hệ thống thật.
  vertCodeLetters: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // A-Z bỏ I, O
  vertCodeDigits: '23456789',                  // 0-9 bỏ 0, 1

  /**
   * Sinh mã xác thực trang trí khớp ĐỊNH DẠNG quan sát từ ảnh mẫu thật:
   *  - độ dài 14, chỉ chữ hoa + số
   *  - bảng chữ không nhầm lẫn (không 0/O/1/I)
   *  - tỷ lệ số ~18% (đo được 5/28), đảm bảo tối thiểu 1 chữ số
   *  - vị trí ký tự phân bố ĐỀU ngẫu nhiên (KHÔNG hard-code theo 2 mẫu → tránh overfit)
   */
  generateSecurityCode(length = 14) {
    const letters = this.vertCodeLetters;
    const digits = this.vertCodeDigits;
    const pick = (s) => s.charAt(Math.floor(Math.random() * s.length));
    const arr = [];
    for (let i = 0; i < length; i++) {
      arr.push(Math.random() < 0.18 ? pick(digits) : pick(letters));
    }
    // Cả 2 mẫu thật đều có >= 1 chữ số — đảm bảo điều này ở vị trí ngẫu nhiên
    if (!arr.some(c => digits.includes(c))) {
      arr[Math.floor(Math.random() * length)] = pick(digits);
    }
    return arr.join('');
  },

  /**
   * Format GPS coordinates string like Image 3
   * e.g. "Tọa độ: 20.970515°N, 105.816296°E ±16ft"
   * @param {number} accuracyM - độ chính xác tính bằng MÉT (chuẩn Geolocation API), tự quy đổi sang feet
   */
  formatCoordsString(lat, lon, accuracyM = 5) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    const absLat = Math.abs(lat).toFixed(6);
    const absLon = Math.abs(lon).toFixed(6);
    const accuracyFt = Math.max(1, Math.round((accuracyM || 5) * 3.28084));
    return `Tọa độ: ${absLat}°${latDir}, ${absLon}°${lonDir} ±${accuracyFt}ft`;
  }
};

if (typeof window !== 'undefined') window.GeoService = GeoService;
if (typeof globalThis !== 'undefined') globalThis.GeoService = GeoService;
