"""
LaMa Inpainting Engine
Powered by advimman/lama Big-LaMa model with PyTorch TorchScript
"""

import os
import sys
import time
import base64
import io
import urllib.request
import numpy as np
import torch
from PIL import Image
import cv2

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "big-lama.pt")
MODEL_URL = "https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt"

class LamaInpainter:
    _instance = None

    def __init__(self, model_path=MODEL_PATH, device=None):
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
            
        self.model_path = model_path
        self.model = None
        self._ensure_model_exists()
        self._load_model()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_model_exists(self):
        if not os.path.exists(self.model_path):
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            print(f"[LaMa Engine] Model not found at {self.model_path}. Downloading from {MODEL_URL}...")
            
            def progress(block_num, block_size, total_size):
                if total_size > 0:
                    percent = min(100, (block_num * block_size * 100) // total_size)
                    sys.stdout.write(f"\rDownloading Big-LaMa model: {percent}% ({block_num*block_size//(1024*1024)} MB / {total_size//(1024*1024)} MB)")
                    sys.stdout.flush()

            urllib.request.urlretrieve(MODEL_URL, self.model_path, reporthook=progress)
            print("\n[LaMa Engine] Download complete!")

    def _load_model(self):
        print(f"[LaMa Engine] Loading Big-LaMa model on {self.device}...")
        start_t = time.time()
        self.model = torch.jit.load(self.model_path, map_location=self.device)
        self.model.eval()
        # Warmup
        try:
            dummy_img = torch.zeros(1, 3, 256, 256, device=self.device, dtype=torch.float32)
            dummy_mask = torch.zeros(1, 1, 256, 256, device=self.device, dtype=torch.float32)
            with torch.no_grad():
                _ = self.model(dummy_img, dummy_mask)
        except Exception as e:
            print(f"[LaMa Engine] Warmup note: {e}")
        print(f"[LaMa Engine] Model loaded successfully in {time.time() - start_t:.2f}s!")

    def _ceil_modulo(self, x, mod=8):
        if x % mod == 0:
            return x
        return (x // mod + 1) * mod

    def _pad_img_to_modulo(self, img, mod=8):
        """Pad image tensor [C, H, W] to height & width multiple of 8"""
        channels, height, width = img.shape
        out_height = self._ceil_modulo(height, mod)
        out_width = self._ceil_modulo(width, mod)
        
        pad_h = out_height - height
        pad_w = out_width - width
        
        if pad_h > 0 or pad_w > 0:
            # Pad on right and bottom using reflect mode
            img = torch.nn.functional.pad(img, (0, pad_w, 0, pad_h), mode='reflect')
        return img, (height, width)

    def inpaint(self, image: Image.Image, mask: Image.Image, dilate_radius: int = 2) -> Image.Image:
        """
        Run LaMa inpainting on a PIL image and PIL mask.
        image: PIL Image (RGB)
        mask: PIL Image (L or 1 channel, where 255 = area to inpaint, 0 = keep)
        dilate_radius: optional integer to dilate mask boundary
        """
        # Ensure RGB image
        if image.mode != "RGB":
            image = image.convert("RGB")

        orig_w, orig_h = image.size

        # Ensure mask is same size as image
        if mask.size != image.size:
            mask = mask.resize((orig_w, orig_h), Image.Resampling.NEAREST)

        mask_np = np.array(mask.convert("L"))

        # Dilation to cover font antialiasing and watermark edges
        if dilate_radius > 0:
            kernel_size = dilate_radius * 2 + 1
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
            mask_np = cv2.dilate(mask_np, kernel)

        # Threshold mask: any non-zero mask pixel is marked as 1.0
        mask_binary = (mask_np > 10).astype(np.float32)

        # Convert image to float32 [0, 1]
        orig_img_np = np.array(image).astype(np.float32)
        img_np = orig_img_np / 255.0

        # Transpose to [C, H, W]
        img_tensor = torch.from_numpy(img_np.transpose(2, 0, 1)).float()
        mask_tensor = torch.from_numpy(mask_binary[np.newaxis, :, :]).float()

        # Pad to multiple of 8
        img_tensor, orig_hw = self._pad_img_to_modulo(img_tensor, 8)
        mask_tensor, _ = self._pad_img_to_modulo(mask_tensor, 8)

        # Add batch dim [1, C, H, W]
        img_tensor = img_tensor.unsqueeze(0).to(self.device)
        mask_tensor = mask_tensor.unsqueeze(0).to(self.device)

        with torch.no_grad():
            output_tensor = self.model(img_tensor, mask_tensor)

        # Remove batch dim and crop back to original size
        output_np = output_tensor[0].permute(1, 2, 0).detach().cpu().numpy()
        output_np = output_np[:orig_hw[0], :orig_hw[1], :]
        output_np = np.clip(output_np * 255.0, 0, 255)

        # Feather mask boundary slightly (1.5px blur) for seamless pixel blend
        mask_feather = cv2.GaussianBlur(mask_binary, (3, 3), 0)[:, :, np.newaxis]
        
        # Lossless composite: untouched background remains 100% original
        final_np = (orig_img_np * (1.0 - mask_feather) + output_np * mask_feather)
        final_np = np.clip(final_np, 0, 255).astype(np.uint8)

        return Image.fromarray(final_np)

    def inpaint_base64(self, image_b64: str, mask_b64: str, dilate_radius: int = 2) -> tuple:
        """
        Helper to process base64 data URLs directly.
        Returns: (result_base64_data_url, elapsed_time_seconds)
        """
        def decode_b64(data_uri):
            if "," in data_uri:
                data_uri = data_uri.split(",", 1)[1]
            return Image.open(io.BytesIO(base64.b64decode(data_uri)))

        img = decode_b64(image_b64)
        mask = decode_b64(mask_b64)

        t0 = time.time()
        result_img = self.inpaint(img, mask, dilate_radius=dilate_radius)
        elapsed = time.time() - t0

        # Encode result as PNG data URL
        buf = io.BytesIO()
        result_img.save(buf, format="PNG", quality=100)
        res_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

        return res_b64, elapsed
