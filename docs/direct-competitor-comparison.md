# Direct Competitor Comparison And Roadmap

## Summary

Atoms has direct market relatives in the Exploding Atoms and Chain Reaction
family, rather than only broad chemistry-themed or generic chain-reaction puzzle
games.

Direct competitors and comparators:

- [Chain Reaction Android](https://play.google.com/store/apps/details?id=com.BuddyMattEnt.ChainReaction):
  the large Android incumbent. Its store description matches the core Atoms
  loop: players place orbs into empty or owned cells, cells reach critical mass,
  explosions claim surrounding cells, and players are eliminated when they lose
  all orbs.
- [Atoms GO!](https://apps.apple.com/us/app/atoms-go/id525091191): an iOS game
  positioned as a modern remake of the 1980 Exploding Atoms game, with local and
  online play, Game Center matching, single-player computer opponents, and AI
  difficulty levels.
- [Critical Mass: Chain Reaction](https://play.google.com/store/apps/details?id=com.sector7.chain_reaction):
  a modern Android variant that extends the classic rectangle-board rules with
  square, hexagonal, and geometric boards, CPU difficulty settings, tutorials,
  and board packs.
- [Atoms on itch.io](https://nivrig.itch.io/atoms): the web page for the nivrig
  Atoms lineage, useful as historical and positioning context for Atoms GO!.
- [Cell Wars](https://playgama.com/game/cell-wars): a recent browser/mobile
  direct competitor with territory capture, chain reactions, AI opponents,
  online multiplayer, local multiplayer, and skins.

The useful product question is not whether similar games exist. They do. The
useful question is where this Atoms can credibly differ. The recommended lane is
a web-first competitive version of the ruleset, differentiated by reliable
private live rooms and match integrity.

## Key Comparison Axes

- Ruleset similarity: placement legality, Critical Mass, Cascades, Capture,
  Elimination, Board Capacity, player count, and terminal Match states.
- Product surface: local play, NPC play, online play, turn clocks, reconnect
  behavior, replay/history, board variety, tutorials, and onboarding.
- Market gap: casual mobile and pass-and-play are already well covered by direct
  competitors.
- Differentiation claim: competitive online Chain Reaction/Atoms with
  authoritative turns, reconnect-safe rooms, deterministic resolution, and clear
  Victory/Stalemate handling.

## Roadmap Direction

- Make private live rooms the first online milestone. Players should share a
  room link, join a live Match, and play against an authoritative state rather
  than only local UI state.
- Define competitive v1 as match integrity: authoritative placement validation,
  turn clocks, reconnect grace, deterministic replay from Match events, and
  stable handling of Victory and Stalemate.
- Keep public matchmaking, ratings, cosmetics, and broad board packs as later
  milestones. They depend on the private-room foundation being trustworthy.
- Preserve the existing domain language in `CONTEXT.md`. Add new glossary terms
  only when implementation begins and terms are resolved.

## Interfaces To Plan

- Add an online room model around the existing Match domain without changing the
  core Cascade rules.
- Persist and send versioned Match events rather than raw UI state, in the same
  spirit as the existing versioned snapshot contract.
- Treat the server as authoritative for placements, clock expiry, reconnection,
  and terminal Match state.
- Keep local and NPC modes separate from online rooms so online concerns do not
  leak into offline play.

## Test Scenarios

- Validate the competitor matrix against the same rules and feature axes for
  each direct competitor.
- Online v1 acceptance scenarios:
  - A legal move is accepted exactly once.
  - An illegal move is rejected without mutating the Match.
  - Two connected clients converge on the same Board after every move.
  - A reconnecting player receives the current authoritative Match state.
  - Clock expiry resolves according to the chosen timeout rule.
  - Cascade replay reaches the same Victory or Stalemate state on all clients.
- Regression tests should keep existing local behavior unchanged: Capacity,
  Holes, Cascade ordering, Elimination, Stalemate, snapshots, and NPC placement.

## Assumptions

- Primary audience: web strategy players.
- Primary differentiator: competitive online, not tactical teaching or board
  variety.
- First online scope: private live rooms.
- First competitive promise: match integrity.
- This belongs in a regular docs markdown file, not `CONTEXT.md`, because it is
  product strategy and roadmap material rather than glossary.
- No ADR is needed yet because no hard-to-reverse implementation decision has
  been made.
