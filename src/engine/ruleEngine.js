import Matter from 'matter-js';
import { SHAPE_COLORS } from './physicsWorld.js';
import { soundEngine } from './soundEngine.js';

/**
 * Baseline physical constants for clean state reverts.
 */
export const BASELINE = {
  gravity: { x: 0, y: 0.8 },
  restitution: 0.4,
  frictionAir: 0.01,
  scale: 1.0,
  medium: 'air',
  viscosity: 0.85,
  phenomenon: 'none',
};

/**
 * Interstellar-Grade Blender VFX Phenomena (Kip Thorne General Relativity & Astrophysics)
 */
export const INTERSTELLAR_PRESETS = [
  {
    id: 'preset_gargantua',
    phenomenon: 'gargantua',
    pillLabel: '🌌 GARGANTUA // BLACK HOLE',
    humanLabel: 'GARGANTUA // KERR SINGULARITY',
    description: 'Supermassive Kerr black hole with relativistic gravitational lensing, Doppler accretion disk & spaghettification',
    rules: [
      {
        id: 'rule_gargantua_phenom',
        type: 'set_phenomenon',
        label: 'GARGANTUA // KERR BLACK HOLE',
        phenomenon: 'gargantua',
      },
      {
        id: 'rule_gargantua_grav',
        type: 'set_gravity',
        label: 'MICRO-GRAVITY DILATION',
        x: 0,
        y: 0.05,
        flipEveryMs: null,
      },
    ],
  },
  {
    id: 'preset_wormhole',
    phenomenon: 'wormhole',
    pillLabel: '🌀 ENDURANCE // WORMHOLE',
    humanLabel: 'ENDURANCE // EINSTEIN-ROSEN BRIDGE',
    description: 'Spherical 4D spacetime throat with celestial galaxy interior, chromatic dispersion & dimensional transit',
    rules: [
      {
        id: 'rule_wormhole_phenom',
        type: 'set_phenomenon',
        label: 'ENDURANCE // EINSTEIN-ROSEN BRIDGE',
        phenomenon: 'wormhole',
      },
      {
        id: 'rule_wormhole_grav',
        type: 'set_gravity',
        label: 'WARP-SPACE ZERO-G',
        x: 0,
        y: 0,
        flipEveryMs: null,
      },
    ],
  },
  {
    id: 'preset_magnetar',
    phenomenon: 'magnetar',
    pillLabel: '⚡ MAGNETAR // PULSAR',
    humanLabel: 'MAGNETAR // RELATIVISTIC PULSAR',
    description: 'Ultra-dense spinning neutron star with sweeping synchrotron light cones, Lorentz force & starquakes',
    rules: [
      {
        id: 'rule_magnetar_phenom',
        type: 'set_phenomenon',
        label: 'MAGNETAR // RELATIVISTIC PULSAR',
        phenomenon: 'magnetar',
      },
      {
        id: 'rule_magnetar_grav',
        type: 'set_gravity',
        label: 'MAGNETIC SUSPENSION',
        x: 0,
        y: 0.05,
        flipEveryMs: null,
      },
    ],
  },
];

/**
 * Core Classic Physical Laws
 */
export const BASELINE_PRESETS = [
  {
    id: 'preset_pinball',
    pillLabel: 'LAW // ZERO-G PINBALL',
    humanLabel: 'PINBALL // ZERO-G ELASTIC',
    description: 'Zero-G + high restitution 1.08 + random velocity kick',
    rules: [
      {
        id: 'rule_pinball_grav',
        type: 'set_gravity',
        label: 'ZERO GRAVITY (0.0, 0.0)',
        x: 0,
        y: 0,
        flipEveryMs: null,
      },
      {
        id: 'rule_pinball_bounce',
        type: 'mutate_bodies',
        label: 'HYPER-BOUNCE (e=1.08)',
        filter: { color: 'all', shape: 'all' },
        restitution: 1.08,
        frictionAir: 0.001,
        scale: 1.0,
      },
    ],
    postAction: (world) => {
      const bodies = world.getDynamicBodies();
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        Matter.Body.setVelocity(b, {
          x: (Math.random() - 0.5) * 16,
          y: (Math.random() - 0.5) * 16,
        });
      }
    },
  },
  {
    id: 'preset_midas',
    pillLabel: 'LAW // MIDAS-CHAIN',
    humanLabel: 'MIDAS-CHAIN // TRANSMUTATION',
    description: 'Red + All turns gold; Gold + Gold explodes',
    rules: [
      {
        id: 'rule_midas_turn',
        type: 'on_collision',
        label: 'COLLIDE: RED→GOLD',
        colorA: 'red',
        colorB: 'all',
        action: 'turn_gold',
      },
      {
        id: 'rule_midas_boom',
        type: 'on_collision',
        label: 'COLLIDE: GOLD+GOLD→EXPLODE',
        colorA: 'gold',
        colorB: 'gold',
        action: 'explode',
      },
    ],
  },
  {
    id: 'preset_castrol_oil',
    pillLabel: 'LAW // CASTROL-OIL',
    humanLabel: 'CASTROL-OIL // VISCOUS FLUID',
    description: 'Submerge simulation in Castrol-grade thick viscous motor oil (viscosity: 0.88)',
    rules: [
      {
        id: 'rule_castrol_medium',
        type: 'set_medium',
        label: 'VISCOUS MEDIUM // CASTROL OIL (0.88)',
        medium: 'oil',
        viscosity: 0.88,
      },
    ],
  },
  {
    id: 'preset_gravity_flip',
    pillLabel: 'LAW // GRAVITY-FLIP',
    humanLabel: 'GRAVITY-FLIP // 2.5S INTERVAL',
    description: 'Gravity flips every 2500ms + spawns 12 blue triangles',
    rules: [
      {
        id: 'rule_flip_timer',
        type: 'set_gravity',
        label: 'FLIP G (Y:0.8 @ 2.5S)',
        x: 0,
        y: 0.8,
        flipEveryMs: 2500,
      },
      {
        id: 'rule_flip_wave',
        type: 'spawn_wave',
        label: 'SPAWN 12 BLUE TRIANGLES',
        shape: 'triangle',
        color: 'blue',
        count: 12,
      },
    ],
  },
];

