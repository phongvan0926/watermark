/**
 * Bộ test UI/UX tự động (Playwright) cho Timemark GPS Pro
 * Chạy: node tests/ui-test.js  (từ thư mục gốc dự án)
 *
 * Kiểm tra:
 *  1. App nạp không lỗi JS, canvas có mực sau khi font sẵn sàng
 *  2. MỌI nút ở đáy sidebar đều cuộn tới được và bấm được (nhiều kích thước màn hình)
 *  3. 12 template card + 4 nút tỷ lệ + 4 nút vị trí đều bấm được, không lỗi
 *  4. Accordion thu gọn/mở rộng + nav chip nhảy khối
 *  5. Tìm GPS theo địa chỉ (mock Nominatim): gõ -> Enter -> chọn kết quả -> input & canvas cập nhật
 *  6. Modal camera (thiết bị giả lập): nút chụp nằm trong màn hình, chụp xong đóng modal
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PORT = 8341;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p.replace(/^\/+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

const MOCK_NOMINATIM = [
  {
    lat: '21.014520', lon: '105.803360',
    display_name: 'Ngõ 167 Đ. Nguyễn Ngọc Vũ, Yên Hòa, Cầu Giấy, Hà Nội, Việt Nam',
    name: 'Ngõ 167',
    address: { road: 'Đ. Nguyễn Ngọc Vũ', suburb: 'Yên Hòa', city_district: 'Cầu Giấy', city: 'Hà Nội', country: 'Việt Nam' }
  },
  {
    lat: '10.774917', lon: '106.692420',
    display_name: 'Công viên Tao Đàn, Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
    name: 'Công viên Tao Đàn',
    address: { road: 'Trương Định', suburb: 'Bến Thành', city_district: 'Quận 1', city: 'Thành phố Hồ Chí Minh', country: 'Việt Nam' }
  }
];

async function setupPage(context, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  // Mock Nominatim để test không phụ thuộc mạng thật
  await page.route('**/nominatim.openstreetmap.org/search**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_NOMINATIM) });
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    if (window.WatermarkEngine && WatermarkEngine.preloadFonts) await WatermarkEngine.preloadFonts();
    if (document.fonts) await document.fonts.ready;
  });
  return { page, errors };
}

async function canvasInk(page) {
  return page.evaluate(() => {
    const cv = document.getElementById('main-canvas');
    if (!cv || !cv.width) return 0;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < cv.width * cv.height; i += 13) if (d[i * 4] > 150) n++;
    return n;
  });
}

