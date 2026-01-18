/**
 * ASCII Cam - Real-time camera to ASCII renderer
 * No external dependencies
 */

// ========================================
// Configuration & State
// ========================================
const CONFIG = {
    // Character sets
    charsets: {
        dense: ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
        light: ' .:-=+*#%@',
    },
    // Default settings
    defaults: {
        step: 8,
        fontSize: 12,
        contrast: 1.2,
        threshold: 0,
        glow: 0.3
    }
};

// Application state
const state = {
    // Video
    videoSource: null,
    isVideoReady: false,
    isFrozen: false,

    // Settings
    step: CONFIG.defaults.step,
    fontSize: CONFIG.defaults.fontSize,
    contrast: CONFIG.defaults.contrast,
    threshold: CONFIG.defaults.threshold,
    glow: CONFIG.defaults.glow,

    // Modes
    outlineMode: false,
    charsetMode: 'dense',
    wordPhrase: '',
    wordIndex: 0,

    // Recording
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: []
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    videoSource: document.getElementById('videoSource'),
    canvas: document.getElementById('asciiCanvas'),
    ctx: null,

    // Buttons
    btnCamera: document.getElementById('btnCamera'),
    videoUpload: document.getElementById('videoUpload'),
    btnOutline: document.getElementById('btnOutline'),
    charsetMode: document.getElementById('charsetMode'),
    wordInput: document.getElementById('wordInput'),
    btnFreeze: document.getElementById('btnFreeze'),
    btnSnapshot: document.getElementById('btnSnapshot'),
    btnRecord: document.getElementById('btnRecord'),
    btnReset: document.getElementById('btnReset'),

    // Sliders
    sliderStep: document.getElementById('sliderStep'),
    sliderFontSize: document.getElementById('sliderFontSize'),
    sliderContrast: document.getElementById('sliderContrast'),
    sliderThreshold: document.getElementById('sliderThreshold'),
    sliderGlow: document.getElementById('sliderGlow'),

    // Value displays
    valStep: document.getElementById('valStep'),
    valFontSize: document.getElementById('valFontSize'),
    valContrast: document.getElementById('valContrast'),
    valThreshold: document.getElementById('valThreshold'),
    valGlow: document.getElementById('valGlow'),

    // Mobile toggle
    btnToggleSliders: document.getElementById('btnToggleSliders'),
    slidersPanel: document.getElementById('slidersPanel'),

    // Error
    errorMessage: document.getElementById('errorMessage')
};

// Offscreen canvas for video sampling
let offscreenCanvas, offscreenCtx;

// ========================================
// Initialization
// ========================================
function init() {
    // Setup canvas context
    elements.ctx = elements.canvas.getContext('2d');

    // Create offscreen canvas
    offscreenCanvas = document.createElement('canvas');
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // Resize canvas to window
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Set mobile defaults
    if (window.innerWidth < 768) {
        state.step = 10;
        elements.sliderStep.value = 10;
        elements.valStep.textContent = '10';
    }

    // Setup event listeners
    setupEventListeners();

    // Start with camera
    startCamera();

    // Start render loop
    requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Video source buttons
    elements.btnCamera.addEventListener('click', () => {
        startCamera();
    });

    elements.videoUpload.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            loadVideoFile(e.target.files[0]);
        }
    });

    // Toggles
    elements.btnOutline.addEventListener('click', () => {
        state.outlineMode = !state.outlineMode;
        elements.btnOutline.classList.toggle('active', state.outlineMode);
    });

    elements.charsetMode.addEventListener('change', (e) => {
        state.charsetMode = e.target.value;
        elements.wordInput.style.display = e.target.value === 'word' ? 'block' : 'none';
    });

    elements.wordInput.addEventListener('input', (e) => {
        state.wordPhrase = e.target.value;
        state.wordIndex = 0;
    });

    // Sliders
    setupSlider('sliderStep', 'valStep', 'step', 1);
    setupSlider('sliderFontSize', 'valFontSize', 'fontSize', 1);
    setupSlider('sliderContrast', 'valContrast', 'contrast', 0.01);
    setupSlider('sliderThreshold', 'valThreshold', 'threshold', 1);
    setupSlider('sliderGlow', 'valGlow', 'glow', 0.01);

    // Action buttons
    elements.btnFreeze.addEventListener('click', toggleFreeze);
    elements.btnSnapshot.addEventListener('click', takeSnapshot);
    elements.btnRecord.addEventListener('click', toggleRecording);
    elements.btnReset.addEventListener('click', resetSettings);

    // Mobile sliders toggle (only works on mobile via CSS)
    if (elements.btnToggleSliders) {
        elements.btnToggleSliders.addEventListener('click', () => {
            elements.btnToggleSliders.classList.toggle('collapsed');
            elements.slidersPanel.classList.toggle('collapsed');
        });
    }
}

