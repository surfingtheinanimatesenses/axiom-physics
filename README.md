# axiom-2d

A 2D rigid-body physics toy built on the side to experiment with custom canvas rendering, fluid drag, and interactive spring-mesh deformation <3

Live demo: https://surfingtheinanimatesenses.github.io/axiom-physics/

## Overview

- **Custom canvas renderer**: 60fps HTML5 Canvas loop driving Matter.js in headless mode with HiDPI support.
- **Spring-mass fiber mesh**: 2D background grid (36px spacing) that deforms with bow-wave compression and viscous wakes.
- **Viscous oil medium**: Stokes + quadratic drag, ~65% buoyant lift, rotational viscosity damping, and inelastic collisions.
- **Rule engine**: Stacks and reverts physical laws (gravity flips, radial forces, collision mutations).
- **Procedural sound**: Web Audio marimba synth tones on impacts and filtered sub-bass on explosions.
- **Prompt compiler (optional)**: Translates natural language prompts to rule definitions via Groq API (gpt-oss-120b). Needs an API key configured in the top bar.

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
