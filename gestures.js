/**
 * gestures.js
 * -----------
 * Analyses the current hand landmark data and fires side-effects
 * (audio, particles, UI updates) when gestures are recognised.
 *
 * Exports:
 *   detectGestures() — call once per render frame after currentHands is updated.
 */

'use strict';

/** Per-hand pinch state to prevent rapid re-triggering. */
const lastPinchState = [false, false];

/**
 * Inspect `currentHands` for pinch and open-hand gestures.
 * Fires shockwaves, audio zaps, and updates the HUD labels.
 */
function detectGestures() {
    if (!currentHands.length) return;

    currentHands.forEach((hand, idx) => {
        // ── Pinch: thumb tip (4) close to index tip (8) ──────────────────────
        const thumb = hand[4];
        const index = hand[8];
        const dist  = getDist(thumb, index);

        const isPinching = dist < 0.05; // 5 % of normalised space

        if (isPinching && !lastPinchState[idx]) {
            const midpoint = {
                x: (thumb.x + index.x) / 2,
                y: (thumb.y + index.y) / 2,
            };
            createShockwave(mapToCanvas(midpoint), themes[currentTheme](time, 1, 1));
            triggerZap();
            uiGesture.innerText = 'PINCH !';
        }

        lastPinchState[idx] = isPinching;
    });

    // ── Spread / fist: distance from index (8) to pinky (20) ─────────────────
    if (currentHands[0]) {
        const spread    = getDist(currentHands[0][8], currentHands[0][20]);
        const spreadPct = Math.min(Math.round(spread * 300), 100);

        uiSpread.innerText = spreadPct + '%';

        // Only update gesture label when not currently pinching
        if (!lastPinchState.includes(true)) {
            uiGesture.innerText = spreadPct > 50 ? 'Open Hand' : 'Fist';
        }
    }
}
