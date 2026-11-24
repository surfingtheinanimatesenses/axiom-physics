import Matter from 'matter-js';
import { soundEngine } from './soundEngine.js';

export const PHENOMENA_TYPES = {
  GARGANTUA: 'gargantua',
  WORMHOLE: 'wormhole',
  MAGNETAR: 'magnetar',
  NONE: 'none',
};

/**
 * Procedural Interstellar VFX & Relativistic Physics Engine.
 * 
 * Implements:
 * 1. GARGANTUA: Kerr supermassive black hole with Kip Thorne relativistic gravitational
 *    lensing, Doppler-boosted accretion disk (top/bottom mirage arcs), photon ring,
 *    spacetime frame-dragging swirl, tidal spaghettification, and polar relativistic jets.
 * 2. ENDURANCE: Einstein-Rosen traversable spherical wormhole with procedural celestial
 *    interior vista, chromatic dispersion rim, gravitational caustics, and dimensional transit.
 * 3. MAGNETAR: Ultra-dense neutron star with twin sweeping volumetric synchrotron beams,
 *    dipole magnetic flux loops, real Lorentz force cyclotron deflection, and periodic starquakes.
 */
class InterstellarEngine {
  constructor() {
    this.activePhenomenon = PHENOMENA_TYPES.NONE;
    this.time = 0;

    // Gargantua Accretion Disk persistent plasma nodes
    this.plasmaNodes = [];
    this._initGargantuaPlasma();

    // Wormhole distant galaxy stars
    this.wormholeStars = [];
    this._initWormholeStars();

    // Magnetar Starquake Timer
    this.lastStarquakeTime = 0;
    this.starquakeFlashAlpha = 0;
  }

  _initGargantuaPlasma() {
    this.plasmaNodes = [];
    const count = 55;
    for (let i = 0; i < count; i++) {
      const radius = 86 + Math.random() * 110; // Between inner ISCO (86) and outer edge (196)
      // Keplerian speed: v ~ 1 / sqrt(r)
      const speed = (Math.sqrt(100 / radius) * 0.035) * (0.8 + Math.random() * 0.4);
      this.plasmaNodes.push({
        r: radius,
        angle: Math.random() * Math.PI * 2,
        speed,
        size: Math.random() * 2.8 + 1.2,
        heat: Math.max(0, 1 - (radius - 86) / 110), // Hotter near inner edge
      });
    }
  }

