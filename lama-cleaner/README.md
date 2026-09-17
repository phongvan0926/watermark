# 🦙 LaMa Inpainting Studio (Watermark & Object Remover)

Ứng dụng xoá dấu ngày giờ, toạ độ GPS (watermark) và vật thể thừa trên ảnh bằng mô hình học sâu **Big-LaMa (Resolution-robust Large Mask Inpainting with Fourier Convolutions)** từ [advimman/lama](https://github.com/advimman/lama).

---

## 1. Cấu Trúc Thư Mục

```
lama-cleaner/
├── webui/                 # Giao diện HTML5 Canvas Dark Glassmorphism
│   ├── index.html         # Canvas workspace, cọ vẽ mask, Before/After split slider
│   ├── style.css          # Giao diện hiện đại, responsive, căn chỉnh pixel
│   └── app.js             # Canvas Controller, cọ mask, 1-click watermark presets
├── models/                # Thư mục chứa trọng số Big-LaMa (tự động tải nếu chưa có)
│   └── big-lama.pt        # Trọng số TorchScript 205MB (được gitignore)
├── engine.py              # Lõi inference PyTorch / TorchScript (reflect pad bội số 8, lossless blend)
├── server.py              # Multi-threaded HTTP Server (API /api/inpaint, /api/status, /api/sample)
├── run.bat                # Khởi động 1-click cho Windows
├── requirements.txt       # Danh sách thư viện Python
├── tests/                 # Kiểm thử tự động (self_test.py)
└── lama-repo/             # Mã nguồn tham khảo từ upstream advimman/lama
```

---

## 2. Cách Khởi Chạy

### Cách 1: Chạy file BAT 1-Click
Nhấp đúp vào `run.bat` (hoặc `run_lama_ui.bat` ở thư mục gốc của dự án). Trình duyệt sẽ tự động mở tại:
👉 **`http://localhost:7860`**

### Cách 2: Khởi động bằng dòng lệnh
```bash
cd lama-cleaner
pip install -r requirements.txt
python server.py
```

---

## 3. Đặc Tả API HTTP

- **`GET /api/status`**: Kiểm tra trạng thái mô hình và thiết bị (CPU/CUDA).
  ```json
  { "status": "ready", "model": "Big-LaMa", "device": "cpu", "cuda": false }
  ```
- **`POST /api/inpaint`**: Thực hiện xoá vùng chọn:
  - *Payload (JSON)*:
    ```json
    {
      "image": "data:image/png;base64,...",
      "mask": "data:image/png;base64,...",
      "dilate": 4
    }
    ```
  - *Response (JSON)*:
    ```json
    {
      "success": true,
      "result": "data:image/png;base64,...",
      "elapsed_sec": 1.25,
      "device": "cpu"
    }
    ```
- **`GET /api/sample`**: Trả về ảnh mẫu thử nghiệm kèm watermark.

---

## 4. Kiểm Thử Tự Động (Self-Test)

Chạy lệnh:
```bash
python lama-cleaner/tests/self_test.py
```
Script sẽ kiểm tra:
1. Nạp mô hình và inference trực tiếp qua `engine.py`.
2. Gửi request xoá watermark qua endpoint API `/api/inpaint` và xuất ảnh kiểm chứng tại `tests/output/self_test_watermark_removed.png`.
