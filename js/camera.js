/**
 * Camera Handler Module
 * Manages live video stream, front/rear camera switching, live watermark overlay, and photo capture
 */

const CameraController = {
  videoElement: null,
  overlayCanvas: null,
  stream: null,
  facingMode: 'environment', // default to back camera
  animFrameId: null,
  state: null,
  streamGen: 0, // token thế hệ: vô hiệu hoá các lần startStream chồng nhau

  init(state) {
    this.state = state;
    this.videoElement = document.getElementById('camera-video');
    this.overlayCanvas = document.getElementById('camera-overlay-canvas');
  },

  async startStream() {
    this.stopStream();
    const myGen = this.streamGen; // stopStream đã tăng token

    const constraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (myGen !== this.streamGen) {
        // Một lần start/stop mới hơn đã chạy: nhả stream này ngay để không rò rỉ camera
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      this.stream = stream;
      this.videoElement.srcObject = stream;
      await this.videoElement.play();
      if (myGen !== this.streamGen) return false;

      this.startLiveOverlay();
      return true;
    } catch (err) {
      // Dừng mọi track đã kịp lấy được (ví dụ play() reject sau khi có stream)
      if (myGen === this.streamGen) this.stopStream();
      console.error('Camera access failed:', err);
      alert('Không thể truy cập camera. Vui lòng cấp quyền truy cập camera trong trình duyệt của bạn.');
      return false;
    }
  },

  stopStream() {
    this.streamGen++;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  },

  async switchCamera() {
    const prevMode = this.facingMode;
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    const ok = await this.startStream();
    if (!ok) {
      // Camera mới không mở được: quay về camera cũ để không mất preview
      this.facingMode = prevMode;
      await this.startStream();
    }
    return ok;
  },

  startLiveOverlay() {
    const loop = () => {
      if (this.videoElement && this.videoElement.readyState >= 2 && this.overlayCanvas) {
        WatermarkEngine.render(this.overlayCanvas, this.videoElement, this.state);
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    loop();
  },

  /**
   * Captures a frame from video as full-resolution Image
   */
  capture() {
    if (!this.videoElement || !this.videoElement.videoWidth) return null;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = this.videoElement.videoWidth;
    snapCanvas.height = this.videoElement.videoHeight;
    const ctx = snapCanvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0, snapCanvas.width, snapCanvas.height);

    const img = new Image();
    img.src = snapCanvas.toDataURL('image/jpeg', 0.95);
    return img;
  }
};

if (typeof window !== 'undefined') window.CameraController = CameraController;
if (typeof globalThis !== 'undefined') globalThis.CameraController = CameraController;
