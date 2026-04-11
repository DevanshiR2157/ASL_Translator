/**
 * state.js
 * --------
 * Single source of truth for all shared mutable state.
 * Every other module reads from / writes to this object so there
 * are no hidden globals scattered across files.
 */

'use strict';

// ── Canvas / rendering ────────────────────────────────────────────────────────
const videoElement = document.querySelector('.input_video');
const bgCanvas     = document.getElementById('bgCanvas');
const mainCanvas   = document.getElementById('mainCanvas');
const bgCtx        = bgCanvas.getContext('2d');
const ctx          = mainCanvas.getContext('2d');

// ── Dimensions (kept in sync by resize()) ─────────────────────────────────────
let width  = window.innerWidth;
let height = window.innerHeight;

// ── Timing ────────────────────────────────────────────────────────────────────
let time             = 0;
let lastTime         = performance.now();
let framesThisSecond = 0;
let lastFpsTime      = performance.now();

// ── Hand data ─────────────────────────────────────────────────────────────────
let currentHands    = [];   // Latest landmark arrays from MediaPipe
let handVelocities  = 0;    // Average movement speed (rough, single value)

// ── Theme ─────────────────────────────────────────────────────────────────────
let currentTheme = 'Rainbow';

/** Returns a CSS colour string for a given theme, time offset, and position. */
const themes = {
    Rainbow:   (t, index, total) => `hsl(${(t * 100 + index * (360 / total)) % 360}, 100%, 60%)`,
    Cyberpunk: (t, index, total) => (index % 2 === 0) ? '#ff003c' : '#00f0ff',
    Lava:      (t, index, total) => `hsl(${(10 + index * 10) % 40}, 100%, ${50 + Math.sin(t) * 10}%)`,
    Ocean:     (t, index, total) => `hsl(${180 + index * 20}, 100%, 60%)`,
    Galaxy:    (t, index, total) => `hsl(${260 + Math.sin(t * 2 + index) * 40}, 100%, 65%)`,
};

// ── Physics arrays ────────────────────────────────────────────────────────────
let particles = [];
let ripples   = [];

// ── Constants ─────────────────────────────────────────────────────────────────
const FINGER_TIPS = [4, 8, 12, 16, 20];
const fontSize    = 16;

// ── Matrix background ─────────────────────────────────────────────────────────
let matrixColumns = [];
let maxColumns    = 0;

// ── UI element refs ───────────────────────────────────────────────────────────
const uiHands   = document.getElementById('ui-hands');
const uiFps     = document.getElementById('ui-fps');
const uiGesture = document.getElementById('ui-gesture');
const uiSpread  = document.getElementById('ui-spread');

// ── Resize handler ────────────────────────────────────────────────────────────
function resize() {
    width  = window.innerWidth;
    height = window.innerHeight;

    bgCanvas.width   = width;
    bgCanvas.height  = height;
    mainCanvas.width  = width;
    mainCanvas.height = height;

    maxColumns    = Math.floor(width / fontSize);
    matrixColumns = Array.from({ length: maxColumns }, () => Math.random() * height / fontSize);
}

window.addEventListener('resize', resize);
resize();
