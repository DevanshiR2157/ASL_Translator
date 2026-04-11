/**
 * hands.js
 * --------
 * Bootstraps MediaPipe Hands and the webcam Camera feed.
 * Updates shared state (currentHands, handVelocities, uiHands)
 * on every frame received from the model.
 *
 * Exports:
 *   initMediaPipe() — call once after the user gesture.
 */

'use strict';

function initMediaPipe() {
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
        maxNumHands:            2,
        modelComplexity:        1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence:  0.7,
    });

    hands.onResults((results) => {
        if (!audioCtx) return; // Guard: wait for AudioContext

        const detected = results.multiHandLandmarks ?? [];

        uiHands.innerText = detected.length;

        // Rudimentary velocity: distance index-finger tip moved since last frame
        if (currentHands.length > 0 && detected.length > 0) {
            const oldP = currentHands[0][8];
            const newP = detected[0][8];
            if (oldP && newP) {
                handVelocities = getDist(oldP, newP);
            }
        } else {
            handVelocities = 0;
        }

        currentHands = detected;
        updateHum(currentHands);
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width:      1280,
        height:     720,
        facingMode: 'user',
    });

    camera.start();
}