  _initWormholeStars() {
    this.wormholeStars = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 52;
      const angle = Math.random() * Math.PI * 2;
      this.wormholeStars.push({
        r,
        angle,
        speed: (Math.random() - 0.5) * 0.008,
        size: Math.random() * 1.8 + 0.8,
        color: Math.random() > 0.4 ? '#38bdf8' : (Math.random() > 0.5 ? '#e0f2fe' : '#c084fc'),
      });
    }
  }

  setPhenomenon(type) {
    this.activePhenomenon = type || PHENOMENA_TYPES.NONE;
    if (this.activePhenomenon === PHENOMENA_TYPES.GARGANTUA) {
      soundEngine.playExplosion();
    } else if (this.activePhenomenon === PHENOMENA_TYPES.WORMHOLE) {
      soundEngine.playCollision({ area: 1500 }, { area: 1500 }, 6);
    } else if (this.activePhenomenon === PHENOMENA_TYPES.MAGNETAR) {
      soundEngine.playExplosion();
    }
  }

  getActivePhenomenon() {
    return this.activePhenomenon;
  }

  clear() {
    this.activePhenomenon = PHENOMENA_TYPES.NONE;
    this.starquakeFlashAlpha = 0;
  }

  // --------------------------------------------------------------------------
  // PHYSICS UPDATE HOOK (Called in Matter.js beforeUpdate)
  // --------------------------------------------------------------------------
  updatePhysics(now, dynamicBodies, worldController, width, height) {
    if (this.activePhenomenon === PHENOMENA_TYPES.NONE) return;
    this.time = now * 0.001;

    if (this.activePhenomenon === PHENOMENA_TYPES.GARGANTUA) {
      this._updateGargantuaPhysics(now, dynamicBodies, worldController, width, height);
    } else if (this.activePhenomenon === PHENOMENA_TYPES.WORMHOLE) {
      this._updateWormholePhysics(now, dynamicBodies, worldController, width, height);
    } else if (this.activePhenomenon === PHENOMENA_TYPES.MAGNETAR) {
      this._updateMagnetarPhysics(now, dynamicBodies, worldController, width, height);
    }
  }

  // 1. Gargantua Physics: Supermassive Kerr Gravitational Ingestion & Tidal Spaghettification
  _updateGargantuaPhysics(now, dynamicBodies, worldController, width, height) {
    const cx = width / 2;
    const cy = height * 0.46;
    const rs = 48; // Event Horizon Radius
    const GM = 0.0036;

    // Update orbiting plasma nodes
    for (let i = 0; i < this.plasmaNodes.length; i++) {
      const p = this.plasmaNodes[i];
      p.angle += p.speed;
    }

    for (let i = dynamicBodies.length - 1; i >= 0; i--) {
      const b = dynamicBodies[i];
      const dx = cx - b.position.x;
      const dy = cy - b.position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist <= 1) continue;

      // Event Horizon Absorption: Crossed Schwarzschild boundary
      if (dist < rs + 4) {
        worldController.removeDynamicBody(b);
        worldController.spawnSparks(b.position.x, b.position.y, 22);
        worldController.triggerScreenShake(7, 10, cx, cy);
        soundEngine.playExplosion();
        continue;
      }

      // Inverse-Distance Relativistic Gravitational Pull
      const fGrav = Math.min(0.006, GM / Math.pow(dist / 60, 1.7));
      Matter.Body.applyForce(b, b.position, {
        x: (dx / dist) * fGrav,
        y: (dy / dist) * fGrav,
      });

      // Kerr Spacetime Frame-Dragging (Lense-Thirring Azimuthal Swirl)
      if (dist < 280) {
        const factor = (1 - dist / 280);
        const swirlMag = factor * factor * 0.0016;
        // Tangential vector: (-dy, dx) for counter-clockwise frame drag
        Matter.Body.applyForce(b, b.position, {
          x: (-dy / dist) * swirlMag,
          y: (dx / dist) * swirlMag,
        });

        // Tidal Spaghettification parameter cache
        const radialAngle = Math.atan2(dy, dx);
        const stretchFactor = 1 + factor * factor * 2.8;
        b.spaghettify = {
          angle: radialAngle,
          stretch: stretchFactor,
          compression: 1 / Math.sqrt(stretchFactor),
          active: true,
        };
      } else {
        b.spaghettify = null;
      }
    }
  }

  // 2. Endurance Wormhole Physics: Dual-Mouth Spatial Metric Transit
  _updateWormholePhysics(now, dynamicBodies, worldController, width, height) {
    const mouthA = { x: width * 0.32, y: height * 0.46 };
    const mouthB = { x: width * 0.68, y: height * 0.46 };
    const rw = 58;

    // Rotate interior distant stars
    for (let i = 0; i < this.wormholeStars.length; i++) {
      const star = this.wormholeStars[i];
      star.angle += star.speed;
    }

    for (let i = 0; i < dynamicBodies.length; i++) {
      const b = dynamicBodies[i];

      // Check Mouth A
      const dxA = mouthA.x - b.position.x;
      const dyA = mouthA.y - b.position.y;
      const distA = Math.hypot(dxA, dyA);

      // Check Mouth B
      const dxB = mouthB.x - b.position.x;
      const dyB = mouthB.y - b.position.y;
      const distB = Math.hypot(dxB, dyB);

      // Gentle mouth gravitational suction
      if (distA < 160 && distA > 1) {
        const fA = (1 - distA / 160) * 0.0014;
        Matter.Body.applyForce(b, b.position, { x: (dxA / distA) * fA, y: (dyA / distA) * fA });
      }
      if (distB < 160 && distB > 1) {
        const fB = (1 - distB / 160) * 0.0014;
        Matter.Body.applyForce(b, b.position, { x: (dxB / distB) * fB, y: (dyB / distB) * fB });
      }

      // Transit through Throat: Mouth A -> Mouth B
      if (distA < rw - 8 && (!b.lastTransit || now - b.lastTransit > 1200)) {
        b.lastTransit = now;
        Matter.Body.setPosition(b, {
          x: mouthB.x + (Math.random() - 0.5) * 10,
          y: mouthB.y + (Math.random() - 0.5) * 10,
        });
        // Relativistic exit momentum
        const exitSpeed = Math.max(8, Math.hypot(b.velocity.x, b.velocity.y) * 1.4);
        const exitAngle = Math.random() * Math.PI * 2;
        Matter.Body.setVelocity(b, {
          x: Math.cos(exitAngle) * exitSpeed,
          y: Math.sin(exitAngle) * exitSpeed,
        });
        worldController.spawnParticles(mouthB.x, mouthB.y, '#38bdf8', 20, 6);
        worldController.spawnParticles(mouthA.x, mouthA.y, '#c084fc', 20, 6);
        worldController.triggerScreenShake(4, 5, mouthB.x, mouthB.y);
        soundEngine.playCollision({ area: 800 }, { area: 800 }, 8);
      }
      // Transit through Throat: Mouth B -> Mouth A
      else if (distB < rw - 8 && (!b.lastTransit || now - b.lastTransit > 1200)) {
        b.lastTransit = now;
        Matter.Body.setPosition(b, {
          x: mouthA.x + (Math.random() - 0.5) * 10,
          y: mouthA.y + (Math.random() - 0.5) * 10,
        });
        const exitSpeed = Math.max(8, Math.hypot(b.velocity.x, b.velocity.y) * 1.4);
        const exitAngle = Math.random() * Math.PI * 2;
        Matter.Body.setVelocity(b, {
          x: Math.cos(exitAngle) * exitSpeed,
          y: Math.sin(exitAngle) * exitSpeed,
        });
        worldController.spawnParticles(mouthA.x, mouthA.y, '#38bdf8', 20, 6);
        worldController.spawnParticles(mouthB.x, mouthB.y, '#c084fc', 20, 6);
        worldController.triggerScreenShake(4, 5, mouthA.x, mouthA.y);
        soundEngine.playCollision({ area: 800 }, { area: 800 }, 8);
      }
    }
  }

  // 3. Magnetar Physics: Lorentz Force Cyclotron Helical Orbits & Starquakes
  _updateMagnetarPhysics(now, dynamicBodies, worldController, width, height) {
    const cx = width / 2;
    const cy = height * 0.46;
    const beamAngle = now * 0.0022; // Synchrotron beam rotation: ~2.2 rad/s

    // Periodic Magnetar Starquake (every ~4.2s)
    if (now - this.lastStarquakeTime > 4200) {
      this.lastStarquakeTime = now;
      this.starquakeFlashAlpha = 0.55;
      worldController.triggerScreenShake(8, 11, cx, cy);
      worldController.spawnSparks(cx, cy, 32);
      soundEngine.playExplosion();

      // Explosive magnetic shock repels nearby bodies
      for (let i = 0; i < dynamicBodies.length; i++) {
        const b = dynamicBodies[i];
        const dx = b.position.x - cx;
        const dy = b.position.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 450) {
          const push = ((1 - dist / 450) * 0.008);
          Matter.Body.applyForce(b, b.position, {
            x: (dx / dist) * push,
            y: (dy / dist) * push,
          });
        }
      }
    }

    if (this.starquakeFlashAlpha > 0) {
      this.starquakeFlashAlpha *= 0.88;
    }

    // Dynamic Lorentz Force: F = q * (v x B)
    for (let i = 0; i < dynamicBodies.length; i++) {
      const b = dynamicBodies[i];
      const dx = b.position.x - cx;
      const dy = b.position.y - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < 1) continue;

      // Magnetic field strength B ~ 1 / r^2
      const bStrength = Math.min(0.0035, 120 / (dist * dist + 1600));

      // Virtual charge q (alternates by shape or color)
      const q = (b.customColorKey === 'gold' || b.customColorKey === 'blue') ? 1.0 : -1.0;

      // Deflection perpendicular to velocity (Cyclotron motion): F = q * (-vy, vx) * B
      const vx = b.velocity.x;
      const vy = b.velocity.y;
      const fLorentzX = q * -vy * bStrength;
      const fLorentzY = q * vx * bStrength;

      Matter.Body.applyForce(b, b.position, { x: fLorentzX, y: fLorentzY });

      // Core gravitational anchoring
      if (dist > 70) {
        const fAttract = 0.0006 * (1 - Math.min(1, dist / 500));
        Matter.Body.applyForce(b, b.position, { x: (-dx / dist) * fAttract, y: (-dy / dist) * fAttract });
      }

      // Check if body is in rotating synchrotron beam path
      const bodyAngle = Math.atan2(dy, dx);
      let angleDiff1 = Math.abs((bodyAngle - beamAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      let angleDiff2 = Math.abs((bodyAngle - (beamAngle + Math.PI) + Math.PI * 3) % (Math.PI * 2) - Math.PI);

      if (angleDiff1 < 0.16 || angleDiff2 < 0.16) {
        b.beamIonized = 1.0;
      } else if (b.beamIonized) {
        b.beamIonized *= 0.92;
        if (b.beamIonized < 0.05) b.beamIonized = 0;
      }
    }
  }

  // --------------------------------------------------------------------------
  // SPACETIME FIBER MESH WARP (Warp the background grid)
  // --------------------------------------------------------------------------
  applyMeshWarp(meshX, meshY, meshVx, meshVy, meshTension, totalNodes, width, height, now) {
    if (this.activePhenomenon === PHENOMENA_TYPES.NONE) return;

    if (this.activePhenomenon === PHENOMENA_TYPES.GARGANTUA) {
      const cx = width / 2;
      const cy = height * 0.46;
      for (let i = 0; i < totalNodes; i++) {
        const dx = cx - meshX[i];
        const dy = cy - meshY[i];
        const distSq = dx * dx + dy * dy;
        if (distSq < 380 * 380 && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const factor = (1 - dist / 380);
          // Radial suction into event horizon
          const pull = factor * factor * 3.8;
          meshVx[i] += (dx / dist) * pull;
          meshVy[i] += (dy / dist) * pull;

          // Kerr azimuthal vortex swirl
          const swirl = factor * factor * factor * 4.2;
          meshVx[i] += (-dy / dist) * swirl;
          meshVy[i] += (dx / dist) * swirl;

          meshTension[i] = Math.min(1.0, meshTension[i] + factor * 0.75);
        }
      }
    } else if (this.activePhenomenon === PHENOMENA_TYPES.WORMHOLE) {
      const mouthA = { x: width * 0.32, y: height * 0.46 };
      const mouthB = { x: width * 0.68, y: height * 0.46 };
      for (let i = 0; i < totalNodes; i++) {
        const dxA = mouthA.x - meshX[i];
        const dyA = mouthA.y - meshY[i];
        const distA = Math.hypot(dxA, dyA);

        const dxB = mouthB.x - meshX[i];
        const dyB = mouthB.y - meshY[i];
        const distB = Math.hypot(dxB, dyB);

        // Concentric harmonic metric ripples from both mouths
        if (distA < 220 && distA > 1) {
          const ripple = Math.sin(distA * 0.08 - now * 0.005) * (1 - distA / 220) * 1.8;
          meshVx[i] += (dxA / distA) * ripple;
          meshVy[i] += (dyA / distA) * ripple;
          meshTension[i] = Math.min(1.0, meshTension[i] + Math.abs(ripple) * 0.4);
        }
        if (distB < 220 && distB > 1) {
          const ripple = Math.sin(distB * 0.08 - now * 0.005) * (1 - distB / 220) * 1.8;
          meshVx[i] += (dxB / distB) * ripple;
          meshVy[i] += (dyB / distB) * ripple;
          meshTension[i] = Math.min(1.0, meshTension[i] + Math.abs(ripple) * 0.4);
        }
      }
    } else if (this.activePhenomenon === PHENOMENA_TYPES.MAGNETAR) {
      const cx = width / 2;
      const cy = height * 0.46;
      for (let i = 0; i < totalNodes; i++) {
        const dx = meshX[i] - cx;
        const dy = meshY[i] - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 340 && dist > 1) {
          const factor = (1 - dist / 340);
          // Magnetic dipole flux line displacement
          const angle = Math.atan2(dy, dx);
          const dipoleDisplace = Math.sin(angle * 2 + now * 0.003) * factor * 2.2;
          meshVx[i] += Math.cos(angle + Math.PI / 2) * dipoleDisplace;
          meshVy[i] += Math.sin(angle + Math.PI / 2) * dipoleDisplace;
          meshTension[i] = Math.min(1.0, meshTension[i] + factor * 0.5);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // CANVAS 2D 60FPS CINEMATIC RENDER PASS
  // --------------------------------------------------------------------------
  render(ctx, width, height, now) {
    if (this.activePhenomenon === PHENOMENA_TYPES.NONE) return;

    if (this.activePhenomenon === PHENOMENA_TYPES.GARGANTUA) {
      this._renderGargantua(ctx, width, height, now);
    } else if (this.activePhenomenon === PHENOMENA_TYPES.WORMHOLE) {
      this._renderWormhole(ctx, width, height, now);
    } else if (this.activePhenomenon === PHENOMENA_TYPES.MAGNETAR) {
      this._renderMagnetar(ctx, width, height, now);
    }
  }

  // 1. RENDER GARGANTUA (Kerr Black Hole & Lensed Accretion Disk)
  _renderGargantua(ctx, width, height, _now) {
    const cx = width / 2;
    const cy = height * 0.46;
    const rs = 48; // Event Horizon
    const rPhoton = 72; // Photon Sphere

    ctx.save();

    // A. Polar Relativistic Plasma Jets (Perpendicular to Accretion Plane)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let sign of [-1, 1]) {
      const jetGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy + sign * 260, 140);
      jetGrad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
      jetGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.25)');
      jetGrad.addColorStop(0.7, 'rgba(168, 85, 247, 0.12)');
      jetGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = jetGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy);
      ctx.lineTo(cx - 75, cy + sign * 380);
      ctx.lineTo(cx + 75, cy + sign * 380);
      ctx.lineTo(cx + 18, cy);
      ctx.closePath();
      ctx.fill();

      // Collimated Central Laser Spire
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + sign * 340);
      ctx.stroke();
    }
    ctx.restore();

    // B. Christopher Nolan Kip Thorne Lensing: Upper and Lower Mirage Arcs
    // Light from behind the black hole bent over top and bottom poles!
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // 1. Upper Mirage Arc (Bent over North Pole)
    const upperArcGrad = ctx.createRadialGradient(cx, cy - 30, rs, cx, cy - 30, 160);
    upperArcGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    upperArcGrad.addColorStop(0.2, 'rgba(251, 191, 36, 0.85)');
    upperArcGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.45)');
    upperArcGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');

    ctx.beginPath();
    ctx.fillStyle = upperArcGrad;
    ctx.arc(cx, cy - 14, 112, Math.PI, 0, false);
    ctx.lineTo(cx + 80, cy - 14);
    ctx.arc(cx, cy - 14, 62, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();

    // 2. Lower Mirage Arc (Bent under South Pole)
    const lowerArcGrad = ctx.createRadialGradient(cx, cy + 30, rs, cx, cy + 30, 150);
    lowerArcGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    lowerArcGrad.addColorStop(0.25, 'rgba(251, 191, 36, 0.65)');
    lowerArcGrad.addColorStop(0.7, 'rgba(180, 83, 9, 0.3)');
    lowerArcGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.fillStyle = lowerArcGrad;
    ctx.arc(cx, cy + 14, 104, 0, Math.PI, false);
    ctx.lineTo(cx - 70, cy + 14);
    ctx.arc(cx, cy + 14, 58, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // C. Main Equatorial Accretion Disk (Tilted Ellipse passing in front)
    // Features Doppler Beaming: Left (approaching) is dazzling white-cyan-gold; Right is red-shifted ember.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Elliptical Accretion Disk Base
    const diskRx = 210;
    const diskRy = 56;

    // Approaching Left Lobe (Doppler boosted: Bright incandescent white-gold)
    const leftGrad = ctx.createRadialGradient(cx - 90, cy, 20, cx - 90, cy, 140);
    leftGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    leftGrad.addColorStop(0.25, 'rgba(56, 189, 248, 0.85)');
    leftGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.55)');
    leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.ellipse(cx, cy, diskRx, diskRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = leftGrad;
    ctx.fill();

    // Receding Right Lobe (Doppler dimmed: Red-shifted ember)
    const rightGrad = ctx.createRadialGradient(cx + 90, cy, 15, cx + 90, cy, 130);
    rightGrad.addColorStop(0, 'rgba(245, 158, 11, 0.7)');
    rightGrad.addColorStop(0.4, 'rgba(180, 83, 9, 0.4)');
    rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.ellipse(cx, cy, diskRx, diskRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = rightGrad;
    ctx.fill();

    // Orbiting Plasma Filament Particles
    for (let i = 0; i < this.plasmaNodes.length; i++) {
      const p = this.plasmaNodes[i];
      // Project into tilted ellipse coordinates
      const px = cx + Math.cos(p.angle) * p.r;
      const py = cy + Math.sin(p.angle) * (p.r * 0.28);

      // Doppler brightening factor (left side approaching)
      const doppler = Math.cos(p.angle) < 0 ? 1.5 : 0.6;
      ctx.beginPath();
      ctx.fillStyle = doppler > 1.0 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(251, 191, 36, 0.65)';
      ctx.arc(px, py, p.size * (doppler > 1 ? 1.3 : 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // D. Razor-Sharp Photon Ring (Light bent into unstable circular orbit at 1.5 Rs)
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.arc(cx, cy, rPhoton, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary sub-ring
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 6;
    ctx.arc(cx, cy, rPhoton + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // E. Pitch Black Event Horizon Shadow (Schwarzschild Obsidian Singularity)
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = '#030305';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 18;
    ctx.arc(cx, cy, rs, 0, Math.PI * 2);
    ctx.fill();

    // Ultra-sharp dark boundary line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // 2. RENDER ENDURANCE WORMHOLE (Einstein-Rosen Spherical Throat Vista)
  _renderWormhole(ctx, width, height, now) {
    const mouthA = { x: width * 0.32, y: height * 0.46 };
    const mouthB = { x: width * 0.68, y: height * 0.46 };
    const rw = 58;

    const mouths = [mouthA, mouthB];

    ctx.save();

    for (let m = 0; m < mouths.length; m++) {
      const mouth = mouths[m];

      // A. Gravitational Caustic Ripples propagating through spacetime
      ctx.save();
      ctx.setLineDash([6, 6]);
      for (let k = 0; k < 3; k++) {
        const waveRadius = rw + ((now * 0.035 + k * 45) % 150);
        const waveAlpha = Math.max(0, (1 - (waveRadius - rw) / 150) * 0.35);
        ctx.beginPath();
        ctx.strokeStyle = m === 0 ? 'rgba(56, 189, 248, ' + waveAlpha + ')' : 'rgba(192, 132, 252, ' + waveAlpha + ')';
        ctx.lineWidth = 1.5;
        ctx.arc(mouth.x, mouth.y, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // B. Throat Interior: Procedural Distant Galaxy Vista through 4D Spherical Window
      ctx.save();
      ctx.beginPath();
      ctx.arc(mouth.x, mouth.y, rw, 0, Math.PI * 2);
      ctx.clip(); // Mask to wormhole sphere

      // Distant Cosmic Galaxy Swirl
      const galaxyGrad = ctx.createRadialGradient(mouth.x, mouth.y, 4, mouth.x, mouth.y, rw);
      galaxyGrad.addColorStop(0, '#020617');
      galaxyGrad.addColorStop(0.4, '#082f49');
      galaxyGrad.addColorStop(0.8, '#3b0764');
      galaxyGrad.addColorStop(1, '#020617');
      ctx.fillStyle = galaxyGrad;
      ctx.fillRect(mouth.x - rw, mouth.y - rw, rw * 2, rw * 2);

      // Rotating Distant Stars
      for (let s = 0; s < this.wormholeStars.length; s++) {
        const star = this.wormholeStars[s];
        const sx = mouth.x + Math.cos(star.angle) * star.r;
        const sy = mouth.y + Math.sin(star.angle) * star.r;
        ctx.beginPath();
        ctx.fillStyle = star.color;
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gravitational Core Singularity Throat Center
      const coreGrad = ctx.createRadialGradient(mouth.x, mouth.y, 1, mouth.x, mouth.y, 18);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(mouth.x, mouth.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // C. Triple Chromatic Aberration Rings (Gravitational Optical Dispersion)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Cyan outer dispersion ring
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.arc(mouth.x, mouth.y, rw + 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Magenta inner dispersion ring
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.arc(mouth.x, mouth.y, rw - 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Laser-sharp white photon boundary
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.2;
      ctx.arc(mouth.x, mouth.y, rw, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Entangled Quantum Filament Bridge between Mouth A and Mouth B
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.2;
    ctx.moveTo(mouthA.x + rw, mouthA.y);
    ctx.lineTo(mouthB.x - rw, mouthB.y);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // 3. RENDER MAGNETAR (Pulsar Synchrotron Lighthouse & Dipole Magnetic Loops)
  _renderMagnetar(ctx, width, height, now) {
    const cx = width / 2;
    const cy = height * 0.46;
    const rm = 22; // Core Radius
    const beamAngle = now * 0.0022;

    ctx.save();

    // A. Starquake Gamma Flash Overlay
    if (this.starquakeFlashAlpha > 0.01) {
      ctx.save();
      ctx.fillStyle = `rgba(56, 189, 248, ${this.starquakeFlashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // B. Magnetic Dipole Flux Loops (Toroidal / Poloidal Field Geometry)
    ctx.save();
    ctx.lineWidth = 1.4;
    for (let sign of [-1, 1]) {
      for (let loop = 1; loop <= 5; loop++) {
        const loopR = 40 + loop * 36;
        const pulse = Math.sin(now * 0.004 + loop) * 3;
        const color = loop % 2 === 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(192, 132, 252, 0.30)';

        ctx.beginPath();
        ctx.strokeStyle = color;
        // Draw dipole arc
        ctx.ellipse(cx + sign * (loopR / 2), cy, loopR / 2, loopR * 0.75 + pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // C. Twin Relativistic Synchrotron Beams (Sweeping Pulsar Lighthouse)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const beamLength = Math.max(width, height) * 0.95;
    const halfAngle = 0.13; // ~7.5 degrees beam spread

    for (let sign of [0, Math.PI]) {
      const angle = beamAngle + sign;
      const x1 = cx + Math.cos(angle - halfAngle) * beamLength;
      const y1 = cy + Math.sin(angle - halfAngle) * beamLength;
      const x2 = cx + Math.cos(angle + halfAngle) * beamLength;
      const y2 = cy + Math.sin(angle + halfAngle) * beamLength;

      const beamGrad = ctx.createRadialGradient(cx, cy, 10, cx + Math.cos(angle) * (beamLength * 0.5), cy + Math.sin(angle) * (beamLength * 0.5), beamLength * 0.6);
      beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      beamGrad.addColorStop(0.2, 'rgba(56, 189, 248, 0.65)');
      beamGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.25)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();

      // Sharp Core Laser Filament in Beam Center
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.0;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * beamLength, cy + Math.sin(angle) * beamLength);
      ctx.stroke();
    }
    ctx.restore();

    // D. Ultra-Dense Neutron Star Core (Blinding Blue-White Stellar Diamond)
    ctx.save();
    // Corona Glow
    const coronaGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 48);
    coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    coronaGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
    coronaGrad.addColorStop(0.7, 'rgba(192, 132, 252, 0.35)');
    coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();

    // Solid Core
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    ctx.arc(cx, cy, rm, 0, Math.PI * 2);
    ctx.fill();

    // Equator Magnetic Belt Ring
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, rm + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }
}

export const interstellarEngine = new InterstellarEngine();
