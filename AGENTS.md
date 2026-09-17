# AGENTS.md — Hướng Dẫn & Tài Liệu Kỹ Thuật Cho Các Hệ Thống AI (Codex, Claude, ChatGPT, Cursor, Gemini...)

Tài liệu này chứa toàn bộ kiến trúc, nguyên lý hoạt động, cấu trúc mã nguồn, quy chuẩn thiết kế watermark và quy tắc bắt buộc để bất kỳ hệ thống AI nào (Codex, Claude, Cursor, Copilot...) có thể đọc hiểu toàn diện dự án và tiếp tục bảo trì, nâng cấp tính năng mà không phá vỡ logic hiện có.

---

## 1. Tổng Quan Dự Án (Project Overview)

- **Tên dự án:** Timemark & GPS Watermark Pro + LaMa Inpainting Studio
- **Kiến trúc tổng thể (Dual-Architecture):**
  1. **Ứng Dụng Chính (Root — Đóng Dấu):** Tái tạo chuẩn xác **100% tuyệt đối** phong cách đóng dấu ngày giờ, toạ độ GPS, mã bảo mật chống giả mạo của ứng dụng Android nổi tiếng **Timemark: Photo Proof for Work** (Mã gói: `com.oceangalaxy.camera.new` của Ocean Galaxy Pte. Ltd) và các ứng dụng GPS Map Camera. Chạy 100% Client-side Web Application (HTML5, Vanilla CSS, Vanilla JavaScript ES6+), Zero-Dependency không cần Node.js để chạy.
  2. **Ứng Dụng Bổ Trợ (`lama-cleaner/` — Xoá Dấu & Vật Thể):** Bộ công cụ AI xoá watermark và vật thể thừa, tái tạo nền ảnh nguyên bản bằng mạng nơ-ron học sâu **Big-LaMa (Resolution-robust Large Mask Inpainting with Fourier Convolutions)** từ repo `advimman/lama`. Có backend Python PyTorch/TorchScript và giao diện Web UI Canvas chuyên dụng.

---

## 2. Cấu Trúc Thư Mục & Vai Trò Từng File (Codebase Manifest)

```
c:\Users\Admin\Desktop\Water Mark\
├── index.html                  # Giao diện chính Timemark: Canvas xem trước, thanh tỷ lệ, 12 mẫu, Tìm GPS, camera modal
├── run_lama_ui.bat             # File thực thi 1-click mở nhanh LaMa Inpainting Studio từ thư mục gốc
├── css/
│   └── style.css               # Giao diện Dark Glassmorphism Timemark, CSS Tokens, accordion, nav chip, batch strip
├── js/
│   ├── exif-parser.js          # Bộ phân tích nhị phân JPEG EXIF (ngày chụp DateTimeOriginal, toạ độ GPS Lat/Lon), validate ngày
│   ├── geocoding.js            # Geolocation API, tra địa chỉ NGƯỢC + XUÔI với 2 nhà cung cấp dự phòng (Nominatim -> Photon), sinh mã, cộng giờ
│   ├── watermark-engine.js     # Lõi vẽ Canvas 2D, co giãn tỷ lệ động, 12 hàm vẽ mẫu, preloadFonts, anchorBlock 4 góc, logo 2 màu, mã xoay -90°
│   ├── camera.js               # Camera trực tiếp (MediaDevices), lật camera, live overlay loop, chống race bằng token thế hệ
│   └── app.js                  # State Controller Timemark, two-way binding, userEdited/applyPreset, biến thể per-image, tải ZIP, tìm GPS
├── lama-cleaner/               # [MÔ-ĐUN AI XOÁ DẤU & VẬT THỂ — TÁI TẠO NỀN ẢNH BẰNG LAMA]
│   ├── webui/                  # Giao diện Web UI Studio (index.html, style.css, app.js)
│   ├── models/                 # Trọng số Big-LaMa (big-lama.pt ~205MB, tự động tải nếu thiếu, đưa vào .gitignore)
│   ├── engine.py               # Lõi AI inpainting (padding reflect bội số 8, mask dilation, lossless alpha composite)
│   ├── server.py               # Máy chủ HTTP đa luồng (API /api/inpaint, /api/status, /api/sample)
│   ├── run.bat                 # Khởi động 1-click nội bộ của thư mục lama-cleaner
│   ├── requirements.txt        # Danh sách thư viện Python cần thiết
│   ├── tests/                  # Bộ kiểm thử tự động (self_test.py)
│   ├── lama-repo/              # Mã nguồn upstream advimman/lama (đã loại bỏ .git để tránh conflict submodule)
│   └── README.md               # Tài liệu hướng dẫn riêng cho LaMa Studio
├── tests/                      # Bộ test Playwright cho app chính Timemark (package.json RIÊNG — app chính vẫn Zero-Dependency)
│   ├── ui-test.js              # 67 kiểm thử: reachability, 12 mẫu × 4 vị trí, accordion, geocode + fallback, giữ dữ liệu, camera
│   ├── batch-test.js           # 11 kiểm thử: mỗi ảnh mã duy nhất + giờ cộng dồn 0–2 phút
│   └── vert-code-test.js       #  8 kiểm thử: định dạng mã xác thực trên 20.000 mẫu sinh ra
├── assets/                     # Ảnh chụp màn hình dùng trong README
├── .github/workflows/
│   └── deploy-pages.yml        # Tự động deploy GitHub Pages mỗi lần push lên main
├── README.md                   # Tài liệu cho người dùng cuối (tính năng, cách dùng, kiểm thử)
└── AGENTS.md                   # Tài liệu này (Dành cho các AI Agents đọc và cập nhật)
```

**Liên kết ngoài:** Repo https://github.com/phongvan0926/watermark · Trang dùng trực tiếp https://phongvan0926.github.io/watermark/

---

## 3. Quy Chuẩn Kỹ Thuật Vẽ Watermark (Rendering & Math Rules)

