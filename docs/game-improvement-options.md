# Atoms Improvement Options Catalog

## Summary

This catalog compares credible directions for improving Atoms. It is for future
maintainers and agents deciding what to build next, not a fixed implementation
backlog.

The scope is game quality, player experience, and product direction. The first
version deliberately excludes monetization, accounts, pricing, and business
platform work.

Use **Direction** for a broad strategic lane and **Option** for a concrete
improvement within that lane. These are strategy-document terms, not
game-domain glossary terms.

## Evaluation Rubric

Each Option uses the same decision brief:

- **Player value**: what a player gains from the change.
- **Effort**: likely implementation size relative to the current codebase.
- **Risk**: design, technical, or maintenance uncertainty.
- **Dependencies**: work that should exist first.
- **Confidence**: how clearly the value and implementation path are understood.
- **Next validation step**: the smallest useful action before committing.

## Core Gameplay And Rulesets

Ruleset work changes what players can do inside a Match. It can create strong
strategic differentiation, but it also carries the highest risk of weakening the
clarity of Capacity, Critical Mass, Explosion Waves, Cascades, Capture,
Elimination, Victory, and Stalemate.

### Option: Shielded Atoms

- **Player value**: Adds a defensive turn choice and gives players more agency
  against large incoming Cascades.
- **Effort**: High. It needs Match rule changes, UI action selection, NPC
  support, snapshot changes, and new tests.
- **Risk**: Medium-high. It may slow the game or reduce the clean inevitability
  of Cascades if shields are too common.
- **Dependencies**: A ruleset selector, a second player action, snapshot version
  planning, and deterministic NPC evaluation.
- **Confidence**: Medium. The deeper plan already exists in
  [Shielded Atoms Gameplay Plan](./shielded-atoms-gameplay-plan.md).
- **Next validation step**: Prototype Shielded Atoms in rule tests and run a
  small set of NPC simulations to check match length and Stalemate rate.

### Option: Additional Classic-Compatible Rule Variants

- **Player value**: Offers novelty while preserving the familiar placement and
  Cascade loop.
- **Effort**: Medium to high, depending on whether variants affect placement,
  Capacity, or Explosion Wave behavior.
- **Risk**: Medium. Small changes can create surprising terminal-state or
  repeat-Cascade behavior.
- **Dependencies**: A `ruleset` concept and clear regression coverage for
  Classic Atoms.
- **Confidence**: Low-medium. The current engine is deterministic and testable,
  but no specific variant has been validated beyond Shielded Atoms.
- **Next validation step**: List two or three candidate variants and reject any
  that cannot be explained without new glossary terms.

## Board Content And Setup

Board work changes the starting Board rather than the core Match rules. This is
one of the safest ways to create variety because Holes and Neutral Atoms already
exist in the domain and test coverage.

### Option: Board Preset Expansion

- **Player value**: Adds replay variety and lets players choose a different
  tactical texture without learning new rules.
- **Effort**: Low-medium. The current preset structure already supports Board
  dimensions and Neutral Atoms; the engine also supports Holes.
- **Risk**: Low-medium. Poor layouts can create weak first moves or unusual
  Capacity patterns.
- **Dependencies**: Preset design guidelines and simulation checks for basic
  playability.
- **Confidence**: High. The current code already validates board topology and
  tests planned presets.
- **Next validation step**: Add a documented preset matrix covering small,
  standard, neutral-heavy, and hole-shaped Boards, then simulate NPC matches.

### Option: Custom Board Setup

- **Player value**: Lets players create, test, and share their own Board
  Setups.
- **Effort**: Medium-high. It needs setup UI, validation feedback, and snapshot
  integration.
- **Risk**: Medium. Too much flexibility can expose invalid or unfun layouts.
- **Dependencies**: Strong Board Setup validation and a usable import/export
  path.
- **Confidence**: Medium. The underlying model supports Holes and Neutral
  Atoms, but the UI workflow is not designed yet.
- **Next validation step**: Design a minimal text-based Board Setup editor that
  uses the existing snapshot board notation before building graphical editing.

## NPC, Simulation, And Learning Tools

NPC and learning work helps players understand tactics and makes solo play more
useful. It can build on the deterministic Match strategy and simulation helpers
without changing Match rules.

### Option: NPC Difficulty Tiers

- **Player value**: Makes 1P vs NPC useful for more skill levels and creates a
  clearer practice loop.
- **Effort**: Medium. The current strategy abstraction can support multiple
  strategies, but each tier needs deterministic behavior and tests.
- **Risk**: Medium. A harder NPC may be slower or may overfit the current
  heuristic scoring model.
- **Dependencies**: Named strategy IDs, benchmark scenarios, and expectations
  for how tiers differ.
- **Confidence**: High. Current NPC code already scores legal placements and
  avoids Stalemate-producing moves when possible.
- **Next validation step**: Define `easy`, `standard`, and `hard` strategies
  using deterministic heuristics, then benchmark them across snapshots.

