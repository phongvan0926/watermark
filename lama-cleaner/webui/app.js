/**
 * LaMa Inpainting Studio — Client-side Controller
 */

(() => {
    // State management
    const state = {
        image: null,           // HTMLImageElement
        imageSrc: null,        // Base64 / URL
        resultSrc: null,       // Base64 result from LaMa
        
        currentTool: 'brush',  // 'brush' | 'eraser' | 'rect'
        brushSize: 40,
        dilateRadius: 4,
        zoom: 1.0,
        
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        rectStartX: 0,
        rectStartY: 0,
        
        undoStack: [],
        redoStack: [],
        maxHistory: 20,
        
        viewMode: 'editor',    // 'editor' | 'slider' | 'result'
        sliderPos: 50          // 0 - 100%
    };

    // DOM Elements
    const elements = {
        serverStatus: document.getElementById('server-status'),
        statusText: document.getElementById('status-text'),
        
        fileInput: document.getElementById('file-input'),
        dropzoneFileInput: document.getElementById('dropzone-file-input'),
        dropzone: document.getElementById('dropzone'),
        dropzoneCard: document.querySelector('.dropzone-card'),
        editorWorkspace: document.getElementById('editor-workspace'),
        
        btnLoadSample: document.getElementById('btn-load-sample'),
        btnDropzoneSample: document.getElementById('btn-dropzone-sample'),
        
        toolBrush: document.getElementById('tool-brush'),
        toolEraser: document.getElementById('tool-eraser'),
        toolRect: document.getElementById('tool-rect'),
        
        brushSizeInput: document.getElementById('brush-size'),
        brushSizeVal: document.getElementById('brush-size-val'),
        brushDot: document.getElementById('brush-dot'),
        
        dilateInput: document.getElementById('dilate-radius'),
        dilateVal: document.getElementById('dilate-val'),
        
        btnUndo: document.getElementById('btn-undo'),
        btnRedo: document.getElementById('btn-redo'),
        btnClearMask: document.getElementById('btn-clear-mask'),
        btnInvertMask: document.getElementById('btn-invert-mask'),
        
        btnInpaint: document.getElementById('btn-inpaint'),
        perfTag: document.getElementById('perf-tag'),
        
        imageCanvas: document.getElementById('image-canvas'),
        maskCanvas: document.getElementById('mask-canvas'),
        canvasWrapper: document.getElementById('canvas-wrapper'),
        cursorBrush: document.getElementById('cursor-brush'),
        
        // Comparison Slider
        comparisonContainer: document.getElementById('comparison-container'),
        compBeforeImg: document.getElementById('comp-before-img'),
        compAfterImg: document.getElementById('comp-after-img'),
        compAfterWrapper: document.getElementById('comp-after-wrapper'),
        compDivider: document.getElementById('comp-divider'),
        btnPeekOrig: document.getElementById('btn-peek-orig'),
        
        // Zoom
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        btnZoomFit: document.getElementById('btn-zoom-fit'),
        zoomVal: document.getElementById('zoom-val'),
        
        // View Tabs
        tabSlider: document.getElementById('tab-slider'),
        tabResult: document.getElementById('tab-result'),
        viewModeTabs: document.getElementById('view-mode-tabs'),
        
        // Result Bar & Loading
        resultBar: document.getElementById('result-bar'),
        resultTimeText: document.getElementById('result-time-text'),
        btnUseAsInput: document.getElementById('btn-use-as-input'),
        btnDownload: document.getElementById('btn-download'),
        loadingOverlay: document.getElementById('loading-overlay'),
        toastContainer: document.getElementById('toast-container')
    };

    const imgCtx = elements.imageCanvas.getContext('2d');
    const maskCtx = elements.maskCanvas.getContext('2d');

    // Initialize Lucide Icons
    function initIcons() {
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    // Toast Notification helper
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }

    // Check Server Status
    async function checkServerStatus() {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                elements.statusText.textContent = `Big-LaMa (${data.device.toUpperCase()}) • Sẵn sàng`;
                elements.serverStatus.classList.remove('offline');
            } else {
                throw new Error('Offline');
            }
        } catch (e) {
            elements.statusText.textContent = 'Chưa kết nối Backend';
            elements.serverStatus.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            elements.serverStatus.style.color = '#ef4444';
        }
    }

    // Load Image onto Canvas
    function loadImage(src) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            state.image = img;
            state.imageSrc = src;
            state.resultSrc = null;
            state.undoStack = [];
            state.redoStack = [];

            // Set canvas dimensions
            elements.imageCanvas.width = img.naturalWidth;
            elements.imageCanvas.height = img.naturalHeight;
            elements.maskCanvas.width = img.naturalWidth;
            elements.maskCanvas.height = img.naturalHeight;

            // Set wrapper dimension
            elements.canvasWrapper.style.width = `${img.naturalWidth}px`;
            elements.canvasWrapper.style.height = `${img.naturalHeight}px`;

            // Draw original image
            imgCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
            imgCtx.drawImage(img, 0, 0);

            // Adapt brush size dynamically to image resolution
            const dynamicBrush = Math.max(25, Math.min(180, Math.round(Math.min(img.naturalWidth, img.naturalHeight) / 25)));
            setBrushSize(dynamicBrush);

            // Clear mask
            clearMaskCanvas();

            // Switch view
            elements.dropzone.style.display = 'none';
            elements.editorWorkspace.style.display = 'flex';
            elements.resultBar.style.display = 'none';
            elements.comparisonContainer.style.display = 'none';
            elements.btnPeekOrig.style.display = 'none';
            elements.tabSlider.disabled = true;
            elements.tabResult.disabled = true;
            switchViewMode('editor');

            updateZoom(1.0);
            fitZoomToScreen();
            updateButtonStates();
            showToast(`Đã nạp ảnh (${img.naturalWidth} × ${img.naturalHeight}px)`, 'success');
        };
        img.src = src;
    }

    function setBrushSize(size) {
        state.brushSize = size;
        elements.brushSizeInput.value = size;
        elements.brushSizeVal.textContent = `${size}px`;
        elements.brushDot.style.width = `${Math.min(36, Math.max(6, size * 0.4))}px`;
        elements.brushDot.style.height = `${Math.min(36, Math.max(6, size * 0.4))}px`;
    }

    // Clear Mask Canvas
    function clearMaskCanvas() {
        maskCtx.clearRect(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
        updateButtonStates();
    }

    // Save History state for Undo
    function pushHistory() {
        if (!state.image) return;
        const snapshot = maskCtx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
        state.undoStack.push(snapshot);
        if (state.undoStack.length > state.maxHistory) {
            state.undoStack.shift();
        }
        state.redoStack = [];
        updateButtonStates();
    }

    function undo() {
        if (state.undoStack.length === 0) return;
        const current = maskCtx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
        state.redoStack.push(current);
        const prev = state.undoStack.pop();
        maskCtx.putImageData(prev, 0, 0);
        updateButtonStates();
    }

    function redo() {
        if (state.redoStack.length === 0) return;
        const current = maskCtx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
        state.undoStack.push(current);
        const next = state.redoStack.pop();
        maskCtx.putImageData(next, 0, 0);
        updateButtonStates();
    }

    function isMaskEmpty() {
        if (!state.image) return true;
        const data = maskCtx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 10) return false;
        }
        return true;
    }

    function updateButtonStates() {
        const hasMask = !isMaskEmpty();
        elements.btnInpaint.disabled = !state.image || !hasMask;
        elements.btnUndo.disabled = state.undoStack.length === 0;
        elements.btnRedo.disabled = state.redoStack.length === 0;
    }

    // Invert Mask
    function invertMask() {
        if (!state.image) return;
        pushHistory();
        const imgData = maskCtx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 10) {
                // Was masked -> unmask
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 0;
            } else {
                // Was transparent -> mask with red
                data[i] = 255;     // R
                data[i + 1] = 71;   // G
                data[i + 2] = 87;   // B
                data[i + 3] = 200;  // Alpha
            }
        }
        maskCtx.putImageData(imgData, 0, 0);
        updateButtonStates();
    }

    // Quick Watermark Presets
    function applyPresetMask(presetName) {
        if (!state.image) {
            showToast('Vui lòng tải ảnh lên trước', 'error');
            return;
        }
        pushHistory();

        const w = elements.maskCanvas.width;
        const h = elements.maskCanvas.height;
        maskCtx.fillStyle = 'rgba(255, 71, 87, 0.85)';

        if (presetName === 'bottom-left') {
            // Typical Timemark / GPS corner (covers 0 to 58% width, 68% to 100% height)
            maskCtx.fillRect(0, Math.round(h * 0.65), Math.round(w * 0.58), Math.round(h * 0.35));
        } else if (presetName === 'bottom-right') {
            // Bottom-right watermark / logo (covers 55% to 100% width, 72% to 100% height)
            maskCtx.fillRect(Math.round(w * 0.52), Math.round(h * 0.70), Math.round(w * 0.48), Math.round(h * 0.30));
        } else if (presetName === 'bottom-bar') {
            // Full bottom watermark bar
            maskCtx.fillRect(0, Math.round(h * 0.72), w, Math.round(h * 0.28));
        } else if (presetName === 'top-right') {
            // Top-right camera timestamp / logo
            maskCtx.fillRect(Math.round(w * 0.58), 0, Math.round(w * 0.42), Math.round(h * 0.25));
        }

        updateButtonStates();
        showToast('Đã chọn nhanh vùng watermark!', 'info');
    }

    // Get Canvas Coordinates relative to actual image pixels
    function getCanvasCoords(e) {
        const rect = elements.maskCanvas.getBoundingClientRect();
        const scaleX = elements.maskCanvas.width / rect.width;
        const scaleY = elements.maskCanvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
            clientX: e.clientX,
            clientY: e.clientY
        };
    }

    // Mouse & Touch Drawing Handlers
    function startDrawing(e) {
        if (!state.image || state.viewMode !== 'editor') return;
        state.isDrawing = true;
        pushHistory();

        const coords = getCanvasCoords(e);
        state.lastX = coords.x;
        state.lastY = coords.y;
        state.rectStartX = coords.x;
        state.rectStartY = coords.y;

        if (state.currentTool === 'brush' || state.currentTool === 'eraser') {
            drawStroke(coords.x, coords.y, coords.x, coords.y);
        }
    }

    function draw(e) {
        updateCursor(e);
        if (!state.isDrawing || !state.image || state.viewMode !== 'editor') return;

        const coords = getCanvasCoords(e);

        if (state.currentTool === 'brush' || state.currentTool === 'eraser') {
            drawStroke(state.lastX, state.lastY, coords.x, coords.y);
            state.lastX = coords.x;
            state.lastY = coords.y;
        } else if (state.currentTool === 'rect') {
            // Live preview rectangle
            if (state.undoStack.length > 0) {
                const prev = state.undoStack[state.undoStack.length - 1];
                maskCtx.putImageData(prev, 0, 0);
            }
            maskCtx.fillStyle = 'rgba(255, 71, 87, 0.85)';
            const rx = Math.min(state.rectStartX, coords.x);
            const ry = Math.min(state.rectStartY, coords.y);
            const rw = Math.abs(coords.x - state.rectStartX);
            const rh = Math.abs(coords.y - state.rectStartY);
            maskCtx.fillRect(rx, ry, rw, rh);
        }
    }

    function stopDrawing() {
        if (!state.isDrawing) return;
        state.isDrawing = false;
        updateButtonStates();
    }

    function drawStroke(x1, y1, x2, y2) {
        maskCtx.beginPath();
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        maskCtx.lineWidth = state.brushSize;

        if (state.currentTool === 'eraser') {
            maskCtx.globalCompositeOperation = 'destination-out';
            maskCtx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.strokeStyle = 'rgba(255, 71, 87, 0.85)';
        }

        maskCtx.moveTo(x1, y1);
        maskCtx.lineTo(x2, y2);
        maskCtx.stroke();
        maskCtx.globalCompositeOperation = 'source-over';
    }

    // Cursor Brush Visual Follower
    function updateCursor(e) {
        if (!state.image || state.viewMode !== 'editor') {
            elements.cursorBrush.style.display = 'none';
            return;
        }

        const rect = elements.canvasWrapper.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            elements.cursorBrush.style.display = 'none';
            return;
        }

        elements.cursorBrush.style.display = 'block';
        const coords = getCanvasCoords(e);
        
        // Exact positioning in canvas coordinate space
        elements.cursorBrush.style.width = `${state.brushSize}px`;
        elements.cursorBrush.style.height = `${state.brushSize}px`;
        elements.cursorBrush.style.left = `${coords.x}px`;
        elements.cursorBrush.style.top = `${coords.y}px`;

        if (state.currentTool === 'eraser') {
            elements.cursorBrush.style.borderColor = '#38bdf8';
        } else {
            elements.cursorBrush.style.borderColor = '#ffffff';
        }
    }

    // Export pure black/white mask for Inpainting Model (White = 255 = inpaint, Black = 0 = keep)
    function exportPureMaskBase64() {
        const offscreen = document.createElement('canvas');
        offscreen.width = elements.maskCanvas.width;
        offscreen.height = elements.maskCanvas.height;
        const offCtx = offscreen.getContext('2d');

        // Fill background black
        offCtx.fillStyle = '#000000';
        offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

        // Get drawn mask alpha channel
        const maskData = maskCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;
        const pureData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
        const d = pureData.data;

        for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i + 3] > 10) {
                d[i] = 255;     // R
                d[i + 1] = 255; // G
                d[i + 2] = 255; // B
                d[i + 3] = 255; // A
            }
        }
        offCtx.putImageData(pureData, 0, 0);
        return offscreen.toDataURL('image/png');
    }

    // Run LaMa Inpainting
    async function runInpaint() {
        if (!state.image || isMaskEmpty()) return;

        elements.loadingOverlay.style.display = 'flex';
        elements.perfTag.textContent = 'Đang chạy mô hình Big-LaMa...';

        try {
            const imageB64 = elements.imageCanvas.toDataURL('image/png');
            const maskB64 = exportPureMaskBase64();

            const payload = {
                image: imageB64,
                mask: maskB64,
                dilate: parseInt(state.dilateRadius) || 4
            };

            const startTime = performance.now();
            const response = await fetch('/api/inpaint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Inpainting failed');
            }

            const elapsedSec = data.elapsed_sec || ((performance.now() - startTime) / 1000).toFixed(2);
            state.resultSrc = data.result;

            // Update UI with result
            elements.resultTimeText.textContent = `${elapsedSec}s`;
            elements.perfTag.textContent = `⚡ Xoá xong trong ${elapsedSec}s`;
            elements.resultBar.style.display = 'flex';
            elements.btnPeekOrig.style.display = 'inline-flex';

            // Setup comparison images with exact pixel dimensions
            elements.compBeforeImg.src = state.imageSrc;
            elements.compAfterImg.src = state.resultSrc;

            elements.tabSlider.disabled = false;
            elements.tabResult.disabled = false;

            // Switch to Slider mode for instant visual gratification
            switchViewMode('slider');
            showToast(`Đã xoá watermark thành công (${elapsedSec}s)!`, 'success');

        } catch (err) {
            console.error(err);
            showToast(`Lỗi: ${err.message}`, 'error');
            elements.perfTag.textContent = 'Lỗi xử lý';
        } finally {
            elements.loadingOverlay.style.display = 'none';
        }
    }

    // View Modes (Editor, Slider, Result)
    function switchViewMode(mode) {
        state.viewMode = mode;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'editor') {
            elements.imageCanvas.style.display = 'block';
            elements.maskCanvas.style.display = 'block';
            elements.comparisonContainer.style.display = 'none';
            elements.btnPeekOrig.style.display = 'none';
            // Redraw original image to canvas in case it was in result mode
            if (state.image) {
                imgCtx.clearRect(0, 0, elements.imageCanvas.width, elements.imageCanvas.height);
                imgCtx.drawImage(state.image, 0, 0);
            }
        } else if (mode === 'slider') {
            elements.imageCanvas.style.display = 'none';
            elements.maskCanvas.style.display = 'none';
            elements.comparisonContainer.style.display = 'block';
            elements.btnPeekOrig.style.display = 'inline-flex';
            updateSlider(state.sliderPos);
        } else if (mode === 'result') {
            elements.imageCanvas.style.display = 'block';
            elements.maskCanvas.style.display = 'none';
            elements.comparisonContainer.style.display = 'none';
            elements.btnPeekOrig.style.display = 'inline-flex';
            // Draw result on image canvas
            if (state.resultSrc) {
                const resImg = new Image();
                resImg.onload = () => {
                    imgCtx.clearRect(0, 0, elements.imageCanvas.width, elements.imageCanvas.height);
                    imgCtx.drawImage(resImg, 0, 0);
                };
                resImg.src = state.resultSrc;
            }
        }
    }

    // Comparison Split Slider
    function updateSlider(percent) {
        state.sliderPos = Math.max(0, Math.min(100, percent));
        elements.compAfterWrapper.style.width = `${state.sliderPos}%`;
        elements.compDivider.style.left = `${state.sliderPos}%`;
    }

    let isSliding = false;
    function handleSliderMove(e) {
        if (!isSliding) return;
        const rect = elements.comparisonContainer.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const x = clientX - rect.left;
        const percent = (x / rect.width) * 100;
        updateSlider(percent);
    }

    // Zoom Controls
    function updateZoom(newZoom) {
        state.zoom = Math.max(0.1, Math.min(5.0, newZoom));
        elements.canvasWrapper.style.transform = `scale(${state.zoom})`;
        elements.zoomVal.textContent = `${Math.round(state.zoom * 100)}%`;
    }

    function fitZoomToScreen() {
        if (!state.image) return;
        const stage = document.getElementById('canvas-stage');
        const padding = 48;
        const availW = stage.clientWidth - padding;
        const availH = stage.clientHeight - padding;

        const scaleW = availW / state.image.naturalWidth;
        const scaleH = availH / state.image.naturalHeight;
        const bestFit = Math.min(1.0, scaleW, scaleH);
        updateZoom(bestFit);
    }

    // Tool switching
    function setTool(toolName) {
        state.currentTool = toolName;
        elements.toolBrush.classList.toggle('active', toolName === 'brush');
        elements.toolEraser.classList.toggle('active', toolName === 'eraser');
        elements.toolRect.classList.toggle('active', toolName === 'rect');
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // File selection
        const handleFile = (file) => {
            if (!file || !file.type.startsWith('image/')) {
                showToast('Vui lòng chọn tệp hình ảnh hợp lệ', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => loadImage(e.target.result);
            reader.readAsDataURL(file);
        };

        elements.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
        elements.dropzoneFileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        // Drag & Drop
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // Clipboard Paste (Ctrl + V)
        window.addEventListener('paste', (e) => {
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    handleFile(blob);
                    showToast('Đã dán ảnh từ Clipboard!', 'info');
                    break;
                }
            }
        });

        // Sample Images
        const loadSample = () => {
            loadImage('/api/sample');
        };
        elements.btnLoadSample.addEventListener('click', loadSample);
        elements.btnDropzoneSample.addEventListener('click', loadSample);

        // Tools
        elements.toolBrush.addEventListener('click', () => setTool('brush'));
        elements.toolEraser.addEventListener('click', () => setTool('eraser'));
        elements.toolRect.addEventListener('click', () => setTool('rect'));

        // Preset Watermark Buttons
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', () => applyPresetMask(btn.dataset.preset));
        });

        // Quick Brush Chips
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => setBrushSize(parseInt(btn.dataset.size)));
        });

        // Brush Size Slider
        elements.brushSizeInput.addEventListener('input', (e) => {
            setBrushSize(parseInt(e.target.value));
        });

        // Dilation Slider
        elements.dilateInput.addEventListener('input', (e) => {
            state.dilateRadius = parseInt(e.target.value);
            elements.dilateVal.textContent = `${state.dilateRadius}px`;
        });

        // Mask Actions
        elements.btnUndo.addEventListener('click', undo);
        elements.btnRedo.addEventListener('click', redo);
        elements.btnClearMask.addEventListener('click', () => {
            pushHistory();
            clearMaskCanvas();
        });
        elements.btnInvertMask.addEventListener('click', invertMask);

        // Primary Inpaint Button
        elements.btnInpaint.addEventListener('click', runInpaint);

        // Canvas Drawing Events
        elements.maskCanvas.addEventListener('mousedown', startDrawing);
        window.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);

        elements.maskCanvas.addEventListener('mouseleave', () => {
            elements.cursorBrush.style.display = 'none';
        });

        // Touch support
        elements.maskCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) startDrawing(e.touches[0]);
        }, { passive: false });

        elements.maskCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) draw(e.touches[0]);
        }, { passive: false });

        elements.maskCanvas.addEventListener('touchend', stopDrawing);

        // Comparison Slider Events
        elements.comparisonContainer.addEventListener('mousedown', (e) => {
            isSliding = true;
            handleSliderMove(e);
        });
        window.addEventListener('mousemove', handleSliderMove);
        window.addEventListener('mouseup', () => { isSliding = false; });

        // Peek Original Image Button (Hold mouse to see original)
        const showOriginal = () => {
            if (state.image && state.viewMode === 'result') {
                imgCtx.drawImage(state.image, 0, 0);
            } else if (state.viewMode === 'slider') {
                elements.compAfterWrapper.style.width = '0%';
            }
        };
        const hideOriginal = () => {
            if (state.resultSrc && state.viewMode === 'result') {
                const resImg = new Image();
                resImg.onload = () => imgCtx.drawImage(resImg, 0, 0);
                resImg.src = state.resultSrc;
            } else if (state.viewMode === 'slider') {
                updateSlider(state.sliderPos);
            }
        };

        elements.btnPeekOrig.addEventListener('mousedown', showOriginal);
        elements.btnPeekOrig.addEventListener('mouseup', hideOriginal);
        elements.btnPeekOrig.addEventListener('mouseleave', hideOriginal);

        // View Tabs
        elements.viewModeTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (btn && !btn.disabled) {
                switchViewMode(btn.dataset.mode);
            }
        });

        // Zoom Events
        elements.btnZoomIn.addEventListener('click', () => updateZoom(state.zoom + 0.15));
        elements.btnZoomOut.addEventListener('click', () => updateZoom(state.zoom - 0.15));
        elements.btnZoomFit.addEventListener('click', fitZoomToScreen);

        // Result Actions
        elements.btnUseAsInput.addEventListener('click', () => {
            if (state.resultSrc) {
                loadImage(state.resultSrc);
                showToast('Đã chuyển kết quả thành ảnh đầu vào tiếp theo!', 'info');
            }
        });

        elements.btnDownload.addEventListener('click', () => {
            if (!state.resultSrc) return;
            const a = document.createElement('a');
            a.href = state.resultSrc;
            a.download = `lama_inpainted_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast('Đang tải ảnh chất lượng cao về máy...', 'success');
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.key === '[' && state.brushSize > 4) {
                setBrushSize(Math.max(4, state.brushSize - 6));
            } else if (e.key === ']' && state.brushSize < 250) {
                setBrushSize(Math.min(250, state.brushSize + 6));
            } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                redo();
            } else if (e.key === 'Enter' && !elements.btnInpaint.disabled) {
                e.preventDefault();
                runInpaint();
            }
        });

        // Window Resize
        window.addEventListener('resize', () => {
            if (state.image) fitZoomToScreen();
        });
    }

    // Startup
    document.addEventListener('DOMContentLoaded', () => {
        initIcons();
        setupEventListeners();
        checkServerStatus();
    });

})();
