/**
 * Main Application Controller
 * Handles UI interactions, state synchronization, EXIF parsing, real-time Canvas rendering, and export
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons safely
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  } else if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // --- 1. Global Application State ---
  const state = {
    template: 'timemark-standard', // 'timemark-standard' | 'timemark-gps' | 'gps-multiline' | 'work-report'
    
    // Editable Text Fields (Khởi tạo chuẩn xác theo Ảnh mẫu 4:3 / 3:4)
    time: '16:46',
    date: '11 Aug 2026',
    dayOfWeek: 'Tues',
    address1: 'Ngõ 167 Đ. Nguyễn Ngọc Vũ, Yên Hòa,',
    address2: 'Hà Nội',
    
    // Extra lines for GPS Multi-line
    gpsLine3: 'Thành Phố Hà Nội',
    gpsLine4: 'P. Kim Liên',
    gpsLine5: 'Việt Nam',

    // Mẫu 3: Tùy Chỉnh fields (Tiêu đề của bạn + Vạch vàng + 3 dòng)
    customTitle: 'Tiêu đề của bạn',
    customDateTime: '30/01/2023 09:30',
    customLocation: 'Tao Dan Park, Hồ Chí Minh',
    customGps: '10.774917°N, 106.692420°E',

    // Điểm danh fields
    attendanceBadge: 'Điểm danh',

    // Dịch vụ fields
    servTitle: 'Tên dịch vụ',
    servDetail: '👉: Chi tiết dịch vụ',
    servPhone: '0123456666',

    // Bảo vệ fields
    secTitle: '🛡️ BẢO VỆ',
    secAddr: 'Chốt Cổng 1, Tao Dan Park, Hồ Chí Minh',

    // Hồ sơ kỹ thuật fields
    techHeader: 'HỒ SƠ KỸ THUẬT',
    techLine1: 'Nghiệm thu: Thử kín nội bộ tầng 3',

    // Nhật ký công việc fields
    logHeader: 'Nhật ký công việc',
    logContent: 'Thử kín nội bộ tầng 3',
    logPlace: 'Tầng 3 trục 1B',

    // GPS & Thời tiết fields
    weathCompass: 'SE 125°',
    weathTemp: '☀️ 28°C',
    weathAlt: 'Độ cao: 18m',
    
    // Logo & Brand (Chuẩn 2 ảnh mới: "Photo by" trên, "Timemark" vàng dưới)
    showLogo: true,
    logoTitle: 'Photo by',
    logoSubtitle: 'Timemark',
    
    // Vertical Security Code
    showVertCode: true,
    vertCode: 'XLTME4223GLDTC',
    vertSuffix: 'Timemark Verified',

    // Work Report fields
    workProject: 'DỰ ÁN: TÒA NHÀ VĂN PHÒNG',
    workPerson: 'Giám sát: Nguyễn Văn Hưng',
    workNote: 'Ghi chú: Đã nghiệm thu hiện trường hoàn tất',

    // Style & Placement
    position: 'bottom-left',
    scale: 100,
    margin: 4,
    textColor: '#ffffff',
    barColor: '#f9c13a', // màu vạch vàng đo từ ảnh mẫu Timemark thực tế
    shadow: 85,
    opacity: 100,

    // Image Data
    currentImage: null,
    batchImages: [],
    activeBatchIndex: 0
  };

  // --- 2. DOM Elements ---
  const mainCanvas = document.getElementById('main-canvas');
  const sourceImg = document.getElementById('source-img');
  const fileUpload = document.getElementById('file-upload');
  const dropZone = document.getElementById('drop-zone');
  const canvasViewport = document.getElementById('canvas-viewport');
  const loadingOverlay = document.getElementById('loading-overlay');
  const resolutionBadge = document.getElementById('img-resolution-badge');

  // Input Fields
  const inputTime = document.getElementById('input-time');
  const pickerTime = document.getElementById('picker-time');
  const btnNowTime = document.getElementById('btn-now-time');
  const inputDate = document.getElementById('input-date');
  const inputDay = document.getElementById('input-day');
  const selectDay = document.getElementById('select-day');
  const inputAddr1 = document.getElementById('input-addr-1');
  const inputAddr2 = document.getElementById('input-addr-2');
  const btnSetSampleCoords = document.getElementById('btn-set-sample-coords');

  const inputGpsLine3 = document.getElementById('input-gps-line3');
  const inputGpsLine4 = document.getElementById('input-gps-line4');
  const inputGpsLine5 = document.getElementById('input-gps-line5');
  const boxGpsMultiLines = document.getElementById('box-gps-multi-lines');

  // Custom Template (Mẫu 3) Elements
  const boxCustomControls = document.getElementById('box-custom-controls');
  const inputCustomTitle = document.getElementById('input-custom-title');
  const inputCustomDateTime = document.getElementById('input-custom-datetime');
  const inputCustomLocation = document.getElementById('input-custom-location');
  const inputCustomGps = document.getElementById('input-custom-gps');

  // Attendance Elements
  const boxAttendControls = document.getElementById('box-attend-controls');
  const inputAttendBadge = document.getElementById('input-attend-badge');

  // Service Elements
  const boxServiceControls = document.getElementById('box-service-controls');
  const inputServTitle = document.getElementById('input-serv-title');
  const inputServDetail = document.getElementById('input-serv-detail');
  const inputServPhone = document.getElementById('input-serv-phone');

  // Security Elements
  const boxSecurityControls = document.getElementById('box-security-controls');
  const inputSecTitle = document.getElementById('input-sec-title');
  const inputSecAddr = document.getElementById('input-sec-addr');

  // Technical Elements
  const boxTechnicalControls = document.getElementById('box-technical-controls');
  const inputTechHeader = document.getElementById('input-tech-header');
  const inputTechLine1 = document.getElementById('input-tech-line1');

  // Worklog Elements
  const boxWorklogControls = document.getElementById('box-worklog-controls');
  const inputLogHeader = document.getElementById('input-log-header');
  const inputLogContent = document.getElementById('input-log-content');
  const inputLogPlace = document.getElementById('input-log-place');

  // Weather & GPS Elements
  const boxWeatherControls = document.getElementById('box-weather-controls');
  const inputWeathCompass = document.getElementById('input-weath-compass');
  const inputWeathTemp = document.getElementById('input-weath-temp');
  const inputWeathAlt = document.getElementById('input-weath-alt');

  // Work Report Elements
  const boxWorkControls = document.getElementById('box-work-controls');
  const inputWorkProject = document.getElementById('input-work-project');
  const inputWorkPerson = document.getElementById('input-work-person');
  const inputWorkNote = document.getElementById('input-work-note');

  const chkShowLogo = document.getElementById('chk-show-logo');
  const boxLogoControls = document.getElementById('box-logo-controls');
  const inputLogoTitle = document.getElementById('input-logo-title');
  const inputLogoSubtitle = document.getElementById('input-logo-subtitle');

  const chkShowVertCode = document.getElementById('chk-show-vert-code');
  const boxVertControls = document.getElementById('box-vert-controls');
  const inputVertCode = document.getElementById('input-vert-code');
  const inputVertSuffix = document.getElementById('input-vert-suffix');
  const btnGenCode = document.getElementById('btn-gen-code');

  // Styling & Sliders
  const rangeScale = document.getElementById('range-scale');
  const labelScale = document.getElementById('label-scale');
  const rangeMargin = document.getElementById('range-margin');
  const labelMargin = document.getElementById('label-margin');
  const colorText = document.getElementById('color-text');
  const colorTextVal = document.getElementById('color-text-val');
  const colorBar = document.getElementById('color-bar');
  const colorBarVal = document.getElementById('color-bar-val');
  const rangeShadow = document.getElementById('range-shadow');
  const labelShadow = document.getElementById('label-shadow');
  const rangeOpacity = document.getElementById('range-opacity');
  const labelOpacity = document.getElementById('label-opacity');

  // Action Buttons
  const btnFetchLocation = document.getElementById('btn-fetch-location');
  const btnDownload = document.getElementById('btn-download');
  const btnCopyClipboard = document.getElementById('btn-copy-clipboard');
  const btnSampleImg = document.getElementById('btn-sample-img');
  const btnResetText = document.getElementById('btn-reset-text');
  const btnZoomFit = document.getElementById('btn-zoom-fit');

  // Batch
  const batchStrip = document.getElementById('batch-strip');
  const batchCount = document.getElementById('batch-count');
  const batchThumbnails = document.getElementById('batch-thumbnails');
  const btnDownloadZip = document.getElementById('btn-download-zip');

  // Camera Modal
  const cameraModal = document.getElementById('camera-modal');
  const btnOpenCamera = document.getElementById('btn-open-camera');
  const btnCloseCamera = document.getElementById('btn-close-camera');
  const btnCapture = document.getElementById('btn-capture');
  const btnSwitchCamera = document.getElementById('btn-switch-camera');
  const btnCameraGps = document.getElementById('btn-camera-gps');

  // Initialize Camera Controller
  CameraController.init(state);

  // --- 3. Render Trigger ---
  function updateCanvas() {
    if (!state.currentImage) return;

    WatermarkEngine.render(mainCanvas, state.currentImage, state);

    // Update Resolution Badge (kèm nhãn tỷ lệ nếu là tỷ lệ phổ biến, ví dụ "(4:3)")
    const w = state.currentImage.naturalWidth || state.currentImage.width;
    const h = state.currentImage.naturalHeight || state.currentImage.height;
    if (resolutionBadge) {
      const gcd = (a, b) => (b ? gcd(b, a % b) : a);
      const d = gcd(w, h) || 1;
      const rw = w / d, rh = h / d;
      const ratioLabel = (rw <= 32 && rh <= 32) ? ` (${rw}:${rh})` : '';
      resolutionBadge.textContent = `${w} x ${h} px${ratioLabel}`;
    }
  }

  // --- 4. Synchronize UI Inputs with State ---
  function syncInputsFromState() {
    inputTime.value = state.time;
    inputDate.value = state.date;
    inputDay.value = state.dayOfWeek;
    inputAddr1.value = state.address1;
    inputAddr2.value = state.address2;

    inputGpsLine3.value = state.gpsLine3;
    inputGpsLine4.value = state.gpsLine4;
    inputGpsLine5.value = state.gpsLine5;

    // Custom Template inputs
    if (inputCustomTitle) inputCustomTitle.value = state.customTitle;
    if (inputCustomDateTime) inputCustomDateTime.value = state.customDateTime;
    if (inputCustomLocation) inputCustomLocation.value = state.customLocation;
    if (inputCustomGps) inputCustomGps.value = state.customGps;

    // Attendance input
    if (inputAttendBadge) inputAttendBadge.value = state.attendanceBadge;

    // Service inputs
    if (inputServTitle) inputServTitle.value = state.servTitle;
    if (inputServDetail) inputServDetail.value = state.servDetail;
    if (inputServPhone) inputServPhone.value = state.servPhone;

    // Security inputs
    if (inputSecTitle) inputSecTitle.value = state.secTitle;
    if (inputSecAddr) inputSecAddr.value = state.secAddr;

    // Technical inputs
    if (inputTechHeader) inputTechHeader.value = state.techHeader;
    if (inputTechLine1) inputTechLine1.value = state.techLine1;

    // Worklog inputs
    if (inputLogHeader) inputLogHeader.value = state.logHeader;
    if (inputLogContent) inputLogContent.value = state.logContent;
    if (inputLogPlace) inputLogPlace.value = state.logPlace;

    // Weather & GPS inputs
    if (inputWeathCompass) inputWeathCompass.value = state.weathCompass;
    if (inputWeathTemp) inputWeathTemp.value = state.weathTemp;
    if (inputWeathAlt) inputWeathAlt.value = state.weathAlt;

    // Work Report inputs
    if (inputWorkProject) inputWorkProject.value = state.workProject;
    if (inputWorkPerson) inputWorkPerson.value = state.workPerson;
    if (inputWorkNote) inputWorkNote.value = state.workNote;

    chkShowLogo.checked = state.showLogo;
    inputLogoTitle.value = state.logoTitle;
    inputLogoSubtitle.value = state.logoSubtitle;
    boxLogoControls.classList.toggle('hidden', !state.showLogo);

    chkShowVertCode.checked = state.showVertCode;
    inputVertCode.value = state.vertCode;
    inputVertSuffix.value = state.vertSuffix;
    boxVertControls.classList.toggle('hidden', !state.showVertCode);

    rangeScale.value = state.scale;
    labelScale.textContent = `${state.scale}%`;
    rangeMargin.value = state.margin;
    labelMargin.textContent = `${state.margin}%`;
    
    colorText.value = state.textColor;
    colorTextVal.textContent = state.textColor.toUpperCase();
    colorBar.value = state.barColor;
    colorBarVal.textContent = state.barColor.toUpperCase();

    rangeShadow.value = state.shadow;
    labelShadow.textContent = state.shadow > 70 ? 'Rõ nét (Đậm)' : `${state.shadow}%`;

    rangeOpacity.value = state.opacity;
    labelOpacity.textContent = `${state.opacity}%`;

    // Position buttons
    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pos === state.position);
    });

    // Template specific box visibility
    if (boxGpsMultiLines) boxGpsMultiLines.classList.toggle('hidden', state.template !== 'gps-multiline');
    if (boxCustomControls) boxCustomControls.classList.toggle('hidden', state.template !== 'timemark-custom');
    if (boxAttendControls) boxAttendControls.classList.toggle('hidden', state.template !== 'timemark-attendance');
    if (boxServiceControls) boxServiceControls.classList.toggle('hidden', state.template !== 'timemark-service');
    if (boxSecurityControls) boxSecurityControls.classList.toggle('hidden', state.template !== 'timemark-security');
    if (boxTechnicalControls) boxTechnicalControls.classList.toggle('hidden', state.template !== 'timemark-technical');
    if (boxWorklogControls) boxWorklogControls.classList.toggle('hidden', state.template !== 'timemark-worklog');
    if (boxWeatherControls) boxWeatherControls.classList.toggle('hidden', state.template !== 'timemark-weather-gps');
    if (boxWorkControls) boxWorkControls.classList.toggle('hidden', state.template !== 'work-report');
  }

  // --- 5. Event Listeners for All Editable Fields ---
  inputTime.addEventListener('input', (e) => { state.time = e.target.value; updateCanvas(); });
  pickerTime.addEventListener('change', (e) => { state.time = e.target.value; inputTime.value = state.time; updateCanvas(); });

  btnNowTime.addEventListener('click', () => {
    const now = new Date();
    // Tôn trọng chip định dạng ngày đang chọn (mặc định 'eng' — chuẩn 2 ảnh mẫu)
    const activeChip = document.querySelector('.chip[data-date-fmt].active');
    const fmt = (activeChip && activeChip.dataset.dateFmt) || 'eng';
    state.time = GeoService.formatTime(now);
    state.date = GeoService.formatDate(now, fmt);
    state.dayOfWeek = fmt === 'eng' ? GeoService.getDayOfWeekEn(now) : GeoService.getDayOfWeekVi(now);
    state.customDateTime = `${GeoService.formatDate(now, 'slash')} ${state.time}`;
    syncInputsFromState();
    updateCanvas();
  });

  inputDate.addEventListener('input', (e) => { state.date = e.target.value; updateCanvas(); });

  // Date format chips
  document.querySelectorAll('.chip[data-date-fmt]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-date-fmt]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const fmt = chip.dataset.dateFmt;
      const now = new Date();
      state.date = GeoService.formatDate(now, fmt);
      if (fmt === 'eng') {
        state.dayOfWeek = GeoService.getDayOfWeekEn(now);
      } else {
        state.dayOfWeek = GeoService.getDayOfWeekVi(now);
      }
      inputDate.value = state.date;
      inputDay.value = state.dayOfWeek;
      updateCanvas();
    });
  });

  inputDay.addEventListener('input', (e) => { state.dayOfWeek = e.target.value; updateCanvas(); });
  selectDay.addEventListener('change', (e) => {
    if (e.target.value) {
      state.dayOfWeek = e.target.value;
      inputDay.value = state.dayOfWeek;
      updateCanvas();
    }
  });

  inputAddr1.addEventListener('input', (e) => { state.address1 = e.target.value; updateCanvas(); });
  inputAddr2.addEventListener('input', (e) => { state.address2 = e.target.value; updateCanvas(); });

  btnSetSampleCoords.addEventListener('click', () => {
    state.address2 = 'Tọa độ: 20.970515°N, 105.816296°E ±16ft';
    inputAddr2.value = state.address2;
    updateCanvas();
  });

  inputGpsLine3.addEventListener('input', (e) => { state.gpsLine3 = e.target.value; updateCanvas(); });
  inputGpsLine4.addEventListener('input', (e) => { state.gpsLine4 = e.target.value; updateCanvas(); });
  inputGpsLine5.addEventListener('input', (e) => { state.gpsLine5 = e.target.value; updateCanvas(); });

  // Custom Template listeners
  if (inputCustomTitle) inputCustomTitle.addEventListener('input', (e) => { state.customTitle = e.target.value; updateCanvas(); });
  if (inputCustomDateTime) inputCustomDateTime.addEventListener('input', (e) => { state.customDateTime = e.target.value; updateCanvas(); });
  if (inputCustomLocation) inputCustomLocation.addEventListener('input', (e) => { state.customLocation = e.target.value; updateCanvas(); });
  if (inputCustomGps) inputCustomGps.addEventListener('input', (e) => { state.customGps = e.target.value; updateCanvas(); });

  // Attendance listener
  if (inputAttendBadge) inputAttendBadge.addEventListener('input', (e) => { state.attendanceBadge = e.target.value; updateCanvas(); });

  // Service listeners
  if (inputServTitle) inputServTitle.addEventListener('input', (e) => { state.servTitle = e.target.value; updateCanvas(); });
  if (inputServDetail) inputServDetail.addEventListener('input', (e) => { state.servDetail = e.target.value; updateCanvas(); });
  if (inputServPhone) inputServPhone.addEventListener('input', (e) => { state.servPhone = e.target.value; updateCanvas(); });

  // Security listeners
  if (inputSecTitle) inputSecTitle.addEventListener('input', (e) => { state.secTitle = e.target.value; updateCanvas(); });
  if (inputSecAddr) inputSecAddr.addEventListener('input', (e) => { state.secAddr = e.target.value; updateCanvas(); });

  // Technical listeners
  if (inputTechHeader) inputTechHeader.addEventListener('input', (e) => { state.techHeader = e.target.value; updateCanvas(); });
  if (inputTechLine1) inputTechLine1.addEventListener('input', (e) => { state.techLine1 = e.target.value; updateCanvas(); });

  // Worklog listeners
  if (inputLogHeader) inputLogHeader.addEventListener('input', (e) => { state.logHeader = e.target.value; updateCanvas(); });
  if (inputLogContent) inputLogContent.addEventListener('input', (e) => { state.logContent = e.target.value; updateCanvas(); });
  if (inputLogPlace) inputLogPlace.addEventListener('input', (e) => { state.logPlace = e.target.value; updateCanvas(); });

  // Weather listeners
  if (inputWeathCompass) inputWeathCompass.addEventListener('input', (e) => { state.weathCompass = e.target.value; updateCanvas(); });
  if (inputWeathTemp) inputWeathTemp.addEventListener('input', (e) => { state.weathTemp = e.target.value; updateCanvas(); });
  if (inputWeathAlt) inputWeathAlt.addEventListener('input', (e) => { state.weathAlt = e.target.value; updateCanvas(); });

  // Work Report listeners
  if (inputWorkProject) inputWorkProject.addEventListener('input', (e) => { state.workProject = e.target.value; updateCanvas(); });
  if (inputWorkPerson) inputWorkPerson.addEventListener('input', (e) => { state.workPerson = e.target.value; updateCanvas(); });
  if (inputWorkNote) inputWorkNote.addEventListener('input', (e) => { state.workNote = e.target.value; updateCanvas(); });

  chkShowLogo.addEventListener('change', (e) => {
    state.showLogo = e.target.checked;
    boxLogoControls.classList.toggle('hidden', !state.showLogo);
    updateCanvas();
  });
  inputLogoTitle.addEventListener('input', (e) => { state.logoTitle = e.target.value; updateCanvas(); });
  inputLogoSubtitle.addEventListener('input', (e) => { state.logoSubtitle = e.target.value; updateCanvas(); });

  // Brand presets
  document.querySelectorAll('[data-preset-brand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.presetBrand;
      if (preset === 'photo-by-timemark') {
        state.logoTitle = 'Photo by';
        state.logoSubtitle = 'Timemark';
      } else if (preset === 'timemark-true') {
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (preset === 'timemark-camera') {
        state.logoTitle = 'Timemark';
        state.logoSubtitle = 'Máy ảnh';
      } else {
        state.logoSubtitle = '';
      }
      inputLogoTitle.value = state.logoTitle;
      inputLogoSubtitle.value = state.logoSubtitle;
      updateCanvas();
    });
  });

  chkShowVertCode.addEventListener('change', (e) => {
    state.showVertCode = e.target.checked;
    boxVertControls.classList.toggle('hidden', !state.showVertCode);
    updateCanvas();
  });
  inputVertCode.addEventListener('input', (e) => { state.vertCode = e.target.value; updateCanvas(); });
  inputVertSuffix.addEventListener('input', (e) => { state.vertSuffix = e.target.value; updateCanvas(); });
  btnGenCode.addEventListener('click', () => {
    state.vertCode = GeoService.generateSecurityCode(14);
    inputVertCode.value = state.vertCode;
    updateCanvas();
  });

  // Category Tabs filtering
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetTab = tab.dataset.tab;

      document.querySelectorAll('.template-card').forEach(card => {
        if (targetTab === 'tab-all') {
          card.style.display = 'flex';
        } else if (targetTab === 'tab-popular') {
          card.style.display = card.dataset.category === 'popular' ? 'flex' : 'none';
        } else if (targetTab === 'tab-work') {
          card.style.display = card.dataset.category === 'work' ? 'flex' : 'none';
        }
      });
    });
  });

  // Position Buttons
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.position = btn.dataset.pos;
      updateCanvas();
    });
  });

  // Scale & Margin Sliders
  rangeScale.addEventListener('input', (e) => {
    state.scale = parseInt(e.target.value, 10);
    labelScale.textContent = `${state.scale}%`;
    updateCanvas();
  });

  rangeMargin.addEventListener('input', (e) => {
    state.margin = parseInt(e.target.value, 10);
    labelMargin.textContent = `${state.margin}%`;
    updateCanvas();
  });

  // Colors
  colorText.addEventListener('input', (e) => {
    state.textColor = e.target.value;
    colorTextVal.textContent = state.textColor.toUpperCase();
    updateCanvas();
  });

  colorBar.addEventListener('input', (e) => {
    state.barColor = e.target.value;
    colorBarVal.textContent = state.barColor.toUpperCase();
    updateCanvas();
  });

  rangeShadow.addEventListener('input', (e) => {
    state.shadow = parseInt(e.target.value, 10);
    labelShadow.textContent = state.shadow > 70 ? 'Rõ nét (Đậm)' : `${state.shadow}%`;
    updateCanvas();
  });

  rangeOpacity.addEventListener('input', (e) => {
    state.opacity = parseInt(e.target.value, 10);
    labelOpacity.textContent = `${state.opacity}%`;
    updateCanvas();
  });

  // --- 6. Template Selection Handling ---
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const tpl = card.dataset.template;
      state.template = tpl;

      // Apply tailored presets based on template
      if (tpl === 'timemark-standard') {
        state.position = 'bottom-left';
        state.time = '09:30';
        state.date = '30 Thg 1 2023';
        state.dayOfWeek = 'Thứ Hai';
        state.address1 = 'Tao Dan Park, Hồ Chí Minh';
        state.address2 = '';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-custom') {
        // Mẫu 3: Tùy Chỉnh (Tiêu đề của bạn)
        state.position = 'bottom-left';
        state.customTitle = 'Tiêu đề của bạn';
        state.customDateTime = '30/01/2023 09:30';
        state.customLocation = 'Tao Dan Park, Hồ Chí Minh';
        state.customGps = '10.774917°N, 106.692420°E';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-attendance') {
        // Mẫu Điểm Danh
        state.position = 'bottom-left';
        state.attendanceBadge = 'Điểm danh';
        state.time = '23:40';
        state.date = '30/01/2022';
        state.address1 = 'Tao Dan Park, Hồ Chí Minh';
        state.address2 = '';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-service') {
        // Mẫu Dịch Vụ
        state.position = 'bottom-left';
        state.servTitle = 'Tên dịch vụ';
        state.customDateTime = '30/01/2023 09:30';
        state.servDetail = '👉: Chi tiết dịch vụ';
        state.servPhone = '0123456666';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-security') {
        // Mẫu Bảo Vệ
        state.position = 'bottom-left';
        state.secTitle = '🛡️ BẢO VỆ';
        state.time = '09:30';
        state.date = '30/01/2023';
        state.secAddr = 'Tao Dan Park, Hồ Chí Minh';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-technical') {
        // Mẫu Hồ Sơ Kỹ Thuật
        state.position = 'bottom-left';
        state.techHeader = 'HỒ SƠ KỸ THUẬT';
        state.techLine1 = 'Nghiệm thu: Thử kín nội bộ tầng 3';
        state.customDateTime = '30/01/2023 09:30';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-completed') {
        // Mẫu Đã Hoàn Thành
        state.position = 'bottom-left';
        state.time = '09:30';
        state.date = '30/01/2023';
        state.address1 = 'Tao Dan Park, District 1, Ho Chi Minh City, Vietnam';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-worklog') {
        // Mẫu Nhật Ký Công Việc
        state.position = 'bottom-left';
        state.logHeader = 'Nhật ký công việc';
        state.logContent = 'Thử kín nội bộ tầng 3';
        state.logPlace = 'Tầng 3 trục 1B';
        state.customDateTime = '30/01/2022 16:35';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-weather-gps') {
        // Mẫu Toạ Độ & Thời Tiết
        state.position = 'bottom-left';
        state.customLocation = 'Tao Dan Park';
        state.customGps = '10.774917°N, 106.692420°E';
        state.weathCompass = 'SE 125°';
        state.customDateTime = '30/01/2023 09:30';
        state.weathTemp = '☀️ 28°C';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
      } else if (tpl === 'timemark-gps') {
        state.position = 'bottom-left';
        state.time = '10:13';
        state.date = '08/07/2026';
        state.dayOfWeek = 'Thứ Tư';
        state.address1 = 'Thành Phố Hà Nội, P. Hoàng Liệt';
        state.address2 = 'Tọa độ: 20.970515°N, 105.816296°E ±16ft';
        state.logoTitle = 'Timemark';
        state.logoSubtitle = 'Máy ảnh';
      } else if (tpl === 'gps-multiline') {
        state.position = 'top-right';
        state.date = '2026年5月19日';
        state.time = '10:44:40';
        state.address1 = 'Ngõ 4 Phương Mai';
        state.gpsLine3 = 'Thành Phố Hà Nội';
        state.gpsLine4 = 'P. Kim Liên';
        state.gpsLine5 = 'Việt Nam';
      } else if (tpl === 'work-report') {
        state.position = 'bottom-left';
        state.workProject = 'HỒ SƠ KỸ THUẬT';
        state.workPerson = 'Nghiệm thu: Thử kín nội bộ tầng 3';
        state.workNote = 'Thời gian: 30/01/2023 09:30';
      }

      syncInputsFromState();
      updateCanvas();
    });
  });

  // --- 7. Geolocation & Reverse Geocode Action ---
  btnFetchLocation.addEventListener('click', async () => {
    btnFetchLocation.disabled = true;
    btnFetchLocation.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block"></div> Đang định vị...';

    try {
      const pos = await GeoService.getCurrentPosition();
      const addrInfo = await GeoService.reverseGeocode(pos.latitude, pos.longitude);

      state.address1 = addrInfo.line1;
      state.address2 = GeoService.formatCoordsString(pos.latitude, pos.longitude, pos.accuracy);
      state.gpsLine3 = addrInfo.city;
      state.gpsLine4 = addrInfo.ward;
      state.gpsLine5 = addrInfo.country;

      syncInputsFromState();
      updateCanvas();
    } catch (err) {
      alert('Không thể lấy vị trí GPS: ' + (err.message || 'Vui lòng kiểm tra quyền truy cập vị trí trên trình duyệt'));
    } finally {
      btnFetchLocation.disabled = false;
      btnFetchLocation.innerHTML = '<i data-lucide="map-pin"></i> GPS Tự Động';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
  });

  // --- 8. File Upload & EXIF Parsing ---
  fileUpload.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    canvasViewport.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('hidden');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    canvasViewport.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('hidden');
    });
  });

  canvasViewport.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Token chống re-entrancy: lần gọi mới vô hiệu hoá lần đang chạy dở
  let handleFilesToken = 0;

  async function handleFiles(files) {
    const myToken = ++handleFilesToken;
    loadingOverlay.classList.remove('hidden');

    try {
      // Nạp vào mảng cục bộ; chỉ commit vào state nếu vẫn là lần gọi mới nhất
      const loaded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const imgObj = await loadImageFile(file);
        if (myToken !== handleFilesToken) return; // đã có lần gọi mới hơn
        if (!imgObj) continue; // bỏ qua file ảnh không đọc được
        loaded.push({ file: file, img: imgObj, name: file.name });
      }

      if (loaded.length === 0) {
        alert('Không đọc được ảnh nào từ các file đã chọn.');
        return; // giữ nguyên batch cũ
      }

      state.batchImages = loaded;
      state.activeBatchIndex = 0;

      // First file EXIF parse
      const firstFile = loaded[0].file;
      const exif = await ExifParser.extractMetadata(firstFile);
      if (myToken !== handleFilesToken) return;

      if (exif.dateTime) {
        state.time = GeoService.formatTime(exif.dateTime);
        state.date = GeoService.formatDate(exif.dateTime, 'vietnamese');
        state.dayOfWeek = GeoService.getDayOfWeekVi(exif.dateTime);
      }

      if (exif.latitude != null && exif.longitude != null) {
        const addr = await GeoService.reverseGeocode(exif.latitude, exif.longitude);
        if (myToken !== handleFilesToken) return;
        state.address1 = addr.line1;
        state.address2 = GeoService.formatCoordsString(exif.latitude, exif.longitude);
      }

      selectBatchImage(0);
      renderBatchThumbnails();
      syncInputsFromState();
    } finally {
      // Chỉ lần gọi mới nhất mới được tắt overlay
      if (myToken === handleFilesToken) loadingOverlay.classList.add('hidden');
    }
  }

  function loadImageFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // ảnh hỏng: bỏ qua thay vì treo tiến trình
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function selectBatchImage(index) {
    if (!state.batchImages[index]) return;
    state.activeBatchIndex = index;
    state.currentImage = state.batchImages[index].img;
    updateCanvas();

    document.querySelectorAll('.batch-thumb-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  function renderBatchThumbnails() {
    if (state.batchImages.length <= 1) {
      batchStrip.classList.add('hidden');
      return;
    }

    batchStrip.classList.remove('hidden');
    batchCount.textContent = state.batchImages.length;
    batchThumbnails.innerHTML = '';

    state.batchImages.forEach((item, i) => {
      const thumb = document.createElement('div');
      thumb.className = `batch-thumb-item ${i === state.activeBatchIndex ? 'active' : ''}`;
      const img = document.createElement('img');
      img.src = item.img.src;
      thumb.appendChild(img);
      thumb.addEventListener('click', () => selectBatchImage(i));
      batchThumbnails.appendChild(thumb);
    });
  }

  // --- 9. Sample Realistic Backgrounds ---
  const sampleImages = [
    // 1. Dark 4:3 Landscape (Chuẩn 100% Ảnh 1)
    createDark43SampleCanvas,
    // 2. Dark 3:4 Portrait (Chuẩn 100% Ảnh 2)
    createDark34SampleCanvas,
    // 3. Office Room (Image 1 style)
    createOfficeSampleCanvas,
    // 4. Living Room (Image 3 style)
    createLivingRoomSampleCanvas,
    // 5. Studio Room (Image 4 style)
    createStudioSampleCanvas
  ];
  let sampleIndex = 0;

  function loadSampleImage() {
    const canvasFunc = sampleImages[sampleIndex % sampleImages.length];
    sampleIndex++;
    const canvas = canvasFunc();
    const img = new Image();
    img.onload = () => {
      state.currentImage = img;
      updateCanvas();
    };
    img.src = canvas.toDataURL('image/jpeg', 0.95);
  }

  btnSampleImg.addEventListener('click', loadSampleImage);

  // Helper Sample 1: Modern Office Room (similar to User Image 1)
  function createOfficeSampleCanvas() {
    const c = document.createElement('canvas');
    c.width = 1920;
    c.height = 1080;
    const ctx = c.getContext('2d');

    // Gradient background: Ceiling, modern wood floor, glass windows
    const gradWall = ctx.createLinearGradient(0, 0, 0, 600);
    gradWall.addColorStop(0, '#cbd5e1');
    gradWall.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradWall;
    ctx.fillRect(0, 0, 1920, 600);

    // Floor with glossy perspective reflection
    const gradFloor = ctx.createLinearGradient(0, 600, 0, 1080);
    gradFloor.addColorStop(0, '#d6ccc2');
    gradFloor.addColorStop(1, '#e3d5ca');
    ctx.fillStyle = gradFloor;
    ctx.fillRect(0, 600, 1920, 480);

    // Grid ceiling tiles
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 1920; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 350);
      ctx.stroke();
    }
    for (let y = 0; y < 350; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }

    // Glass walls left
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 200, 480, 500);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(40, 280, 400, 250);

    // Windows right
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(1440, 200, 480, 600);

    // Exit sign
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(40, 170, 70, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('EXIT', 55, 190);

    return c;
  }

  // Helper Sample 2: Living Room / Desk (similar to User Image 3)
  function createLivingRoomSampleCanvas() {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1440; // portrait
    const ctx = c.getContext('2d');

    // Warm interior lighting
    const grad = ctx.createLinearGradient(0, 0, 1080, 1440);
    grad.addColorStop(0, '#fefae0');
    grad.addColorStop(0.5, '#eddcd2');
    grad.addColorStop(1, '#cb997e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1440);

    // Ceiling Light Panels
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 40;
    ctx.fillRect(350, 80, 380, 100);
    ctx.fillRect(160, 280, 180, 60);
    ctx.shadowBlur = 0;

    // Table in foreground
    ctx.fillStyle = '#ddb892';
    ctx.beginPath();
    ctx.moveTo(100, 850);
    ctx.lineTo(980, 850);
    ctx.lineTo(1080, 1440);
    ctx.lineTo(0, 1440);
    ctx.closePath();
    ctx.fill();

    return c;
  }

  // Helper Sample 3: Studio / Grid Ceiling Room (similar to User Image 4)
  function createStudioSampleCanvas() {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1440;
    const ctx = c.getContext('2d');

    // White room with grid ceiling
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1080, 1440);

    // Black grid ceiling
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    for (let x = 0; x < 1080; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 480);
      ctx.stroke();
    }
    for (let y = 0; y < 480; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1080, y);
      ctx.stroke();
    }

    return c;
  }

  // Helper Sample 4: Dark 4:3 Landscape (Chuẩn 100% Ảnh 1 người dùng)
  function createDark43SampleCanvas() {
    const c = document.createElement('canvas');
    c.width = 1920;
    c.height = 1440; // Exact 4:3 ratio
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, 1920, 1440);
    return c;
  }

  // Helper Sample 5: Dark 3:4 Portrait (Chuẩn 100% Ảnh 2 người dùng)
  function createDark34SampleCanvas() {
    const c = document.createElement('canvas');
    c.width = 1440;
    c.height = 1920; // Exact 3:4 ratio
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, 1440, 1920);
    return c;
  }

  // Aspect Ratio Switcher Logic
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const ratio = btn.dataset.ratio;
      let w = 1920, h = 1440;
      if (ratio === '4:3') { w = 1920; h = 1440; }
      else if (ratio === '3:4') { w = 1440; h = 1920; }
      else if (ratio === '16:9') { w = 1920; h = 1080; }
      else if (ratio === '9:16') { w = 1080; h = 1920; }

      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, w, h);

      const img = new Image();
      img.onload = () => {
        state.currentImage = img;
        updateCanvas();
      };
      img.src = c.toDataURL('image/jpeg', 0.95);
    });
  });

  // Dedicated Button: Mẫu 4:3 Ngang (Chuẩn Ảnh 1)
  const btnSample43 = document.getElementById('btn-sample-43');
  if (btnSample43) {
    btnSample43.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === '4:3'));
      document.querySelectorAll('.template-card').forEach(c => c.classList.toggle('active', c.dataset.template === 'timemark-standard'));
      state.template = 'timemark-standard';
      state.position = 'bottom-left';
      state.time = '16:46';
      state.date = '11 Aug 2026';
      state.dayOfWeek = 'Tues';
      state.address1 = 'Ngõ 167 Đ. Nguyễn Ngọc Vũ, Yên Hòa,';
      state.address2 = 'Hà Nội';
      state.logoTitle = 'Photo by';
      state.logoSubtitle = 'Timemark';
      state.vertCode = 'XLTME4223GLDTC';
      state.vertSuffix = 'Timemark Verified';
      state.scale = 100;
      state.margin = 4;
      state.barColor = '#f9c13a';

      const canvas = createDark43SampleCanvas();
      const img = new Image();
      img.onload = () => {
        state.currentImage = img;
        syncInputsFromState();
        updateCanvas();
      };
      img.src = canvas.toDataURL('image/jpeg', 0.95);
    });
  }

  // Dedicated Button: Mẫu 3:4 Dọc (Chuẩn Ảnh 2)
  const btnSample34 = document.getElementById('btn-sample-34');
  if (btnSample34) {
    btnSample34.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === '3:4'));
      document.querySelectorAll('.template-card').forEach(c => c.classList.toggle('active', c.dataset.template === 'timemark-standard'));
      state.template = 'timemark-standard';
      state.position = 'bottom-left';
      state.time = '16:46';
      state.date = '11 Aug 2026';
      state.dayOfWeek = 'Tues';
      state.address1 = 'Ngõ 167 Đ. Nguyễn Ngọc Vũ, Yên Hòa,';
      state.address2 = 'Hà Nội';
      state.logoTitle = 'Photo by';
      state.logoSubtitle = 'Timemark';
      state.vertCode = 'ELBET6CLUYAXEE';
      state.vertSuffix = 'Timemark Verified';
      state.scale = 100;
      state.margin = 4;
      state.barColor = '#f9c13a';

      const canvas = createDark34SampleCanvas();
      const img = new Image();
      img.onload = () => {
        state.currentImage = img;
        syncInputsFromState();
        updateCanvas();
      };
      img.src = canvas.toDataURL('image/jpeg', 0.95);
    });
  }
  
  // Download single image
  btnDownload.addEventListener('click', () => {
    if (!state.currentImage) return;

    updateCanvas();
    const link = document.createElement('a');
    const timeClean = state.time.replace(/:/g, '-');
    const dateClean = state.date.replace(/[\s,\/]/g, '_');
    link.download = `timemark_${dateClean}_${timeClean}.jpg`;
    link.href = mainCanvas.toDataURL('image/jpeg', 0.96);
    link.click();
  });

  // Copy to Clipboard (promisify toBlob để try/catch bắt được lỗi async thật sự)
  btnCopyClipboard.addEventListener('click', async () => {
    if (!state.currentImage) return;

    try {
      const blob = await new Promise((resolve, reject) => {
        mainCanvas.toBlob(b => (b ? resolve(b) : reject(new Error('Không tạo được ảnh PNG'))), 'image/png');
      });
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Trình duyệt không hỗ trợ Clipboard API');
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      btnCopyClipboard.innerHTML = '<i data-lucide="check" style="color:#10b981"></i>';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
      setTimeout(() => {
        btnCopyClipboard.innerHTML = '<i data-lucide="clipboard-copy"></i>';
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
      }, 2000);
    } catch (err) {
      alert('Không thể sao chép ảnh vào Clipboard: ' + (err.message || err));
    }
  });

  // Batch Download as ZIP
  btnDownloadZip.addEventListener('click', async () => {
    if (!state.batchImages || state.batchImages.length === 0) return;
    if (!window.JSZip) {
      alert('Đang tải thư viện nén ZIP, vui lòng thử lại sau 2 giây.');
      return;
    }

    const zip = new JSZip();
    const tempCanvas = document.createElement('canvas');

    btnDownloadZip.disabled = true;
    btnDownloadZip.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block"></div> Đang xử lý...';

    try {
      for (let i = 0; i < state.batchImages.length; i++) {
        const item = state.batchImages[i];
        WatermarkEngine.render(tempCanvas, item.img, state);

        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
        const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
        const originalName = item.name.replace(/\.[^/.]+$/, '');
        zip.file(`${originalName}_timemark.jpg`, base64Data, { base64: true });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `timemark_batch_${Date.now()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    } catch (err) {
      alert('Không thể tạo file ZIP: ' + (err.message || err));
    } finally {
      btnDownloadZip.disabled = false;
      btnDownloadZip.innerHTML = '<i data-lucide="archive"></i> Tải Tất Cả (ZIP)';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
  });

  // Reset to default sample
  btnResetText.addEventListener('click', () => {
    state.time = '16:15';
    state.date = '07 Tháng 8, 2026';
    state.dayOfWeek = 'Thứ Sáu';
    state.address1 = 'Sunrise B, KĐT The Manor Central Park,';
    state.address2 = 'Định Công, Hà Nội';
    state.logoTitle = 'Timemark';
        state.logoSubtitle = '100% Chân thực';
    state.vertCode = '149HXNC36GBETD';
    state.scale = 100;
    state.margin = 4;
    state.textColor = '#ffffff';
    state.barColor = '#f9c13a';
    state.shadow = 85;
    state.opacity = 100;
    syncInputsFromState();
    updateCanvas();
  });

  // --- 11. Camera Modal ---
  btnOpenCamera.addEventListener('click', async () => {
    cameraModal.classList.remove('hidden');
    await CameraController.startStream();
  });

  btnCloseCamera.addEventListener('click', () => {
    CameraController.stopStream();
    cameraModal.classList.add('hidden');
  });

  btnSwitchCamera.addEventListener('click', async () => {
    await CameraController.switchCamera();
  });

  btnCameraGps.addEventListener('click', async () => {
    try {
      const pos = await GeoService.getCurrentPosition();
      const addr = await GeoService.reverseGeocode(pos.latitude, pos.longitude);
      state.address1 = addr.line1;
      state.address2 = GeoService.formatCoordsString(pos.latitude, pos.longitude);
      syncInputsFromState();
    } catch (e) {
      alert('Không thể lấy GPS camera: ' + e.message);
    }
  });

  btnCapture.addEventListener('click', async () => {
    const capturedImg = CameraController.capture();
    if (!capturedImg) return;
    // img.decode() an toàn hơn onload: không bị lỡ sự kiện nếu ảnh đã giải mã xong
    try {
      if (capturedImg.decode) await capturedImg.decode();
    } catch (e) { /* vẫn tiếp tục với ảnh hiện có */ }
    state.currentImage = capturedImg;
    state.batchImages = [{ img: capturedImg, name: 'camera_capture.jpg' }];
    renderBatchThumbnails();
    updateCanvas();
    CameraController.stopStream();
    cameraModal.classList.add('hidden');
  });

  // Zoom Fit handler
  btnZoomFit.addEventListener('click', () => {
    mainCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Initial setup: Load sample image, sync state, and re-render when fonts are loaded
  syncInputsFromState();
  loadSampleImage();

  // BẮT BUỘC: chủ động nạp các font vẽ canvas (Big Shoulders Display, Roboto Condensed,
  // Roboto, PT Mono). Font Google chỉ tự tải khi DOM sử dụng — canvas KHÔNG kích hoạt
  // tải font, nên nếu thiếu bước này watermark sẽ rơi về font sans-serif mặc định.
  if (WatermarkEngine.preloadFonts) {
    WatermarkEngine.preloadFonts().then(() => updateCanvas()).catch(() => {});
  }

  if (document.fonts) {
    document.fonts.ready.then(() => {
      updateCanvas();
    });
  }
});
