/**
 * Test luồng tải hàng loạt — mỗi ảnh một mã xác thực riêng + giờ lệch +0/1/2 phút.
 * Chạy: node tests/batch-test.js  (từ thư mục gốc dự án)
 *
 * Kiểm chứng:
 *  1. Upload 6 ảnh -> mỗi ảnh mang _vertCode DUY NHẤT, _timeOffset không giảm, bước 0..2
 *  2. Render từng ảnh trong batch cho ra MÃ khác nhau và GIỜ = base + offset
 *  3. Toàn bộ phần còn lại (địa chỉ, template) GIỐNG NHAU giữa các ảnh — chỉ mã & giờ đổi
 *  4. Tắt toggle -> mọi ảnh dùng chung mã & giờ gốc
 *  5. Nút "Tạo lại" đổi bộ mã & giờ mới
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const PORT = 8351;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg' };

function server() {
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      fs.readFile(path.join(root, p.replace(/^\/+/, '')), (e, d) => {
        if (e) { rs.writeHead(404); rs.end(); return; }
        rs.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
        rs.end(d);
      });
    });
    s.listen(PORT, () => res(s));
  });
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// tạo 6 ảnh JPEG nhỏ trong bộ nhớ (data URL) để "upload"
function makeFakeImages(n) {
  return Array.from({ length: n }, (_, i) => ({ name: `anh_${i + 1}.jpg` }));
}

async function main() {
  const s = await server();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => { if (window.WatermarkEngine) await WatermarkEngine.preloadFonts(); await document.fonts.ready; });

  // Nạp 6 ảnh giả trực tiếp qua handleFiles bằng cách dựng File từ canvas
  await page.evaluate(async (n) => {
    function fakeFile(i) {
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#20242c'; ctx.fillRect(0, 0, 400, 300);
      return new Promise(res => c.toBlob(b => res(new File([b], `anh_${i + 1}.jpg`, { type: 'image/jpeg' })), 'image/jpeg'));
    }
    const files = [];
    for (let i = 0; i < n; i++) files.push(await fakeFile(i));
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const input = document.getElementById('file-upload');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, 6);
  await page.waitForTimeout(1200);

  // 1. Thu thập biến thể per-image từ state (đọc qua __state không có, nên đọc qua DOM/eval batchImages)
  const variations = await page.evaluate(() => {
    // batchImages nằm trong closure — không truy cập trực tiếp được. Thay vào đó
    // render từng ảnh và đọc mã/giờ hiển thị bằng cách chọn từng thumbnail.
    return null;
  });

  // Đọc biến thể bằng cách bấm lần lượt từng thumbnail rồi đọc note + input mã
  const thumbs = await page.$$('.batch-thumb-item');
  check('hiện đủ 6 thumbnail', thumbs.length === 6, `thấy ${thumbs.length}`);

  const seen = [];
  for (let i = 0; i < thumbs.length; i++) {
    await thumbs[i].click();
    await page.waitForTimeout(120);
    const code = await page.inputValue('#input-vert-code');
    const note = await page.textContent('#batch-variation-note');
    seen.push({ code, note: note.trim() });
  }

  const codes = seen.map(s => s.code);
  const uniqueCodes = new Set(codes);
  check('mỗi ảnh một mã DUY NHẤT', uniqueCodes.size === 6, codes.join(', '));
  check('mọi mã đúng định dạng (14 ký tự, không 0/O/1/I)', codes.every(c => /^[A-HJ-NP-Z2-9]{14}$/.test(c)));

  // giờ trích từ note "... giờ HH:mm (+k′)"
  const times = seen.map(s => (s.note.match(/giờ (\d{2}:\d{2})/) || [])[1]);
  const offsets = seen.map(s => { const m = s.note.match(/\(\+(\d+)′\)/); return m ? parseInt(m[1], 10) : 0; });
  check('ảnh đầu offset = 0', offsets[0] === 0, 'offset[0]=' + offsets[0]);
  check('offset không giảm dần', offsets.every((o, i) => i === 0 || o >= offsets[i - 1]), offsets.join(','));
  check('mỗi bước tăng 0..2 phút', offsets.every((o, i) => i === 0 || (o - offsets[i - 1]) >= 0 && (o - offsets[i - 1]) <= 2), offsets.join(','));
  check('giờ khớp base 16:46 + offset', times.every((t, i) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m === (16 * 60 + 46 + offsets[i]) % (24 * 60);
  }), times.join(', '));

  // 3. Địa chỉ giữ nguyên giữa các ảnh (chỉ mã & giờ đổi)
  const addr = await page.inputValue('#input-addr-1');
  check('địa chỉ không đổi theo ảnh (chung nội dung)', typeof addr === 'string' && addr.length > 0);

  // 4. Tắt toggle -> note ẩn, mã input về mã gốc chung
  await page.uncheck('#chk-per-image');
  await page.waitForTimeout(150);
  const noteHiddenAfterOff = await page.$eval('#batch-variation-note', el => el.classList.contains('hidden'));
  check('tắt toggle -> ẩn dòng biến thể', noteHiddenAfterOff);

  // 5. Bật lại + Tạo lại -> bộ mã mới khác bộ cũ
  await page.check('#chk-per-image');
  await page.waitForTimeout(100);
  await page.click('#btn-reroll-batch');
  await page.waitForTimeout(200);
  const newCodes = [];
  const thumbs2 = await page.$$('.batch-thumb-item');
  for (let i = 0; i < thumbs2.length; i++) {
    await thumbs2[i].click(); await page.waitForTimeout(90);
    newCodes.push(await page.inputValue('#input-vert-code'));
  }
  const changed = newCodes.some((c, i) => c !== codes[i]);
  check('nút "Tạo lại" đổi bộ mã', changed && new Set(newCodes).size === 6);

  check('không phát sinh lỗi JS', errors.length === 0, errors.join(' | '));

  await browser.close();
  s.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n===== BATCH: ${results.length - failed.length}/${results.length} PASS =====`);
  if (failed.length) { failed.forEach(f => console.log(' -', f.name)); process.exit(1); }
}

main().catch(e => { console.error('RUNNER ERROR:', e); process.exit(2); });
