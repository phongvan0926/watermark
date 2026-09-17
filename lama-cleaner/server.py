#!/usr/bin/env python3
"""
LaMa Inpainting Web UI Server
A lightweight multi-threaded HTTP server for interactive LaMa image inpainting.
"""

import os
import sys
import json
import time
import socket
import webbrowser
import mimetypes

# Fix Windows console UTF-8 output
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from PIL import Image, ImageDraw
import io

from engine import LamaInpainter

HOST = "127.0.0.1"
DEFAULT_PORT = 7860
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEBUI_DIR = os.path.join(BASE_DIR, "webui")

# Preload engine on startup
print("[Server] Initializing LaMa Inpainter Engine...")
inpainter = LamaInpainter.get_instance()

def create_sample_image():
    """Generates a high-quality sample image with text watermark for instant testing."""
    w, h = 800, 600
    img = Image.new("RGB", (w, h), color=(30, 41, 59))
    draw = ImageDraw.Draw(img)

    # Draw scenic gradient / shapes
    for y in range(h):
        r = int(30 + (y / h) * 40)
        g = int(60 + (y / h) * 80)
        b = int(120 + (y / h) * 90)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Draw mountains/hills
    draw.polygon([(0, 600), (200, 350), (450, 600)], fill=(20, 30, 48))
    draw.polygon([(250, 600), (550, 280), (800, 600)], fill=(15, 23, 42))
    draw.polygon([(480, 600), (680, 380), (800, 600)], fill=(10, 15, 30))

    # Draw sun
    draw.ellipse([580, 100, 700, 220], fill=(255, 200, 80))

    # Draw realistic sample Watermark at bottom left
    draw.rectangle([30, 460, 420, 560], fill=(0, 0, 0, 160))
    draw.text((45, 470), "TIMEMARK GPS PRO", fill=(255, 200, 50))
    draw.text((45, 495), "17:50 | 27/08/2026", fill=(255, 255, 255))
    draw.text((45, 520), "Toạ độ: 21.0285° N, 105.8542° E", fill=(220, 220, 220))
    draw.text((45, 540), "Địa chỉ: Hoàn Kiếm, Hà Nội, Việt Nam", fill=(180, 180, 180))

    # Watermark 2: Sample object/watermark text in middle
    draw.text((280, 180), "WATERMARK SAMPLE", fill=(255, 255, 255))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()

SAMPLE_BYTES = create_sample_image()

class LamaHTTPHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_cors_headers()
            self.end_headers()
            info = {
                "status": "ready",
                "model": "Big-LaMa",
                "device": str(inpainter.device),
                "cuda": inpainter.device.type == "cuda"
            }
            self.wfile.write(json.dumps(info).encode("utf-8"))
            return

        if path == "/api/sample":
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(SAMPLE_BYTES)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(SAMPLE_BYTES)
            return

        # Serve Web UI files
        if path == "/" or path == "/index.html":
            file_path = os.path.join(WEBUI_DIR, "index.html")
        else:
            rel_path = path.lstrip("/")
            file_path = os.path.join(WEBUI_DIR, rel_path)

        # Fallback security check
        file_path = os.path.normpath(file_path)
        if not file_path.startswith(WEBUI_DIR) or not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_error(404, "File Not Found")
            return

        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type is None:
            mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/inpaint":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length == 0:
                    self.send_error(400, "Empty payload")
                    return

                raw_body = self.rfile.read(content_length)
                data = json.loads(raw_body.decode("utf-8"))

                image_b64 = data.get("image")
                mask_b64 = data.get("mask")
                dilate_radius = int(data.get("dilate", 4))

                if not image_b64 or not mask_b64:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": "Missing image or mask"}).encode("utf-8"))
                    return

                # Perform inpainting
                res_b64, elapsed = inpainter.inpaint_base64(image_b64, mask_b64, dilate_radius=dilate_radius)

                response_data = {
                    "success": True,
                    "result": res_b64,
                    "elapsed_sec": round(elapsed, 3),
                    "device": str(inpainter.device)
                }

                resp_bytes = json.dumps(response_data).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(resp_bytes)

            except Exception as e:
                import traceback
                traceback.print_exc()
                err_bytes = json.dumps({"success": False, "error": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(err_bytes)
            return

        self.send_error(404, "Endpoint not found")

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[Server] {self.address_string()} - {format % args}\n")

def find_available_port(start_port=DEFAULT_PORT, max_attempts=20):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_SOCKET if hasattr(socket, 'AF_SOCKET') else socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    return start_port

def start_server(port=None, open_browser=True):
    if port is None:
        port = find_available_port(DEFAULT_PORT)

    server_address = (HOST, port)
    httpd = ThreadingHTTPServer(server_address, LamaHTTPHandler)
    url = f"http://localhost:{port}"

    print("=" * 65)
    print("✨  LaMa Inpainting Web UI is Running!  ✨")
    print(f"🚀  Open in browser: {url}")
    print(f"🧠  Model: Big-LaMa (Resolution-robust FFC Inpainting)")
    print(f"💻  Device: {inpainter.device}")
    print("=" * 65)

    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down gracefully...")
        httpd.shutdown()

if __name__ == "__main__":
    p = None
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except ValueError:
            pass
    start_server(port=p)
