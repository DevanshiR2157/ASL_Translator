/**
 * gestures.js
 * -----------
 * Per-frame gesture processing.
 *
 * Now delegates letter detection to asl.js.
 * Retains pinch detection for the shockwave/audio visual effect
 * (pinch is also used as the "confirm letter" interaction).
 */

'use strict';

const lastPinchState = [false, false];

function detectGestures() {
    if (!currentHands.length) return;

    // ── ASL letter classification (primary hand) ──────────────────────────────
    classifyASL(currentHands[0]);

    // ── Pinch detection on all visible hands (visual/audio effect) ───────────
    currentHands.forEach((hand, idx) => {
        const thumb = hand[LM.THUMB_TIP];
        const index = hand[LM.INDEX_TIP];

        const palmW   = Math.hypot(
            hand[LM.INDEX_MCP].x - hand[LM.PINKY_MCP].x,
            hand[LM.INDEX_MCP].y - hand[LM.PINKY_MCP].y
        );
        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        const isPinching = (pinchDist / (palmW || 1)) < 0.25;

        if (isPinching && !lastPinchState[idx]) {
            const midpoint = {
                x: (thumb.x + index.x) / 2,
                y: (thumb.y + index.y) / 2,
            };
            createShockwave(mapToCanvas(midpoint), themes[currentTheme](time, 1, 1));
            triggerZap();
        }

        lastPinchState[idx] = isPinching;
    });
}
