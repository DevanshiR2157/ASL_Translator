/**
 * asl-rules.js
 * ------------
 * Geometric rule-based ASL static-letter classifier.
 *
 * Uses MediaPipe's 21 normalised landmarks (x, y, z) to derive:
 *   • Per-finger extension ratio  (is this finger straight or curled?)
 *   • Per-finger curl angle
 *   • Tip-to-tip and tip-to-palm distances
 *   • Thumb direction / abduction angle
 *
 * Returns: { letter: string, confidence: number (0–1) }
 * Confidence < 0.85 signals the ML fallback should take over.
 *
 * Note: J and Z involve motion so cannot be detected from a single frame.
 * They are omitted and left to the ML model.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Low-level geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

function dist3(a, b) {
    return Math.sqrt(
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2 +
        (a.z - b.z) ** 2
    );
}

function dist2(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Normalised extension ratio for a finger.
 * 1 = fully straight, 0 = fully curled.
 * Measured as (tip–mcp distance) / (reference palm width).
 */
function fingerExtension(lm, mcp, pip, dip, tip, palmRef) {
    // Tip-to-MCP distance vs straightened length estimate
    const tipToMcp  = dist3(lm[tip], lm[mcp]);
    const straightLen = dist3(lm[mcp], lm[pip]) +
                        dist3(lm[pip], lm[dip]) +
                        dist3(lm[dip], lm[tip]);
    return tipToMcp / straightLen; // ~1 when straight, ~0.4–0.6 when curled
}

/**
 * Returns extension ratios for all 5 fingers: [thumb, index, middle, ring, pinky]
 * Each value is roughly 0 (curled) to 1 (extended).
 */
function getExtensions(lm) {
    const palmW = dist3(lm[LM.INDEX_MCP], lm[LM.PINKY_MCP]); // palm width for scale

    return {
        thumb:  fingerExtension(lm, LM.THUMB_CMC,  LM.THUMB_MCP,  LM.THUMB_IP,   LM.THUMB_TIP,  palmW),
        index:  fingerExtension(lm, LM.INDEX_MCP,  LM.INDEX_PIP,  LM.INDEX_DIP,  LM.INDEX_TIP,  palmW),
        middle: fingerExtension(lm, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP, palmW),
        ring:   fingerExtension(lm, LM.RING_MCP,   LM.RING_PIP,   LM.RING_DIP,   LM.RING_TIP,   palmW),
        pinky:  fingerExtension(lm, LM.PINKY_MCP,  LM.PINKY_PIP,  LM.PINKY_DIP,  LM.PINKY_TIP,  palmW),
    };
}

/** Is a finger extended? Threshold tuned empirically. */
function isExtended(ratio)     { return ratio > 0.75; }
function isCurled(ratio)       { return ratio < 0.55; }
function isHalfCurled(ratio)   { return ratio >= 0.50 && ratio <= 0.75; }

/** Normalised tip distance relative to palm width. */
function tipDist(lm, tip1, tip2) {
    const palmW = dist3(lm[LM.INDEX_MCP], lm[LM.PINKY_MCP]);
    return dist3(lm[tip1], lm[tip2]) / palmW;
}

/** Is the thumb tip close to a given landmark? */
function thumbNear(lm, landmark, threshold = 0.35) {
    return tipDist(lm, LM.THUMB_TIP, landmark) < threshold;
}

/**
 * Thumb abduction: how far the thumb tip is from the index MCP
 * relative to palm width. High = thumb is spread out sideways.
 */
function thumbAbduction(lm) {
    return tipDist(lm, LM.THUMB_TIP, LM.INDEX_MCP);
}

/**
 * Is the index finger pointing up (tip higher than pip in image space)?
 * Note: y increases downward in normalised coords.
 */