### 3.1. Thuật Toán Co Giãn Tỷ Lệ Động (Dynamic Resolution Scaling)
Ảnh tải lên từ điện thoại có thể có độ phân giải từ 720p, 1080p, 4K đến 12MP (4000x3000px). Thuật toán scale bắt buộc:
$$\text{scale} = \left(\frac{\min(\text{Width}, \text{Height})}{1000}\right) \times \left(\frac{\text{userScale}}{100}\right)$$
Tất cả kích thước font chữ, khoảng cách dòng, độ dày nét vẽ, lề phải được nhân với `scale` để tỷ lệ đóng dấu luôn đồng nhất trên mọi kích thước ảnh.

### 3.2. Hệ Toạ Độ Đơn Vị Scale (Unit-Based Layout — thay thế công thức margin theo % W/H cũ)
Từ v1.4.0, mẫu `timemark-standard` dùng **hệ đơn vị scale thống nhất** `u = min(Width, Height) / 1000 * (userScale/100)`, đo trực tiếp từ 2 ảnh mẫu thực (min-dim 1920px). **Không còn phân nhánh Ngang/Dọc** — layout hai hướng giống hệt nhau theo đơn vị `u` (đã kiểm chứng: cả 2 ảnh mẫu cho cùng bộ số):

| Thông số | Giá trị (× u) |
| :--- | :--- |
| Mép mực trái đồng hồ (ink-left) | `24.5 * marginFactor` |
| Lề dưới → baseline dòng địa chỉ cuối | `30.7 * marginFactor` |
| Cỡ font đồng hồ (Big Shoulders Display 600) | `119.4` + letter-spacing `0.0131em` |
| Baseline Ngày = baseline Đồng hồ − | `67.8` |
| Baseline Thứ = baseline Đồng hồ + | `4` |
| Cỡ font Ngày/Thứ | `36.6` |
| Vạch vàng: cách mép mực phải đồng hồ / rộng | `32.3` / `4.2` |
| Vạch vàng: từ đỉnh chữ số → baseline đồng hồ + | `4.7` |
| Ngày/Thứ cách vạch | `15` |
| Cỡ font địa chỉ / giãn dòng | `39` / `46` |
| Baseline địa chỉ dòng 1 = baseline Đồng hồ + | `69.3`; mép mực thụt `6.3` so với đồng hồ |
| Logo: mép mực phải cách phải / baseline "Timemark" cách đáy | `17.2` / `22.6` |
| Logo: "Photo by" (22u) baseline cao hơn "Timemark" (34u) | `38.5` |
| Mã dọc: baseline cách mép phải / cỡ mã / cỡ suffix | `10.4` / `24.4` / `24` |

`marginFactor = state.margin / 4` (slider mặc định 4 → hệ số 1.0). Việc căn mép mực (ink-edge) dùng helper `fillTextInkLeft` (bù `actualBoundingBoxLeft`) để triệt tiêu sai lệch side-bearing giữa các font.

### 3.3. Typography & Bảng Màu Chuẩn (kiểm chứng bằng đo IoU pixel trên ảnh mẫu gốc)
- **Số Đồng Hồ:** `Big Shoulders Display` **weight 600** + letter-spacing `0.0131em` (IoU 0.839 với ảnh mẫu — vượt xa Bebas/Oswald/Anton). Fallback: `Anton`, `Oswald`, `Arial Narrow`.
- **Ngày / Thứ / Địa Chỉ:** `Roboto Condensed` 400 (IoU thắng mọi ứng viên trên cả 4 chuỗi thử). Fallback: `Roboto`, `Arial Narrow`.
- **Logo "Timemark":** `Roboto` 500 (IoU 0.826); "Photo by": `Roboto` 400.
- **Mã Bảo Mật dọc:** `PT Mono` 400 (IoU 0.626, bỏ xa Roboto Mono 0.496); suffix "Timemark Verified" dùng `Roboto Condensed` 400.
- **Nạp font bắt buộc:** gọi `WatermarkEngine.preloadFonts()` (document.fonts.load) trước lần vẽ đầu — canvas KHÔNG tự kích hoạt tải font Google.
- **Màu Sắc (đo top-decile pixel từ ảnh mẫu):**
  - Chữ chính: `#ffffff` (kèm bóng đổ `rgba(0,0,0,0.85)` blur 4px chống chìm nền).
  - Vạch đứng: vàng kim `#f9c13a` (mặc định mới — thay `#f59e0b`).
  - Logo 2 tông màu: "Time" vàng chanh `#faf04e` + "mark" trắng `#ffffff`.
  - Mã xác thực dọc: `#ececec`.
  - Huy hiệu (Badges): Điểm danh (`#f9c13a` & `#1e3a8a`), Bảo vệ (`#1e3a8a`), Đã hoàn thành (`#16a34a`), Nhật ký (`#d97706`), Kỹ thuật (`#2563eb`).

### 3.4. Vị Trí Vạch Ngăn Cách & Các Thành Phần
- **Vạch ngăn cách dọc (`|`):** Bên phải số giờ, cách mép mực phải của chữ số `32.3u`, rộng `4.2u`. Chiều cao ôm từ **đỉnh chữ số đồng hồ** xuống `baseline + 4.7u` (KHÔNG phải ôm khối Ngày/Thứ như mô tả cũ — đã đo lại từ ảnh mẫu).
- **Khối địa chỉ:** Dưới đồng hồ, mép mực trái thụt `6.3u` so với mép mực chữ số.
- **Logo góc phải dưới:** "Photo by" (xám nhạt `#e8e8e8`) trên, "Timemark" 2 tông màu dưới; mép mực phải cách mép ảnh `17.2u`, baseline cách đáy `22.6u`.
- **Mã xác thực mép phải:** Xoay `-90°`; **ĐOẠN MÃ 14 ký tự canh giữa đúng tại `Height/2`** (không canh cả chuỗi — đã đo từ ảnh mẫu); icon `©` nằm trước (phía dưới) cách `11u`, suffix nằm sau (phía trên) cách `18u`; baseline cách mép phải `10.4u` (đồng nhất 2 hướng).

---

## 4. Danh Sách Các Mẫu Watermark (Template Suite)

