# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Cascade-time **Elimination** now preempts repeat-state **Stalemate**: after each **Explosion Wave**, a player who has taken a turn and owns no atoms is eliminated, and the match ends as **Victory** when only one non-eliminated player remains.

### Added

- Documented the Cascade Elimination rule reversal with ADR-0002 and updated the domain glossary to distinguish Victory from remaining multi-player Stalemates.
