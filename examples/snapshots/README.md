# Example Match Snapshots

These snapshots are hand-editable version 2 Match Snapshots for testing the NPC simulation harness.

Run one with:

```sh
bun run simulate-match -- examples/snapshots/fresh-3x3.json
```

Useful checks:

```sh
bun run simulate-match -- examples/snapshots/fresh-3x3.json --max-turns 3
bun run simulate-match -- examples/snapshots/fresh-3x3.json --json --max-turns 3
bun run simulate-match -- examples/snapshots/cascade-stalemate-2x2.json --json
bun run simulate-match -- examples/snapshots/stalled-neutral-2x2.json --json
bun run simulate-match -- examples/snapshots/terminal-victory-3x3.json --json
```

Expected outcomes:

- `fresh-3x3.json`: plays from an empty Board; use a low `--max-turns` to exercise `turn-cap-reached`.
- `fresh-6x6.json`: starts from an empty Small preset-sized Board.
- `fresh-8x8.json`: starts from an empty Standard preset-sized Board.
- `holes-in-progress-3x3.json`: continues an in-progress Match with one Hole and one Neutral Atom.
- `neutral-4x4.json`: continues a Match with Neutral Atoms available for Capture.
- `cascade-stalemate-2x2.json`: reaches engine Stalemate after the next NPC placement.
- `stalled-neutral-2x2.json`: reports harness-level `stalled` because the active Player has no legal placement.
- `terminal-victory-3x3.json`: reports already-complete Victory with zero simulated turns.