| ID Mẫu | Tên Mẫu | Hàm vẽ trong `watermark-engine.js` | Đặc điểm chính |
| :--- | :--- | :--- | :--- |
| `timemark-standard` | **1. Thời gian & Vị trí** | `drawTimemarkStandard` | Giờ lớn + Vạch vàng + Ngày tháng tiếng Anh/Việt + Thứ + 1-2 dòng địa chỉ + Logo góc phải + Mã dọc mép phải |
| `timemark-custom` | **2. Tùy Chỉnh (Mẫu 3)** | `drawTimemarkCustom` | Tiêu đề lớn in đậm + Vạch vàng bên trái ôm 3 dòng: Ngày giờ, Địa điểm, Toạ độ GPS |
| `timemark-attendance` | **3. Điểm Danh** | `drawTimemarkAttendance` | Badge vàng `[Điểm danh]` + Khung giờ xanh `23:40` + Vạch vàng + Ngày & Địa điểm |
| `timemark-service` | **4. Dịch Vụ** | `drawTimemarkService` | Tên dịch vụ + Ngày giờ + `👉 Chi tiết dịch vụ` + `☎ Hotline` |
| `timemark-security` | **5. Bảo Vệ** | `drawTimemarkSecurity` | Badge khiên `🛡️ BẢO VỆ` + Giờ tuần tra + Vị trí chốt |
| `timemark-technical` | **6. Hồ Sơ Kỹ Thuật** | `drawTimemarkTechnical` | Banner xanh `HỒ SƠ KỸ THUẬT` + Hạng mục nghiệm thu + Thời gian |
| `timemark-completed` | **7. Đã Hoàn Thành** | `drawTimemarkCompleted` | Giờ + Badge tích xanh `[✅]` + Vạch vàng + Ngày & Địa điểm |
| `timemark-worklog` | **8. Nhật Ký Công Việc** | `drawTimemarkWorklog` | Header cam `Nhật ký công việc` + Nội dung + Địa điểm + Thời gian |
| `timemark-weather-gps`| **9. GPS & Thời Tiết** | `drawTimemarkWeatherGPS` | Địa điểm + Toạ độ GPS + La bàn `🧭 SE 125°` + Thời tiết `☀️ 28°C` + Độ cao |
| `timemark-gps` | **10. Timemark + Toạ Độ** | `drawTimemarkGPS` | Định dạng ngày `08/07/2026` + Toạ độ `20.970515°N ±16ft` + Phụ đề `Máy ảnh` |
| `gps-multiline` | **11. GPS Camera Đa Dòng** | `drawGPSMultiline` | 5 dòng phân cấp địa chỉ góc trên phải hoặc các góc tuỳ chọn |

---

## 5. Quy Tắc Bắt Buộc Khi Sửa Đổi Code (Rules For AI Agents)

1. **Khả năng tương thích trình duyệt (Browser-safe):**
   - Không được dùng `require()` hay module bundler; mã chạy trực tiếp bằng thẻ `<script>`.
   - Mỗi file trong thư mục `js/` phải xuất đối tượng ra cả `window` và `globalThis`, ví dụ:
     ```javascript
     if (typeof window !== 'undefined') window.MyModule = MyModule;
     if (typeof globalThis !== 'undefined') globalThis.MyModule = MyModule;
     ```
2. **Kiểm tra phần tử DOM tồn tại trước khi truy cập:**
   - Luôn kiểm tra `if (element) { ... }` hoặc dùng `if (boxElement) boxElement.classList.toggle(...)` để tránh lỗi `TypeError: Cannot read properties of null` làm ngắt tiến trình `DOMContentLoaded`.
3. **Gọi icon an toàn:**
   - Dùng `if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();` thay vì gọi trần `lucide.createIcons()`.
4. **Kiểm tra cú pháp & chạy test sau khi sửa:**
   - Chạy `node --check` cho từng file trong `js/` để đảm bảo 0 lỗi cú pháp.
   - Chạy bộ test Playwright trước khi bàn giao (từ thư mục gốc):
     ```bash
     node tests/ui-test.js && node tests/batch-test.js && node tests/vert-code-test.js
     ```
     Hiện trạng chuẩn: **86/86 PASS** (67 + 11 + 8). Nếu thêm tính năng, phải bổ sung test tương ứng.
5. **QUY TRÌNH BẮT BUỘC SAU MỖI LẦN HOÀN THÀNH CÔNG VIỆC** (yêu cầu trực tiếp của chủ dự án):
   - **a. Cập nhật tài liệu:** thêm mô tả tính năng vào `README.md` (góc nhìn người dùng cuối) và thêm mục vào **Nhật Ký Thay Đổi (Changelog)** cuối file `AGENTS.md` (góc nhìn kỹ thuật) — kèm cập nhật các mục 2/3/4 nếu cấu trúc, công thức hay danh sách mẫu thay đổi.
   - **b. Commit** với message tiếng Việt mô tả rõ thay đổi.
   - **c. Push** lên `origin main` để local và GitHub luôn đồng bộ; GitHub Pages sẽ tự deploy sau ~1 phút.
   - Không chờ người dùng nhắc — đây là bước kết thúc mặc định của mọi tác vụ có thay đổi mã nguồn.

## 6. Kiến Trúc & Quy Chuẩn LaMa Inpainting Studio (`lama-cleaner/`)

Mô-đun `lama-cleaner/` là ứng dụng AI bổ trợ chuyên dùng để xoá watermark (ngày giờ, toạ độ GPS, logo) và vật thể thừa, tái tạo lại nền ảnh nguyên bản bằng mạng nơ-ron học sâu **Big-LaMa (Resolution-robust Large Mask Inpainting with Fourier Convolutions)** từ repo `advimman/lama`.

### 6.1. Nguyên Lý Mô Hình & Xử Lý Tensor (`engine.py`)
1. **Kiến trúc mạng:** Big-LaMa sử dụng các khối tích chập Fourier nhanh (Fast Fourier Convolutions - FFC) với trường tiếp nhận toàn cục (global receptive field), cho phép phục hồi cấu trúc định kỳ và chi tiết lớn ở độ phân giải cao vượt trội so với CNN thông thường.
2. **Quy tắc Padding Bội Số 8:**
   - Đầu vào của mạng yêu cầu chiều rộng và chiều cao phải chia hết cho 8.
   - Hàm `_pad_img_to_modulo(img, mod=8)` thực hiện đệm biên phía dưới và bên phải theo chế độ phản xạ đối xứng (`mode='reflect'`) để tránh sinh viền giả ở mép ảnh. Sau khi inpainting, ảnh đầu ra được crop trả về đúng kích thước gốc `(orig_h, orig_w)`.
