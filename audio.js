/**
 * audio.js
 * --------
 * Web Audio engine.
 *
 * Exports:
 *   initAudio()  — call once after the user gesture (start button).
 *   triggerZap() — short sawtooth zap for pinch events.
 *   updateHum()  — modulates the continuous hum based on hand proximity.
 */

'use strict';

let audioCtx = null;
let humOsc   = null;
let humGain  = null;

/** Bootstraps the AudioContext and the continuous background hum oscillator. */
function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        humOsc  = audioCtx.createOscillator();
        humGain = audioCtx.createGain();

        humOsc.type           = 'sine';
        humOsc.frequency.value = 100;
        humGain.gain.value    = 0; // Silent until hands appear

        humOsc.connect(humGain);
        humGain.connect(audioCtx.destination);
        humOsc.start();
    } catch (e) {
        console.error('Web Audio API failed:', e);
    }
}

/** Short sawtooth burst played on each pinch detection. */
function triggerZap() {
    if (!audioCtx) return;

    const osc      = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

/**
 * Modulates the hum pitch and volume based on the distance between
 * the index fingers of both hands.
 *
 * @param {Array} activeHands - Array of MediaPipe landmark arrays.
 */
function updateHum(activeHands) {
    if (!audioCtx || !humGain) return;

    if (activeHands.length < 2) {
        humGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
        return;
    }

    const p1 = activeHands[0][8];
    const p2 = activeHands[1][8];
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const targetFreq   = 100 + (1 - Math.min(dist, 1)) * 300;
    const targetVolume = 0.05 + (1 - Math.min(dist, 1)) * 0.15;

    humOsc.frequency.setTargetAtTime(targetFreq,   audioCtx.currentTime, 0.1);
    humGain.gain.setTargetAtTime(targetVolume,      audioCtx.currentTime, 0.1);
}
