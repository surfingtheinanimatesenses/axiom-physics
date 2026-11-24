import Matter from 'matter-js';
import { RuleEngine, BASELINE } from './ruleEngine.js';
import { soundEngine } from './soundEngine.js';

export const SHAPE_COLORS = {
  red: {
    hex: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.15)',
    name: 'RED',
  },
  blue: {
    hex: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.15)',
    name: 'BLUE',
  },
  green: {
    hex: '#10b981',
    fill: 'rgba(16, 185, 129, 0.15)',
    name: 'GREEN',
  },
  gold: {
    hex: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.15)',
    name: 'GOLD',
  },
};

export const COLOR_KEYS = ['red', 'blue', 'green', 'gold'];
export const SHAPE_TYPES = ['box', 'circle', 'triangle'];

export const MAX_DYNAMIC_BODIES = 120;
export const MAX_VELOCITY = 24;
export const WALL_THICKNESS = 300;
export const MESH_STEP = 36;

/**
 * Initializes the headless Matter.js physics engine, custom 60fps canvas renderer,
 * interactive fiber mesh field, deterministic RuleEngine, and Web Audio integration.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options
 * @param {Function} [options.onTelemetry]
 * @param {Function} [options.onRulesChanged]
 */
export function createPhysicsWorld(canvas, options = {}) {
  const { onTelemetry, onRulesChanged } = options;

  // 1. Headless Engine with Baseline Gravity (0, 0.8)
  const engine = Matter.Engine.create({
    enableSleeping: false,
    gravity: { x: BASELINE.gravity.x, y: BASELINE.gravity.y, scale: 0.001 },
  });

  const ctx = canvas.getContext('2d', { alpha: false });
  let animationFrameId = null;
  let isRunning = true;
  let isPaused = false;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = window.devicePixelRatio || 1;

  let dynamicBodies = [];
  let walls = [];
  const particles = [];
  const shimmerRings = [];
  const meshShockwaves = [];

  // Medium simulation state (air vs thick motor oil)
  let currentMedium = BASELINE.medium || 'air'; // 'air' | 'oil'
  let currentViscosity = BASELINE.viscosity || 0.85; // 0.0 to 1.0

  // Screen shake state
  let screenShakeFrames = 0;
  let screenShakeMag = 0;

  function triggerScreenShake(frames = 5, magnitude = 6, epicenterX = null, epicenterY = null) {
    screenShakeFrames = frames;
    screenShakeMag = magnitude;
    if (epicenterX !== null && epicenterY !== null) {
      meshShockwaves.push({
        x: epicenterX,
        y: epicenterY,
        radius: 10,
        maxRadius: Math.min(width, height) * 0.45,
        speed: 13,
        strength: 24,
      });
    }
  }

  // Pointer position tracking for interactive fiber mesh
  let pointerX = -1000;
  let pointerY = -1000;
  let isPointerOver = false;
  let isPointerDown = false;

  // 2D Spring-Mass Fiber Mesh State Arrays (Pre-allocated typed arrays for zero GC pressure)
  let meshCols = Math.ceil(width / MESH_STEP) + 2;
  let meshRows = Math.ceil(height / MESH_STEP) + 2;
  let meshRestX = new Float32Array(meshCols * meshRows);
  let meshRestY = new Float32Array(meshCols * meshRows);
  let meshX = new Float32Array(meshCols * meshRows);
  let meshY = new Float32Array(meshCols * meshRows);
  let meshVx = new Float32Array(meshCols * meshRows);
  let meshVy = new Float32Array(meshCols * meshRows);
  let meshTension = new Float32Array(meshCols * meshRows);

  function resizeMesh() {
    meshCols = Math.ceil(width / MESH_STEP) + 2;
    meshRows = Math.ceil(height / MESH_STEP) + 2;
    const totalNodes = meshCols * meshRows;
    meshRestX = new Float32Array(totalNodes);
    meshRestY = new Float32Array(totalNodes);
    meshX = new Float32Array(totalNodes);
    meshY = new Float32Array(totalNodes);
    meshVx = new Float32Array(totalNodes);
    meshVy = new Float32Array(totalNodes);
    meshTension = new Float32Array(totalNodes);

    let idx = 0;
    for (let r = 0; r < meshRows; r++) {
      const gy = (r - 1) * MESH_STEP;
      for (let c = 0; c < meshCols; c++) {
        const gx = (c - 1) * MESH_STEP;
        meshRestX[idx] = gx;
        meshRestY[idx] = gy;
        meshX[idx] = gx;
        meshY[idx] = gy;
        meshVx[idx] = 0;
        meshVy[idx] = 0;
        meshTension[idx] = 0;
        idx++;
      }
    }
  }

  let frameCount = 0;
  let lastFpsUpdate = performance.now();
  let currentFps = 60;

  // 2. Anti-Tunneling Static Walls (300px thick flush outside viewport edges)
  function createOrUpdateWalls(w, h) {
    if (walls.length > 0) {
      Matter.Composite.remove(engine.world, walls);
      walls = [];
    }

    const t = WALL_THICKNESS;
    const top = Matter.Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, {
      isStatic: true,
      label: 'boundary_wall',
      restitution: 0.6,
      friction: 0.1,
    });

    const bottom = Matter.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, {
      isStatic: true,
      label: 'boundary_wall',
      restitution: 0.6,
      friction: 0.1,
    });

    const left = Matter.Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, {
      isStatic: true,
      label: 'boundary_wall',
      restitution: 0.6,
      friction: 0.1,
    });

    const right = Matter.Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, {
      isStatic: true,
      label: 'boundary_wall',
      restitution: 0.6,
      friction: 0.1,
    });

    walls = [top, bottom, left, right];
    Matter.Composite.add(engine.world, walls);
  }

  // 3. Physics Simulation Hooks in beforeUpdate (Velocity Clamping + Viscous Fluid Drag & Buoyancy)
  Matter.Events.on(engine, 'beforeUpdate', () => {
    const bodies = Matter.Composite.allBodies(engine.world);
    const isOil = currentMedium === 'oil';
    const visc = currentViscosity;

    // World gravity scaled vector for buoyancy calculations
    const gx = engine.world.gravity.x * engine.world.gravity.scale;
    const gy = engine.world.gravity.y * engine.world.gravity.scale;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.isStatic) continue;

      // A. Maximum velocity clamp (magnitude <= 24)
      const vx = b.velocity.x;
      const vy = b.velocity.y;
      const speed = Math.hypot(vx, vy);

      if (speed > MAX_VELOCITY) {
        const factor = MAX_VELOCITY / speed;
        Matter.Body.setVelocity(b, {
          x: vx * factor,
          y: vy * factor,
        });
      }

      // B. Viscous Fluid Mechanics (Active when medium === 'oil')
      if (isOil) {
        const effRadius = b.customRadius || (b.customSize ? b.customSize / 2 : 20);
        const rRatio = effRadius / 20;

        // 1. Stokes (linear) + Quadratic Viscous Drag: F_drag = -k1 * v - k2 * |v| * v
        const k1 = 0.00035 * visc * rRatio;
        const k2 = 0.00004 * visc * rRatio;
        const fDragX = -(k1 * vx + k2 * speed * vx);
        const fDragY = -(k1 * vy + k2 * speed * vy);
        Matter.Body.applyForce(b, b.position, { x: fDragX, y: fDragY });

        // 2. Buoyancy Counter-Force: F_buoy = -0.65 * mass * gravity
        const fBuoyX = -0.65 * b.mass * gx;
        const fBuoyY = -0.65 * b.mass * gy;
        Matter.Body.applyForce(b, b.position, { x: fBuoyX, y: fBuoyY });

        // 3. Rotational Viscosity: Heavy angular velocity damping (angularVelocity *= 0.88 at visc 1.0)
        b.angularVelocity *= (1 - 0.12 * visc);

        // 4. Inelastic Oil-Cushioned Collisions (drop restitution <= 0.15 for soft thuds)
        if (b.restitution > 0.15) {
          b.restitution = 0.15;
        }
      }
    }
  });

  // Collision Sound Synth on collisionStart (Marimba / Glass decaying sine+triangle)
  Matter.Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bA = pair.bodyA;
      const bB = pair.bodyB;
      if (bA.isStatic && bB.isStatic) continue;

      const relSpeed = Math.hypot(
        (bA.velocity?.x || 0) - (bB.velocity?.x || 0),
        (bA.velocity?.y || 0) - (bB.velocity?.y || 0)
      );
      soundEngine.playCollision(bA, bB, relSpeed);
    }
  });

  // 4. Critical Mouse Fix & HiDPI Setup
  const mouse = Matter.Mouse.create(canvas);
  Matter.Mouse.setScale(mouse, { x: 1, y: 1 });

  const mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.25,
      damping: 0.1,
      render: { visible: false },
    },
  });
  Matter.Composite.add(engine.world, mouseConstraint);

  // Resize handler
  function handleResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    Matter.Mouse.setScale(mouse, { x: 1, y: 1 });
    createOrUpdateWalls(width, height);
    resizeMesh();
  }

  handleResize();

  // Particle System Spawners
  function spawnParticles(x, y, colorHex = '#ffffff', count = 16, maxSpeed = 5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * maxSpeed + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02,
        color: colorHex,
      });
    }
  }

  // 18 Fading Velocity Sparks on Explode
  function spawnSparks(x, y, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 3;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.025,
        color: Math.random() > 0.4 ? '#f59e0b' : '#ffffff',
      });
    }
  }

  // Golden Shimmer Rings on turn_gold
  function spawnShimmerRings(x, y) {
    shimmerRings.push({
      x,
      y,
      radius: 6,
      maxRadius: 55,
      speed: 1.6,
      alpha: 1.0,
      color: '#f59e0b',
    });
    shimmerRings.push({
      x,
      y,
      radius: 2,
      maxRadius: 38,
      speed: 1.1,
      alpha: 0.85,
      color: '#fcd34d',
    });
  }

  // 5. Spawning Logic
  function spawnShape(x, y, forcedType = null, forcedColor = null, initialVelocity = null) {
    const shapeType = forcedType || SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
    const colorKey = forcedColor || COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
    const colorInfo = SHAPE_COLORS[colorKey] || SHAPE_COLORS.gold;

    const posX = x !== undefined && x !== null ? x : Math.random() * (width - 160) + 80;
    const posY = y !== undefined && y !== null ? y : Math.random() * (height * 0.45) + 60;

    let body;
    const commonOpts = {
      restitution: BASELINE.restitution,
      friction: 0.04,
      frictionAir: BASELINE.frictionAir,
      density: 0.002,
      label: 'dynamic_body',
    };

    if (shapeType === 'box') {
      const size = Math.floor(Math.random() * 18) + 32; // 32 - 50px
      body = Matter.Bodies.rectangle(posX, posY, size, size, commonOpts);
      body.customSize = size;
    } else if (shapeType === 'circle') {
      const radius = Math.floor(Math.random() * 10) + 16; // 16 - 26px
      body = Matter.Bodies.circle(posX, posY, radius, commonOpts);
      body.customRadius = radius;
    } else {
      // Triangle (3-sided regular polygon)
      const radius = Math.floor(Math.random() * 10) + 20; // 20 - 30px
      body = Matter.Bodies.polygon(posX, posY, 3, radius, commonOpts);
      body.customRadius = radius;
    }

    body.customType = shapeType;
    body.customColorKey = colorKey;
    body.customColor = colorInfo;
    body.customTrail = [];
    body.wakeRibbon = [];
    body.plugin = { appliedScale: 1.0 };

    if (currentMedium === 'oil') {
      body.restitution = Math.min(body.restitution, 0.15);
    }

    if (initialVelocity) {
      Matter.Body.setVelocity(body, initialVelocity);
    } else {
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 2,
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
    }

    // Strict cap of 120 dynamic bodies (recycle oldest)
    if (dynamicBodies.length >= MAX_DYNAMIC_BODIES) {
      const oldest = dynamicBodies.shift();
      Matter.Composite.remove(engine.world, oldest);
    }

    dynamicBodies.push(body);
    Matter.Composite.add(engine.world, body);

    return body;
  }

  function removeDynamicBody(body) {
    const idx = dynamicBodies.indexOf(body);
    if (idx !== -1) {
      dynamicBodies.splice(idx, 1);
    }
    Matter.Composite.remove(engine.world, body);
  }

  function spawnBatch(count = 15) {
    for (let i = 0; i < count; i++) {
      spawnShape();
    }
  }

  function broadcastTelemetry() {
    if (onTelemetry) {
      onTelemetry({
        bodyCount: dynamicBodies.length,
        maxBodies: MAX_DYNAMIC_BODIES,
        gravityX: Number(engine.world.gravity.x.toFixed(1)),
        gravityY: Number(engine.world.gravity.y.toFixed(1)),
        medium: currentMedium,
        viscosity: currentViscosity,
        fps: currentFps,
        isPaused,
      });
    }
  }

  function setMedium(medium, viscosity) {
    currentMedium = medium === 'oil' ? 'oil' : 'air';
    if (typeof viscosity === 'number') {
      currentViscosity = Math.max(0.0, Math.min(1.0, viscosity));
    }
    broadcastTelemetry();
  }

  // World Controller instance exposed to RuleEngine
  const worldController = {
    engine,
    spawnShape,
    spawnBatch,
    removeDynamicBody,
    spawnParticles,
    spawnSparks,
    spawnShimmerRings,
    triggerScreenShake,
    setMedium,
    getDynamicBodies: () => dynamicBodies,
    onTelemetryUpdate: broadcastTelemetry,
  };

  // Instantiate RuleEngine
  const ruleEngine = new RuleEngine(worldController);

  function resetWorld() {
    ruleEngine.clearAll();

    for (let i = 0; i < dynamicBodies.length; i++) {
      Matter.Composite.remove(engine.world, dynamicBodies[i]);
    }
    dynamicBodies = [];

    // Reset baseline gravity & medium
    engine.world.gravity.x = BASELINE.gravity.x;
    engine.world.gravity.y = BASELINE.gravity.y;
    engine.world.gravity.scale = 0.001;
    currentMedium = BASELINE.medium;
    currentViscosity = BASELINE.viscosity;

    // Spawn 24 initial shapes
    for (let i = 0; i < 24; i++) {
      spawnShape();
    }

    broadcastTelemetry();
    if (onRulesChanged) {
      onRulesChanged(ruleEngine.getActiveRules());
    }
  }

  // Initial spawn: exactly 24 shapes
  for (let i = 0; i < 24; i++) {
    spawnShape();
  }

  // 6. Pointer & Cursor Listeners for Interactive Fiber Mesh & Spawning
  let pointerDownPos = null;
  let pointerDownTime = 0;
  let hadGrabbedBody = false;

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    isPointerOver = true;
  }

  function onPointerEnter() {
    isPointerOver = true;
  }

  function onPointerLeave() {
    isPointerOver = false;
    isPointerDown = false;
    pointerX = -1000;
    pointerY = -1000;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointerX = x;
    pointerY = y;
    isPointerOver = true;
    isPointerDown = true;

    pointerDownPos = { x, y };
    pointerDownTime = performance.now();
    hadGrabbedBody = Boolean(mouseConstraint.body);
  }

  function onPointerUp(e) {
    isPointerDown = false;
    if (e.button !== 0 || !pointerDownPos) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - pointerDownPos.x;
    const dy = y - pointerDownPos.y;
    const dist = Math.hypot(dx, dy);
    const duration = performance.now() - pointerDownTime;

    if (!hadGrabbedBody && !mouseConstraint.body && dist < 5 && duration < 350) {
      const hits = Matter.Query.point(dynamicBodies, { x, y });
      if (hits.length === 0) {
        spawnShape(x, y);
        broadcastTelemetry();
      }
    }

    pointerDownPos = null;
    hadGrabbedBody = false;
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', handleResize);

  // 7. Custom 60fps requestAnimationFrame HTML5 Canvas Renderer
  let lastEngineStep = performance.now();

  function render(now) {
    if (!isRunning) return;

    frameCount++;
    if (now - lastFpsUpdate >= 500) {
      currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
      frameCount = 0;
      lastFpsUpdate = now;
      broadcastTelemetry();
    }

    // Step physics engine (fixed ~16.6ms timestep, pauses when isPaused)
    if (!isPaused) {
      const delta = Math.min(now - lastEngineStep, 50);
      Matter.Engine.update(engine, delta > 0 ? delta : 1000 / 60);
    }
    lastEngineStep = now;

    // Begin Canvas Render Pass
    ctx.save();
    ctx.scale(dpr, dpr);

    // Apply 5-frame damped screen shake on explosions
    if (screenShakeFrames > 0) {
      const sx = (Math.random() - 0.5) * screenShakeMag;
      const sy = (Math.random() - 0.5) * screenShakeMag;
      ctx.translate(sx, sy);
      screenShakeMag *= 0.65;
      screenShakeFrames--;
    }

    // Viewport background: #09090b
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    const isOil = currentMedium === 'oil';

    // In Oil Mode: Deep amber-gold vignette overlay
    if (isOil) {
      const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.15, width / 2, height / 2, width * 0.8);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.018)');
      grad.addColorStop(1, 'rgba(217, 119, 6, 0.075)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // -------------------------------------------------------------
    // INTERACTIVE 2D SPRING-MASS FIBER MESH & VISCOUS WAKE FIELD
    // -------------------------------------------------------------

    // Update propagating shockwaves
    for (let swIdx = meshShockwaves.length - 1; swIdx >= 0; swIdx--) {
      const sw = meshShockwaves[swIdx];
      sw.radius += sw.speed;
      if (sw.radius >= sw.maxRadius) {
        meshShockwaves.splice(swIdx, 1);
      }
    }

    const time = now * 0.0014;
    const activeRules = ruleEngine.getActiveRules();
    const radialRules = activeRules.filter((r) => r.type === 'radial_force');

    // Viscoelastic Spring Relaxation: Overdamped in oil mode (stiffness: 0.035, damping: 0.82)
    const stiffness = isOil ? 0.035 : 0.075;
    const damping = isOil ? 0.82 : 0.86;
    const totalNodes = meshCols * meshRows;

    for (let i = 0; i < totalNodes; i++) {
      // Subtle ambient harmonic vibration across the fiber weave
      const ambX = Math.sin(meshRestX[i] * 0.005 + meshRestY[i] * 0.004 + time) * (isOil ? 0.6 : 1.2);
      const ambY = Math.cos(meshRestX[i] * 0.004 - meshRestY[i] * 0.005 + time) * (isOil ? 0.6 : 1.2);

      const fx = (meshRestX[i] + ambX - meshX[i]) * stiffness;
      const fy = (meshRestY[i] + ambY - meshY[i]) * stiffness;
      meshVx[i] = (meshVx[i] + fx) * damping;
      meshVy[i] = (meshVy[i] + fy) * damping;
      meshX[i] += meshVx[i];
      meshY[i] += meshVy[i];
      meshTension[i] *= (isOil ? 0.90 : 0.84);
    }

    // Body-Mesh Coupling: Any moving body within 110px pushes & drags surrounding fiber strands along velocity
    for (let b = 0; b < dynamicBodies.length; b++) {
      const body = dynamicBodies[b];
      const bVx = body.velocity?.x || 0;
      const bVy = body.velocity?.y || 0;
      const bSpeed = Math.hypot(bVx, bVy);

      // Track viscous wake ribbon
      body.wakeRibbon = body.wakeRibbon || [];
      body.wakeRibbon.push({ x: body.position.x, y: body.position.y, speed: bSpeed });
      if (body.wakeRibbon.length > 8) {
        body.wakeRibbon.shift();
      }

      const bRadius = 110;
      const minCol = Math.max(0, Math.floor((body.position.x - bRadius) / MESH_STEP) + 1);
      const maxCol = Math.min(meshCols - 1, Math.ceil((body.position.x + bRadius) / MESH_STEP) + 1);
      const minRow = Math.max(0, Math.floor((body.position.y - bRadius) / MESH_STEP) + 1);
      const maxRow = Math.min(meshRows - 1, Math.ceil((body.position.y + bRadius) / MESH_STEP) + 1);

      for (let r = minRow; r <= maxRow; r++) {
        const rowOff = r * meshCols;
        for (let c = minCol; c <= maxCol; c++) {
          const nIdx = rowOff + c;
          const dx = meshX[nIdx] - body.position.x;
          const dy = meshY[nIdx] - body.position.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < bRadius * bRadius && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const factor = 1 - dist / bRadius;
            // Bow-wave compression ahead of the object
            const push = factor * factor * (isOil ? 2.4 : 4.0);
            meshVx[nIdx] += (dx / dist) * push;
            meshVy[nIdx] += (dy / dist) * push;
            // Elongated syrupy wake trailing along velocity vector
            const drag = factor * (isOil ? 0.44 : 0.22);
            meshVx[nIdx] += bVx * drag;
            meshVy[nIdx] += bVy * drag;
            meshTension[nIdx] = Math.min(1.0, meshTension[nIdx] + factor * (isOil ? 0.7 : 0.45));
          }
        }
      }
    }

    // Interactive cursor deflection (repulsion / drag lens)
    if (isPointerOver && pointerX > -500) {
      const cRadius = 140;
      const minCol = Math.max(0, Math.floor((pointerX - cRadius) / MESH_STEP) + 1);
      const maxCol = Math.min(meshCols - 1, Math.ceil((pointerX + cRadius) / MESH_STEP) + 1);
      const minRow = Math.max(0, Math.floor((pointerY - cRadius) / MESH_STEP) + 1);
      const maxRow = Math.min(meshRows - 1, Math.ceil((pointerY + cRadius) / MESH_STEP) + 1);

      for (let r = minRow; r <= maxRow; r++) {
        const rowOff = r * meshCols;
        for (let c = minCol; c <= maxCol; c++) {
          const nIdx = rowOff + c;
          const cdx = meshX[nIdx] - pointerX;
          const cdy = meshY[nIdx] - pointerY;
          const cDistSq = cdx * cdx + cdy * cdy;
          if (cDistSq < cRadius * cRadius && cDistSq > 1) {
            const cDist = Math.sqrt(cDistSq);
            const cFactor = 1 - cDist / cRadius;
            const force = cFactor * cFactor * (isPointerDown ? (isOil ? -3.0 : -4.8) : (isOil ? 2.6 : 4.2));
            meshVx[nIdx] += (cdx / cDist) * force;
            meshVy[nIdx] += (cdy / cDist) * force;
            meshTension[nIdx] = Math.min(1.0, meshTension[nIdx] + cFactor * 0.6);
          }
        }
      }
    }

    // Active radial force field warping
    for (let rf = 0; rf < radialRules.length; rf++) {
      const raw = radialRules[rf].raw || radialRules[rf];
      const isAttract = (raw.strength !== undefined ? raw.strength : 0.002) >= 0;
      const srcCol = raw.sourceColor || 'all';

      for (let b = 0; b < dynamicBodies.length; b++) {
        const body = dynamicBodies[b];
        if (srcCol !== 'all' && body.customColorKey !== srcCol) continue;

        const fieldRadius = 220;
        const minCol = Math.max(0, Math.floor((body.position.x - fieldRadius) / MESH_STEP) + 1);
        const maxCol = Math.min(meshCols - 1, Math.ceil((body.position.x + fieldRadius) / MESH_STEP) + 1);
        const minRow = Math.max(0, Math.floor((body.position.y - fieldRadius) / MESH_STEP) + 1);
        const maxRow = Math.min(meshRows - 1, Math.ceil((body.position.y + fieldRadius) / MESH_STEP) + 1);

        for (let r = minRow; r <= maxRow; r++) {
          const rowOff = r * meshCols;
          for (let c = minCol; c <= maxCol; c++) {
            const nIdx = rowOff + c;
            const rdx = meshX[nIdx] - body.position.x;
            const rdy = meshY[nIdx] - body.position.y;
            const rDistSq = rdx * rdx + rdy * rdy;
            if (rDistSq < fieldRadius * fieldRadius && rDistSq > 1) {
              const rDist = Math.sqrt(rDistSq);
              const rFactor = 1 - rDist / fieldRadius;
              const rForce = (isAttract ? -1 : 1) * rFactor * rFactor * (isOil ? 1.5 : 2.8);
              meshVx[nIdx] += (rdx / rDist) * rForce;
              meshVy[nIdx] += (rdy / rDist) * rForce;
              meshTension[nIdx] = Math.min(1.0, meshTension[nIdx] + rFactor * 0.5);
            }
          }
        }
      }
    }

    // Shockwaves from explosions
    for (let s = 0; s < meshShockwaves.length; s++) {
      const sw = meshShockwaves[s];
      for (let i = 0; i < totalNodes; i++) {
        const sdx = meshX[i] - sw.x;
        const sdy = meshY[i] - sw.y;
        const sDist = Math.hypot(sdx, sdy);
        const waveDiff = Math.abs(sDist - sw.radius);
        if (waveDiff < 45 && sDist > 1) {
          const sFactor = (1 - waveDiff / 45) * (1 - sw.radius / sw.maxRadius);
          const swPush = sFactor * (sw.strength * 0.15);
          meshVx[i] += (sdx / sDist) * swPush;
          meshVy[i] += (sdy / sDist) * swPush;
          meshTension[i] = Math.min(1.0, meshTension[i] + sFactor * 0.9);
        }
      }
    }

    // A. Render Base Woven Fibers (Horizontal & Vertical Lines)
    ctx.beginPath();
    // In Air Mode: crisp 1px lines at rgba(255, 255, 255, 0.05); In Oil Mode: warm amber-bronze strands rgba(217, 119, 6, 0.18)
    ctx.strokeStyle = isOil ? 'rgba(217, 119, 6, 0.18)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Horizontal fiber strands
    for (let r = 0; r < meshRows; r++) {
      const rowOffset = r * meshCols;
      ctx.moveTo(meshX[rowOffset], meshY[rowOffset]);
      for (let c = 1; c < meshCols; c++) {
        const pIdx = rowOffset + c;
        ctx.lineTo(meshX[pIdx], meshY[pIdx]);
      }
    }

    // Vertical fiber strands
    for (let c = 0; c < meshCols; c++) {
      ctx.moveTo(meshX[c], meshY[c]);
      for (let r = 1; r < meshRows; r++) {
        const pIdx = r * meshCols + c;
        ctx.lineTo(meshX[pIdx], meshY[pIdx]);
      }
    }
    ctx.stroke();

    // B. High-Tension Stressed Fiber Highlights (Cyan in Air; Bright Amber 0.55 in Oil)
    ctx.beginPath();
    ctx.strokeStyle = isOil ? 'rgba(245, 158, 11, 0.55)' : 'rgba(6, 182, 212, 0.22)';
    ctx.lineWidth = isOil ? 1.4 : 1.2;

    for (let r = 0; r < meshRows; r++) {
      const rowOffset = r * meshCols;
      for (let c = 0; c < meshCols - 1; c++) {
        const p1 = rowOffset + c;
        const p2 = p1 + 1;
        if (meshTension[p1] > 0.18 || meshTension[p2] > 0.18) {
          ctx.moveTo(meshX[p1], meshY[p1]);
          ctx.lineTo(meshX[p2], meshY[p2]);
        }
      }
    }

    for (let c = 0; c < meshCols; c++) {
      for (let r = 0; r < meshRows - 1; r++) {
        const p1 = r * meshCols + c;
        const p2 = (r + 1) * meshCols + c;
        if (meshTension[p1] > 0.18 || meshTension[p2] > 0.18) {
          ctx.moveTo(meshX[p1], meshY[p1]);
          ctx.lineTo(meshX[p2], meshY[p2]);
        }
      }
    }
    ctx.stroke();

    // C. Node Weave Intersections (Technical Micro-Crosses)
    ctx.beginPath();
    ctx.strokeStyle = isOil ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.065)';
    ctx.lineWidth = 1;
    const arm = 2;
    for (let i = 0; i < totalNodes; i++) {
      const px = meshX[i];
      const py = meshY[i];
      ctx.moveTo(px - arm, py);
      ctx.lineTo(px + arm, py);
      ctx.moveTo(px, py - arm);
      ctx.lineTo(px, py + arm);
    }
    ctx.stroke();

    // D. Energetic Node Micro-Glow on high stress
    ctx.beginPath();
    ctx.fillStyle = isOil ? 'rgba(245, 158, 11, 0.65)' : 'rgba(6, 182, 212, 0.55)';
    for (let i = 0; i < totalNodes; i++) {
      if (meshTension[i] > 0.35) {
        ctx.moveTo(meshX[i] + 1.5, meshY[i]);
        ctx.arc(meshX[i], meshY[i], 1.5, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // E. Viscous Wake Ribbons Trailing Moving Bodies (Active in Oil Mode)
    if (isOil) {
      for (let b = 0; b < dynamicBodies.length; b++) {
        const body = dynamicBodies[b];
        const wake = body.wakeRibbon;
        if (!wake || wake.length < 2) continue;

        for (let w = 0; w < wake.length - 1; w++) {
          const pt1 = wake[w];
          const pt2 = wake[w + 1];
          const alpha = ((w + 1) / wake.length) * 0.28;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 2.0 + (w / wake.length) * 2.5;
          ctx.lineCap = 'round';
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      }
    }

    // F. Translucent Meniscus Halos Around Bodies (Active in Oil Mode)
    if (isOil) {
      for (let b = 0; b < dynamicBodies.length; b++) {
        const body = dynamicBodies[b];
        const baseRad = body.circleRadius || body.customRadius || (body.customSize ? body.customSize / 2 : 20);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.lineWidth = 2.5;
        ctx.arc(body.position.x, body.position.y, baseRad + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // -------------------------------------------------------------
    // FOREGROUND SIMULATION RENDERING
    // -------------------------------------------------------------

    // Render Radial Force Animated Concentric Dashed Rings
    for (let r = 0; r < activeRules.length; r++) {
      const rule = activeRules[r];
      if (rule.type === 'radial_force') {
        const raw = rule.raw || rule;
        const isAttract = (raw.strength !== undefined ? raw.strength : 0.002) >= 0;
        const ringColor = isAttract ? '#06b6d4' : '#f43f5e';
        const srcCol = raw.sourceColor || 'all';

        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;

        for (let b = 0; b < dynamicBodies.length; b++) {
          const body = dynamicBodies[b];
          if (srcCol !== 'all' && body.customColorKey !== srcCol) continue;

          const timeOffset = (now * 0.0018) % 1;

          for (let k = 0; k < 3; k++) {
            const phase = (timeOffset + k / 3) % 1;
            // Cyan pulsing inward for attraction; Rose pulsing outward for repulsion
            const ringRadius = isAttract
              ? 85 - phase * 60 // 85 -> 25
              : 25 + phase * 60; // 25 -> 85
            const ringAlpha = Math.sin(phase * Math.PI) * 0.45;

            ctx.beginPath();
            ctx.strokeStyle = ringColor;
            ctx.globalAlpha = Math.max(0, ringAlpha);
            ctx.arc(body.position.x, body.position.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
      }
    }

    // Render Golden Shimmer Rings
    for (let s = shimmerRings.length - 1; s >= 0; s--) {
      const ring = shimmerRings[s];
      ring.radius += ring.speed;
      ring.alpha -= 0.025;
      if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
        shimmerRings.splice(s, 1);
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = Math.max(0, ring.alpha);
      ctx.lineWidth = 1.5;
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Render Particles & Sparks
    for (let p = particles.length - 1; p >= 0; p--) {
      const part = particles[p];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) {
        particles.splice(p, 1);
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = part.color;
      ctx.globalAlpha = Math.max(0, part.life);
      ctx.lineWidth = 1.5;
      ctx.moveTo(part.x, part.y);
      ctx.lineTo(part.x - part.vx * 1.5, part.y - part.vy * 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Render Dynamic Bodies & Motion Trails
    for (let i = 0; i < dynamicBodies.length; i++) {
      const b = dynamicBodies[i];
      const speed = Matter.Vector.magnitude(b.velocity);
      const color = b.customColor || SHAPE_COLORS.gold;

      // Update motion trail buffer
      b.customTrail.push({
        x: b.position.x,
        y: b.position.y,
        angle: b.angle,
        speed: speed,
      });
      if (b.customTrail.length > 5) {
        b.customTrail.shift();
      }

      // Draw subtle 5-frame motion trail when speed > 8
      if (speed > 8 && b.customTrail.length > 1) {
        for (let t = 0; t < b.customTrail.length - 1; t++) {
          const pt = b.customTrail[t];
          const nextPt = b.customTrail[t + 1];
          const trailAlpha = ((t + 1) / b.customTrail.length) * 0.25;

          ctx.beginPath();
          ctx.strokeStyle = color.hex;
          ctx.globalAlpha = trailAlpha;
          ctx.lineWidth = 1;
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(nextPt.x, nextPt.y);
          ctx.stroke();

          // Ghost outline at previous position
          if (b.customType === 'circle') {
            ctx.beginPath();
            const currentR = (b.circleRadius || b.customRadius || 18) * (b.plugin?.appliedScale || 1.0);
            ctx.arc(pt.x, pt.y, currentR, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.save();
            ctx.translate(pt.x, pt.y);
            ctx.rotate(pt.angle);
            ctx.beginPath();
            if (b.customType === 'box') {
              const sz = (b.customSize || 36) * (b.plugin?.appliedScale || 1.0);
              ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
            } else {
              const r = (b.customRadius || 24) * (b.plugin?.appliedScale || 1.0);
              for (let k = 0; k < 3; k++) {
                const theta = (k * 2 * Math.PI) / 3 - Math.PI / 2;
                const px = r * Math.cos(theta);
                const py = r * Math.sin(theta);
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw Primary Body Vertices
      const vertices = b.vertices;
      ctx.beginPath();
      if (b.customType === 'circle') {
        const radius = (b.circleRadius || b.customRadius || 18);
        ctx.arc(b.position.x, b.position.y, radius, 0, Math.PI * 2);
      } else {
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let v = 1; v < vertices.length; v++) {
          ctx.lineTo(vertices[v].x, vertices[v].y);
        }
        ctx.closePath();
      }

      // 15% alpha fill
      ctx.fillStyle = color.fill;
      ctx.fill();

      // Crisp 1.5px solid stroke
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center Orientation Tick Mark
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      // Center point
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -1, 2, 2);

      // Orientation pointer tick
      const tickLength = b.customType === 'circle' ? (b.circleRadius || 18) * 0.75 : 12;
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.moveTo(0, 0);
      ctx.lineTo(tickLength, 0);
      ctx.stroke();

      ctx.restore();
    }

    // Active drag constraint
    if (mouseConstraint.body) {
      const b = mouseConstraint.body;
      const mPos = mouseConstraint.mouse.position;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.moveTo(b.position.x, b.position.y);
      ctx.lineTo(mPos.x, mPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Precision crosshair at drag point
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mPos.x - 6, mPos.y);
      ctx.lineTo(mPos.x + 6, mPos.y);
      ctx.moveTo(mPos.x, mPos.y - 6);
      ctx.lineTo(mPos.x, mPos.y + 6);
      ctx.stroke();
    }

    ctx.restore();

    animationFrameId = requestAnimationFrame(render);
  }

  // Start RAF loop
  animationFrameId = requestAnimationFrame(render);

  // Clean Teardown
  function destroy() {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerenter', onPointerEnter);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', handleResize);

    ruleEngine.destroy();

    Matter.Events.off(engine);
    Matter.Composite.clear(engine.world, false);
    Matter.Engine.clear(engine);
    dynamicBodies = [];
    walls = [];
  }

  return {
    engine,
    ruleEngine,
    spawnShape,
    spawnBatch,
    resetWorld,
    togglePause: () => {
      isPaused = !isPaused;
      broadcastTelemetry();
      return isPaused;
    },
    isPaused: () => isPaused,
    setGravity: (gx, gy) => {
      engine.world.gravity.x = gx;
      engine.world.gravity.y = gy;
      broadcastTelemetry();
    },
    setMedium,
    getMedium: () => currentMedium,
    getViscosity: () => currentViscosity,
    addRule: (rule) => {
      const active = ruleEngine.addRule(rule);
      if (onRulesChanged) onRulesChanged(active);
      return active;
    },
    removeRule: (ruleId) => {
      const active = ruleEngine.removeRule(ruleId);
      if (onRulesChanged) onRulesChanged(active);
      return active;
    },
    clearAllRules: () => {
      const active = ruleEngine.clearAll();
      if (onRulesChanged) onRulesChanged(active);
      return active;
    },
    getActiveRules: () => ruleEngine.getActiveRules(),
    getDynamicBodies: () => dynamicBodies,
    destroy,
  };
}
