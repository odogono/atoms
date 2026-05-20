# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Added Destructible Tiles with Hit Points, destruction into Holes, recursive Collapse, snapshot v3 metadata, a 6x6 Destructible preset, and board HP rendering.

### Changed

- Softened the board camera so Tile focus drifts subtly instead of fully recentering, and disables Tile-following drift for reduced-motion users.

## [0.4.1]

### Added

- Added an NPC-only Match simulation harness for running versioned Match Snapshots outside the UI.
- Added `bun run simulate-match` with file/stdin input, human and JSON output, turn caps, and aggregate Match statistics.
- Added Match Snapshot and Board Setup glossary language to disambiguate informal "map" references.

## [0.4.0]

### Added

- Added modal-based New Match setup and a confirmed Abandon Match flow.
- Added Rounds completed, Board Control, and Critical Pressure HUD indicators.
- Added player panels with active-player emphasis and clearer Match status/action controls.
- Added glossary language for Round, Board Control, and Critical Pressure.

### Changed

- Moved mode and Board selection out of always-visible controls so setup changes only apply when starting a Match.
- Improved responsive Match layout so the board remains usable on mobile.

## [0.3.0]

### Added

- Added versioned Match snapshot serialization with human-editable ASCII Board rows.
- Added Hole cells as absent Board space that affects Capacity, legal placements, Cascade paths, NPC placement, and rendering.
- Documented Cell and Hole domain language plus the versioned snapshot contract with ADR-0003.

### Changed

- Replaced runtime Board storage with Cell-based state so playable Tiles and Holes are represented explicitly.

## [0.2.0]

### Changed

- Renamed the Game-oriented Match rules modules and exports to Match-oriented names, aligning code with the domain glossary.
- Split NPC placement scoring into a dedicated strategy module while keeping Capacity, Capture, Cascade, Elimination, Victory, and Stalemate rules in the Match rules module.
- Updated Match flow state to store the rule state as `match` and use the renamed Match rules interface.
- Cascade-time **Elimination** now preempts repeat-state **Stalemate**: after each **Explosion Wave**, a player who has taken a turn and owns no atoms is eliminated, and the match ends as **Victory** when only one non-eliminated player remains.

### Added

- Added shared Match test fixtures and dedicated NPC strategy coverage.
- Documented the Cascade Elimination rule reversal with ADR-0002 and updated the domain glossary to distinguish Victory from remaining multi-player Stalemates.
