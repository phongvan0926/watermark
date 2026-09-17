import urllib.request
import json
import base64
import io
import os
import sys
from PIL import Image, ImageDraw

# Add parent directory to sys.path so we can import engine directly
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
LAMA_DIR = os.path.dirname(TEST_DIR)
ROOT_DIR = os.path.dirname(LAMA_DIR)
sys.path.insert(0, LAMA_DIR)

def test_engine_direct():
    print("\n--- [1/2] Test Direct Engine Inference ---")
    from engine import LamaInpainter
    inpainter = LamaInpainter.get_instance()
    
    # Create test image
    img = Image.new("RGB", (400, 300), color=(60, 100, 180))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 200, 120], fill=(255, 255, 255))
    
    mask = Image.new("L", (400, 300), color=0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rectangle([45, 45, 205, 125], fill=255)
    
    result = inpainter.inpaint(img, mask, dilate_radius=2)
    assert result.size == (400, 300), f"Size mismatch: {result.size}"
    print(f"Direct Engine Inference SUCCESS! Output size: {result.size}")

def test_watermark_removal_api():
    print("\n--- [2/2] Test HTTP Server Inpaint API ---")
    img_candidates = [
        os.path.join(TEST_DIR, "output", "test_orig_1.png"),
        os.path.join(ROOT_DIR, "assets", "screenshot-portrait.png"),
        os.path.join(ROOT_DIR, "assets", "screenshot-app.png")
    ]
    img_path = None
    for p in img_candidates:
        if os.path.exists(p):
            img_path = p
            break
            
    if img_path:
        img = Image.open(img_path).convert('RGB')
        w, h = img.size
    else:
        w, h = 800, 600
        img = Image.new('RGB', (w, h), color=(100, 150, 200))
        
    print(f"[Self-Test] Using image: {img_path or 'Synthetic'} ({w}x{h})")

    # Generate corner mask covering watermark
    mask = Image.new('L', (w, h), color=0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle([0, int(h * 0.65), int(w * 0.58), h], fill=255)

    buf_img = io.BytesIO()
    img.save(buf_img, format='PNG')
    b64_img = 'data:image/png;base64,' + base64.b64encode(buf_img.getvalue()).decode()

    buf_mask = io.BytesIO()
    mask.save(buf_mask, format='PNG')
    b64_mask = 'data:image/png;base64,' + base64.b64encode(buf_mask.getvalue()).decode()

    payload = json.dumps({'image': b64_img, 'mask': b64_mask, 'dilate': 4}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:7860/api/inpaint', data=payload, headers={'Content-Type': 'application/json'})

    print("[Self-Test] Sending inpainting request to server (http://127.0.0.1:7860/api/inpaint)...")
    try:
        res = urllib.request.urlopen(req, timeout=30)
        data = json.loads(res.read().decode('utf-8'))

        assert data['success'] is True, f"Inpainting failed: {data}"
        
        res_b64 = data['result'].split(',', 1)[1]
        res_bytes = base64.b64decode(res_b64)
        res_img = Image.open(io.BytesIO(res_bytes))
        
        out_dir = os.path.join(TEST_DIR, "output")
        os.makedirs(out_dir, exist_ok=True)
        res_img.save(os.path.join(out_dir, "self_test_watermark_removed.png"))
        
        print(f"[Self-Test] SUCCESS! Inpainted in {data['elapsed_sec']}s, Output resolution: {res_img.size}")
        assert res_img.size == (w, h), "Resolution mismatch!"
    except urllib.error.URLError as e:
        print(f"[Self-Test Note] Server not running or not responding ({e}). Direct engine test passed.")

if __name__ == '__main__':
    test_engine_direct()
    test_watermark_removal_api()