### Option: Tutorial Or Guided First Match

- **Player value**: Helps new players understand Capacity, Critical Mass,
  Cascades, Capture, Victory, and Stalemate without reading documentation.
- **Effort**: Low-medium for a guided scenario; medium if it becomes a full
  interactive lesson system.
- **Risk**: Low. It can use existing Match rules and a fixed Board Setup.
- **Dependencies**: A scripted first-match state and UI messaging that does not
  obscure the Board.
- **Confidence**: High. The current game has enough stable domain language to
  teach the loop clearly.
- **Next validation step**: Create one guided scenario that forces a simple
  Capture and one Explosion Wave.

### Option: Move Hints

- **Player value**: Helps players see tactical opportunities and learn why a
  placement is strong or dangerous.
- **Effort**: Medium. Hints can reuse NPC scoring, but explanation requires
  careful wording.
- **Risk**: Medium. Bad hints can train players into shallow play or make the
  NPC feel unfair.
- **Dependencies**: Stable strategy scoring and a way to distinguish
  explanation from automation.
- **Confidence**: Medium. The engine can evaluate moves, but human-readable
  reasons are not represented today.
- **Next validation step**: Show a developer-only ranked legal placement list
  with scores and observed Cascade outcomes.

## UX And Presentation Polish

UX work improves how clearly the current game communicates state. It does not
need to change Match rules, but it should preserve the precision of the domain
language.

### Option: Match Clarity Polish

- **Player value**: Makes the current turn, legal placements, Board Control,
  Critical Pressure, and terminal Match state easier to understand.
- **Effort**: Low-medium. Most required state is already available in the UI.
- **Risk**: Low. The main risk is visual clutter around the Board.
- **Dependencies**: Clear hierarchy for status, metrics, and active-player
  information.
- **Confidence**: High. The current screen already computes the relevant
  metrics.
- **Next validation step**: Review the main screen at desktop and mobile widths
  and list the three most confusing states.

### Option: Accessibility And Input Refinement

- **Player value**: Makes local play more reliable for keyboard, pointer, and
  assistive-technology users.
- **Effort**: Medium. It touches focus management, Board navigation, labels, and
  visual contrast.
- **Risk**: Low-medium. The 3D Board may make semantic representation harder
  than ordinary DOM UI.
- **Dependencies**: Stable keyboard cursor behavior and clear status messages.
- **Confidence**: Medium. The app already has keyboard movement and modal focus
  handling, but Board semantics need deeper review.
- **Next validation step**: Audit keyboard-only play from match setup through
  Victory or Stalemate.

### Option: Cascade Playback Controls

- **Player value**: Lets players understand complex Cascades by pausing,
  stepping, or replaying Explosion Waves.
- **Effort**: Medium. The Match flow already stores timelines and waves, but UI
  playback control is currently automatic.
- **Risk**: Medium. Manual playback can complicate turn flow and NPC scheduling.
- **Dependencies**: A clear separation between resolved Match state and visual
  playback state.
- **Confidence**: Medium-high. Existing wave timelines make the feature
  feasible.
- **Next validation step**: Add a design note for pause, step, and replay
  behavior without changing the underlying Match result.

## Persistence, Replay, And Sharing

Persistence work makes Matches portable, debuggable, and easier to discuss. It
fits the current codebase well because Match Snapshots already use a versioned
JSON contract with a human-editable ASCII Board.

### Option: Snapshot Import And Export

- **Player value**: Allows players and developers to save, restore, inspect, and
  share Match states.
- **Effort**: Low-medium. Serialization and parsing already exist; the missing
  work is UI and error presentation.
- **Risk**: Low. Snapshot parsing already validates unstable playing snapshots
  and terminal states.
- **Dependencies**: A simple import/export surface and friendly parse errors.
- **Confidence**: High. Snapshot tests cover versioning, Holes, Neutral Atoms,
  and terminal states.
- **Next validation step**: Add a developer-facing import/export dialog before
  committing to a player-facing share flow.

### Option: Shareable Match Links

- **Player value**: Makes specific Match states easy to send to another person
  or use in bug reports.
- **Effort**: Medium. It needs compact encoding, URL size checks, and user
  feedback.
- **Risk**: Medium. Large Boards or future snapshot versions may not fit well in
  URLs.
- **Dependencies**: Snapshot import/export and a policy for unsupported snapshot
  versions.
- **Confidence**: Medium. The snapshot model is strong, but transport format is
  undecided.
- **Next validation step**: Measure encoded URL sizes for existing example
  snapshots and decide whether links should store full state or an external
  reference.

### Option: Replay From Match Events

- **Player value**: Lets players review completed Matches and supports
  debugging or competitive integrity later.
- **Effort**: High. The current snapshot contract stores state, not a full event
  log.
- **Risk**: Medium-high. Event contracts become durable once shared or stored.
- **Dependencies**: A versioned Match event format and deterministic replay
  validation.
