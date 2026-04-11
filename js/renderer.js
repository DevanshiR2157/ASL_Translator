/**
 * renderer.js
 * -----------
 * Main per-frame drawing pipeline.
 *
 * Exports:
 *   renderLoop(timestamp) — pass to requestAnimationFrame.
 */

'use strict';

/** Entry point — drives every animation frame. */
function renderLoop(timestamp) {
    requestAnimationFrame(renderLoop);

    // ── Timing ────────────────────────────────────────────────────────────────
    const dt = (timestamp - lastTime) / 1000;
    lastTime  = timestamp;
    time     += dt;

    framesThisSecond++;
    if (timestamp > lastFpsTime + 1000) {
        uiFps.innerText  = framesThisSecond;
        framesThisSecond = 0;
        lastFpsTime      = timestamp;
    }

    // ── Background layer (matrix rain) ────────────────────────────────────────
    drawBackground();

    // ── Main canvas: fade previous frame to keep motion trails ───────────────
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // Screen blending gives additive neon-glow look
    ctx.globalCompositeOperation = 'screen';

    // ── Physics (particles + ripples) ─────────────────────────────────────────
    updatePhysics();

    // ── Hand rendering ────────────────────────────────────────────────────────
    if (currentHands.length > 0) {
        drawHands();

        if (currentHands.length >= 2) {
            drawCrossHandEffects();
        }

        detectGestures();
    }

    ctx.globalCompositeOperation = 'source-over'; // Restore default
}

// ── Hand skeleton & fingertip sparks ──────────────────────────────────────────

function drawHands() {
    currentHands.forEach((hand, handIndex) => {
        const glowColor = themes[currentTheme](time, handIndex, 2);

        // MediaPipe skeleton connectors
        drawConnectors(ctx, hand, HAND_CONNECTIONS, {
            color:     glowColor,
            lineWidth: 2,
        });

        // Fingertip bloom + spark emission
        ctx.shadowBlur = 15;
        ctx.shadowColor = glowColor;

        FINGER_TIPS.forEach((tipIndex, idx) => {
            const pt     = mapToCanvas(hand[tipIndex]);
            const tipCol = themes[currentTheme](time, idx, FINGER_TIPS.length);

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            if (Math.random() > 0.6) {
                createParticles(pt, tipCol, 1);
            }
        });

        ctx.shadowBlur = 0;
    });
}

// ── Cross-hand interactions (lightning + connecting gradients + mandala) ───────

function drawCrossHandEffects() {
    const h1 = currentHands[0];
    const h2 = currentHands[1];

    // Per-finger gradient lines and lightning arcs
    FINGER_TIPS.forEach((tipIndex, idx) => {
        const pt1  = mapToCanvas(h1[tipIndex]);
        const pt2  = mapToCanvas(h2[tipIndex]);
        const dist = Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);
        const col  = themes[currentTheme](time, idx, FINGER_TIPS.length);

        // Lightning: jittery arc when fingertips are close
        if (dist < 150 && Math.random() > 0.5) {
            const midX = (pt1.x + pt2.x) / 2 + (Math.random() - 0.5) * 50;
            const midY = (pt1.y + pt2.y) / 2 + (Math.random() - 0.5) * 50;

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(midX, midY);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = '#ffffff';
            ctx.shadowBlur  = 20;
            ctx.shadowColor = col;
            ctx.lineWidth   = 3;
            ctx.stroke();
        }

        // Animated gradient connecting line
        const grad = ctx.createLinearGradient(pt1.x, pt1.y, pt2.x, pt2.y);
        grad.addColorStop(0,   themes[currentTheme](time, idx,     5));
        grad.addColorStop(0.5, themes[currentTheme](time, idx + 1, 5));
        grad.addColorStop(1,   themes[currentTheme](time, idx + 2, 5));

        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 4;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = col;
        ctx.stroke();
        ctx.shadowBlur  = 0;
    });

    // Mandala: star-polygon connecting all 10 fingertips, slowly rotating
    drawMandala(h1, h2);
}

function drawMandala(h1, h2) {
    const allTips = [
        ...FINGER_TIPS.map(t => mapToCanvas(h1[t])),
        ...FINGER_TIPS.map(t => mapToCanvas(h2[t])),
    ];

    const cx = allTips.slice(0, 10).reduce((s, p) => s + p.x, 0) / 10;
    const cy = allTips.slice(0, 10).reduce((s, p) => s + p.y, 0) / 10;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.5);

    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const t1 = { x: allTips[i].x - cx,          y: allTips[i].y - cy };
        const t2 = { x: allTips[(i + 3) % 10].x - cx, y: allTips[(i + 3) % 10].y - cy };
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();
}
