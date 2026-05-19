# 0001. Cascade Stalemate

## Status

Superseded by ADR-0002

## Context

Atoms uses neighbour-count **Capacity**: corners reach **Critical Mass** at 2 atoms, edges at 3, and interior tiles at 4. **Explosion Waves** emit only to valid orthogonal neighbours.

Those rules mean some late-game **Cascades** do not reach a stable **Board**. A repeated Cascade state would otherwise loop forever while accumulating wave history and eventually exhaust browser memory.

## Decision

Detect repeated Cascade states during resolution. When a repeated state is found, end the match as a draw **Stalemate** with no winner.

## Consequences

- **Capacity** and neighbour-only emission stay consistent with the documented rules.
- **Victory** is still checked only after a Cascade reaches a stable Board.
- NPC scoring treats stalemate-producing moves as legal but strongly undesirable when another legal move exists.

## Alternatives Considered

- Immediate **Victory** when only one player owns atoms during an unresolved Cascade: rejected because it violates stable-board-first resolution.
- Uniform capacity of four atoms with off-board atom loss: rejected because it reverses the established corner and edge Capacity rule.
- Rejecting moves that produce non-stabilizing Cascades: rejected because it makes legal placement depend on a hidden future simulation.
