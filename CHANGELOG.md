# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0]

### Changed

- Renamed the Game-oriented Match rules modules and exports to Match-oriented names, aligning code with the domain glossary.
- Split NPC placement scoring into a dedicated strategy module while keeping Capacity, Capture, Cascade, Elimination, Victory, and Stalemate rules in the Match rules module.
- Updated Match flow state to store the rule state as `match` and use the renamed Match rules interface.
- Cascade-time **Elimination** now preempts repeat-state **Stalemate**: after each **Explosion Wave**, a player who has taken a turn and owns no atoms is eliminated, and the match ends as **Victory** when only one non-eliminated player remains.

### Added

- Added shared Match test fixtures and dedicated NPC strategy coverage.
- Documented the Cascade Elimination rule reversal with ADR-0002 and updated the domain glossary to distinguish Victory from remaining multi-player Stalemates.
