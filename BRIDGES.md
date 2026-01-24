# Bridges

## Purpose

EverythingOS is intentionally kept small and stable at its core.  
**Bridges** are the supported way to connect EverythingOS to external systems, runtimes, and physical environments.

If you want to extend EverythingOS without modifying its core behavior, you should build a bridge.

---

## What Is a Bridge?

A bridge is an adapter layer that:

- Connects EverythingOS to an external system (hardware, protocol, runtime)
- Translates external signals into EverythingOS events
- Executes actions only through explicit activators
- Remains replaceable and optional

Bridges do not change core scheduling, policies, or supervision logic.

---

## Core Guarantees

When you build a bridge, the core guarantees:

- Deterministic event delivery
- Explicit policy evaluation before actions
- Human-in-the-loop support where required
- Observable state transitions and logs
- Failure isolation (bridge failure does not crash the core)

In return, bridges must respect the contracts below.

---

## Bridge Rules

A valid bridge must:

1. Be side-effect free until an activator is invoked  
2. Avoid hidden state (all meaningful state must be visible or snapshot-able)  
3. Fail loudly and explicitly  
4. Never bypass policy or supervision layers  
5. Be testable without real hardware whenever possible  

Bridges that violate these rules will not be merged.

---

## Current Supported Extensions

### Agent Extensions (Stable)

EverythingOS already supports:

- Custom software agents
- Event listeners
- Activators
- Sensors (logical / software)

This is the recommended starting point for new contributors.

---

## Phase 5 — Robotics Integration (Next)

Phase 5 introduces physical-world bridges while preserving safety and human oversight.

Planned (not yet implemented):

- ROS2 Bridge  
  - Event ↔ ROS topic translation  
  - Action servers exposed as activators  
  - Policy-gated motion commands  

- Motion Planning Integration  
  - High-level goal → planner request  
  - Planner output → supervised execution  

- SLAM / World State Synchronization  
  - External map → EverythingOS world state  
  - Snapshot and replay support  

EverythingOS does not replace ROS.  
ROS remains the real-time control layer. EverythingOS operates above it.

---

## Phase 6 — Swarm Coordination (Future)

Future work may include:

- Multi-agent coordination across nodes
- Distributed state reconciliation
- Fault-tolerant swarm behaviors
- Human override at swarm or agent level

This phase depends on real-world validation from Phase 5.

---

## Good First Bridges

The following bridges are especially welcome:

- Raspberry Pi GPIO bridge (simulation-first)
- MQTT / IoT sensor bridge
- Web-based system inspector
- ROS2 simulation bridge (Gazebo / RViz)
- Policy visualization or explanation tools

Open an issue or draft PR if you want to claim one.

---

## Ownership and Contributions

Bridge authors retain ownership of their bridges.  
The core team focuses on stability, contracts, and safety.

If you want to explore new domains without rewriting the core, bridges are the path forward.

---

## Design Philosophy

EverythingOS grows through careful extensions, not rapid expansion.

If that approach resonates with you, you are in the right place.
