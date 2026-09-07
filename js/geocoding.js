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
   * Gọi JSON có timeout (AbortController) — tránh treo UI khi mạng nghẽn hoặc bị chặn.
   * Ném lỗi nếu quá hạn / không kết nối được / HTTP không thành công.
   */
  async fetchJson(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /** Chuẩn hoá tên phường/xã theo cách viết Việt Nam */
  formatWard(ward) {
    if (!ward) return '';
    const low = String(ward).toLowerCase();
    return (low.startsWith('phường') || low.startsWith('p.') || low.startsWith('xã') || low.startsWith('thị trấn'))
      ? ward : `P. ${ward}`;
  },

  /** Chuẩn hoá tên tỉnh/thành theo cách viết Việt Nam */
  formatCity(city) {
    if (!city) return '';
    const low = String(city).toLowerCase();
    return (low.includes('thành phố') || low.includes('tỉnh')) ? city : `Thành Phố ${city}`;
  },

  /** Chuyển 1 kết quả Nominatim -> cấu trúc địa chỉ chuẩn của app */
  parseNominatimAddress(item) {
    const addr = item.address || {};
    const houseNumber = addr.house_number || '';
    const road = addr.road || addr.street || addr.suburb_district || '';
    const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || '';
    const district = addr.city_district || addr.district || addr.county || '';
    const city = addr.city || addr.state || addr.province || '';
    const country = addr.country || 'Việt Nam';

    let streetPart = [houseNumber, road].filter(Boolean).join(' ');
    if (!streetPart) streetPart = item.name || ward || district || city || 'Vị trí hiện tại';

    const wardPart = this.formatWard(ward);
    const cityPart = this.formatCity(city);

    return {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name || [streetPart, wardPart, cityPart, country].filter(Boolean).join(', '),
      line1: [streetPart, wardPart].filter(Boolean).join(', '),
      line2: district ? `${district}, ${city}` : cityPart,
      street: streetPart,
      ward: wardPart,
      district: district,
      city: cityPart,
      country: country,
      fullAddress: item.display_name || '',
      provider: 'nominatim'
    };
  },

  /** Chuyển 1 feature Photon (GeoJSON) -> cấu trúc địa chỉ chuẩn của app */
  parsePhotonFeature(feature) {
    const p = (feature && feature.properties) || {};
    const coords = (feature && feature.geometry && feature.geometry.coordinates) || [];
    const streetName = p.street || p.name || '';
    let streetPart = [p.housenumber, streetName].filter(Boolean).join(' ');
    if (!streetPart) streetPart = p.locality || p.district || p.city || 'Vị trí hiện tại';

    // Photon (VN): "district" thường ứng với phường/quận, "county" mới là cấp huyện
    const ward = p.district || p.locality || '';
    const district = p.county || '';
    const city = p.city || p.state || '';
    const country = p.country || 'Việt Nam';

    const wardPart = this.formatWard(ward);
    const cityPart = this.formatCity(city);

    return {
      latitude: coords[1],
      longitude: coords[0],
      displayName: [streetPart, wardPart, district, cityPart, country].filter(Boolean).join(', '),
      line1: [streetPart, wardPart].filter(Boolean).join(', '),
      line2: district ? `${district}, ${city}` : cityPart,
      street: streetPart,
      ward: wardPart,
      district: district,
      city: cityPart,
      country: country,
      fullAddress: [streetPart, wardPart, district, cityPart, country].filter(Boolean).join(', '),
      provider: 'photon'
    };
  },

  /**
   * Reverse geocode: toạ độ -> địa chỉ. Thử Nominatim trước (dữ liệu chi tiết hơn),
   * nếu hỏng/bị chặn thì tự chuyển sang Photon (komoot) — cùng dữ liệu OpenStreetMap,
   * hỗ trợ CORS, không cần API key. Luôn trả về object (có fallback trung tính).
   */
  async reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=vi`;
      const data = await this.fetchJson(url);
      if (data && !data.error && data.address) {
        return this.parseNominatimAddress(data);
      }
      throw new Error(data && data.error ? data.error : 'Nominatim không có dữ liệu địa chỉ');
    } catch (e) {
      console.warn('Nominatim reverse thất bại, chuyển sang Photon:', e && e.message);
    }

    try {
      const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=default`;
      const data = await this.fetchJson(url);
      const f = data && data.features && data.features[0];
      if (f) return this.parsePhotonFeature(f);
      throw new Error('Photon không có kết quả');
    } catch (e) {
      console.warn('Photon reverse thất bại:', e && e.message);
    }

    return {
      latitude: lat,
      longitude: lon,
      displayName: `Vị trí toạ độ (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      line1: `Vị trí toạ độ (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      line2: '',
      street: 'Toạ độ GPS',
      ward: '',
      district: '',
      city: '',
      country: 'Việt Nam',
      fullAddress: `Toạ độ: ${lat}, ${lon}`,
      provider: 'none'
    };
  },

  /**
   * Forward geocode: gõ địa chỉ -> tra toạ độ GPS + địa chỉ chuẩn hoá.
   * Thử Nominatim trước, tự chuyển sang Photon nếu bị chặn/lỗi mạng.
   * @param {string} query - địa chỉ tự do, ví dụ "167 Nguyễn Ngọc Vũ, Cầu Giấy, Hà Nội"
   * @returns {Promise<Array<{latitude, longitude, displayName, line1, street, ward, district, city, country}>>}
   */
  async forwardGeocode(query) {
    const valid = (arr) => arr.filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    const errors = [];

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&accept-language=vi`;
      const data = await this.fetchJson(url);
      if (Array.isArray(data) && data.length) {
        const out = valid(data.map(item => this.parseNominatimAddress(item)));
        if (out.length) return out;
      }
    } catch (e) {
      errors.push('Nominatim: ' + (e && e.message));
      console.warn('Nominatim search thất bại, chuyển sang Photon:', e && e.message);
    }

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=default`;
      const data = await this.fetchJson(url);
      const feats = (data && data.features) || [];
      if (feats.length) {
        const out = valid(feats.map(f => this.parsePhotonFeature(f)));
        if (out.length) return out;
      }
    } catch (e) {
      errors.push('Photon: ' + (e && e.message));
      console.warn('Photon search thất bại:', e && e.message);
    }

    if (errors.length) {
      throw new Error('Không kết nối được dịch vụ tra cứu địa chỉ (' + errors.join(' | ') + ')');
    }
    return [];
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
