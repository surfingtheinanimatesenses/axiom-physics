# Axiom-2d

Explore whatever your imagination makes and make it happen <3

A 2D rigid-body physics toy built on the side to experiment with custom canvas rendering, fluid drag, and interactive spring-mesh deformation.

Live demo: https://axiom-physics.vercel.app

## Overview

- **Custom canvas renderer**: 60fps HTML5 Canvas loop driving Matter.js in headless mode with HiDPI support.
- **Natural language physics compiler**: Type whatever physical law you imagine—the built-in compiler translates your words into real-time rigid-body forces, gravity shifts, and collision reactions on the fly.
- **Spring-mass fiber mesh**: 2D background grid (36px spacing) that deforms with bow-wave compression and viscous wakes.
- **Viscous oil medium**: Stokes + quadratic drag, ~65% buoyant lift, rotational viscosity damping, and inelastic collisions.
- **Rule engine**: Stacks and reverts physical laws (gravity flips, radial forces, collision mutations).
- **Procedural sound**: Web Audio marimba synth tones on impacts and filtered sub-bass on explosions.

## Controls

- **Left click (empty space)**: Spawn shape
- **Left click + drag**: Grab and toss bodies
- **Space**: Pause / resume simulation
- **C**: Clear active rules and revert to baseline
- **R**: Reset bodies and state

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## License

MIT