3. **Quy tắc Bắt Mask Nhạy Cảm & Dilation Triệt Để:**
   - Ngưỡng nhị phân hoá mask: `mask_binary = (mask_np > 10).astype(np.float32)`. Tuyệt đối không dùng ngưỡng cao `> 127` vì sẽ bỏ sót các nét cọ mờ và phần đổ bóng (drop shadow) mờ ở viền chữ watermark.
   - Mở rộng viền (Dilation): Áp dụng `cv2.dilate` với kernel ellipse `cv2.MORPH_ELLIPSE` kích thước `(dilate_radius * 2 + 1)` (mặc định 4px) để ôm trùm hoàn toàn phần viền khử răng cưa (anti-aliasing) của watermark.
4. **Quy chuẩn Ghép Ảnh Bảo Toàn Nền Gốc (Lossless Alpha Composite):**
   - Mạng nơ-ron sinh ra toàn bộ bức ảnh, nhưng để bảo toàn **100% độ sắc nét nguyên bản tuyệt đối** của các vùng không bị xoá, `engine.py` thực hiện ghép ảnh:
     $$\text{mask\_feather} = \text{GaussianBlur}(\text{mask\_binary}, (3, 3))$$
     $$\text{final} = \text{orig\_img} \times (1.0 - \text{mask\_feather}) + \text{output} \times \text{mask\_feather}$$
   - Nhờ đó, 90%+ diện tích ảnh không bị watermark tác động sẽ giữ nguyên bit-exact từng pixel, hoàn toàn không bị suy giảm chất lượng.

### 6.2. Máy Chủ HTTP & Giao Tiếp API (`server.py`)
- Sử dụng `ThreadingHTTPServer` đa luồng, độc lập, không yêu cầu framework nặng.
- **An toàn mã hoá console Windows:** Luôn cấu hình `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` để tránh lỗi `UnicodeEncodeError` khi in emoji hoặc chuỗi Unicode trên Windows Console (`cp1252`).
- **Danh sách Endpoint:**
  - `GET /`: Phục vụ giao diện Web UI Studio từ thư mục `webui/`.
  - `GET /api/status`: Trả về trạng thái mô hình (`ready`), tên mô hình (`Big-LaMa`), và thiết bị thực thi (`cpu` hoặc `cuda`).
  - `GET /api/sample`: Trả về ảnh mẫu JPEG chất lượng cao có sẵn watermark để người dùng thử nghiệm 1-click.
  - `POST /api/inpaint`: Nhận JSON payload `{ image: "<b64>", mask: "<b64>", dilate: 4 }`, thực thi inpainting và trả về `{ success: true, result: "<b64>", elapsed_sec: ... }`.

### 6.3. Giao Diện Canvas Web UI (`webui/`)
- Thiết kế Dark Glassmorphism đồng bộ với ứng dụng chính.
- **Tính toán toạ độ con trỏ cọ vẽ:** Tỷ lệ `scaleX = canvas.width / rect.width`, `scaleY = canvas.height / rect.height`. Vòng tròn preview cọ vẽ (`cursorBrush`) nằm ngay trong `canvasWrapper` với toạ độ pixel thực, tự động co giãn chính xác 100% ở mọi mức zoom.
- **1-Click Watermark Presets:** Cung cấp 4 nút chọn nhanh các vùng watermark thường gặp:
  - *Góc Dưới Trái:* bao phủ $0 \to 58\%$ chiều rộng, $65\% \to 100\%$ chiều cao (vị trí kinh điển của Timemark, Shot on, GPS Pro).
  - *Góc Dưới Phải:* bao phủ $52\% \to 100\%$ chiều rộng, $70\% \to 100\%$ chiều cao (dấu ngày giờ, logo hãng).
  - *Cả Dòng Đáy:* bao phủ $0 \to 100\%$ chiều rộng, $72\% \to 100\%$ chiều cao.
  - *Góc Trên Phải:* bao phủ $58\% \to 100\%$ chiều rộng, $0 \to 25\%$ chiều cao.
- **So sánh Before / After (Split Slider):** Căn chỉnh pixel tuyệt đối giữa ảnh trước và sau, không bị lệch hoặc méo hình khi kéo thanh trượt. Nút `[👁️ Giữ để xem ảnh gốc]` cho phép bấm giữ để so sánh tức thì.

### 6.4. Quy Tắc An Toàn Git Cho Trọng Số AI (Model Weights Git Safety)
- File trọng số `big-lama.pt` nặng ~205MB. **GitHub có giới hạn cứng 100MB cho mỗi file** — nếu commit file này vào Git sẽ bị GitHub từ chối push (`remote: error: GH001: Large files detected`).
- **Quy tắc bắt buộc:**
  1. Phải luôn khai báo `*.pt`, `*.onnx`, `models/`, `lama-cleaner/models/*.pt` trong `.gitignore`.
  2. `engine.py` đã tích hợp sẵn phương thức `_ensure_model_exists()`, tự động tải mô hình từ release GitHub uy tín nếu trên máy chưa có. Người dùng hoặc AI clone repo về máy mới chỉ cần chạy `run.bat` là hệ thống sẽ tự tải trọng số về chạy mà không cần lưu binary vào kho mã nguồn.

### 6.5. Hướng Dẫn Vận Hành & Kiểm Thử Cho AI Agents
- Khởi động server từ thư mục con: `cd lama-cleaner && python server.py`.
- Khởi động nhanh từ thư mục gốc: chạy file `run_lama_ui.bat`.
- Chạy kiểm thử tự động toàn diện:
  ```bash
  python lama-cleaner/tests/self_test.py
  ```
  Script sẽ tự động kiểm tra cả 2 tầng: (1) Inference trực tiếp từ Python Engine, (2) Inference gián tiếp qua HTTP Server API.

---

## 7. Nhật Ký Thay Đổi (Changelog)

