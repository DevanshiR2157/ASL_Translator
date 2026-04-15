/**
 * main.js
 * -------
 * Application entry point.
 *
 * - Wires theme switcher
 * - Start-button handler: boots audio, ML model, MediaPipe, render loop
 */

'use strict';

// ── Theme switcher ────────────────────────────────────────────────────────────
document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTheme = e.target.getAttribute('data-theme');
        document.documentElement.style.setProperty('--accent', themes[currentTheme](0, 1, 1));
    });
});

// ── Start button ──────────────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', async () => {
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('themes').classList.remove('hidden');

    initAudio();
    initMediaPipe();
    requestAnimationFrame(renderLoop);

    // Load ML model asynchronously — HUD shows status
    const mlStatus = document.getElementById('ui-ml-status');
    if (mlStatus) mlStatus.innerText = 'Loading…';

    try {
        await initASLModel();
        if (mlStatus) {
            mlStatus.innerText      = mlModelReady ? 'Ready ✓' : 'Rules only';
            mlStatus.style.color    = mlModelReady ? '#00ffcc' : '#ffcc00';
        }
    } catch (e) {
        if (mlStatus) {
            mlStatus.innerText   = 'Rules only';
            mlStatus.style.color = '#ffcc00';
        }
    }
});
