/**
 * effects.js
 * ----------
 * Manages the visual effects layer:
 *   • Matrix-rain background (bgCanvas)
 *   • Particle system (spark trails at fingertips)
 *   • Ripple / shockwave system (pinch explosions)
 *
 * All functions write directly to the canvas contexts defined in state.js.
 */

'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Euclidean distance between two normalised MediaPipe points. */
function getDist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Convert a normalised MediaPipe landmark {x, y} to pixel coords
 * for the current canvas dimensions.
 */
function mapToCanvas(point) {
    return { x: point.x * width, y: point.y * height };
}

// ── Particle factory ──────────────────────────────────────────────────────────

/**
 * Spawn `count` spark particles at `pos`.
 *
 * @param {{ x: number, y: number }} pos   - Pixel-space origin.
 * @param {string}                   color - CSS colour string.
 * @param {number}                  [count=3]
 */
function createParticles(pos, color, count = 3) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x:     pos.x,
            y:     pos.y,
            vx:    (Math.random() - 0.5) * 8,
            vy:    (Math.random() - 0.5) * 8,
            life:  1.0,
            color,
            size:  Math.random() * 3 + 1,
        });
    }
}

// ── Shockwave factory ─────────────────────────────────────────────────────────

/**
 * Spawn an expanding circular shockwave at `pos`.
 *
 * @param {{ x: number, y: number }} pos
 * @param {string}                   color
 */
function createShockwave(pos, color) {
    ripples.push({
        x:         pos.x,
        y:         pos.y,
        radius:    0,
        maxRadius: 150 + Math.random() * 100,
        life:      1.0,
        color,
    });
}

// ── Background: matrix rain ───────────────────────────────────────────────────

/**
 * Draw one frame of the matrix-rain effect onto bgCanvas.
 * Speed is boosted by `handVelocities` so fast hand movement
 * agitates the rain.
 */
function drawBackground() {
    // Fade previous frame via destination-out; velocity speeds up the fade.
    bgCtx.globalCompositeOperation = 'destination-out';
    bgCtx.fillStyle = `rgba(0, 0, 0, ${0.15 + Math.min(handVelocities * 10, 0.5)})`;
    bgCtx.fillRect(0, 0, width, height);
    bgCtx.globalCompositeOperation = 'source-over';

    bgCtx.fillStyle = themes[currentTheme](time, 1, 1);
    bgCtx.font      = `${fontSize}px monospace`;

    const speedMult = 1 + handVelocities * 100;

    for (let i = 0; i < matrixColumns.length; i++) {
        if (Math.random() > 0.95) {
            const char = String.fromCharCode(0x30A0 + Math.random() * 96);
            bgCtx.fillText(char, i * fontSize, matrixColumns[i] * fontSize);
        }

        matrixColumns[i] += Math.random() * speedMult;

        if (matrixColumns[i] * fontSize > height && Math.random() > 0.9) {
            matrixColumns[i] = 0;
        }
    }
}

// ── Physics update (particles + ripples) ──────────────────────────────────────

/** Advance and draw all live particles and ripples onto mainCanvas. */
function updatePhysics() {
    // — Particles —
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.1;    // Gravity
        p.life -= 0.02;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle  = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
    }

    // — Ripples —
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += (r.maxRadius - r.radius) * 0.1; // Ease-out expansion
        r.life   -= 0.03;

        if (r.life <= 0) {
            ripples.splice(i, 1);
            continue;
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.lineWidth   = 4 * r.life;
        ctx.globalAlpha = r.life;
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0; // Reset after physics pass
}
