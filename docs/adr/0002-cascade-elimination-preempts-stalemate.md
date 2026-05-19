# 0002. Cascade Elimination Preempts Stalemate

## Status

Accepted

## Context

ADR-0001 made repeated **Cascade** states a draw **Stalemate** so neighbour-count **Capacity** could not create infinite resolution loops. That stable-board-first rule treated a match as a draw even when an **Explosion Wave** had already left only one eligible **Player** owning atoms.

## Decision

After each **Explosion Wave**, eliminate any **Player** who has taken a turn and owns no atoms. If that leaves exactly one non-eliminated **Player**, end the **Match** as **Victory** immediately. Repeated **Cascade** states still produce **Stalemate** when multiple non-eliminated **Players** remain.

## Consequences

- **Victory** can preempt repeat-state **Stalemate** during a **Cascade**.
- Playback stops on the first wave that leaves one non-eliminated **Player**.
- **Stalemate** remains the terminal draw state for repeating multi-player **Cascades**.
