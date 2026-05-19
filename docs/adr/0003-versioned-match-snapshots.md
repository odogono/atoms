# Versioned Match Snapshots

Atoms match snapshots use a versioned JSON contract with a human-editable ASCII board. The JSON stores match flow metadata and player state, while each board cell is represented as `[]` for an empty tile, `..` for a hole, a numeric player token followed by atom count such as `11` or `23`, or a Neutral Atom token such as `N1`.

This keeps saved matches readable and hand-editable without making the runtime model depend on display colors or player names. The original `version: 1` format supports empty tiles, holes, and player-owned atom tokens. `version: 2` adds `N-count` tokens for Neutral Atoms. Version 1 snapshots remain parseable, but current serialization emits version 2.
