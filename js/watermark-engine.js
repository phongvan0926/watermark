/**
 * Watermark Canvas Rendering Engine
 * High-Resolution rendering for Timemark Standard, Timemark GPS, and GPS Multi-line templates
 *
 * BỘ FONT CHUẨN TIMEMARK (đã kiểm chứng bằng đo IoU pixel trên 2 ảnh mẫu gốc):
 *  - Đồng hồ lớn "16:46"  : Big Shoulders Display 600 + letter-spacing 0.0131em (IoU 0.839)
 *  - Ngày / Thứ / Địa chỉ : Roboto Condensed 400
 *  - Logo "Timemark"      : Roboto 500 — 2 tông màu: "Time" vàng #FAF04E + "mark" trắng
 *  - "Photo by"           : Roboto 400
 *  - Mã dọc "XLTME..."    : PT Mono 400 (canh giữa THEO ĐOẠN MÃ tại H/2, không canh cả chuỗi)
 *  - "Timemark Verified"  : Roboto Condensed 400
 *
 * HẰNG SỐ LAYOUT: tính theo "đơn vị scale" u = min(W,H)/1000, đo trực tiếp từ ảnh mẫu 1920px min-dim.
 */

const WatermarkEngine = {
  FONTS: {
    clock: "'Big Shoulders Display', 'Anton', 'Oswald', 'Arial Narrow', sans-serif",
    text: "'Roboto Condensed', 'Roboto', 'Arial Narrow', sans-serif",
    brand: "'Roboto', 'Inter', -apple-system, sans-serif",
    mono: "'PT Mono', 'Roboto Mono', 'Courier New', monospace"
  },

  // Màu chuẩn đo từ ảnh mẫu (top-decile brightest pixels)
  COLORS: {
    bar: '#f9c13a',        // vạch vàng đứng
    logoYellow: '#faf04e', // "Time" trong logo Timemark
    vertCode: '#ececec'    // mã xác thực dọc mép phải
  },

  /**
   * Nạp trước toàn bộ font vẽ canvas. BẮT BUỘC gọi trước lần render đầu:
   * font Google chỉ tự tải khi DOM sử dụng, còn canvas KHÔNG kích hoạt tải font.
   */
  preloadFonts() {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }
    const specs = [
      "600 100px 'Big Shoulders Display'",
      "700 100px 'Big Shoulders Display'",
      "400 100px 'Anton'",
      "400 100px 'Roboto Condensed'",
      "500 100px 'Roboto Condensed'",
      "700 100px 'Roboto Condensed'",
      "400 100px 'Roboto'",
      "500 100px 'Roboto'",
      "700 100px 'Roboto'",
      "400 100px 'PT Mono'"
    ];
    return Promise.all(
      specs.map(s => document.fonts.load(s, '16:46 Ngõ Đ. Timemark Verified ©').catch(() => {}))
    );
  },

  /**
   * Main render function that draws the image and selected watermark onto the target canvas
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLImageElement|HTMLVideoElement} source
   * @param {Object} state - current app configuration state
   */
  render(canvas, source, state) {
    if (!source || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Get natural dimensions
    let width = source.naturalWidth || source.videoWidth || source.width || 1920;
    let height = source.naturalHeight || source.videoHeight || source.height || 1080;

    if (width === 0 || height === 0) {
      width = 1920;
      height = 1080;
    }

    // Set canvas dimensions to exact source resolution
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Clear and draw base image
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    // Global scale factor based on minimum dimension (scaled against a 1000px reference)
    const baseUnit = Math.min(width, height) / 1000;
    const userScale = (state.scale || 100) / 100;
    const scale = baseUnit * userScale;

    // Apply global opacity
    const opacity = (state.opacity || 100) / 100;
    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw selected template
    switch (state.template) {
      case 'timemark-standard':
        this.drawTimemarkStandard(ctx, width, height, scale, state);
        break;
      case 'timemark-custom':
        this.drawTimemarkCustom(ctx, width, height, scale, state);
        break;
      case 'timemark-attendance':
        this.drawTimemarkAttendance(ctx, width, height, scale, state);
        break;
      case 'timemark-service':
        this.drawTimemarkService(ctx, width, height, scale, state);
        break;
      case 'timemark-security':
        this.drawTimemarkSecurity(ctx, width, height, scale, state);
        break;
      case 'timemark-technical':
        this.drawTimemarkTechnical(ctx, width, height, scale, state);
        break;
      case 'timemark-completed':
        this.drawTimemarkCompleted(ctx, width, height, scale, state);
        break;
      case 'timemark-worklog':
        this.drawTimemarkWorklog(ctx, width, height, scale, state);
        break;
      case 'timemark-weather-gps':
        this.drawTimemarkWeatherGPS(ctx, width, height, scale, state);
        break;
      case 'timemark-gps':
        this.drawTimemarkGPS(ctx, width, height, scale, state);
        break;
      case 'gps-multiline':
        this.drawGPSMultiline(ctx, width, height, scale, state);
        break;
      case 'work-report':
        this.drawWorkReport(ctx, width, height, scale, state);
        break;
      default:
        this.drawTimemarkStandard(ctx, width, height, scale, state);
    }

    // Draw Right Edge Vertical Verification Code (if enabled for Timemark templates)
    if (state.showVertCode && state.template !== 'gps-multiline') {
      this.drawRightVerticalCode(ctx, width, height, scale, state);
    }

    ctx.restore();
  },

  /**
   * Helper to set text shadow for crisp legibility on white or dark backgrounds
   */
  applyShadow(ctx, scale, shadowStrength = 85) {
    if (shadowStrength <= 0) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      return;
    }

    const alpha = (shadowStrength / 100) * 0.9;
    ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetX = 1.5 * scale;
    ctx.shadowOffsetY = 1.5 * scale;
  },

  /**
   * Vẽ text sao cho MÉP MỰC TRÁI (ink left) nằm đúng tại inkLeftX (chính xác pixel,
   * loại bỏ sai lệch side-bearing giữa các font). Trả về metrics phục vụ tính toán tiếp.
   */
  fillTextInkLeft(ctx, text, inkLeftX, baselineY) {
    const m = ctx.measureText(text);
    // inkLeft = drawX - actualBoundingBoxLeft  =>  drawX = inkLeftX + actualBoundingBoxLeft
    const abl = (typeof m.actualBoundingBoxLeft === 'number') ? m.actualBoundingBoxLeft : 0;
    const drawX = inkLeftX + abl;
    ctx.fillText(text, drawX, baselineY);
    return { drawX, advance: m.width, capH: m.actualBoundingBoxAscent || 0 };
  },

  /**
   * Neo một khối chữ nhật (blockW x blockH) vào 1 trong 4 góc theo state.position.
   * Trả về toạ độ góc trên-trái của khối; luôn kẹp trong khung ảnh (không âm).
   */
  anchorBlock(width, height, marginX, marginY, blockW, blockH, position) {
    let x = marginX;
    let y = height - marginY - blockH;
    if (position === 'top-left') {
      y = marginY;
    } else if (position === 'top-right') {
      x = width - marginX - blockW;
      y = marginY;
    } else if (position === 'bottom-right') {
      x = width - marginX - blockW;
    }
    return { x: Math.max(4, x), y: Math.max(4, y) };
  },

  /**
   * Template 1: Timemark Standard — tái tạo pixel-perfect theo 2 ảnh mẫu thực
   * (mọi hằng số đều là "đơn vị scale" u = min(W,H)/1000, đo từ ảnh mẫu min-dim 1920):
   *   Clock Big Shoulders Display 600 @119.4u + letter-spacing 0.0131em, ink cao 188px@1920,
   *   baseline H-145.8u, ink-left 24.5u
   *   Date/Day Roboto Condensed 400 @36u — date baseline = clockBase - 67.8u; day = clockBase + 4u
   *   Bar vàng: cách mép mực phải đồng hồ 30.2u, rộng 4.2u, từ đỉnh chữ số tới baseline + 4.7u
   *   Address Roboto Condensed 400 @38u — dòng đầu baseline = clockBase + 69.3u, giãn dòng 46u,
   *   thụt 5u so với origin đồng hồ; baseline dòng cuối = H - 30.7u (lề dưới)
   */
  drawTimemarkStandard(ctx, width, height, scale, state) {
    const u = scale;
    const marginFactor = (state.margin || 4) / 4; // 1.0 khi margin = 4 (mặc định)

    const textColor = state.textColor || '#ffffff';
    const barColor = state.barColor || this.COLORS.bar;
    const shadowVal = state.shadow !== undefined ? state.shadow : 85;

    // Font sizes (đơn vị đo thực nghiệm)
    const clockFontSize = 119.4 * u;
    const clockLetterSpacing = 0.0131 * clockFontSize; // đo IoU tối ưu tại 0.0131em
    const dateFontSize = Math.round(36.6 * u);
    const dayFontSize = Math.round(36.6 * u);
    const addrFontSize = Math.round(39 * u);
    const addrLineHeight = Math.round(46 * u);

    const timeText = state.time || '16:46';
    const dateText = state.date || '11 Aug 2026';
    const dayText = state.dayOfWeek || 'Tues';
    const addr1 = (state.address1 || '').trim();
    const addr2 = (state.address2 || '').trim();
    const addrLines = [];
    if (addr1) addrLines.push(addr1);
    if (addr2) addrLines.push(addr2);

    const marginX = 24.5 * u * marginFactor;  // ink-left đồng hồ
    const marginY = 30.7 * u * marginFactor;  // lề dưới tới baseline dòng địa chỉ cuối

    ctx.save();
    this.applyShadow(ctx, scale, shadowVal);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const clockFontStr = `600 ${clockFontSize}px ${this.FONTS.clock}`;
    const canSpace = ('letterSpacing' in ctx);

    // --- Đo trước kích thước các thành phần để hỗ trợ neo phải ---
    ctx.font = clockFontStr;
    if (canSpace) ctx.letterSpacing = `${clockLetterSpacing}px`;
    const mClock = ctx.measureText(timeText);
    const clockAdvance = mClock.width;
    const clockCapH = mClock.actualBoundingBoxAscent || clockFontSize * 0.81;
    const clockInkRightOff = (typeof mClock.actualBoundingBoxRight === 'number') ? mClock.actualBoundingBoxRight : clockAdvance;
    if (canSpace) ctx.letterSpacing = '0px';

    ctx.font = `400 ${dateFontSize}px ${this.FONTS.text}`;
    const dateW = ctx.measureText(dateText).width;
    ctx.font = `400 ${dayFontSize}px ${this.FONTS.text}`;
    const dayW = ctx.measureText(dayText).width;
    ctx.font = `400 ${addrFontSize}px ${this.FONTS.text}`;
    const addrWs = addrLines.map(l => ctx.measureText(l).width);

    const barGap = 32.3 * u;   // mép mực phải đồng hồ -> vạch
    const barW = Math.max(3, 4.2 * u);
    const infoGap = 15 * u;    // vạch -> ngày/thứ
    const clockRowW = clockInkRightOff + barGap + barW + infoGap + Math.max(dateW, dayW);
    const blockW = Math.max(clockRowW, ...(addrWs.length ? addrWs : [0]));

    // --- Neo toạ độ theo 4 vị trí ---
    let inkLeftX = marginX;
    let clockBaseline;

    if (state.position === 'top-left' || state.position === 'top-right') {
      clockBaseline = marginY + clockCapH + 10 * u;
    } else {
      const lastBaseline = height - marginY;
      clockBaseline = addrLines.length > 0
        ? lastBaseline - (addrLines.length - 1) * addrLineHeight - 69.3 * u
        : lastBaseline;
    }
    if (state.position === 'top-right' || state.position === 'bottom-right') {
      // Kẹp không cho khối tràn khỏi mép trái khi nội dung dài hơn ảnh
      inkLeftX = Math.max(6 * u, width - marginX - blockW);
    }

    // --- 1. Đồng hồ lớn (Big Shoulders Display 600 + tracking chuẩn Timemark) ---
    ctx.font = clockFontStr;
    if (canSpace) ctx.letterSpacing = `${clockLetterSpacing}px`;
    ctx.fillStyle = textColor;
    const clockDraw = this.fillTextInkLeft(ctx, timeText, inkLeftX, clockBaseline);
    if (canSpace) ctx.letterSpacing = '0px';

    // --- 2. Vạch vàng đứng (từ đỉnh chữ số tới ngay dưới baseline) ---
    const clockInkRight = clockDraw.drawX + clockInkRightOff;
    const barX = clockInkRight + barGap;
    const barTop = clockBaseline - clockCapH + 0.4 * u;
    const barBottom = clockBaseline + 4.7 * u;
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barTop, barW, barBottom - barTop);

    // --- 3. Ngày & Thứ bên phải vạch ---
    const infoX = barX + barW + infoGap;
    ctx.font = `400 ${dateFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    ctx.fillText(dateText, infoX, clockBaseline - 67.8 * u);

    ctx.font = `400 ${dayFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    ctx.fillText(dayText, infoX, clockBaseline + 4 * u);

    // --- 4. Các dòng địa chỉ dưới đồng hồ (mép mực thụt 6.3u so với mép mực đồng hồ) ---
    ctx.font = `400 ${addrFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    const addrInkLeft = inkLeftX + 6.3 * u;
    let addrBaseline = clockBaseline + 69.3 * u;
    addrLines.forEach((line) => {
      this.fillTextInkLeft(ctx, line, addrInkLeft, addrBaseline);
      addrBaseline += addrLineHeight;
    });

    ctx.restore();

    // --- 5. Logo góc phải dưới (Photo by / Timemark) ---
    if (state.showLogo) {
      this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
    }
  },

  /**
   * Template 2: Timemark with GPS Coordinates (Ảnh 3)
   * Big Digital Clock + Gold Divider + Date/Day + Address Line 1 + GPS Coords line
   */
  drawTimemarkGPS(ctx, width, height, scale, state) {
    // Uses the same layout as Standard but ensures GPS coords formatting on Line 2
    this.drawTimemarkStandard(ctx, width, height, scale, state);
  },

  /**
   * Mẫu 3: Tùy Chỉnh (Tiêu đề của bạn + Vạch vàng + Ngày giờ + Địa điểm + Toạ độ GPS)
   * Theo đúng hình ảnh catalog Timemark mẫu thứ 3
   */
  drawTimemarkCustom(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    const textColor = state.textColor || '#ffffff';
    const barColor = state.barColor || this.COLORS.bar;
    const shadowVal = state.shadow !== undefined ? state.shadow : 85;

    ctx.save();
    this.applyShadow(ctx, scale, shadowVal);

    // Font definitions
    const titleFontSize = Math.round(26 * scale);
    const lineFontSize = Math.round(18 * scale);
    const lineHeight = Math.round(26 * scale);

    const titleText = (state.customTitle || 'Tiêu đề của bạn').trim();
    const line1 = (state.customDateTime || `${state.date} ${state.time}`).trim();
    const line2 = (state.customLocation || state.address1 || 'Tao Dan Park, Hồ Chí Minh').trim();
    const line3 = (state.customGps || state.address2 || '10.774917°N, 106.692420°E').trim();

    const lines = [line1, line2, line3].filter(Boolean);
    const barWidth = Math.max(3, Math.round(3.5 * scale));

    // Đo bề rộng thật của khối để neo phải chính xác (không dùng hằng số cứng)
    ctx.textAlign = 'left';
    ctx.font = `700 ${titleFontSize}px ${this.FONTS.text}`;
    const titleW = ctx.measureText(titleText).width;
    ctx.font = `500 ${lineFontSize}px ${this.FONTS.text}`;
    const maxLineW = lines.reduce((mx, l) => Math.max(mx, ctx.measureText(l).width), 0);
    const blockW = Math.max(titleW, barWidth + 10 * scale + maxLineW);
    // Khối: tiêu đề (titleFontSize) + 10 gap + các dòng
    const bodyH = lines.length * lineHeight - (4 * scale);
    const blockH = titleFontSize + 10 * scale + bodyH;

    const anchor = this.anchorBlock(width, height, marginX, marginY, blockW, blockH, state.position);
    const startX = anchor.x;
    const titleY = anchor.y;
    const bodyTopY = titleY + titleFontSize + (10 * scale); // luôn nằm DƯỚI tiêu đề, không đè chồng

    // 1. Draw Custom Title (Bold)
    ctx.font = `700 ${titleFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    ctx.fillText(titleText, startX, titleY);

    // 2. Draw Vertical Gold Bar on left of lines
    ctx.fillStyle = barColor;
    ctx.fillRect(startX, bodyTopY, barWidth, bodyH);

    // 3. Draw Lines next to vertical bar
    const textStartX = startX + barWidth + (10 * scale);

    lines.forEach((lineText, idx) => {
      ctx.font = idx === 0 ? `500 ${lineFontSize}px ${this.FONTS.text}` : `400 ${lineFontSize}px ${this.FONTS.text}`;
      ctx.fillStyle = idx === 0 ? textColor : '#f1f5f9';
      ctx.textBaseline = 'top';
      ctx.fillText(lineText, textStartX, bodyTopY + idx * lineHeight);
    });

    ctx.restore();

    // Draw Bottom-Right Brand (Timemark / 100% Chân thực)
    if (state.showLogo) {
      this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
    }
  },

  /**
   * Mẫu: Điểm Danh (Huy hiệu Điểm danh màu vàng + Khung giờ xanh + Vạch vàng + Ngày & Địa điểm)
   */
  drawTimemarkAttendance(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    const textColor = state.textColor || '#ffffff';
    const barColor = state.barColor || this.COLORS.bar;
    const shadowVal = state.shadow !== undefined ? state.shadow : 85;

    ctx.save();
    this.applyShadow(ctx, scale, shadowVal);

    const badgeText = state.attendanceBadge || 'Điểm danh';
    const timeText = state.time || '23:40';
    const dateText = state.date || '30/01/2022';
    const addrText = state.address1 || 'Tao Dan Park, Hồ Chí Minh';

    const lineFontSize = Math.round(18 * scale);
    const lineHeight = Math.round(26 * scale);

    // Đo bề rộng thật của các thành phần để neo 4 góc chính xác
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    const badgeMetrics = ctx.measureText(badgeText);
    const badgePadX = 8 * scale;
    const badgeW = badgeMetrics.width + badgePadX * 2;
    const badgeH = 24 * scale;

    ctx.font = `600 ${Math.round(22 * scale)}px ${this.FONTS.clock}`;
    const headerRowW = badgeW + 6 * scale + ctx.measureText(timeText).width + 12 * scale;
    ctx.font = `500 ${lineFontSize}px ${this.FONTS.text}`;
    const maxLineW = Math.max(ctx.measureText(dateText).width, ctx.measureText(addrText).width);
    const barWidthPre = Math.max(3, Math.round(3.5 * scale));
    const blockW = Math.max(headerRowW, barWidthPre + 10 * scale + maxLineW);

    const blockHeight = 2 * lineHeight;
    const blockH = 36 * scale + blockHeight; // header (badge/timebox) + 2 dòng
    const anchor = this.anchorBlock(width, height, marginX, marginY, blockW, blockH, state.position);
    const startX = anchor.x;
    const headerY = anchor.y;
    const bodyTopY = headerY + (36 * scale);

    // 1. Draw [Điểm danh] Badge
    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = barColor;
    this.roundRect(ctx, startX, headerY, badgeW, badgeH, 4 * scale);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, startX + badgePadX, headerY + badgeH / 2);

    // 2. Draw Time Box [23:40]
    const timeBoxX = startX + badgeW + 6 * scale;
    ctx.font = `600 ${Math.round(22 * scale)}px ${this.FONTS.clock}`;
    const timeMetrics = ctx.measureText(timeText);
    const timeBoxW = timeMetrics.width + 12 * scale;
    const timeBoxH = 26 * scale;

    ctx.fillStyle = '#1e3a8a'; // navy blue
    this.roundRect(ctx, timeBoxX, headerY - (1 * scale), timeBoxW, timeBoxH, 4 * scale);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeText, timeBoxX + 6 * scale, headerY + timeBoxH / 2);

    // 3. Draw Vertical Gold Bar & 2 lines below
    const barWidth = Math.max(3, Math.round(3.5 * scale));
    const barHeight = blockHeight - (4 * scale);
    ctx.fillStyle = barColor;
    ctx.fillRect(startX, bodyTopY, barWidth, barHeight);

    const textStartX = startX + barWidth + (10 * scale);

    ctx.font = `500 ${lineFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    ctx.fillText(dateText, textStartX, bodyTopY);

    ctx.font = `400 ${lineFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(addrText, textStartX, bodyTopY + lineHeight);

    ctx.restore();

    if (state.showLogo) {
      this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
    }
  },

  /**
   * Mẫu 4: Dịch Vụ (Tên dịch vụ + Ngày giờ + 👉 Chi tiết + ☎ Hotline)
   */
  drawTimemarkService(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;
    const textColor = state.textColor || '#ffffff';

    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    const titleText = state.servTitle || 'Tên dịch vụ';
    const timeText = state.customDateTime || `${state.date} ${state.time}`;
    const detailText = state.servDetail || '👉: Chi tiết dịch vụ';
    const phoneText = state.servPhone ? `☎: ${state.servPhone}` : '☎: 0123456666';

    const titleSize = Math.round(24 * scale);
    const lineSize = Math.round(18 * scale);
    const lineHeight = Math.round(26 * scale);

    // Đo bề rộng khối để neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `700 ${titleSize}px ${this.FONTS.text}`;
    const titleW = ctx.measureText(titleText).width;
    ctx.font = `500 ${lineSize}px ${this.FONTS.text}`;
    const maxLineW = [timeText, detailText, phoneText].reduce((mx, t) => Math.max(mx, ctx.measureText(t).width), 0);
    const blockW = Math.max(titleW, maxLineW);
    const blockH = 3 * lineHeight + lineSize + 2 * scale;

    const anchor = this.anchorBlock(width, height, marginX, marginY, blockW, blockH, state.position);
    const startX = anchor.x;
    const startY = anchor.y;

    ctx.font = `700 ${titleSize}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    ctx.fillText(titleText, startX, startY);

    ctx.font = `500 ${lineSize}px ${this.FONTS.text}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(timeText, startX, startY + lineHeight);

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(detailText, startX, startY + lineHeight * 2);

    ctx.fillStyle = '#60a5fa'; // bright blue phone
    ctx.fillText(phoneText, startX, startY + lineHeight * 3);

    ctx.restore();

    if (state.showLogo) this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
  },

  /**
   * Mẫu 5: Bảo Vệ / Tuần Tra (Badge khiên 🛡️ + Giờ tuần tra + Địa điểm)
   */
  drawTimemarkSecurity(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    const badgeText = state.secTitle || '🛡️ BẢO VỆ';
    const timeText = state.time || '09:30';
    const dateText = state.date || '30/01/2023';
    const addrText = state.secAddr || state.address1 || 'Tao Dan Park, Hồ Chí Minh';

    // Đo bề rộng khối để neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    const bMetrics = ctx.measureText(badgeText);
    const bW = bMetrics.width + 16 * scale;
    const bH = 26 * scale;
    ctx.font = `600 ${Math.round(28 * scale)}px ${this.FONTS.clock}`;
    const timeRowW = ctx.measureText(timeText).width + 10 * scale;
    ctx.font = `500 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    const timeDateW = timeRowW + ctx.measureText(dateText).width;
    ctx.font = `400 ${Math.round(17 * scale)}px ${this.FONTS.text}`;
    const addrW = ctx.measureText(addrText).width;
    const blockW = Math.max(bW, timeDateW, addrW);
    const blockH = bH + 12 * scale + 34 * scale + 22 * scale; // badge + gap + hàng giờ + dòng địa chỉ

    const anchor = this.anchorBlock(width, height, marginX, marginY, blockW, blockH, state.position);
    const startX = anchor.x;
    const startY = anchor.y;

    // Blue badge header
    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#1e3a8a';
    this.roundRect(ctx, startX, startY, bW, bH, 4 * scale);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, startX + 8 * scale, startY + bH / 2);

    // Time & Date row
    const rowY = startY + bH + 12 * scale;
    ctx.font = `600 ${Math.round(28 * scale)}px ${this.FONTS.clock}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(timeText, startX, rowY);

    const tW = ctx.measureText(timeText).width;
    ctx.font = `500 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(dateText, startX + tW + 10 * scale, rowY + 6 * scale);

    // Address
    ctx.font = `400 ${Math.round(17 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(addrText, startX, rowY + 34 * scale);

    ctx.restore();
    if (state.showLogo) this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
  },

  /**
   * Mẫu 6: Hồ Sơ Kỹ Thuật / Công Trình (Header xanh + Nghiệm thu + Thời gian)
   */
  drawTimemarkTechnical(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    const headerText = state.techHeader || 'HỒ SƠ KỸ THUẬT';
    const line1 = state.techLine1 || 'Nghiệm thu: Thử kín nội bộ tầng 3';
    const line2 = `Thời gian : ${state.customDateTime || `${state.date} ${state.time}`}`;

    // Card tự giãn theo nội dung dài + neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `500 ${Math.round(15 * scale)}px ${this.FONTS.text}`;
    const contentW = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width);
    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    const headerW = ctx.measureText(headerText).width;
    const cardW = Math.max(380 * scale, contentW + 28 * scale, headerW + 28 * scale);
    const cardH = 120 * scale;

    const anchor = this.anchorBlock(width, height, marginX, marginY, cardW, cardH, state.position);
    const startX = anchor.x;
    const startY = anchor.y;

    // Card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    this.roundRect(ctx, startX, startY, cardW, cardH, 6 * scale);
    ctx.fill();

    // Top Blue Banner
    ctx.fillStyle = '#2563eb';
    this.roundRect(ctx, startX, startY, cardW, 32 * scale, 6 * scale);
    ctx.fill();

    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headerText, startX + cardW / 2, startY + 16 * scale);

    // Content lines
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `500 ${Math.round(15 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(line1, startX + 14 * scale, startY + 44 * scale);
    ctx.fillText(line2, startX + 14 * scale, startY + 76 * scale);

    ctx.restore();
    if (state.showLogo) this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
  },

  /**
   * Mẫu 7: Đã Hoàn Thành (Giờ + Badge ✅ + Vạch vàng + Ngày & Địa điểm)
   */
  drawTimemarkCompleted(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    const timeText = state.time || '09:30';
    const dateText = state.date || '30/01/2023';
    const addrText = state.address1 || 'Tao Dan Park, District 1, Ho Chi Minh City';

    const clockFontSize = Math.round(52 * scale);
    const lineFontSize = Math.round(18 * scale);
    const lineHeight = Math.round(25 * scale);

    // Đo bề rộng khối để neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `600 ${clockFontSize}px ${this.FONTS.clock}`;
    const tW = ctx.measureText(timeText).width;
    ctx.font = `500 ${lineFontSize}px ${this.FONTS.text}`;
    const maxLineW = Math.max(ctx.measureText(dateText).width, ctx.measureText(addrText).width);
    const blockW = Math.max(tW + 8 * scale + 34 * scale, 12 * scale + maxLineW);
    const blockH = clockFontSize + 4 * scale + 2 * lineHeight; // đồng hồ + vạch/2 dòng dưới

    const anchor = this.anchorBlock(width, height, marginX, marginY, blockW, blockH, state.position);
    const startX = anchor.x;
    const headerY = anchor.y + clockFontSize; // đồng hồ vẽ baseline 'bottom' tại đây

    // Clock
    ctx.font = `600 ${clockFontSize}px ${this.FONTS.clock}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'bottom';
    ctx.fillText(timeText, startX, headerY);

    // Green Check badge [✅]
    ctx.fillStyle = '#16a34a';
    this.roundRect(ctx, startX + tW + 8 * scale, headerY - clockFontSize + 8 * scale, 34 * scale, 34 * scale, 6 * scale);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(20 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', startX + tW + 25 * scale, headerY - clockFontSize / 2 + 8 * scale);

    // Vertical bar & lines below
    ctx.textAlign = 'left';
    const barTop = headerY + 4 * scale;
    ctx.fillStyle = state.barColor || this.COLORS.bar;
    ctx.fillRect(startX, barTop, 3.5 * scale, 2 * lineHeight - 4 * scale);

    const textStartX = startX + 12 * scale;
    ctx.font = `500 ${lineFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(dateText, textStartX, barTop);

    ctx.font = `400 ${lineFontSize}px ${this.FONTS.text}`;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(addrText, textStartX, barTop + lineHeight);

    ctx.restore();
    if (state.showLogo) this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
  },

  /**
   * Mẫu 8: Nhật Ký Công Việc (Header cam + 3 dòng chi tiết)
   */
  drawTimemarkWorklog(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    const headerText = state.logHeader || 'Nhật ký công việc';
    const content = state.logContent || 'Thử kín nội bộ tầng 3';
    const place = state.logPlace || 'Tầng 3 trục 1B';
    const timeText = state.customDateTime || `${state.date} ${state.time}`;

    // Card tự giãn theo nội dung + neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `400 ${Math.round(15 * scale)}px ${this.FONTS.text}`;
    const wlMaxW = [`Nội dung :  ${content}`, `Địa điểm :  ${place}`, `Thời gian :  ${timeText}`]
      .reduce((mx, t) => Math.max(mx, ctx.measureText(t).width), 0);
    const cardW = Math.max(380 * scale, wlMaxW + 28 * scale);
    const cardH = 145 * scale;

    const anchor = this.anchorBlock(width, height, marginX, marginY, cardW, cardH, state.position);
    const startX = anchor.x;
    const startY = anchor.y;

    // Card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    this.roundRect(ctx, startX, startY, cardW, cardH, 6 * scale);
    ctx.fill();

    // Orange Banner
    ctx.fillStyle = '#d97706';
    this.roundRect(ctx, startX, startY, cardW, 32 * scale, 6 * scale);
    ctx.fill();

    ctx.font = `700 ${Math.round(16 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(headerText, startX + 14 * scale, startY + 16 * scale);

    // 3 lines
    ctx.font = `400 ${Math.round(15 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.textBaseline = 'top';
    ctx.fillText(`Nội dung :  ${content}`, startX + 14 * scale, startY + 42 * scale);
    ctx.fillText(`Địa điểm :  ${place}`, startX + 14 * scale, startY + 72 * scale);
    ctx.fillText(`Thời gian :  ${timeText}`, startX + 14 * scale, startY + 102 * scale);

    ctx.restore();
    if (state.showLogo) this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
  },

  /**
   * Mẫu 9: Toạ Độ GPS & Thời Tiết (Location + GPS Coords + Compass + Date/Time + Weather)
   */
  drawTimemarkWeatherGPS(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    const locationText = state.customLocation || state.address1 || 'Tao Dan Park';
    const coordsText = state.customGps || '10.774917°N, 106.692420°E';
    const compassText = state.weathCompass || 'SE 125°';
    const timeText = state.customDateTime || `${state.date} ${state.time}`;
    const tempText = state.weathTemp || '☀️ 28°C';

    // Card tự giãn theo nội dung + neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(20 * scale)}px ${this.FONTS.text}`;
    const locW = ctx.measureText(locationText).width;
    ctx.font = `500 ${Math.round(14 * scale)}px ${this.FONTS.text}`;
    const wgMaxW = Math.max(
      locW,
      ctx.measureText(`${coordsText}   🧭 ${compassText}`).width,
      ctx.measureText(`${timeText}   ${tempText}`).width
    );
    const cardW = Math.max(400 * scale, wgMaxW + 28 * scale);
    const cardH = 115 * scale;

    const anchor = this.anchorBlock(width, height, marginX, marginY, cardW, cardH, state.position);
    const startX = anchor.x;
    const startY = anchor.y;

    // Card background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.roundRect(ctx, startX, startY, cardW, cardH, 8 * scale);
    ctx.fill();

    // Location
    ctx.font = `700 ${Math.round(20 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(locationText, startX + 14 * scale, startY + 12 * scale);

    // Line 2: GPS Coords + Compass
    ctx.font = `500 ${Math.round(14 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${coordsText}   🧭 ${compassText}`, startX + 14 * scale, startY + 44 * scale);

    // Line 3: Time + Weather
    ctx.font = `500 ${Math.round(14 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${timeText}   ${tempText}`, startX + 14 * scale, startY + 74 * scale);

    ctx.restore();
    if (state.showLogo) this.drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state);
  },

  /**
   * Template 3: GPS Camera Multi-line (Ảnh 2)
   * Clean multi-line date + hierarchical address lines in Top-Right / chosen corner
   */
  drawGPSMultiline(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    const textColor = state.textColor || '#ffffff';
    const shadowVal = state.shadow !== undefined ? state.shadow : 85;

    ctx.save();
    this.applyShadow(ctx, scale, shadowVal);

    const fontSize = Math.round(23 * scale);
    const lineHeight = Math.round(33 * scale);
    ctx.font = `400 ${fontSize}px ${this.FONTS.brand}`;
    ctx.fillStyle = textColor;

    // Collect all active lines
    const lines = [];

    // Line 1: Date & Time combined (e.g. "2026年5月19日 10:44:40" or "07 Tháng 8, 2026 16:15:00")
    // Chỉ nối thêm giây khi time CHƯA có giây (tránh "10:44:40:40")
    let line1DateTime = `${state.date} ${state.time}`;
    if (state.date && state.date.includes('年') && ((state.time || '').match(/:/g) || []).length < 2) {
      line1DateTime = `${state.date} ${state.time}:40`;
    }
    lines.push(line1DateTime);

    if (state.address1) lines.push(state.address1);
    if (state.gpsLine3) lines.push(state.gpsLine3);
    if (state.gpsLine4) lines.push(state.gpsLine4);
    if (state.gpsLine5) lines.push(state.gpsLine5);

    // Position logic
    let startX = width - marginX;
    let startY = marginY + fontSize;
    ctx.textAlign = 'right';

    if (state.position === 'top-left') {
      startX = marginX;
      startY = marginY + fontSize;
      ctx.textAlign = 'left';
    } else if (state.position === 'bottom-left') {
      startX = marginX;
      startY = height - marginY - (lines.length - 1) * lineHeight;
      ctx.textAlign = 'left';
    } else if (state.position === 'bottom-right') {
      startX = width - marginX;
      startY = height - marginY - (lines.length - 1) * lineHeight;
      ctx.textAlign = 'right';
    }

    // Render lines
    lines.forEach((lineText, index) => {
      ctx.fillText(lineText, startX, startY + index * lineHeight);
    });

    ctx.restore();
  },

  /**
   * Template 4: Field Work / Attendance Report Stamp
   */
  drawWorkReport(ctx, width, height, scale, state) {
    const marginPct = (state.margin || 4) / 100;
    const marginX = width * marginPct;
    const marginY = height * marginPct;

    const textColor = state.textColor || '#ffffff';
    const barColor = state.barColor || this.COLORS.bar;
    const shadowVal = state.shadow !== undefined ? state.shadow : 85;

    ctx.save();
    this.applyShadow(ctx, scale, shadowVal);

    // Card tự giãn theo nội dung + neo theo state.position (đủ 4 góc)
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(18 * scale)}px ${this.FONTS.text}`;
    let wrMaxW = ctx.measureText(state.workProject || 'DỰ ÁN: TÒA NHÀ VĂN PHÒNG').width;
    ctx.font = `500 ${Math.round(15 * scale)}px ${this.FONTS.text}`;
    wrMaxW = Math.max(wrMaxW,
      ctx.measureText(state.workPerson || 'Giám sát: Nguyễn Văn Hưng').width,
      ctx.measureText(`${state.date} ${state.time} (${state.dayOfWeek})`).width);
    ctx.font = `400 ${Math.round(14 * scale)}px ${this.FONTS.text}`;
    wrMaxW = Math.max(wrMaxW,
      ctx.measureText(state.address1 || '201 Trường Chinh, Hà Nội').width,
      ctx.measureText(state.workNote || 'Ghi chú: Đã nghiệm thu hiện trường hoàn tất').width);

    const badgeWidth = Math.max(Math.round(420 * scale), Math.round(wrMaxW + 32 * scale));
    const badgeHeight = Math.round(180 * scale);
    const anchor = this.anchorBlock(width, height, marginX, marginY, badgeWidth, badgeHeight, state.position);
    const startX = anchor.x;
    const startY = anchor.y;

    // Semi-transparent background card
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeStyle = barColor;
    ctx.lineWidth = 2 * scale;
    this.roundRect(ctx, startX, startY, badgeWidth, badgeHeight, 8 * scale);
    ctx.fill();
    ctx.stroke();

    // Text items
    const pad = 16 * scale;
    ctx.font = `700 ${Math.round(18 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = barColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(state.workProject || 'DỰ ÁN: TÒA NHÀ VĂN PHÒNG', startX + pad, startY + pad);

    ctx.font = `500 ${Math.round(15 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = textColor;
    ctx.fillText(state.workPerson || 'Giám sát: Nguyễn Văn Hưng', startX + pad, startY + pad + 28 * scale);
    ctx.fillText(`${state.date} ${state.time} (${state.dayOfWeek})`, startX + pad, startY + pad + 52 * scale);

    ctx.font = `400 ${Math.round(14 * scale)}px ${this.FONTS.text}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(state.address1 || '201 Trường Chinh, Hà Nội', startX + pad, startY + pad + 78 * scale);
    ctx.fillText(state.workNote || 'Ghi chú: Đã nghiệm thu hiện trường hoàn tất', startX + pad, startY + pad + 102 * scale);

    ctx.restore();
  },

  /**
   * Logo góc phải dưới — 2 kiểu bố cục:
   * 1. "Photo by" (trên, Roboto 400 22u, xám nhạt) + "Timemark" (dưới, Roboto 500 34u,
   *    2 tông màu: "Time" vàng #FAF04E + "mark" trắng) — chuẩn 2 ảnh mẫu.
   *    Đo thực tế: mép mực phải cách phải 17.2u; baseline "Timemark" cách đáy 22.6u;
   *    baseline "Photo by" cao hơn 38.5u.
   * 2. "Timemark" (trên, vàng) + phụ đề trắng (dưới) — kiểu "100% Chân thực" / "Máy ảnh".
   */
  drawBottomRightBrand(ctx, width, height, scale, marginX, marginY, state) {
    const u = scale;
    ctx.save();
    this.applyShadow(ctx, scale, state.shadow !== undefined ? state.shadow : 85);

    // Tôn trọng chuỗi rỗng người dùng chủ ý xoá (chỉ dùng mặc định khi undefined)
    const line1 = state.logoTitle !== undefined ? state.logoTitle : 'Photo by';
    const line2 = state.logoSubtitle !== undefined ? state.logoSubtitle : 'Timemark';
    const marginFactor = (state.margin || 4) / 4;

    if (!line1 && !line2) { ctx.restore(); return; }

    // Layout detection: kiểu "Photo by/Timemark" cần line2 thật sự tồn tại
    const isPhotoByStyle = !!line2 && (line1.toLowerCase().includes('photo by') || line2.trim().toLowerCase() === 'timemark');

    if (isPhotoByStyle) {
      const titleSize = Math.round(34 * u);
      const prefixSize = Math.round(22 * u);
      const rightEdge = width - 17.2 * u * marginFactor;
      const titleBaseline = height - 22.6 * u * marginFactor;
      const prefixBaseline = titleBaseline - 38.5 * u;

      ctx.textBaseline = 'alphabetic';
      ctx.font = `500 ${titleSize}px ${this.FONTS.brand}`;

      const brandText = line2 || 'Timemark';
      const isTimemarkWord = brandText.trim().toLowerCase() === 'timemark';

      if (isTimemarkWord) {
        // 2 tông màu: "Time" vàng + "mark" trắng (chuẩn logo Timemark)
        const partYellow = brandText.trim().slice(0, 4);
        const partWhite = brandText.trim().slice(4);
        const wYellow = ctx.measureText(partYellow).width;
        const wWhite = ctx.measureText(partWhite).width;
        const startX = rightEdge - wYellow - wWhite;
        ctx.textAlign = 'left';
        ctx.fillStyle = this.COLORS.logoYellow;
        ctx.fillText(partYellow, startX, titleBaseline);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(partWhite, startX + wYellow, titleBaseline);
      } else {
        ctx.textAlign = 'right';
        ctx.fillStyle = state.barColor || this.COLORS.bar;
        ctx.fillText(brandText, rightEdge, titleBaseline);
      }

      // "Photo by" phía trên, xám nhạt
      if (line1) {
        ctx.textAlign = 'right';
        ctx.font = `400 ${prefixSize}px ${this.FONTS.brand}`;
        ctx.fillStyle = '#e8e8e8';
        ctx.fillText(line1, rightEdge, prefixBaseline);
      }
    } else {
      // Timemark (Top line) + Subtitle (Bottom line, e.g. "100% Chân thực" / "Máy ảnh")
      const brandX = width - marginX;
      const brandBaselineY = height - marginY;
      const titleSize = Math.round(26 * scale);
      const subtitleSize = Math.round(16 * scale);
      const gap = Math.round(4 * scale);

      ctx.textAlign = 'right';

      if (line2) {
        // Subtitle on bottom
        ctx.font = `400 ${subtitleSize}px ${this.FONTS.brand}`;
        ctx.fillStyle = '#f8fafc';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(line2, brandX, brandBaselineY);

        // Title on top
        ctx.font = `700 ${titleSize}px ${this.FONTS.brand}`;
        ctx.fillStyle = state.barColor || this.COLORS.bar;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(line1, brandX, brandBaselineY - subtitleSize - gap);
      } else {
        ctx.font = `700 ${titleSize}px ${this.FONTS.brand}`;
        ctx.fillStyle = state.barColor || this.COLORS.bar;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(line1, brandX, brandBaselineY);
      }
    }

    ctx.restore();
  },

  /**
   * Mã xác thực dọc mép phải, xoay -90° (đọc từ dưới lên):
   *   [icon ©] [MÃ 14 KÝ TỰ - PT Mono 24.4u] [cách 18u] [Timemark Verified - Roboto Condensed 24u]
   * Đo từ ảnh mẫu: ĐOẠN MÃ canh giữa đúng tại H/2 (không phải cả chuỗi);
   * baseline cách mép phải 10.4u; màu #ECECEC.
   */
  drawRightVerticalCode(ctx, width, height, scale, state) {
    const u = scale;
    ctx.save();

    const code = state.vertCode || 'XLTME4223GLDTC';
    const suffix = state.vertSuffix !== undefined ? state.vertSuffix : 'Timemark Verified';

    const codeFontSize = Math.round(24.4 * u);
    const suffixFontSize = Math.round(24 * u);
    const iconFontSize = Math.round(22 * u);

    const codeFont = `400 ${codeFontSize}px ${this.FONTS.mono}`;
    const suffixFont = `400 ${suffixFontSize}px ${this.FONTS.text}`;
    const iconFont = `400 ${iconFontSize}px ${this.FONTS.mono}`;

    ctx.fillStyle = this.COLORS.vertCode;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 2.5 * u;
    ctx.shadowOffsetX = 1 * u;
    ctx.shadowOffsetY = 1 * u;

    ctx.font = codeFont;
    const codeW = ctx.measureText(code).width;
    ctx.font = iconFont;
    const iconW = ctx.measureText('©').width;
    ctx.font = suffixFont;
    const suffixW = suffix ? ctx.measureText(suffix).width : 0;

    // Baseline nằm cách mép phải 10.4u; xoay -90° để chữ chạy từ dưới lên
    const posX = width - 10.4 * u;
    ctx.translate(posX, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Đoạn mã canh giữa tại tâm ảnh (x=0 sau translate); nếu suffix dài/scale lớn
    // vượt quá mép trên thì dịch cả chuỗi xuống vừa đủ để không tràn khỏi ảnh
    let codeStartX = -codeW / 2;
    const topExtent = codeStartX + codeW + (suffix ? 18 * u + suffixW : 0); // phía mép trên
    const topAvail = height / 2 - 12 * u;
    if (topExtent > topAvail) {
      const shift = topExtent - topAvail;
      const bottomRoom = (height / 2 - 12 * u) - (-codeStartX + 11 * u + iconW); // chỗ trống phía dưới
      codeStartX -= Math.min(shift, Math.max(0, bottomRoom));
    }

    // Icon © trước mã (phía dưới ảnh), cách mã 11u
    ctx.font = iconFont;
    ctx.fillText('©', codeStartX - 11 * u - iconW, 0);

    // Mã bảo mật 14 ký tự — PT Mono
    ctx.font = codeFont;
    ctx.fillText(code, codeStartX, 0);

    // "Timemark Verified" — Roboto Condensed, cách mã 18u
    if (suffix) {
      ctx.font = suffixFont;
      ctx.fillText(suffix, codeStartX + codeW + 18 * u, 0);
    }

    ctx.restore();
  },

  /**
   * Helper for rounded rectangle
   */
  roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

if (typeof window !== 'undefined') window.WatermarkEngine = WatermarkEngine;
if (typeof globalThis !== 'undefined') globalThis.WatermarkEngine = WatermarkEngine;