- **v1.0.0 (Ban đầu):**
  - Xây dựng kiến trúc nền tảng Web App, Canvas Watermark Engine, bộ đọc JPEG EXIF nhị phân, bộ giải mã toạ độ Việt Nam (Nominatim), Camera trực tiếp.
- **v1.1.0 (Bộ Mẫu Chuẩn Catalog Timemark):**
  - Tích hợp trọn bộ 10+ mẫu watermark theo đúng catalog app Timemark (`com.oceangalaxy.camera.new`).
  - Hỗ trợ sửa text 100% cho mọi trường: Dịch vụ, Bảo vệ, Kỹ thuật, Nhật ký, La bàn, Thời tiết...
- **v1.2.0 (Hiệu Chuẩn Pixel Tuyệt Đối 4:3 & 3:4):**
  - Hiệu chỉnh vị trí hiển thị pixel-perfect theo 2 ảnh chụp thực tế từ điện thoại (Ảnh ngang 4:3 và Ảnh dọc 3:4).
  - Bổ sung bộ chuyển tỷ lệ `4:3`, `3:4`, `16:9`, `9:16` và 2 nút nạp nhanh ảnh mẫu chuẩn `[📸 Mẫu 4:3 Ngang]` & `[📸 Mẫu 3:4 Dọc]`.
  - Hỗ trợ định dạng `Photo by Timemark` và ngày tiếng Anh `11 Aug 2026 | Tues`.
  - Sửa triệt để các lỗi DOM null references & cú pháp đóng ngoặc, vượt qua 100% bài test mô phỏng trình duyệt.
- **v1.3.0 (Tài Liệu Hoá Toàn Diện Cho AI):**
  - Khởi tạo file `AGENTS.md` với đầy đủ kiến trúc, công thức toán học, danh mục mẫu và hướng dẫn tương tác cho các hệ thống AI.
- **v1.4.0 (Nhận Diện Font Chuẩn 100% Bằng Đo Pixel + Hiệu Chuẩn Lại Toàn Bộ Layout):**
  - **Xác định đúng bộ font Timemark bằng phương pháp định lượng** (chấm điểm IoU chồng khít nét chữ giữa từng font ứng viên và 2 ảnh mẫu gốc, xét 20+ ứng viên): Đồng hồ = `Big Shoulders Display 600` + letter-spacing `0.0131em` (IoU 0.839); Ngày/Thứ/Địa chỉ = `Roboto Condensed 400`; Logo = `Roboto 500/400`; Mã dọc = `PT Mono 400`; suffix = `Roboto Condensed 400`. Cập nhật link Google Fonts trong `index.html` (bỏ Bebas Neue/Space Grotesk cũ).
  - **Sửa tận gốc lỗi font không hiển thị:** thêm `WatermarkEngine.preloadFonts()` dùng `document.fonts.load()` cho mọi font canvas — trước đây font chỉ khai báo trong `<link>` nhưng DOM không dùng nên trình duyệt không bao giờ tải, canvas luôn rơi về sans-serif mặc định. `app.js` gọi preload rồi re-render khi xong.
  - **Hiệu chuẩn lại toàn bộ layout `timemark-standard` theo hệ đơn vị scale thống nhất** (mục 3.2 mới): đo trực tiếp từng thành phần trên 2 ảnh mẫu; phát hiện & sửa: đồng hồ vẽ nhỏ hơn thật ~35% (76u → 119.4u), vạch vàng ôm chiều cao chữ số (không phải khối ngày), mã dọc canh giữa theo ĐOẠN MÃ tại H/2, baseline ngày tính sai do phần thòng chữ "g". Kết quả kiểm chứng tự động: vạch vàng trùng pixel tuyệt đối, mọi thành phần lệch ≤1px, IoU toàn ảnh 0.66/0.75-max trên cả 4:3 và 3:4.
  - **Logo "Timemark" 2 tông màu chuẩn app:** "Time" vàng chanh `#faf04e` + "mark" trắng; "Photo by" xám nhạt; màu vạch mặc định đổi thành `#f9c13a` (đo từ ảnh thật).
  - **Sửa lỗi ổn định & dọn mã:** khối `sidebar-card` lồng trùng trong `index.html`; key `daysOfWeekVi` khai báo trùng trong `geocoding.js`; mã mẫu sai ký tự (`XL7ME…`→`XLTME…`, `EL8ET…`→`ELBET…`); nạp ảnh hỏng không còn treo overlay loading; nút tải ZIP có try/finally không bị kẹt disabled; chụp camera dùng `img.decode()` tránh race mất sự kiện onload; nút Mẫu 4:3/3:4 tự reset về vị trí góc dưới trái; thu hồi URL blob sau khi tải ZIP.