// Kiểm tra 1 selector: cuộn tới được VÀ điểm giữa của nó thật sự bấm trúng (không bị che)
async function reachable(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, why: 'không tồn tại' };
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ok: false, why: 'kích thước 0' };
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
      return { ok: false, why: `ngoài màn hình sau scrollIntoView (top=${Math.round(r.top)})` };
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return { ok: false, why: 'elementFromPoint null' };
    if (el === hit || el.contains(hit) || hit.contains(el)) return { ok: true };
    return { ok: false, why: `bị che bởi <${hit.tagName.toLowerCase()} class="${hit.className}">` };
  }, selector);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const context = await browser.newContext({ permissions: ['camera'] });

  const VIEWPORTS = [
    { name: 'desktop 1366x768', w: 1366, h: 768 },
    { name: 'laptop thấp 1280x620', w: 1280, h: 620 },
    { name: 'tablet 1024x600', w: 1024, h: 600 },
    { name: 'mobile 390x844', w: 390, h: 844 }
  ];

  // Các nút "đáy sidebar" hay bị mất — phải bấm được ở MỌI kích thước
  const CRITICAL_CONTROLS = [
    '#range-opacity',
    '#range-shadow',
    '#color-bar',
    '.pos-btn[data-pos="bottom-right"]',
    '#btn-gen-code',
    '.template-card[data-template="work-report"]',
    '#btn-geo-search',
    '#input-geo-search'
  ];

  for (const vp of VIEWPORTS) {
    console.log(`\n▶ Viewport: ${vp.name}`);
    const { page, errors } = await setupPage(context, { width: vp.w, height: vp.h });

    check(`[${vp.name}] nạp trang không lỗi JS`, errors.length === 0, errors.join(' | '));
    check(`[${vp.name}] canvas có mực`, (await canvasInk(page)) > 30);

    for (const sel of CRITICAL_CONTROLS) {
      const r = await reachable(page, sel);
      check(`[${vp.name}] bấm được ${sel}`, r.ok, r.why || '');
    }

    await page.close();
  }

  // ===== Các test hành vi chạy ở viewport chuẩn =====
  console.log('\n▶ Hành vi (1366x768)');
  const { page, errors } = await setupPage(context, { width: 1366, height: 768 });

  // 12 template + 4 tỷ lệ + 4 vị trí
  const cards = await page.$$eval('.template-card', els => els.map(e => e.dataset.template));
  check('đủ 12 template card', cards.length === 12, `thấy ${cards.length}`);
  for (const tpl of cards) {
    await page.evaluate((t) => {
      const c = document.querySelector(`.template-card[data-template="${t}"]`);
      c.scrollIntoView({ block: 'center' }); c.click();
    }, tpl);
    await page.waitForTimeout(60);
  }
  for (const sel of ['.ratio-btn[data-ratio="3:4"]', '.ratio-btn[data-ratio="16:9"]', '.pos-btn[data-pos="top-right"]', '.pos-btn[data-pos="bottom-left"]']) {
    await page.evaluate((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'center' }); el.click(); }, sel);
    await page.waitForTimeout(80);
  }
  check('bấm hết 12 mẫu + tỷ lệ + vị trí không lỗi JS', errors.length === 0, errors.join(' | '));

  // Accordion + nav chip
  await page.evaluate(() => document.querySelector('#sec-style .collapsible-header').click());
  const collapsed = await page.$eval('#sec-style', el => el.classList.contains('collapsed'));
  check('accordion thu gọn được khối Kiểu dáng', collapsed);
  await page.evaluate(() => document.querySelector('.nav-chip[data-target="sec-style"]').click());
  await page.waitForTimeout(400);
  const expanded = await page.$eval('#sec-style', el => !el.classList.contains('collapsed'));
  check('nav chip mở lại khối + nhảy tới nơi', expanded);

  // Tìm GPS theo địa chỉ (mock)
  await page.evaluate(() => document.querySelector('.template-card[data-template="timemark-standard"]').click());
  await page.fill('#input-geo-search', '167 Nguyễn Ngọc Vũ, Cầu Giấy, Hà Nội');
  await page.press('#input-geo-search', 'Enter');
  await page.waitForSelector('.geo-result-item', { timeout: 5000 });
  const nResults = await page.$$eval('.geo-result-item', els => els.length);
  check('tìm GPS trả về danh sách kết quả', nResults === 2, `thấy ${nResults}`);
  await page.click('.geo-result-item');
  await page.waitForTimeout(300);
  const addr1 = await page.inputValue('#input-addr-1');
  const gps3 = await page.inputValue('#input-gps-line3');
  const customGps = await page.inputValue('#input-custom-gps');
  check('chọn kết quả -> điền địa chỉ dòng 1', addr1.includes('Nguyễn Ngọc Vũ'), addr1);
  check('chọn kết quả -> điền tỉnh/thành (GPS line 3)', gps3.includes('Hà Nội'), gps3);
  check('chọn kết quả -> điền toạ độ GPS', /21\.014520°N, 105\.803360°E/.test(customGps), customGps);
  check('sau khi điền canvas vẫn có mực', (await canvasInk(page)) > 30);
  const statusTxt = await page.textContent('#geo-search-status');
  check('hiện thông báo đã điền', statusTxt.includes('Đã điền'), statusTxt.trim());

  // Camera modal với thiết bị giả lập: nút chụp phải nằm trong màn hình
  await page.evaluate(() => document.getElementById('btn-open-camera').click());
  await page.waitForTimeout(1500);
  const capOk = await page.evaluate(() => {
    const b = document.getElementById('btn-capture');
    const r = b.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.width > 0;
  });
  check('modal camera: nút chụp nằm gọn trong màn hình', capOk);
  await page.evaluate(() => document.getElementById('btn-capture').click());
  await page.waitForTimeout(800);
  const modalHidden = await page.$eval('#camera-modal', el => el.classList.contains('hidden'));
  check('chụp ảnh xong modal tự đóng', modalHidden);
  check('không phát sinh lỗi JS trong toàn bộ phiên hành vi', errors.length === 0, errors.join(' | '));

  // Màn hình THẤP: modal camera vẫn phải gọn (lỗi cũ: nút chụp bị cắt)
  const { page: p2, errors: e2 } = await setupPage(context, { width: 1280, height: 560 });
  await p2.evaluate(() => document.getElementById('btn-open-camera').click());
  await p2.waitForTimeout(1500);
  const capOk2 = await p2.evaluate(() => {
    const b = document.getElementById('btn-capture');
    const r = b.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.width > 0;
  });
  check('[1280x560] nút chụp camera vẫn trong màn hình', capOk2, '');
  check('[1280x560] không lỗi JS', e2.length === 0, e2.join(' | '));
  await p2.close();

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n===== KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS =====`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach(f => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
}

main().catch(e => { console.error('TEST RUNNER ERROR:', e); process.exit(2); });
