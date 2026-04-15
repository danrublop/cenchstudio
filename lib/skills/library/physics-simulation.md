---
id: physics-simulation
name: Physics Simulation
category: physics
tags: [physics, simulation, pendulum, projectile, orbital, wave, double-slit, electric-field, harmonic, mathjax, latex]
sceneType: physics
complexity: complex
requires: []
description: Physics concept simulations with MathJax equations and Canvas-based deterministic animations. Supports pendulum, projectile, orbital, wave interference, and more.
parameters:
  - name: simulationType
    type: string
    default: pendulum
    description: Physics simulation type
    enum: [pendulum, double_pendulum, projectile, orbital, wave_interference, double_slit, electric_field, harmonic_oscillator]
  - name: layout
    type: string
    default: split
    description: Scene layout
    enum: [split, fullscreen, equation_focus]
---

## Physics Scenes

Use generate_physics_scene when the content involves a physics concept with a simulation.
Available simulations: pendulum, double_pendulum, projectile, orbital, wave_interference, double_slit, electric_field, harmonic_oscillator.

Physics scenes use a dedicated template with:
- MathJax for LaTeX equation rendering
- Canvas-based simulation from PhysicsSims library
- GSAP timeline integration for WVC seekability
- Three layout options: split (sim + text), fullscreen, equation_focus

The simulation runs deterministically and is frame-accurately seekable by the render server.
Pass equation keys (e.g. 'pendulum_ode', 'projectile_range') from the PhysicsEquations database — do NOT write raw LaTeX.
Use set_simulation_params to change physics parameters mid-scene for dramatic demonstrations.
Use annotate_simulation to add callouts at key physics moments.

## When to Use Physics Scenes

- Explaining physics concepts with interactive simulations
- Demonstrating equations with visual representations
- Educational content about mechanics, waves, electromagnetics
- Any content where a physical simulation reinforces the explanation

## Gotchas

- Always use equation keys from PhysicsEquations, never raw LaTeX
- Minimum 6-second duration for physics scenes (simulation needs time to develop)
- set_simulation_params changes are seekable — they work with the render server