- **Confidence**: Medium. The engine is deterministic, but event persistence is
  not designed.
- **Next validation step**: Draft a minimal placement-event contract and replay
  a short Match from events in tests.

## Online And Competitive Play

Online work can differentiate this Atoms from casual local variants, but it is a
larger product and infrastructure lane. It should not leak complexity into local
or NPC modes.

### Option: Private Live Rooms

- **Player value**: Lets players share a room link and play a live Match against
  another person.
- **Effort**: High. It requires authoritative placement validation,
  synchronization, reconnect handling, and terminal-state convergence.
- **Risk**: High. Network state can undermine trust if clients diverge during a
  Cascade.
- **Dependencies**: A server-authoritative room model and deterministic Match
  event replay.
- **Confidence**: Medium. The deeper roadmap exists in
  [Direct Competitor Comparison And Roadmap](./direct-competitor-comparison.md).
- **Next validation step**: Build a local-only authoritative-room prototype
  before choosing hosting or transport details.

### Option: Competitive Match Integrity

- **Player value**: Makes online Matches feel fair by ensuring legal moves,
  clocks, reconnects, Victory, and Stalemate are resolved authoritatively.
- **Effort**: High. This is a foundation for serious online play rather than a
  cosmetic feature.
- **Risk**: High. Poorly specified edge cases become player-facing disputes.
- **Dependencies**: Private rooms, turn-clock policy, reconnect policy, and
  versioned Match events.
- **Confidence**: Medium. The current engine has clear terminal-state rules, but
  network policy is still open.
- **Next validation step**: Write acceptance scenarios for legal move
  acceptance, illegal move rejection, reconnect, clock expiry, and Cascade
  convergence.

## Platform And Distribution

Platform work helps people reach and return to the game. For this catalog, keep
it limited to web-first packaging and installability, not account systems or
business infrastructure.

### Option: Installable Web App

- **Player value**: Makes the game easier to launch repeatedly on desktop or
  mobile.
- **Effort**: Low-medium. It mostly needs manifest, icons, service worker
  policy, and install-quality polish.
- **Risk**: Low-medium. Offline behavior can confuse players if snapshots or
  online features later behave differently.
- **Dependencies**: Stable app shell and basic mobile layout quality.
- **Confidence**: Medium-high. The app is already browser-based.
- **Next validation step**: Audit install requirements and decide whether the
  first installable version supports offline play.

### Option: Public Demo Packaging

- **Player value**: Makes it easy to try the game quickly and share it with
  testers.
- **Effort**: Low. The app already builds as a browser game.
- **Risk**: Low. The main risk is shipping unclear onboarding.
- **Dependencies**: A clear default Match setup and enough UX clarity for first
  play.
- **Confidence**: High. This direction does not require new game rules.
- **Next validation step**: Create a release checklist that includes build,
  smoke test, first-match flow, and known limitations.

## Recommended Shortlist

The shortlist is optimized for the next one to two months. It is a recommended
starting point, not a fixed roadmap.

1. **Tutorial or guided first match**: high player value, low to moderate
   effort, and directly teaches Capacity, Cascades, Capture, Victory, and
   Stalemate.
2. **Board preset expansion**: uses existing Holes and Neutral Atoms support to
   add variety without changing core rules.
3. **Snapshot import/export or shareable Match states**: builds on the existing
   versioned snapshot contract and creates a durable sharing and debugging loop.
4. **NPC difficulty tiers**: builds on the existing strategy abstraction and
   simulation helper without changing Match rules.
5. **Match clarity polish**: improves the current turn, legal placement, Board
   Control, Critical Pressure, and terminal-state communication.

## Documentation Rules

- Keep `CONTEXT.md` unchanged unless a new game-domain term is accepted.
  Strategy terms such as **Direction** and **Option** belong in this catalog,
  not the glossary.
- Do not create an ADR for this catalog. Consider ADRs only for durable
  implementation decisions such as snapshot format changes or authoritative
  online event contracts.
- Preserve existing domain language: Board, Tile, Hole, Atom, Neutral Atom,
  Capacity, Critical Mass, Explosion Wave, Cascade, Capture, Elimination,
  Victory, Stalemate, Board Control, and Critical Pressure.

## Acceptance Criteria

- The catalog compares directions neutrally instead of assuming online play is
  the only path.
- Existing online and Shielded Atoms docs are linked and summarized, not
  duplicated wholesale.
- Each Option uses the same decision-brief fields so Options can be compared
  consistently.
- The shortlist is visibly optimized for the next one to two months.
- No monetization, account, pricing, or business-platform work is included as
  an Option.
- The catalog remains a strategy document, not an implementation backlog or
  mini-spec collection.

## Assumptions

- This artifact is a Markdown strategy document under `docs/`.
- The first version is a catalog, not an implementation backlog.
- An **Option** is a concrete improvement, and a **Direction** is a broader
  strategic lane.
- The catalog should help choose future work, not specify every UI, schema, or
  test in advance.