- **v1.4.1 (Review Đa Agent 5 Chiều — 36 lỗi được xác minh đối chứng & sửa toàn bộ):**
  - **Mẫu 12 "Báo Cáo Hiện Trường" (`work-report`) chính thức dùng được:** thêm template-card vào `index.html`, nối 2 chiều 3 input (dự án/cán bộ/ghi chú), hiện box `#box-work-controls` khi chọn mẫu.
  - **Engine — 7 mẫu (Dịch vụ, Bảo vệ, Kỹ thuật, Hoàn thành, Nhật ký, Thời tiết, Báo cáo) giờ tôn trọng `state.position` đủ 4 góc** qua helper mới `anchorBlock()`; các mẫu neo phải bỏ hằng số bề rộng cứng, đo `measureText` thật (hết tràn mép với chữ dài); card Kỹ thuật/Nhật ký/Thời tiết/Báo cáo tự giãn theo nội dung; mẫu Tùy Chỉnh hết đè tiêu đề lên vạch vàng; `shadow=0` thật sự tắt bóng ở mọi mẫu (bỏ `|| 85`); sửa `10:44:40:40` ở mẫu GPS đa dòng; xoá trống phụ đề logo không còn tự vẽ lại "Timemark"; kẹp neo phải khi địa chỉ dài hơn ảnh; mã dọc tự dịch xuống khi suffix dài/scale lớn để không tràn mép trên.
  - **app.js:** mọi preset mẫu set kèm `logoTitle='Timemark'` (hết cặp brand sai "Photo by/100% Chân thực"); copy Clipboard promisify `toBlob` để bắt được lỗi async (hết nuốt lỗi im lặng); `handleFiles` chống re-entrancy bằng token + try/finally (hết trộn batch, hết kẹt overlay); toạ độ EXIF 0° (xích đạo/kinh tuyến gốc) không còn bị bỏ qua; tên file tải về thay hết mọi dấu `:`; nút "Lấy Giờ Hiện Tại" tôn trọng chip định dạng ngày đang chọn; 2 nút Mẫu 4:3/3:4 đồng bộ highlight template-card.
  - **camera.js:** chống race `startStream` bằng token thế hệ (hết rò rỉ MediaStream/camera sáng đèn vĩnh viễn), catch tự `stopStream`, `switchCamera` rollback camera cũ khi camera mới lỗi; overlay live thêm `object-fit: cover` khớp khung video (hết méo 16:9 trong khung 4:3).
  - **geocoding.js:** fetch Nominatim có AbortController timeout 8s; bắt body `{"error"}` HTTP 200; so sánh "Thành phố/Tỉnh" không phân biệt hoa thường (hết "Thành Phố Thành phố Thủ Đức"); độ chính xác GPS quy đổi đúng mét→feet (×3.28084); fallback không còn bịa "Hà Nội".
  - **exif-parser.js:** validate chuỗi DateTime (chặn `0000:00:00` → 30/11/1899 và chuỗi rác → "NaN Tháng NaN").
  - **CSS/HTML:** bổ sung class preview thiếu (`.tm-attend-body`, `.tm-comp-body`, `.gps-multi`, `.gps-line`, card Báo cáo); header & preview toolbar wrap được ở màn hình hẹp (hết cắt mất nút "Tải Ảnh Về"); badge độ phân giải hiển thị lại nhãn tỷ lệ "(4:3)".
  - **Kiểm chứng hồi quy tự động sau khi sửa:** IoU pixel với 2 ảnh mẫu giữ nguyên 0.660/0.658; 48 tổ hợp (12 mẫu × 4 vị trí) vẽ thành công, 0 lỗi console; `node --check` sạch trên cả 5 file JS.
- **v1.5.0 (Đại Tu UI/UX + Tìm GPS Theo Địa Chỉ + Bộ Test Playwright):**
  - **Sửa tận gốc lỗi không cuộn tới được các nút phía dưới sidebar:** thêm `min-height: 0` cho `.app-main`/`.editor-sidebar` (điều kiện bắt buộc để overflow của con flex hoạt động), `flex-shrink: 0` cho từng card, đệm đáy 72px, thanh cuộn dày 10px dễ nhận biết, `overscroll-behavior: contain`.
  - **Modal camera hết mất nút chụp trên màn hình thấp:** `max-height: 94vh` + viewfinder co giãn (`flex:1; min-height:0`) + backdrop cuộn được.
  - **UI mới dễ dùng:** thanh điều hướng nhanh dính trên đầu sidebar (📍 Tìm GPS / 🖼 Mẫu / ✏️ Nội dung / 🎨 Kiểu dáng — bấm nhảy thẳng tới khối, tự mở nếu đang gọn); mọi khối sidebar thu gọn/mở rộng được (accordion, bấm header, chevron xoay); các section có id `sec-geosearch`/`sec-templates`/`sec-content`/`sec-style` + `scroll-margin-top` khỏi bị thanh sticky che.
  - **Tính năng mới — Tìm GPS theo địa chỉ (forward geocoding):** gõ địa chỉ bất kỳ → `GeoService.forwardGeocode()` (Nominatim `/search`, addressdetails, limit 5, timeout 8s AbortController) → hiện tối đa 5 kết quả kèm toạ độ → bấm chọn là tự điền: địa chỉ dòng 1/2, toạ độ GPS (`customGps`), phân cấp tỉnh/phường/quốc gia (`gpsLine3-5`), vị trí chốt bảo vệ; mẫu `timemark-gps` tự điền chuỗi `Tọa độ: …±ft`. Hỗ trợ Enter để tìm, trạng thái đang tìm/không thấy/lỗi rõ ràng.
  - **Bộ test Playwright** (`tests/ui-test.js`, chạy `node tests/ui-test.js`): 55 kiểm thử — độ với tới của mọi nút đáy sidebar trên 4 kích thước màn hình (1366×768, 1280×620, 1024×600, 390×844), bấm 12 mẫu + tỷ lệ + vị trí không lỗi, accordion/nav chip, trọn luồng tìm GPS (mock Nominatim), camera giả lập chụp ảnh thật (nút chụp trong khung nhìn cả ở 1280×560). Kết quả: **55/55 PASS**. Đã xác minh thêm 1 lệnh gọi Nominatim thật đúng hợp đồng API. Thư mục `tests/` có `package.json` riêng — app chính vẫn Zero-Dependency.
- **v1.5.1 (Mã Xác Thực Dọc — Khớp Định Dạng Bề Mặt + Ô Tự Nhập):**
  - **Lưu ý bản chất:** mã dọc là con tem TRANG TRÍ khớp định dạng, KHÔNG phải token do máy chủ Timemark cấp và KHÔNG tra cứu "Verified" được trên hệ thống thật (token thật là ID ngẫu nhiên do server phát/hoặc mã hoá metadata — không thể suy ra từ ảnh). App chủ ý KHÔNG mạo nhận mã thật.
  - **Phân tích định lượng 2 mã mẫu thật** (`XLTME4223GLDTC`, `ELBET6CLUYAXEE`): 28/28 ký tự đều tránh 0/O/1/I (xác suất trùng ngẫu nhiên chỉ 3.7% → là **bảng chữ không nhầm lẫn** thật), độ dài 14, chữ hoa + số, tỷ lệ số ~18%, luôn có ≥1 chữ số.
  - **`generateSecurityCode` sinh mã khớp đúng các quy luật trên**: bảng `A-Z` bỏ `I,O` + `0-9` bỏ `0,1`; ~18% số; đảm bảo ≥1 số; vị trí ký tự phân bố ĐỀU (KHÔNG hard-code theo 2 mẫu để tránh overfit).
  - **Ô tự nhập mã hoàn thiện** (`#input-vert-code`): tự viết hoa + lọc chỉ giữ chữ/số khi gõ (giữ đúng vị trí con trỏ), `maxlength=20`, có dòng gợi ý làm rõ đây là tem trang trí. Cho phép người dùng dán mã thật của chính ảnh mình.
  - **Test riêng `tests/vert-code-test.js`** (8/8 PASS trên 20.000 mã): đúng độ dài/charset, không 0/O/1/I, luôn có số, tỷ lệ số ~18.5%, không vị trí nào bị khoá giá trị, 20000/20000 mã duy nhất. Live test: 5 mã "Đổi mã khác" đều hợp lệ, nhập bẩn `ab-12 xy!z` → `AB12XYZ`.
