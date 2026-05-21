# Atoms Skill-Expression Audit

## Summary

Classic 2P Atoms shows meaningful skill expression in the current simulation
model. The game is deterministic, and a stronger principle-driven strategy
reliably beats weaker strategies across fresh starts, generated midgames,
hand-authored snapshots, Neutral Atom states, Hole states, and Destructible Tile
states.

The main caveat is not strategic randomness. The main caveat is legibility:
large Cascades can make a deterministic loss feel sudden if the player cannot
see how Board Control, Critical Pressure, capture timing, and reply safety led
to it.

## Benchmark Result

Command:

```sh
bun run benchmark-strategies -- --json
```

Default pairwise result, `tactical` versus `baseline`:

| Metric                     | Result |
| -------------------------- | -----: |
| Games                      |     64 |
| Decisive games             |     62 |
| Tactical wins              |     61 |
| Baseline wins              |      1 |
| Draws                      |      2 |
| Tactical decisive win rate |  98.4% |
| Tactical score rate        |  96.9% |
| Benchmark result           | Passed |

Ladder result:

| Challenger | Baseline     | Result | Decisive win rate | Score rate | Draws |
| ---------- | ------------ | ------ | ----------------: | ---------: | ----: |
| tactical   | first-legal  | Passed |            100.0% |      98.4% |     2 |
| tactical   | low-capacity | Passed |             98.4% |      96.9% |     2 |
| tactical   | baseline     | Passed |             98.4% |      96.9% |     2 |

The pass bar is the existing benchmark standard: at least 60% decisive win rate
and greater than 50% score rate. Draws are scored as 0.5 and reported
separately.

## Winning Principles

- **Low-Capacity buildup** matters because corner and edge Tiles reach Critical
  Mass sooner, creating earlier Cascade threats.
- **Board Control** matters because owning more Tiles increases legal placement
  options and makes future Captures more valuable.
- **Critical Pressure** matters because Tiles close to Critical Mass can turn
  one placement into multiple Explosion Waves.
- **Capture timing** matters more than atom count alone; triggering a Cascade at
  the right moment can convert opponent territory faster than gradual expansion.
- **Neutral Atom conversion** is valuable when a Cascade can Capture Neutral
  Atoms without wasting a direct placement.
- **Stalemate avoidance** is part of skill, not an implementation accident; the
  tactical strategy rejects known Stalemate-producing moves when a productive
  alternative exists.
- **Reply safety** matters. The tactical strategy's shallow opponent-reply
  check is enough to beat immediate-gain strategies very consistently.

## Interpretation

Classic Atoms should not be described as random. Under the current engine and
benchmark corpus, better decisions win reliably against weaker policies.

The player-facing problem is more likely that consequences are hard to read
before and during long Cascades. If the game still feels too chaotic in human
play, the next question should be about agency and legibility, not whether
strategy exists.

The first rule-change candidate should be Shielded Atoms, and Classic should
remain the default unless a later validation shows that Classic's agency problem
cannot be addressed through teaching, metrics, hints, or replay controls.

## Revisit Trigger

Re-run this audit whenever new game mechanics are added or existing mechanics
change. Any new ruleset, player action, Tile behavior, Atom behavior, Cascade
behavior, Capture behavior, Board Setup feature, Victory condition, or Stalemate
condition can change which strategies are successful and whether the game still
passes the skill-expression bar.

## Caveats

- The audit covers 2P current rules first. It does not claim the same result for
  3P or 4P play, where turn order and multi-player incentives differ.
- The benchmark compares deterministic NPC Strategies, not human players.
- The corpus is broader than before, but still finite. More tactical snapshots
  would make the conclusion stronger.
- The tactical strategy is not a solved optimal player; it is a shallow
  principle-driven policy with one reply check.
