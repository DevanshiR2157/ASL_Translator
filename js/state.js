/**
 * state.js
 * --------
 * Single source of truth for all shared mutable state.
 */

'use strict';

// ── Canvas / rendering ────────────────────────────────────────────────────────
const videoElement = document.querySelector('.input_video');
const bgCanvas     = document.getElementById('bgCanvas');
const mainCanvas   = document.getElementById('mainCanvas');
const bgCtx        = bgCanvas.getContext('2d');
const ctx          = mainCanvas.getContext('2d');

// ── Dimensions ────────────────────────────────────────────────────────────────
let width  = window.innerWidth;
let height = window.innerHeight;

// ── Timing ────────────────────────────────────────────────────────────────────
let time             = 0;
let lastTime         = performance.now();
let framesThisSecond = 0;
let lastFpsTime      = performance.now();

// ── Hand data ─────────────────────────────────────────────────────────────────
let currentHands   = [];
let handVelocities = 0;

// ── ASL classification state ──────────────────────────────────────────────────
let detectedLetter       = '–';
let letterConfidence     = 0;      // 0–1
let classificationSource = 'none'; // 'rules' | 'ml' | 'none'
let mlModelReady         = false;

// ── Theme ─────────────────────────────────────────────────────────────────────
let currentTheme = 'Rainbow';

const themes = {
    Rainbow:   (t, i, total) => `hsl(${(t * 100 + i * (360 / total)) % 360}, 100%, 60%)`,
    Cyberpunk: (t, i)        => (i % 2 === 0) ? '#ff003c' : '#00f0ff',
    Lava:      (t, i)        => `hsl(${(10 + i * 10) % 40}, 100%, ${50 + Math.sin(t) * 10}%)`,
    Ocean:     (t, i)        => `hsl(${180 + i * 20}, 100%, 60%)`,
    Galaxy:    (t, i)        => `hsl(${260 + Math.sin(t * 2 + i) * 40}, 100%, 65%)`,
};

// ── Physics arrays ────────────────────────────────────────────────────────────
let particles = [];
let ripples   = [];

// ── Constants ─────────────────────────────────────────────────────────────────
const FINGER_TIPS = [4, 8, 12, 16, 20];
const fontSize    = 16;

// MediaPipe landmark index map
const LM = {
    WRIST: 0,
    THUMB_CMC: 1,  THUMB_MCP: 2,   THUMB_IP: 3,    THUMB_TIP: 4,
    INDEX_MCP: 5,  INDEX_PIP: 6,   INDEX_DIP: 7,   INDEX_TIP: 8,
    MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
    RING_MCP: 13,  RING_PIP: 14,   RING_DIP: 15,   RING_TIP: 16,
    PINKY_MCP: 17, PINKY_PIP: 18,  PINKY_DIP: 19,  PINKY_TIP: 20,
};

// ── Matrix background ─────────────────────────────────────────────────────────
let matrixColumns = [];
let maxColumns    = 0;

// ── UI refs ───────────────────────────────────────────────────────────────────
const uiHands      = document.getElementById('ui-hands');
const uiFps        = document.getElementById('ui-fps');
const uiLetter     = document.getElementById('ui-letter');
const uiConfidence = document.getElementById('ui-confidence');
const uiSource     = document.getElementById('ui-source');
const uiConfBar    = document.getElementById('ui-conf-bar');

// ── Resize handler ────────────────────────────────────────────────────────────
function resize() {
    width  = window.innerWidth;
    height = window.innerHeight;

    bgCanvas.width    = width;
    bgCanvas.height   = height;
    mainCanvas.width  = width;
    mainCanvas.height = height;

    maxColumns    = Math.floor(width / fontSize);
    matrixColumns = Array.from({ length: maxColumns }, () => Math.random() * height / fontSize);
}

window.addEventListener('resize', resize);
resize();