- **v1.6.0 (Tải Hàng Loạt — Mỗi Ảnh Một Mã Riêng + Giờ Lệch Nhẹ):**
  - **Mỗi ảnh trong loạt tự nhận biến thể riêng:** khi upload/kéo-thả nhiều ảnh (hoặc chụp camera), `assignBatchVariations()` gán cho từng ảnh một `_vertCode` **duy nhất** (không trùng trong loạt) và `_timeOffset` **cộng dồn ngẫu nhiên 0/1/2 phút** (ảnh đầu +0). `GeoService.addMinutesToTime()` cộng phút vào giờ, cuộn vòng 24h, giữ nguyên phần giây/định dạng.
  - **Preview & tải đều dùng biến thể:** `renderStateFor(item)` tạo state biến thể (ghi đè `vertCode` + `time` = base + offset) cho cả xem trước từng ảnh lẫn khi xuất ZIP; **mọi trường khác giữ nguyên** từ state gốc — đúng yêu cầu "chỉ đổi mã & giờ". Tên file ZIP gắn số thứ tự + mã để truy vết (`03_anh_XXXX_timemark.jpg`).
  - **UI batch nâng cấp:** thanh danh sách ảnh có toggle "🎲 Mỗi ảnh mã riêng + giờ +0–2′" (mặc định bật), nút "Tạo lại" reroll toàn bộ, dòng chú thích realtime "Ảnh #i/n · mã … · giờ … (+k′)", thumbnail đánh số thứ tự. Ô nhập mã tự đồng bộ theo ảnh đang xem; khi bật biến thể, sửa mã/đổi mã tác động lên riêng ảnh đó.
  - **Test `tests/batch-test.js`** (11/11 PASS): upload 6 ảnh → 6 mã duy nhất đúng định dạng, offset không giảm & bước 0–2, giờ = base+offset, tắt toggle ẩn biến thể, nút Tạo lại đổi bộ mã; `addMinutesToTime` 8/8 ca (kể cả cuộn qua nửa đêm). UI suite vẫn 55/55.
- **v1.6.1 (Chuẩn Hoá Tài Liệu & Quy Trình Bàn Giao):**
  - **Ghi thành quy tắc bắt buộc** (mục 5): sau MỖI lần hoàn thành công việc phải tự động cập nhật `README.md` + changelog `AGENTS.md`, rồi `git commit` và `git push` lên `origin main` — không chờ nhắc.
  - **Cập nhật Codebase Manifest (mục 2)** cho khớp thực tế: bổ sung `tests/` (3 bộ test), `assets/`, `.github/workflows/deploy-pages.yml`, `README.md`; mô tả lại vai trò từng file JS theo đúng chức năng hiện tại (forwardGeocode, preloadFonts, anchorBlock, biến thể per-image, chống race camera).
  - **Bổ sung quy tắc chạy test trước khi bàn giao** (mục 4): `node --check` cho từng file + chạy đủ 3 bộ test, mốc chuẩn **74/74 PASS**.
  - **README.md hoàn thiện:** badge phiên bản + tổng số test đúng thực tế (74/74), ảnh minh hoạ tính năng tải hàng loạt, cây thư mục đầy đủ, mục giải thích minh bạch bản chất mã xác thực dọc (tem trang trí, không phải token tra cứu được), ghi chú UI gọn gàng.
- **v1.6.2 (Sửa Lỗi "Failed to fetch" Khi Tra Cứu Địa Chỉ — Dự Phòng 2 Nhà Cung Cấp):**
  - **Nguyên nhân gốc (đã chẩn đoán, KHÔNG phải lỗi code):** `nominatim.openstreetmap.org` bị phân giải DNS về `127.0.0.1` trên mạng của người dùng (file `hosts` sạch → chặn ở tầng DNS nhà mạng/bộ lọc). `curl` trả `HTTP=000`, exit 7 (không kết nối được) → trình duyệt báo `Failed to fetch`. Lỗi này làm hỏng CẢ 3 luồng: Tìm GPS theo địa chỉ, nút GPS Tự Động, và tra địa chỉ từ EXIF.
  - **Giải pháp — dự phòng tự động sang Photon (komoot):** cùng dữ liệu OpenStreetMap, trả `Access-Control-Allow-Origin: *`, không cần API key, hoạt động tốt trên mạng bị chặn Nominatim. Cả `forwardGeocode()` và `reverseGeocode()` giờ thử Nominatim trước (dữ liệu chi tiết hơn) rồi tự chuyển sang Photon khi lỗi/bị chặn.
  - **Tái cấu trúc `geocoding.js`:** tách helper dùng chung `fetchJson()` (timeout AbortController 8s), `formatWard()` / `formatCity()` (chuẩn hoá "P. X" / "Thành Phố Y", không phân biệt hoa thường), `parseNominatimAddress()` và `parsePhotonFeature()` cùng trả về MỘT cấu trúc địa chỉ chuẩn (thêm trường `provider` để truy vết nguồn). Giữ nguyên hợp đồng dữ liệu nên `app.js` không phải đổi.
  - **Thông báo lỗi thân thiện:** thay vì hiện thẳng `Failed to fetch`, app phân biệt mất mạng (`navigator.onLine`) và bị chặn máy chủ, rồi hướng dẫn cụ thể (đổi DNS 8.8.8.8/1.1.1.1, tắt tiện ích chặn quảng cáo, hoặc nhập tay).
  - **Kiểm chứng thực tế trên chính mạng đang bị chặn:** forward trả 5 kết quả trong 1.185 giây, định dạng đúng ("143 Đường Nguyễn Ngọc Vũ, P. Yên Hoà" / "Thành Phố Hà Nội"); reverse cũng chạy qua Photon.
  - **4 test hồi quy mới trong `ui-test.js`** (55 → 59): giả lập Nominatim bị chặn → phải tự dùng Photon và điền đúng địa chỉ + toạ độ; cả 2 nguồn hỏng → phải hiện thông báo tiếng Việt dễ hiểu, KHÔNG lộ chuỗi "Failed to fetch". Tổng bộ test: **78/78 PASS**.
