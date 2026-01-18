/**
 * ASCII Cam - Real-time camera to ASCII renderer
 * Dual Shell UI: Desktop + Mobile with shared logic
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

// Application state (shared between shells)
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
    recordedChunks: [],

    // UI state
    currentShell: 'desktop',
    mobileInitialized: false
};

// ========================================
// DOM Elements - Desktop Shell
// ========================================
const desktopElements = {
    shell: null,
    btnCamera: null,
    videoUpload: null,
    btnOutline: null,
    charsetMode: null,
    wordInput: null,
    btnFreeze: null,
    btnSnapshot: null,
    btnRecord: null,
    btnReset: null,
    sliderStep: null,
    sliderFontSize: null,
    sliderContrast: null,
    sliderThreshold: null,
    sliderGlow: null,
    valStep: null,
    valFontSize: null,
    valContrast: null,
    valThreshold: null,
    valGlow: null,
    errorMessage: null
};

// ========================================
// DOM Elements - Mobile Shell
// ========================================
const mobileElements = {
    shell: null,
    topBar: null,
    bottomBar: null,
    sheet: null,
    btnCamera: null,
    videoUpload: null,
    btnSettings: null,
    btnOutline: null,
    btnFreeze: null,
    btnSnapshot: null,
    btnRecord: null,
    btnReset: null,
    btnCloseSheet: null,
    sheetHandle: null,
    charsetMode: null,
    wordInput: null,
    sliderStep: null,
    sliderFontSize: null,
    sliderContrast: null,
    sliderThreshold: null,
    sliderGlow: null,
    valStep: null,
    valFontSize: null,
    valContrast: null,
    valThreshold: null,
    valGlow: null,
    errorMessage: null
};

// Shared elements
const sharedElements = {
    videoSource: null,
    canvas: null,
    ctx: null
};

// Offscreen canvas for video sampling
let offscreenCanvas, offscreenCtx;

// Debounce timer for resize
let resizeDebounce = null;

// ========================================
// Device Detection
// ========================================
function isMobileUI() {
    const maxWidthMatch = window.matchMedia('(max-width: 768px)').matches;
    const pointerMatch = window.matchMedia('(pointer: coarse)').matches;
    return maxWidthMatch || pointerMatch;
}

// ========================================
// Shell Management
// ========================================
function applyShell() {
    const isMobile = isMobileUI();
    const newShell = isMobile ? 'mobile' : 'desktop';

    // Update aria-hidden
    if (desktopElements.shell) {
        desktopElements.shell.setAttribute('aria-hidden', isMobile ? 'true' : 'false');
    }
    if (mobileElements.shell) {
        mobileElements.shell.setAttribute('aria-hidden', isMobile ? 'false' : 'true');
    }

    // Initialize mobile shell if needed
    if (isMobile && !state.mobileInitialized) {
        initMobileElements();
        setupMobileEventListeners();
        syncMobileUI();
        state.mobileInitialized = true;
    }

    // Sync UI when switching shells
    if (state.currentShell !== newShell) {
        if (isMobile) {
            syncMobileUI();
        } else {
            syncDesktopUI();
        }
        state.currentShell = newShell;
    }
}

// ========================================
// Initialization
// ========================================
function init() {
    // Get shared elements
    sharedElements.videoSource = document.getElementById('videoSource');
    sharedElements.canvas = document.getElementById('asciiCanvas');
    sharedElements.ctx = sharedElements.canvas.getContext('2d');

    // Create offscreen canvas
    offscreenCanvas = document.createElement('canvas');
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // Resize canvas to window
    resizeCanvas();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Initialize desktop elements
    initDesktopElements();
    setupDesktopEventListeners();

    // Get shell elements
    desktopElements.shell = document.getElementById('desktopShell');
    mobileElements.shell = document.getElementById('mobileShell');

    // Apply correct shell based on device
    applyShell();

    // Set mobile defaults on small screens
    if (window.innerWidth < 768) {
        state.step = 10;
        updateSliderUI('step', 10);
    }

    // Start with camera
    startCamera();

    // Start render loop
    requestAnimationFrame(renderLoop);
}

function initDesktopElements() {
    desktopElements.btnCamera = document.getElementById('btnCamera');
    desktopElements.videoUpload = document.getElementById('videoUpload');
    desktopElements.btnOutline = document.getElementById('btnOutline');
    desktopElements.charsetMode = document.getElementById('charsetMode');
    desktopElements.wordInput = document.getElementById('wordInput');
    desktopElements.btnFreeze = document.getElementById('btnFreeze');
    desktopElements.btnSnapshot = document.getElementById('btnSnapshot');
    desktopElements.btnRecord = document.getElementById('btnRecord');
    desktopElements.btnReset = document.getElementById('btnReset');
    desktopElements.sliderStep = document.getElementById('sliderStep');
    desktopElements.sliderFontSize = document.getElementById('sliderFontSize');
    desktopElements.sliderContrast = document.getElementById('sliderContrast');
    desktopElements.sliderThreshold = document.getElementById('sliderThreshold');
    desktopElements.sliderGlow = document.getElementById('sliderGlow');
    desktopElements.valStep = document.getElementById('valStep');
    desktopElements.valFontSize = document.getElementById('valFontSize');
    desktopElements.valContrast = document.getElementById('valContrast');
    desktopElements.valThreshold = document.getElementById('valThreshold');
    desktopElements.valGlow = document.getElementById('valGlow');
    desktopElements.errorMessage = document.getElementById('errorMessage');
}

function initMobileElements() {
    mobileElements.topBar = document.getElementById('mobileTopBar');
    mobileElements.bottomBar = document.getElementById('mobileBottomBar');
    mobileElements.sheet = document.getElementById('mobileSheet');
    mobileElements.btnCamera = document.getElementById('mBtnCamera');
    mobileElements.videoUpload = document.getElementById('mVideoUpload');
    mobileElements.btnSettings = document.getElementById('mBtnSettings');
    mobileElements.btnOutline = document.getElementById('mBtnOutline');
    mobileElements.btnFreeze = document.getElementById('mBtnFreeze');
    mobileElements.btnSnapshot = document.getElementById('mBtnSnapshot');
    mobileElements.btnRecord = document.getElementById('mBtnRecord');
    mobileElements.btnReset = document.getElementById('mBtnReset');
    mobileElements.btnCloseSheet = document.getElementById('mBtnCloseSheet');
    mobileElements.sheetHandle = document.getElementById('mSheetHandle');
    mobileElements.charsetMode = document.getElementById('mCharsetMode');
    mobileElements.wordInput = document.getElementById('mWordInput');
    mobileElements.sliderStep = document.getElementById('mSliderStep');
    mobileElements.sliderFontSize = document.getElementById('mSliderFontSize');
    mobileElements.sliderContrast = document.getElementById('mSliderContrast');
    mobileElements.sliderThreshold = document.getElementById('mSliderThreshold');
    mobileElements.sliderGlow = document.getElementById('mSliderGlow');
    mobileElements.valStep = document.getElementById('mValStep');
    mobileElements.valFontSize = document.getElementById('mValFontSize');
    mobileElements.valContrast = document.getElementById('mValContrast');
    mobileElements.valThreshold = document.getElementById('mValThreshold');
    mobileElements.valGlow = document.getElementById('mValGlow');
    mobileElements.errorMessage = document.getElementById('mErrorMessage');
}

function handleResize() {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
        resizeCanvas();
        applyShell();
    }, 100);
}

function resizeCanvas() {
    sharedElements.canvas.width = window.innerWidth;
    sharedElements.canvas.height = window.innerHeight;
}

// ========================================
// Desktop Event Listeners
// ========================================
function setupDesktopEventListeners() {
    // Video source
    desktopElements.btnCamera.addEventListener('click', startCamera);
    desktopElements.videoUpload.addEventListener('change', handleVideoUpload);

    // Toggles
    desktopElements.btnOutline.addEventListener('click', toggleOutline);
    desktopElements.charsetMode.addEventListener('change', handleCharsetChange);
    desktopElements.wordInput.addEventListener('input', handleWordInput);

    // Sliders
    setupDesktopSlider('sliderStep', 'valStep', 'step', 1);
    setupDesktopSlider('sliderFontSize', 'valFontSize', 'fontSize', 1);
    setupDesktopSlider('sliderContrast', 'valContrast', 'contrast', 0.01);
    setupDesktopSlider('sliderThreshold', 'valThreshold', 'threshold', 1);
    setupDesktopSlider('sliderGlow', 'valGlow', 'glow', 0.01);

    // Actions
    desktopElements.btnFreeze.addEventListener('click', toggleFreeze);
    desktopElements.btnSnapshot.addEventListener('click', takeSnapshot);
    desktopElements.btnRecord.addEventListener('click', toggleRecording);
    desktopElements.btnReset.addEventListener('click', resetSettings);
}

function setupDesktopSlider(sliderId, valueId, stateKey, multiplier) {
    const slider = desktopElements[sliderId];
    const valueDisplay = desktopElements[valueId];

    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value) * multiplier;
        state[stateKey] = value;
        valueDisplay.textContent = value.toFixed(multiplier < 1 ? 1 : 0);
        // Sync to mobile if initialized
        if (state.mobileInitialized) {
            syncMobileSlider(stateKey);
        }
    });
}

// ========================================
// Mobile Event Listeners
// ========================================
function setupMobileEventListeners() {
    // Video source
    mobileElements.btnCamera.addEventListener('click', startCamera);
    mobileElements.videoUpload.addEventListener('change', handleVideoUpload);

    // Settings sheet
    mobileElements.btnSettings.addEventListener('click', openSheet);
    mobileElements.btnCloseSheet.addEventListener('click', closeSheet);
    mobileElements.sheetHandle.addEventListener('click', closeSheet);

    // Toggles
    mobileElements.btnOutline.addEventListener('click', toggleOutline);
    mobileElements.charsetMode.addEventListener('change', handleCharsetChange);
    mobileElements.wordInput.addEventListener('input', handleWordInput);

    // Sliders
    setupMobileSlider('sliderStep', 'valStep', 'step', 1);
    setupMobileSlider('sliderFontSize', 'valFontSize', 'fontSize', 1);
    setupMobileSlider('sliderContrast', 'valContrast', 'contrast', 0.01);
    setupMobileSlider('sliderThreshold', 'valThreshold', 'threshold', 1);
    setupMobileSlider('sliderGlow', 'valGlow', 'glow', 0.01);

    // Actions
    mobileElements.btnFreeze.addEventListener('click', toggleFreeze);
    mobileElements.btnSnapshot.addEventListener('click', takeSnapshot);
    mobileElements.btnRecord.addEventListener('click', toggleRecording);
    mobileElements.btnReset.addEventListener('click', resetSettings);
}

function setupMobileSlider(sliderId, valueId, stateKey, multiplier) {
    const slider = mobileElements[sliderId];
    const valueDisplay = mobileElements[valueId];

    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value) * multiplier;
        state[stateKey] = value;
        valueDisplay.textContent = value.toFixed(multiplier < 1 ? 1 : 0);
        // Sync to desktop
        syncDesktopSlider(stateKey);
    });
}

// ========================================
// UI Sync Functions
// ========================================
function syncMobileUI() {
    if (!state.mobileInitialized) return;

    // Sync sliders
    mobileElements.sliderStep.value = state.step;
    mobileElements.sliderFontSize.value = state.fontSize;
    mobileElements.sliderContrast.value = state.contrast * 100;
    mobileElements.sliderThreshold.value = state.threshold;
    mobileElements.sliderGlow.value = state.glow * 100;

    // Sync value displays
    mobileElements.valStep.textContent = state.step;
    mobileElements.valFontSize.textContent = state.fontSize;
    mobileElements.valContrast.textContent = state.contrast.toFixed(1);
    mobileElements.valThreshold.textContent = state.threshold;
    mobileElements.valGlow.textContent = state.glow.toFixed(1);

    // Sync toggles
    mobileElements.charsetMode.value = state.charsetMode;
    mobileElements.wordInput.style.display = state.charsetMode === 'word' ? 'block' : 'none';
    mobileElements.wordInput.value = state.wordPhrase;
    mobileElements.btnOutline.classList.toggle('active', state.outlineMode);
    mobileElements.btnFreeze.classList.toggle('active', state.isFrozen);
    mobileElements.btnFreeze.textContent = state.isFrozen ? 'Unfreeze' : 'Freeze';

    // Camera button state
    mobileElements.btnCamera.classList.toggle('active', state.videoSource === 'camera');
}

function syncDesktopUI() {
    // Sync sliders
    desktopElements.sliderStep.value = state.step;
    desktopElements.sliderFontSize.value = state.fontSize;
    desktopElements.sliderContrast.value = state.contrast * 100;
    desktopElements.sliderThreshold.value = state.threshold;
    desktopElements.sliderGlow.value = state.glow * 100;

    // Sync value displays
    desktopElements.valStep.textContent = state.step;
    desktopElements.valFontSize.textContent = state.fontSize;
    desktopElements.valContrast.textContent = state.contrast.toFixed(1);
    desktopElements.valThreshold.textContent = state.threshold;
    desktopElements.valGlow.textContent = state.glow.toFixed(1);

    // Sync toggles
    desktopElements.charsetMode.value = state.charsetMode;
    desktopElements.wordInput.style.display = state.charsetMode === 'word' ? 'block' : 'none';
    desktopElements.wordInput.value = state.wordPhrase;
    desktopElements.btnOutline.classList.toggle('active', state.outlineMode);
    desktopElements.btnFreeze.classList.toggle('active', state.isFrozen);
    desktopElements.btnFreeze.textContent = state.isFrozen ? 'Unfreeze' : 'Freeze';

    // Camera button state
    desktopElements.btnCamera.classList.toggle('active', state.videoSource === 'camera');
}

function syncMobileSlider(stateKey) {
    const sliderMap = {
        step: { slider: 'sliderStep', val: 'valStep', mult: 1 },
        fontSize: { slider: 'sliderFontSize', val: 'valFontSize', mult: 1 },
        contrast: { slider: 'sliderContrast', val: 'valContrast', mult: 0.01 },
        threshold: { slider: 'sliderThreshold', val: 'valThreshold', mult: 1 },
        glow: { slider: 'sliderGlow', val: 'valGlow', mult: 0.01 }
    };
    const map = sliderMap[stateKey];
    if (map && mobileElements[map.slider]) {
        mobileElements[map.slider].value = state[stateKey] / map.mult;
        mobileElements[map.val].textContent = state[stateKey].toFixed(map.mult < 1 ? 1 : 0);
    }
}

function syncDesktopSlider(stateKey) {
    const sliderMap = {
        step: { slider: 'sliderStep', val: 'valStep', mult: 1 },
        fontSize: { slider: 'sliderFontSize', val: 'valFontSize', mult: 1 },
        contrast: { slider: 'sliderContrast', val: 'valContrast', mult: 0.01 },
        threshold: { slider: 'sliderThreshold', val: 'valThreshold', mult: 1 },
        glow: { slider: 'sliderGlow', val: 'valGlow', mult: 0.01 }
    };
    const map = sliderMap[stateKey];
    if (map && desktopElements[map.slider]) {
        desktopElements[map.slider].value = state[stateKey] / map.mult;
        desktopElements[map.val].textContent = state[stateKey].toFixed(map.mult < 1 ? 1 : 0);
    }
}

function updateSliderUI(stateKey, value) {
    state[stateKey] = value;
    syncDesktopSlider(stateKey);
    if (state.mobileInitialized) {
        syncMobileSlider(stateKey);
    }
}

// ========================================
// Mobile Sheet Controls
// ========================================
function openSheet() {
    mobileElements.sheet.classList.add('open');
}

function closeSheet() {
    mobileElements.sheet.classList.remove('open');
}

// ========================================
// Shared Control Functions
// ========================================
function handleVideoUpload(e) {
    if (e.target.files[0]) {
        loadVideoFile(e.target.files[0]);
    }
}

function handleCharsetChange(e) {
    state.charsetMode = e.target.value;
    const showWord = e.target.value === 'word';
    desktopElements.wordInput.style.display = showWord ? 'block' : 'none';
    if (state.mobileInitialized) {
        mobileElements.wordInput.style.display = showWord ? 'block' : 'none';
        mobileElements.charsetMode.value = e.target.value;
    }
    desktopElements.charsetMode.value = e.target.value;
}

function handleWordInput(e) {
    state.wordPhrase = e.target.value;
    state.wordIndex = 0;
    // Sync across shells
    desktopElements.wordInput.value = state.wordPhrase;
    if (state.mobileInitialized) {
        mobileElements.wordInput.value = state.wordPhrase;
    }
}

function toggleOutline() {
    state.outlineMode = !state.outlineMode;
    desktopElements.btnOutline.classList.toggle('active', state.outlineMode);
    if (state.mobileInitialized) {
        mobileElements.btnOutline.classList.toggle('active', state.outlineMode);
    }
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

        sharedElements.videoSource.srcObject = stream;
        await sharedElements.videoSource.play();

        // Ensure canvas is sized after camera starts
        resizeCanvas();

        state.videoSource = 'camera';
        state.isVideoReady = true;

        // Update UI
        desktopElements.btnCamera.classList.add('active');
        if (state.mobileInitialized) {
            mobileElements.btnCamera.classList.add('active');
        }

    } catch (err) {
        showError('Camera access denied. Please allow camera permissions or upload a video file.');
        console.error('Camera error:', err);
    }
}

function loadVideoFile(file) {
    hideError();
    stopVideoSource();

    const url = URL.createObjectURL(file);
    sharedElements.videoSource.srcObject = null;
    sharedElements.videoSource.src = url;
    sharedElements.videoSource.loop = true;
    sharedElements.videoSource.muted = true;

    sharedElements.videoSource.onloadedmetadata = () => {
        resizeCanvas();
    };

    sharedElements.videoSource.onloadeddata = () => {
        sharedElements.videoSource.play();
        state.videoSource = 'file';
        state.isVideoReady = true;
        desktopElements.btnCamera.classList.remove('active');
        if (state.mobileInitialized) {
            mobileElements.btnCamera.classList.remove('active');
        }
    };

    sharedElements.videoSource.onerror = () => {
        showError('Could not load video file. Try a different format.');
    };
}

function stopVideoSource() {
    if (sharedElements.videoSource.srcObject) {
        sharedElements.videoSource.srcObject.getTracks().forEach(track => track.stop());
        sharedElements.videoSource.srcObject = null;
    }

    if (sharedElements.videoSource.src) {
        URL.revokeObjectURL(sharedElements.videoSource.src);
        sharedElements.videoSource.src = '';
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

    const ctx = sharedElements.ctx;
    const canvas = sharedElements.canvas;
    const video = sharedElements.videoSource;

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
                if (lum > state.threshold) {
                    charIndex = state.wordIndex % charset.length;
                    state.wordIndex++;
                } else {
                    continue;
                }
            } else {
                charIndex = Math.floor((lum / 255) * (charset.length - 1));
            }

            const char = charset[charIndex];
            if (char === ' ') continue;

            const px = x * cellWidth;
            const py = y * cellHeight;

            ctx.fillStyle = '#fff';
            ctx.fillText(char, px, py);
        }
    }

    if (state.charsetMode === 'word') {
        state.wordIndex = 0;
    }
}

// ========================================
// Edge Detection (Sobel-lite)
// ========================================
function applySobelEdgeDetection(luminance, width, height) {
    const edges = new Float32Array(width * height);
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const kernelIdx = (ky + 1) * 3 + (kx + 1);
                    sumX += luminance[idx] * gx[kernelIdx];
                    sumY += luminance[idx] * gy[kernelIdx];
                }
            }

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
    const text = state.isFrozen ? 'Unfreeze' : 'Freeze';

    desktopElements.btnFreeze.textContent = text;
    desktopElements.btnFreeze.classList.toggle('active', state.isFrozen);

    if (state.mobileInitialized) {
        mobileElements.btnFreeze.textContent = state.isFrozen ? 'Unfreeze' : 'Freeze';
        mobileElements.btnFreeze.classList.toggle('active', state.isFrozen);
    }
}

function takeSnapshot() {
    const link = document.createElement('a');
    link.download = `ascii-cam-${Date.now()}.png`;
    link.href = sharedElements.canvas.toDataURL('image/png');
    link.click();
}

async function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
        return;
    }

    try {
        const stream = sharedElements.canvas.captureStream(30);
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

        desktopElements.btnRecord.textContent = 'Recording...';
        desktopElements.btnRecord.classList.add('recording');

        if (state.mobileInitialized) {
            mobileElements.btnRecord.textContent = 'Stop';
            mobileElements.btnRecord.classList.add('recording');
        }

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

        desktopElements.btnRecord.textContent = 'Record 5s';
        desktopElements.btnRecord.classList.remove('recording');

        if (state.mobileInitialized) {
            mobileElements.btnRecord.textContent = 'Record';
            mobileElements.btnRecord.classList.remove('recording');
        }
    }
}

function resetSettings() {
    // Reset state
    Object.keys(CONFIG.defaults).forEach(key => {
        state[key] = CONFIG.defaults[key];
    });

    state.outlineMode = false;
    state.charsetMode = 'dense';
    state.wordPhrase = '';

    // Sync both UIs
    syncDesktopUI();
    if (state.mobileInitialized) {
        syncMobileUI();
        closeSheet();
    }

    // Unfreeze
    if (state.isFrozen) {
        toggleFreeze();
    }

    hideError();
}

// ========================================
// Error Handling
// ========================================
function showError(message) {
    desktopElements.errorMessage.textContent = message;
    desktopElements.errorMessage.classList.add('visible');

    if (state.mobileInitialized) {
        mobileElements.errorMessage.textContent = message;
        mobileElements.errorMessage.classList.add('visible');

        // Auto-hide on mobile after 4 seconds
        setTimeout(() => {
            mobileElements.errorMessage.classList.remove('visible');
        }, 4000);
    }
}

function hideError() {
    desktopElements.errorMessage.classList.remove('visible');
    if (state.mobileInitialized) {
        mobileElements.errorMessage.classList.remove('visible');
    }
}

// ========================================
// Start Application
// ========================================
document.addEventListener('DOMContentLoaded', init);