/**
 * Complete Presets Collection
 */
export const PRESETS = [...INTERSTELLAR_PRESETS, ...BASELINE_PRESETS];

/**
 * Deterministic Safe Rule Engine.
 * Strictly NO eval() or dynamic code generation.
 */
export class RuleEngine {
  constructor(world) {
    this.world = world;
    this.engine = world.engine;
    this.activeRules = [];
    this.postStepQueue = [];

    this._bindEngineHooks();
  }

  /**
   * Binds to Matter.Engine beforeUpdate, afterUpdate, and collisionStart hooks.
   */
  _bindEngineHooks() {
    // 1. Collision Start: Queue actions into postStepQueue (never mutate bodies inside collisionStart)
    this._collisionHandler = (event) => {
      const collisionRules = this.activeRules.filter((r) => r.type === 'on_collision');
      if (collisionRules.length === 0) return;

      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Skip static boundaries
        if (bodyA.isStatic || bodyB.isStatic) continue;

        for (let j = 0; j < collisionRules.length; j++) {
          const rule = collisionRules[j];
          const colA = rule.colorA;
          const colB = rule.colorB;

          const matchNormal =
            (colA === 'all' || bodyA.customColorKey === colA) &&
            (colB === 'all' || bodyB.customColorKey === colB);

          const matchInverted =
            (colB === 'all' || bodyA.customColorKey === colB) &&
            (colA === 'all' || bodyB.customColorKey === colA);

          if (matchNormal || matchInverted) {
            // Push to postStepQueue safely
            const point =
              pair.collision.supports && pair.collision.supports.length > 0
                ? { x: pair.collision.supports[0].x, y: pair.collision.supports[0].y }
                : { x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 };

            this.postStepQueue.push({
              action: rule.action,
              bodyA,
              bodyB,
              point,
            });
          }
        }
      }
    };

    // 2. BeforeUpdate: Frame-independent simulation timers & radial forces
    this._beforeUpdateHandler = (event) => {
      const delta = event.delta || 16.67;
      const dynamicBodies = this.world.getDynamicBodies();

      for (let i = 0; i < this.activeRules.length; i++) {
        const rule = this.activeRules[i];

        // A. Frame-Independent Timers for set_gravity
        if (rule.type === 'set_gravity' && rule.flipEveryMs) {
          rule._timerMs = (rule._timerMs || 0) + delta;
          if (rule._timerMs >= rule.flipEveryMs) {
            rule._timerMs -= rule.flipEveryMs;
            rule._flipState = !rule._flipState;

            const mul = rule._flipState ? -1 : 1;
            this.engine.world.gravity.x = rule.x * mul;
            this.engine.world.gravity.y = rule.y * mul;

            if (this.world.onTelemetryUpdate) {
              this.world.onTelemetryUpdate();
            }
          }
        }

        // B. Radial Force (inverse distance clamped)
        if (rule.type === 'radial_force') {
          const clampedStrength = Math.max(-0.004, Math.min(0.004, rule.strength));
          const srcCol = rule.sourceColor;
          const tgtCol = rule.targetColor;

          for (let s = 0; s < dynamicBodies.length; s++) {
            const srcBody = dynamicBodies[s];
            if (srcCol !== 'all' && srcBody.customColorKey !== srcCol) continue;

            for (let t = 0; t < dynamicBodies.length; t++) {
              if (s === t) continue;
              const tgtBody = dynamicBodies[t];
              if (tgtCol !== 'all' && tgtBody.customColorKey !== tgtCol) continue;

              const dx = srcBody.position.x - tgtBody.position.x;
              const dy = srcBody.position.y - tgtBody.position.y;
              const dist = Math.hypot(dx, dy);

              // Minimum distance 30px to prevent divide-by-zero flinging
              const effectiveDist = Math.max(30, dist);
              const forceMag = (clampedStrength * 60) / effectiveDist;

              const fx = (dx / dist) * forceMag;
              const fy = (dy / dist) * forceMag;

              Matter.Body.applyForce(tgtBody, tgtBody.position, { x: fx, y: fy });
            }
          }
        }
      }
    };