- **v1.6.3 (Sửa Lỗi Mất Địa Chỉ/Toạ Độ Khi Đổi Mẫu Watermark):**
  - **Nguyên nhân gốc:** trình xử lý chọn mẫu (`--- 6. Template Selection Handling ---`) gán preset minh hoạ **vô điều kiện** (`state.address1 = 'Tao Dan Park, Hồ Chí Minh'` …), nên mọi nội dung người dùng đã nhập — kể cả địa chỉ & toạ độ vừa lấy từ "Tìm GPS" — bị ghi đè mỗi lần đổi mẫu.
  - **Cơ chế mới `userEdited` + `applyPreset()`:** app ghi nhớ những trường người dùng đã tự nhập hoặc được điền tự động; khi đổi mẫu, preset **CHỈ điền vào các trường chưa bị đụng tới**. Nhờ vậy dữ liệu thật được giữ nguyên, còn các trường trống vẫn nhận nội dung minh hoạ như trước.
  - **44 điểm đánh dấu dữ liệu người dùng:** toàn bộ 32 ô nhập (bulk), bộ chọn giờ/thứ, nút "Lấy Giờ Hiện Tại", nút "Toạ độ mẫu", 4 nút vị trí, preset thương hiệu logo, **Tìm GPS theo địa chỉ** (`applyGeoResult`), **GPS Tự Động**, **EXIF ngày giờ + toạ độ**, và nút GPS trong camera.
  - **Bảng preset tách riêng (`TEMPLATE_PRESETS`):** thay chuỗi `if/else if` 110 dòng bằng một object khai báo — dễ đọc, dễ thêm mẫu mới, và là nguồn duy nhất cho `applyPreset()`.
  - **Đường thoát rõ ràng:** nút "Khôi phục mẫu ban đầu" và 2 nút "Mẫu 4:3/3:4" gọi `clearEdited()` để xoá đánh dấu, cho phép preset điền lại từ đầu.
  - **Chỉ báo trực quan:** dòng xanh `🔒 Đang giữ N nội dung bạn đã nhập (không bị mất khi đổi mẫu)` hiện ở đầu khối "Chỉnh Sửa Nội Dung", tự ẩn khi không còn dữ liệu người dùng.
  - **8 test hồi quy mới trong `ui-test.js`** (59 → 67): lấy địa chỉ qua Tìm GPS rồi **đổi qua 6 mẫu liên tiếp** → địa chỉ/toạ độ/tỉnh-thành phải giữ nguyên; trường chưa nhập vẫn nhận preset; nút Khôi phục xoá đánh dấu và preset điền lại được. Tổng bộ test: **86/86 PASS**.
- **v1.7.0 (Đóng Gói LaMa Inpainting Studio Vào Sub-App Độc Lập + Tối Ưu Mask AI):**
  - **Đóng gói toàn bộ mô-đun AI xoá watermark vào `lama-cleaner/`**: Giữ sạch sẽ thư mục gốc để ứng dụng chính `Timemark GPS Pro` duy trì 100% tính chất Zero-Dependency. Thư mục con gồm đầy đủ `webui/`, `engine.py`, `server.py`, `models/`, `requirements.txt`, `tests/`, `run.bat` và `README.md`. File `run_lama_ui.bat` tại thư mục gốc đóng vai trò launcher chuyển tiếp 1-click.
  - **Bảo vệ kho Git khỏi file trọng số lớn 205MB**: Cập nhật `.gitignore` chặn `*.pt`, `*.onnx`, `models/`, `lama-cleaner/models/`. Tích hợp logic `_ensure_model_exists()` trong `engine.py` tự động tải mô hình `big-lama.pt` từ release uy tín nếu chưa tồn tại, đảm bảo clone về bất kỳ máy nào cũng chạy được ngay.
  - **Khắc phục triệt để các vấn đề xoá watermark chưa thành công**:
    1. *Ngưỡng mask nhạy cảm:* Đổi ngưỡng nhị phân sang `mask > 10` (thay vì `> 127`), kết hợp mở rộng viền tự động (Dilation ellipse mặc định 4px) và làm mềm Gaussian feathering, xoá sạch hoàn toàn cả bóng đổ (drop shadow) và viền khử răng cưa của watermark.
    2. *Ghép ảnh bảo toàn độ nét (Lossless Alpha Composite):* `orig * (1 - mask) + inpaint * mask` giúp 100% diện tích ảnh gốc ngoài vùng chọn giữ nguyên bit-exact không bị giảm chất lượng.
    3. *Căn chỉnh pixel tuyệt đối:* Khắc phục lệch toạ độ cọ vẽ khi phóng to/thu nhỏ (Zoom Transform Invariance), sửa lỗi co ép ảnh trên thanh trượt so sánh Before / After (Split Slider).
    4. *4 nút chọn nhanh watermark (1-Click Presets):* Phủ kín tức thì các góc watermark phổ biến (Góc dưới trái, góc dưới phải, cả dòng đáy, góc trên phải).
    5. *Nút giữ xem ảnh gốc `[👁️ Giữ để xem ảnh gốc]`*: Cho phép kiểm tra đối chiếu trực quan tức thì.
  - **Kiểm thử tự động 2 tầng (`lama-cleaner/tests/self_test.py`)**: Kiểm tra thành công cả inference trực tiếp qua Engine và inference gián tiếp qua HTTP Server API. Cập nhật tài liệu chi tiết tại mục 6 trong `AGENTS.md`.
