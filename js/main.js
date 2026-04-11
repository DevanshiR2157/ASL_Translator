/**
 * main.js
 * -------
 * Application entry point.
 *
 * Responsibilities:
 *   • Theme-switcher UI
 *   • Start-button click handler (triggers AudioContext, MediaPipe, render loop)
 *
 * Everything else is handled by the dedicated modules loaded before this file.
 */

'use strict';

// ── Theme switcher ────────────────────────────────────────────────────────────
document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTheme = e.target.getAttribute('data-theme');
        // Update the CSS accent variable to match the new theme
        document.documentElement.style.setProperty('--accent', themes[currentTheme](0, 1, 1));
    });
});

// ── Start button ──────────────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('themes').classList.remove('hidden');

    initAudio();       // audio.js
    initMediaPipe();   // hands.js

    requestAnimationFrame(renderLoop); // renderer.js
});
