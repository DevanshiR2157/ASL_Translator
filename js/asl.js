/**
 * asl.js
 * ------
 * Orchestrates the ASL classification pipeline:
 *
 *   1. Run rule-based classifier (fast, geometric)
 *   2. If confidence ≥ RULES_THRESHOLD → accept rules result
 *   3. Otherwise → run ML classifier and take its result
 *   4. Apply temporal smoothing (rolling majority vote over last N frames)
 *   5. Update shared state and HUD
 *
 * Exports:
 *   classifyASL(lm) — call each frame with the primary hand's landmarks
 */

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────
const RULES_THRESHOLD = 0.85;  // Min rules confidence to skip ML
const SMOOTH_WINDOW   = 6;     // Frames to majority-vote over (reduces flicker)

// ── Temporal smoother ─────────────────────────────────────────────────────────
const _history = []; // Rolling window of { letter, source } objects

function pushHistory(letter, source) {
    _history.push({ letter, source });
    if (_history.length > SMOOTH_WINDOW) _history.shift();
}

/** Return the most common letter in the history window. */
function majorityLetter() {
    const counts = {};
    for (const { letter } of _history) {
        counts[letter] = (counts[letter] ?? 0) + 1;
    }
    let best = '–', bestCount = 0;
    for (const [letter, count] of Object.entries(counts)) {
        if (count > bestCount) { bestCount = count; best = letter; }
    }
    return best;
}

/** Dominant source in current history window. */
function dominantSource() {
    const ml    = _history.filter(h => h.source === 'ml').length;
    const rules = _history.filter(h => h.source === 'rules').length;
    return ml > rules ? 'ml' : 'rules';
}

// ── Confidence bar colour ─────────────────────────────────────────────────────
function confColor(conf) {
    if (conf >= 0.85) return '#00ffcc';
    if (conf >= 0.60) return '#ffcc00';
    return '#ff4444';
}

// ── Main classify function ────────────────────────────────────────────────────

/**
 * Classify the given landmark array, update global ASL state & HUD.
 *
 * @param {Array} lm - 21-element MediaPipe landmark array
 */
function classifyASL(lm) {
    // 1. Rules pass
    const rulesResult = classifyASLRules(lm);

    let finalLetter;
    let finalConf;
    let finalSource;

    if (rulesResult.confidence >= RULES_THRESHOLD) {
        // Rules are confident — use them directly
        finalLetter = rulesResult.letter;
        finalConf   = rulesResult.confidence;
        finalSource = 'rules';
    } else {
        // Rules uncertain — fall back to ML
        const mlResult = classifyASLML(lm);

        if (mlResult.confidence > rulesResult.confidence) {
            finalLetter = mlResult.letter;
            finalConf   = mlResult.confidence;
            finalSource = 'ml';
        } else {
            // ML also uncertain — keep rules best guess
            finalLetter = rulesResult.letter;
            finalConf   = rulesResult.confidence;
            finalSource = 'rules';
        }
    }

    // 2. Temporal smoothing
    pushHistory(finalLetter, finalSource);
    const smoothed = majorityLetter();
    const source   = dominantSource();

    // 3. Update shared state
    detectedLetter       = smoothed;
    letterConfidence     = finalConf;
    classificationSource = source;

    // 4. Update HUD
    uiLetter.innerText     = smoothed;
    uiConfidence.innerText = Math.round(finalConf * 100) + '%';
    uiSource.innerText     = source === 'ml' ? 'ML' : 'Rules';

    if (uiConfBar) {
        uiConfBar.style.width           = Math.round(finalConf * 100) + '%';
        uiConfBar.style.backgroundColor = confColor(finalConf);
    }
}
