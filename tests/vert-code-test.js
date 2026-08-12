/**
 * Test generator mã xác thực dọc (GeoService.generateSecurityCode)
 * Kiểm chứng OUTPUT khớp ĐỊNH DẠNG đo được từ 2 ảnh mẫu Timemark thật:
 *   - độ dài 14, chỉ chữ hoa A-Z + số 0-9
 *   - bảng chữ không nhầm lẫn: KHÔNG chứa 0, O, 1, I
 *   - luôn có >= 1 chữ số; tỷ lệ số trung bình ~18% (mẫu thật 5/28 = 17.9%)
 *   - vị trí ký tự KHÔNG cố định (không overfit theo 2 mẫu)
 *
 * Chạy: node tests/vert-code-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'geocoding.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const Geo = sandbox.GeoService || (sandbox.window && sandbox.window.GeoService);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`); };

check('GeoService.generateSecurityCode tồn tại', typeof Geo?.generateSecurityCode === 'function');

const N = 20000;
const codes = Array.from({ length: N }, () => Geo.generateSecurityCode());

// 1. Độ dài
check('mọi mã dài đúng 14', codes.every(c => c.length === 14));

// 2. Chỉ chữ hoa + số
check('chỉ gồm chữ hoa A-Z và số 0-9', codes.every(c => /^[A-Z0-9]+$/.test(c)));

// 3. Không chứa ký tự dễ nhầm 0/O/1/I
const withAmbiguous = codes.filter(c => /[0O1I]/.test(c));
check('không mã nào chứa 0/O/1/I', withAmbiguous.length === 0, withAmbiguous[0] ? 'VD lỗi: ' + withAmbiguous[0] : '');

// 4. Luôn có tối thiểu 1 chữ số
check('mọi mã có >= 1 chữ số', codes.every(c => /[0-9]/.test(c)));

// 5. Tỷ lệ số trung bình nằm quanh 18% (khoảng 12%-26%)
const totalDigits = codes.reduce((s, c) => s + (c.match(/[0-9]/g) || []).length, 0);
const digitRatio = totalDigits / (N * 14);
check('tỷ lệ số trung bình ~18%', digitRatio > 0.12 && digitRatio < 0.26, (digitRatio * 100).toFixed(1) + '%');

// 6. Không overfit: mỗi vị trí phải nhận nhiều giá trị khác nhau (>= 15 ký tự distinct)
let minDistinct = 99, worstPos = -1;
for (let pos = 0; pos < 14; pos++) {
  const distinct = new Set(codes.map(c => c[pos])).size;
  if (distinct < minDistinct) { minDistinct = distinct; worstPos = pos; }
}
check('không có vị trí bị "khoá" giá trị (đa dạng)', minDistinct >= 15, `vị trí ${worstPos} có ${minDistinct} giá trị khác nhau`);

// 7. Đa dạng tổng thể: gần như không trùng mã
const unique = new Set(codes).size;
check('mã gần như không trùng lặp', unique >= N * 0.999, `${unique}/${N} mã duy nhất`);

const failed = results.filter(r => !r.ok);
console.log(`\n===== VERT-CODE: ${results.length - failed.length}/${results.length} PASS =====`);
if (failed.length) { failed.forEach(f => console.log(' -', f.name, f.detail)); process.exit(1); }