function setupSlider(sliderId, valueId, stateKey, multiplier) {
    const slider = elements[sliderId];
    const valueDisplay = elements[valueId];

    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value) * multiplier;
        state[stateKey] = value;
        valueDisplay.textContent = value.toFixed(multiplier < 1 ? 1 : 0);
    });
}

// ========================================
// Video Source Management
// ========================================
async function startCamera() {
    try {
        hideError();

        // Stop any existing video
        stopVideoSource();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        elements.videoSource.srcObject = stream;
        await elements.videoSource.play();

        // Ensure canvas is sized after camera starts
        resizeCanvas();

        state.videoSource = 'camera';
        state.isVideoReady = true;

        // Update UI
        elements.btnCamera.classList.add('active');

    } catch (err) {
        showError('Camera access denied. Please allow camera permissions or upload a video file.');
        console.error('Camera error:', err);
    }
}

function loadVideoFile(file) {
    hideError();
    stopVideoSource();

    const url = URL.createObjectURL(file);
    elements.videoSource.srcObject = null;
    elements.videoSource.src = url;
    elements.videoSource.loop = true;
    elements.videoSource.muted = true;

    elements.videoSource.onloadedmetadata = () => {
        // Resize canvas when video metadata loads
        resizeCanvas();
    };

    elements.videoSource.onloadeddata = () => {
        elements.videoSource.play();
        state.videoSource = 'file';
        state.isVideoReady = true;
        elements.btnCamera.classList.remove('active');
    };

    elements.videoSource.onerror = () => {
        showError('Could not load video file. Try a different format.');
    };
}

function stopVideoSource() {
    // Stop camera stream if active
    if (elements.videoSource.srcObject) {
        elements.videoSource.srcObject.getTracks().forEach(track => track.stop());
        elements.videoSource.srcObject = null;
    }

    // Clear video file
    if (elements.videoSource.src) {
        URL.revokeObjectURL(elements.videoSource.src);
        elements.videoSource.src = '';
    }

    state.isVideoReady = false;
}

// ========================================
// ASCII Rendering
// ========================================
function renderLoop() {
    if (!state.isFrozen) {
        renderASCII();
    }

    requestAnimationFrame(renderLoop);
}

function renderASCII() {
    if (!state.isVideoReady) return;

    const ctx = elements.ctx;
    const canvas = elements.canvas;
    const video = elements.videoSource;

    const fontSize = state.fontSize;
    const contrast = state.contrast;

    // Get current charset
    let charset = CONFIG.charsets[state.charsetMode] || CONFIG.charsets.dense;
    if (state.charsetMode === 'word' && state.wordPhrase.length > 0) {
        charset = state.wordPhrase;
    }

    // Calculate grid dimensions
    const cols = Math.floor(canvas.width / (fontSize * 0.6));
    const rows = Math.floor(canvas.height / fontSize);

    // Resize offscreen canvas to match sampling resolution
    const sampleWidth = Math.min(cols, 180);
    const sampleHeight = Math.min(rows, 135);

    if (offscreenCanvas.width !== sampleWidth || offscreenCanvas.height !== sampleHeight) {
        offscreenCanvas.width = sampleWidth;
        offscreenCanvas.height = sampleHeight;
    }

    // Draw video frame to offscreen canvas
    offscreenCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight);

    // Get pixel data
    const imageData = offscreenCtx.getImageData(0, 0, sampleWidth, sampleHeight);
    const pixels = imageData.data;

    // Compute luminance values
    const luminance = new Float32Array(sampleWidth * sampleHeight);
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        // Standard luminance formula
        luminance[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Apply edge detection if outline mode
    let renderData = luminance;
    if (state.outlineMode) {
        renderData = applySobelEdgeDetection(luminance, sampleWidth, sampleHeight);
    }

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Setup text rendering
    ctx.font = `${fontSize}px 'SF Mono', Monaco, monospace`;
    ctx.textBaseline = 'top';

    // Apply glow if enabled
    if (state.glow > 0) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = state.glow * 15;
    } else {
        ctx.shadowBlur = 0;
    }

    // Render ASCII characters
    const cellWidth = canvas.width / sampleWidth;
    const cellHeight = canvas.height / sampleHeight;

    for (let y = 0; y < sampleHeight; y++) {
        for (let x = 0; x < sampleWidth; x++) {
            const idx = y * sampleWidth + x;
            let lum = renderData[idx];

            // Apply contrast
            lum = ((lum / 255 - 0.5) * contrast + 0.5) * 255;
            lum = Math.max(0, Math.min(255, lum));

            // Apply threshold
            if (lum < state.threshold) {
                lum = 0;
            }

            // Map luminance to character
            let charIndex;
            if (state.charsetMode === 'word' && state.wordPhrase.length > 0) {
                // In word mode, cycle through phrase
                if (lum > state.threshold) {
                    charIndex = state.wordIndex % charset.length;
                    state.wordIndex++;
                } else {
                    continue; // Skip dark areas in word mode
                }
            } else {
                charIndex = Math.floor((lum / 255) * (charset.length - 1));
            }

            const char = charset[charIndex];

            // Skip spaces for performance
            if (char === ' ') continue;

            // Calculate position
            const px = x * cellWidth;
            const py = y * cellHeight;

            // Set color (white)
            ctx.fillStyle = '#fff';
            ctx.fillText(char, px, py);
        }
    }

    // Reset word index each frame for consistent cycling
    if (state.charsetMode === 'word') {
        state.wordIndex = 0;
    }
}