function indexPointingUp(lm) {
    return lm[LM.INDEX_TIP].y < lm[LM.INDEX_MCP].y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-letter rule functions
// Each returns a confidence 0–1, or 0 if clearly not a match.
// ─────────────────────────────────────────────────────────────────────────────

function scoreA(lm, ext) {
    // Fist, thumb rests on side (not tucked under, not extended)
    if (!isCurled(ext.index) || !isCurled(ext.middle) ||
        !isCurled(ext.ring)  || !isCurled(ext.pinky)) return 0;
    const thumbOut = thumbAbduction(lm) > 0.25;
    return thumbOut ? 0.9 : 0.7;
}

function scoreB(lm, ext) {
    // Four fingers straight up, thumb tucked across palm
    if (!isExtended(ext.index) || !isExtended(ext.middle) ||
        !isExtended(ext.ring)  || !isExtended(ext.pinky)) return 0;
    if (thumbAbduction(lm) > 0.5) return 0; // thumb should be in
    return 0.9;
}

function scoreC(lm, ext) {
    // All fingers curved, forming a C shape — half curled
    const allHalf = [ext.index, ext.middle, ext.ring, ext.pinky]
        .every(e => e > 0.55 && e < 0.80);
    if (!allHalf) return 0;
    return 0.85;
}

function scoreD(lm, ext) {
    // Index up, middle/ring/pinky curled, thumb touches middle finger
    if (!isExtended(ext.index)) return 0;
    if (!isCurled(ext.middle) || !isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const thumbTouchMiddle = thumbNear(lm, LM.MIDDLE_TIP, 0.4);
    return thumbTouchMiddle ? 0.9 : 0.7;
}

function scoreE(lm, ext) {
    // All fingers curled down tightly, thumb tucked under fingers
    const allCurled = [ext.index, ext.middle, ext.ring, ext.pinky].every(isCurled);
    if (!allCurled) return 0;
    // Thumb tip should be below index DIP (tucked under)
    const thumbUnder = thumbNear(lm, LM.INDEX_DIP, 0.3) ||
                       thumbNear(lm, LM.MIDDLE_DIP, 0.3);
    return thumbUnder ? 0.9 : 0.6;
}

function scoreF(lm, ext) {
    // Index and thumb touching (pinch), other three fingers extended
    if (!isExtended(ext.middle) || !isExtended(ext.ring) || !isExtended(ext.pinky)) return 0;
    const pinch = tipDist(lm, LM.THUMB_TIP, LM.INDEX_TIP) < 0.25;
    return pinch ? 0.9 : 0;
}

function scoreG(lm, ext) {
    // Index pointing sideways, thumb parallel — like pointing a gun sideways
    if (!isExtended(ext.index)) return 0;
    if (!isCurled(ext.middle) || !isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    // Index tip should be roughly level with MCP (horizontal pointing)
    const horizontal = Math.abs(lm[LM.INDEX_TIP].y - lm[LM.INDEX_MCP].y) < 0.12;
    return horizontal ? 0.85 : 0.5;
}

function scoreH(lm, ext) {
    // Index and middle extended horizontally, others curled
    if (!isExtended(ext.index) || !isExtended(ext.middle)) return 0;
    if (!isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    // Both extended fingers roughly horizontal
    const horizontal = Math.abs(lm[LM.INDEX_TIP].y - lm[LM.MIDDLE_TIP].y) < 0.08;
    return horizontal ? 0.85 : 0.6;
}

function scoreI(lm, ext) {
    // Only pinky extended, others curled
    if (!isExtended(ext.pinky)) return 0;
    if (!isCurled(ext.index) || !isCurled(ext.middle) || !isCurled(ext.ring)) return 0;
    return 0.9;
}

// J = I + motion — not rule-detectable, skip (return 0)
function scoreJ() { return 0; }

function scoreK(lm, ext) {
    // Index and middle up (V shape but tighter), thumb up between them
    if (!isExtended(ext.index) || !isExtended(ext.middle)) return 0;
    if (!isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const thumbBetween = thumbNear(lm, LM.INDEX_PIP, 0.35);
    return thumbBetween ? 0.85 : 0.5;
}

function scoreL(lm, ext) {
    // Index up, thumb out sideways, others curled — classic L shape
    if (!isExtended(ext.index)) return 0;
    if (!isCurled(ext.middle) || !isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    if (thumbAbduction(lm) < 0.55) return 0; // thumb must be spread
    return 0.92;
}

function scoreM(lm, ext) {
    // Three fingers (index, middle, ring) folded over thumb
    const threeDown = isCurled(ext.index) && isCurled(ext.middle) && isCurled(ext.ring);
    if (!threeDown || !isCurled(ext.pinky)) return 0;
    // Thumb tucked under (near palm)
    const thumbIn = thumbAbduction(lm) < 0.3;
    return thumbIn ? 0.75 : 0; // low conf — similar to N/E
}

function scoreN(lm, ext) {
    // Two fingers (index, middle) folded over thumb
    const twoDown = isCurled(ext.index) && isCurled(ext.middle);
    if (!twoDown || !isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const thumbIn = thumbAbduction(lm) < 0.3;
    return thumbIn ? 0.72 : 0;
}

function scoreO(lm, ext) {
    // All fingers curve to meet thumb — round O shape
    const allPartial = [ext.index, ext.middle, ext.ring, ext.pinky]
        .every(e => e > 0.45 && e < 0.78);
    if (!allPartial) return 0;
    const thumbToIndex = tipDist(lm, LM.THUMB_TIP, LM.INDEX_TIP);
    return (thumbToIndex < 0.35) ? 0.88 : 0.5;
}

function scoreP(lm, ext) {
    // Like K but pointing downward
    if (!isExtended(ext.index) || !isExtended(ext.middle)) return 0;
    if (!isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    // Index pointing downward
    const downward = lm[LM.INDEX_TIP].y > lm[LM.INDEX_MCP].y + 0.05;
    return downward ? 0.82 : 0;
}

function scoreQ(lm, ext) {
    // Like G but pointing downward
    if (!isExtended(ext.index)) return 0;
    if (!isCurled(ext.middle) || !isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const downward = lm[LM.INDEX_TIP].y > lm[LM.INDEX_MCP].y + 0.05;
    return downward ? 0.80 : 0;
}

function scoreR(lm, ext) {
    // Index and middle crossed (close together), others curled
    if (!isExtended(ext.index) || !isExtended(ext.middle)) return 0;
    if (!isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const crossed = tipDist(lm, LM.INDEX_TIP, LM.MIDDLE_TIP) < 0.22;
    return crossed ? 0.83 : 0.4;
}

function scoreS(lm, ext) {
    // Fist with thumb across front of fingers
    const allCurled = [ext.index, ext.middle, ext.ring, ext.pinky].every(isCurled);
    if (!allCurled) return 0;
    // Thumb tip near index/middle knuckle (across the front)
    const thumbAcross = thumbNear(lm, LM.INDEX_MCP, 0.4) || thumbNear(lm, LM.MIDDLE_MCP, 0.4);
    return thumbAcross ? 0.85 : 0.6;
}

function scoreT(lm, ext) {
    // Thumb between index and middle (tucked in fist)
    const allCurled = [ext.index, ext.middle, ext.ring, ext.pinky].every(isCurled);
    if (!allCurled) return 0;
    const thumbUp = thumbNear(lm, LM.INDEX_PIP, 0.3);
    return thumbUp ? 0.78 : 0;
}

function scoreU(lm, ext) {
    // Index and middle together and straight up, others curled
    if (!isExtended(ext.index) || !isExtended(ext.middle)) return 0;
    if (!isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const together = tipDist(lm, LM.INDEX_TIP, LM.MIDDLE_TIP) < 0.28;
    return together ? 0.85 : 0.5;
}

function scoreV(lm, ext) {
    // Index and middle spread apart (peace sign), others curled
    if (!isExtended(ext.index) || !isExtended(ext.middle)) return 0;
    if (!isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    const spread = tipDist(lm, LM.INDEX_TIP, LM.MIDDLE_TIP) > 0.28;
    return spread ? 0.88 : 0.5;
}

function scoreW(lm, ext) {
    // Index, middle, ring extended, pinky curled, thumb out
    if (!isExtended(ext.index) || !isExtended(ext.middle) || !isExtended(ext.ring)) return 0;
    if (!isCurled(ext.pinky)) return 0;
    return 0.87;
}

function scoreX(lm, ext) {
    // Index finger hooked (half-curled), others curled
    if (!isHalfCurled(ext.index)) return 0;
    if (!isCurled(ext.middle) || !isCurled(ext.ring) || !isCurled(ext.pinky)) return 0;
    return 0.82;
}

function scoreY(lm, ext) {
    // Pinky and thumb extended, others curled — hang loose / shaka
    if (!isExtended(ext.pinky) || !isExtended(ext.thumb)) return 0;
    if (!isCurled(ext.index) || !isCurled(ext.middle) || !isCurled(ext.ring)) return 0;
    return 0.90;
}

// Z = motion — not rule-detectable
function scoreZ() { return 0; }

// ─────────────────────────────────────────────────────────────────────────────
// Public classifier
// ─────────────────────────────────────────────────────────────────────────────

const SCORERS = { A:scoreA, B:scoreB, C:scoreC, D:scoreD, E:scoreE,
                  F:scoreF, G:scoreG, H:scoreH, I:scoreI, J:scoreJ,
                  K:scoreK, L:scoreL, M:scoreM, N:scoreN, O:scoreO,
                  P:scoreP, Q:scoreQ, R:scoreR, S:scoreS, T:scoreT,
                  U:scoreU, V:scoreV, W:scoreW, X:scoreX, Y:scoreY,
                  Z:scoreZ };

/**
 * Classify a single hand's landmark array using geometry rules.
 *
 * @param  {Array} lm  - 21-element array of {x,y,z} MediaPipe landmarks
 * @returns {{ letter: string, confidence: number }}
 */
function classifyASLRules(lm) {
    const ext = getExtensions(lm);

    let best       = { letter: '?', confidence: 0 };

    for (const [letter, scoreFn] of Object.entries(SCORERS)) {
        const conf = scoreFn(lm, ext);
        if (conf > best.confidence) {
            best = { letter, confidence: conf };
        }
    }

    return best;
}
