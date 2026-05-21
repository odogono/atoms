# 0005. Versioned Board Setup Documents

## Status

Accepted

## Context

Atoms already has versioned **Match Snapshot** JSON for saving complete Match state. A **Board Setup** is narrower: it describes the pre-turn Board used to start a Match, without active Player, turn number, Match status, or winner.

The Board Setup Editor needs import/export for custom starting Boards. Reusing Match Snapshot JSON would make exported Board Setups carry irrelevant Match fields and blur the glossary boundary between **Board Setup** and **Match Snapshot**.

## Decision

Use a separate versioned Board Setup JSON document for import/export. Version 1 stores a single `boardSetup` with name, dimensions, Holes, Neutral Atoms, and Destructible Tiles.

## Consequences

- Board Setup import/export stays focused on starting Boards.
- Match Snapshot JSON remains the format for complete saved Match state.
- Future Board Setup changes can version independently from Match Snapshot changes.

## Alternatives Considered

- Reuse Match Snapshot JSON: rejected because it includes Match flow fields that Board Setup does not own.
- Use ASCII board rows only: rejected because Destructible Tile Hit Points and setup names need metadata.