    // 3. AfterUpdate: Flush postStepQueue safely (spawn/remove/scale bodies)
    this._afterUpdateHandler = () => {
      if (this.postStepQueue.length === 0) return;

      const queue = this.postStepQueue.splice(0, this.postStepQueue.length);
      const dynamicBodies = this.world.getDynamicBodies();

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const { action, bodyA, bodyB, point } = item;

        // Verify bodies are still in world
        const hasA = dynamicBodies.includes(bodyA);
        const hasB = dynamicBodies.includes(bodyB);

        switch (action) {
          case 'explode': {
            if (hasA) this.world.removeDynamicBody(bodyA);
            if (hasB) this.world.removeDynamicBody(bodyB);

            // Radial outward impulse to bodies within 160px
            const currentBodies = this.world.getDynamicBodies();
            for (let b = 0; b < currentBodies.length; b++) {
              const body = currentBodies[b];
              const dx = body.position.x - point.x;
              const dy = body.position.y - point.y;
              const dist = Math.hypot(dx, dy);

              if (dist > 0 && dist < 160) {
                const impulse = (1 - dist / 160) * 0.04 * (body.mass || 1);
                Matter.Body.applyForce(body, body.position, {
                  x: (dx / dist) * impulse,
                  y: (dy / dist) * impulse,
                });
              }
            }

            // Sound + 18 fading velocity sparks + 5-frame damped screen shake & shockwave
            soundEngine.playExplosion();
            if (this.world.triggerScreenShake) this.world.triggerScreenShake(5, 7, point.x, point.y);
            if (this.world.spawnSparks) this.world.spawnSparks(point.x, point.y, 18);
            this.world.spawnParticles(point.x, point.y, '#f59e0b', 20, 6.5);
            break;
          }

          case 'spawn_sparks': {
            this.world.spawnParticles(point.x, point.y, '#ffffff', 14, 4.0);
            break;
          }

          case 'destroy_b': {
            if (hasB) this.world.removeDynamicBody(bodyB);
            this.world.spawnParticles(point.x, point.y, '#ef4444', 12, 3.5);
            break;
          }

          case 'turn_gold': {
            let modified = false;
            if (hasA && bodyA.customColorKey !== 'gold') {
              bodyA.customColorKey = 'gold';
              bodyA.customColor = SHAPE_COLORS.gold;
              modified = true;
            }
            if (hasB && bodyB.customColorKey !== 'gold') {
              bodyB.customColorKey = 'gold';
              bodyB.customColor = SHAPE_COLORS.gold;
              modified = true;
            }
            if (modified) {
              if (this.world.spawnShimmerRings) this.world.spawnShimmerRings(point.x, point.y);
              this.world.spawnParticles(point.x, point.y, '#f59e0b', 16, 4.0);
            }
            break;
          }
        }
      }
    };

    Matter.Events.on(this.engine, 'collisionStart', this._collisionHandler);
    Matter.Events.on(this.engine, 'beforeUpdate', this._beforeUpdateHandler);
    Matter.Events.on(this.engine, 'afterUpdate', this._afterUpdateHandler);
  }

  /**
   * Applies baseline revert, then re-applies all active rules.
   */
  reapplyAllRules() {
    // 1. Reset baseline state
    this.engine.world.gravity.x = BASELINE.gravity.x;
    this.engine.world.gravity.y = BASELINE.gravity.y;
    this.engine.world.gravity.scale = 0.001;

    if (this.world.setMedium) {
      this.world.setMedium(BASELINE.medium, BASELINE.viscosity);
    }

    if (this.world.setPhenomenon) {
      this.world.setPhenomenon(BASELINE.phenomenon || 'none');
    }

    const dynamicBodies = this.world.getDynamicBodies();
    for (let i = 0; i < dynamicBodies.length; i++) {
      const b = dynamicBodies[i];
      b.plugin = b.plugin || { appliedScale: 1.0 };

      // Rescale back to 1.0 baseline using 1 / appliedScale
      if (b.plugin.appliedScale && b.plugin.appliedScale !== 1.0) {
        const invScale = 1.0 / b.plugin.appliedScale;
        Matter.Body.scale(b, invScale, invScale);
        b.plugin.appliedScale = 1.0;
      }

      b.restitution = BASELINE.restitution;
      b.frictionAir = BASELINE.frictionAir;
    }

    // 2. Re-apply active rules sequentially
    for (let i = 0; i < this.activeRules.length; i++) {
      this._applySingleRule(this.activeRules[i], false);
    }

    if (this.world.onTelemetryUpdate) {
      this.world.onTelemetryUpdate();
    }
  }

  /**
   * Applies a single rule definition to the world.
   * @param {Object} rule
   * @param {boolean} isInitialAdd
   */
  _applySingleRule(rule, isInitialAdd = true) {
    rule._timerMs = 0;
    rule._flipState = false;

    switch (rule.type) {
      case 'set_gravity': {
        this.engine.world.gravity.x = rule.x;
        this.engine.world.gravity.y = rule.y;
        break;
      }

      case 'set_medium': {
        if (this.world.setMedium) {
          this.world.setMedium(rule.medium || 'oil', typeof rule.viscosity === 'number' ? rule.viscosity : 0.85);
        }
        break;
      }

      case 'set_phenomenon': {
        if (this.world.setPhenomenon) {
          this.world.setPhenomenon(rule.phenomenon || 'none');
        }
        break;
      }

      case 'mutate_bodies': {
        const dynamicBodies = this.world.getDynamicBodies();
        const filter = rule.filter || { color: 'all', shape: 'all' };

        for (let i = 0; i < dynamicBodies.length; i++) {
          const b = dynamicBodies[i];
          b.plugin = b.plugin || { appliedScale: 1.0 };

          const matchColor = filter.color === 'all' || b.customColorKey === filter.color;
          const matchShape = filter.shape === 'all' || b.customType === filter.shape;

          if (matchColor && matchShape) {
            if (rule.restitution !== undefined) {
              b.restitution = rule.restitution;
            }
            if (rule.frictionAir !== undefined) {
              b.frictionAir = rule.frictionAir;
            }
            // Track appliedScale so Body.scale() is applied once, never compounded per frame
            if (rule.scale && rule.scale !== 1.0 && b.plugin.appliedScale === 1.0) {
              Matter.Body.scale(b, rule.scale, rule.scale);
              b.plugin.appliedScale = rule.scale;
            }
          }
        }
        break;
      }

      case 'spawn_wave': {
        // Execute once when the rule is added (clamp count to 1..25)
        if (isInitialAdd && !rule._executed) {
          rule._executed = true;
          const count = Math.max(1, Math.min(25, rule.count || 12));
          for (let k = 0; k < count; k++) {
            this.world.spawnShape(null, null, rule.shape || null, rule.color || null);
          }
        }
        break;
      }

      case 'radial_force':
      case 'on_collision':
        // Handled dynamically in beforeUpdate / collision hooks
        break;
    }
  }

  /**
   * Adds one or more rules to the active rule stack.
   * @param {Object|Array<Object>} ruleOrRules
   */
  addRule(ruleOrRules) {
    const list = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];

    for (let i = 0; i < list.length; i++) {
      const r = { ...list[i] };
      if (!r.id) {
        r.id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
      this.activeRules.push(r);
      this._applySingleRule(r, true);
    }

    if (this.world.onTelemetryUpdate) {
      this.world.onTelemetryUpdate();
    }

    return this.getActiveRules();
  }

  /**
   * Removes a rule by its ID, triggers clean baseline revert, and re-applies remaining rules.
   * @param {string} ruleId
   */
  removeRule(ruleId) {
    this.activeRules = this.activeRules.filter((r) => r.id !== ruleId);
    this.reapplyAllRules();
    return this.getActiveRules();
  }

  /**
   * Clears all active rules, resets world to baseline.
   */
  clearAll() {
    this.activeRules = [];
    this.postStepQueue = [];
    this.reapplyAllRules();
    return [];
  }

  /**
   * Returns current active rules list for UI rendering.
   */
  getActiveRules() {
    return this.activeRules.map((r) => ({
      id: r.id,
      label: r.label || r.humanLabel || `${r.type.toUpperCase()}`,
      type: r.type,
      raw: r,
    }));
  }

  /**
   * Cleanly unbinds all engine events.
   */
  destroy() {
    this.clearAll();
    Matter.Events.off(this.engine, 'collisionStart', this._collisionHandler);
    Matter.Events.off(this.engine, 'beforeUpdate', this._beforeUpdateHandler);
    Matter.Events.off(this.engine, 'afterUpdate', this._afterUpdateHandler);
  }
}
