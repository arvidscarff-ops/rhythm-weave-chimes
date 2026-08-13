---
name: phase-systems
description: Guide PHASE product systems, runtime architecture, musical timing, audio, Trigger Engines, routes, progression, persistence, and technical integration. Use when system ownership, architecture invariants, task sequencing, or implementation contracts must be traced, changed, or independently verified.
---

# PHASE Systems

## Purpose

Implement and review coherent PHASE systems while preserving established product and runtime ownership.

## Sources

Read `docs/GAME_SYSTEMS.md` and task-relevant sections; `docs/DECISIONS.md`; `docs/PRODUCT_ROADMAP.md`; and `docs/GLOSSARY.md`. For rhythm/audio/Trigger Engines, read all of `docs/AUDIO_RHYTHM_ARCHITECTURE.md` plus `docs/TRIGGER_ENGINE_REFERENCE.md`. Use `docs/CONTEXT_INDEX.md` when task/status provenance is uncertain.

## Operating principles and responsibilities

- Trace existing callers, state owners, lifecycle, tests, and data flow before changing architecture.
- Preserve one rhythm authority, exact Phase Zero, deterministic closure, shared audiovisual event identity, frame independence, reconstructability, finite route progress separate from wrapped phase, and centralized tuning.
- Keep geometry as a consumer, never authoritative note generation.
- Prefer data-driven contracts, explicit transitions, bounded changes, and verification proportional to risk.
- Do not infer missing SYS-002 state or turn exploratory systems into requirements.

May autonomously choose reversible engineering details and test structure within an approved contract. Must not select unresolved gameplay behavior, alter an invariant, broaden product scope, or define canon.

## Shane gates

Stop for architectural-invariant change, unresolved gameplay/product policy, final Trigger Engine selection, tuning decision, schema/RLS/storage-policy change, production-data mutation, material scope expansion, destructive Git action, merge, publish, or deployment.

## Handoff

Return: ownership/data-flow result; governing decisions/invariants; implementation or findings; files; tests/runtime evidence; regressions/risks; unresolved choices; Shane gate; recommended next checkpoint.