// ========================================
// Edge Detection (Sobel-lite)
// ========================================
function applySobelEdgeDetection(luminance, width, height) {
    const edges = new Float32Array(width * height);

    // Sobel kernels
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;

            // Apply 3x3 kernel
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kernelIdx = (ky + 1) * 3 + (kx + 1);

                    sumX += luminance[idx] * gx[kernelIdx];
                    sumY += luminance[idx] * gy[kernelIdx];
                }
            }

            // Gradient magnitude
            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            edges[y * width + x] = Math.min(255, magnitude);
        }
    }

    return edges;
}

// ========================================
// Action Functions
// ========================================
function toggleFreeze() {
    state.isFrozen = !state.isFrozen;
    elements.btnFreeze.textContent = state.isFrozen ? 'Unfreeze' : 'Freeze';
    elements.btnFreeze.classList.toggle('active', state.isFrozen);
}

function takeSnapshot() {
    const link = document.createElement('a');
    link.download = `ascii-cam-${Date.now()}.png`;
    link.href = elements.canvas.toDataURL('image/png');
    link.click();
}

async function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
        return;
    }

    try {
        const stream = elements.canvas.captureStream(30);
        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm'
        });

        state.recordedChunks = [];

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                state.recordedChunks.push(e.data);
            }
        };

        state.mediaRecorder.onstop = () => {
            const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `ascii-cam-${Date.now()}.webm`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        };

        state.mediaRecorder.start();
        state.isRecording = true;
        elements.btnRecord.textContent = 'Recording...';
        elements.btnRecord.classList.add('recording');

        // Auto-stop after 5 seconds
        setTimeout(() => {
            if (state.isRecording) {
                stopRecording();
            }
        }, 5000);

    } catch (err) {
        showError('Recording not supported in this browser.');
        console.error('Recording error:', err);
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;
        elements.btnRecord.textContent = 'Record 5s';
        elements.btnRecord.classList.remove('recording');
    }
}

function resetSettings() {
    // Reset state to defaults
    Object.keys(CONFIG.defaults).forEach(key => {
        state[key] = CONFIG.defaults[key];
    });

    // Reset sliders
    elements.sliderStep.value = CONFIG.defaults.step;
    elements.sliderFontSize.value = CONFIG.defaults.fontSize;
    elements.sliderContrast.value = CONFIG.defaults.contrast * 100;
    elements.sliderThreshold.value = CONFIG.defaults.threshold;
    elements.sliderGlow.value = CONFIG.defaults.glow * 100;

    // Reset value displays
    elements.valStep.textContent = CONFIG.defaults.step;
    elements.valFontSize.textContent = CONFIG.defaults.fontSize;
    elements.valContrast.textContent = CONFIG.defaults.contrast.toFixed(1);
    elements.valThreshold.textContent = CONFIG.defaults.threshold;
    elements.valGlow.textContent = CONFIG.defaults.glow.toFixed(1);

    // Reset modes
    state.outlineMode = false;
    state.charsetMode = 'dense';
    state.wordPhrase = '';

    elements.btnOutline.classList.remove('active');
    elements.charsetMode.value = 'dense';
    elements.wordInput.style.display = 'none';
    elements.wordInput.value = '';

    // Unfreeze
    if (state.isFrozen) {
        toggleFreeze();
    }

    hideError();
}

// ========================================
// Utility Functions
// ========================================
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add('visible');
}

function hideError() {
    elements.errorMessage.classList.remove('visible');
}

// ========================================
// Start Application
// ========================================
document.addEventListener('DOMContentLoaded', init);
