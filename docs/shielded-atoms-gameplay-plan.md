# Shielded Atoms Gameplay Plan

## Summary

Add **Shielded Atoms** as an opt-in ruleset variant. Classic Atoms remains the
default. In Shielded Atoms, each Player gets two **Shield Charges** per Match
and may spend one instead of placing an Atom to add a **Shield** to one owned
Tile.

A Shield blocks all opposing incoming atoms that reach that Tile during one
Explosion Wave, then breaks. Friendly incoming atoms pass through normally, and
Shielded Tiles still explode normally at Critical Mass.

## Key Changes

- Add a `ruleset` concept with at least `classic` and `shielded`; Match setup
  defaults to Classic Atoms.
- Extend Match state with per-player Shield Charge counts and Shielded Tile
  state.
- Add a second player action in Shielded Atoms: `shield-tile`, valid only on an
  owned, unshielded Tile when the Player has a Shield Charge.
- During Cascade resolution, if opposing incoming atoms target a Shielded Tile,
  remove those opposing incoming paths for that Tile, break the Shield, and
  continue resolving the wave normally for all other Tiles.
- Friendly incoming atoms do not break or consume a Shield.
- NPCs in Shielded Atoms should evaluate both placement and Shield actions using
  a deterministic heuristic.

## Interfaces And Docs

- UI: add a ruleset selector in Match setup: `Classic Atoms` default,
  `Shielded Atoms` opt-in.
- UI: add a Shield tool toggle with remaining Shield Charges; the next click or
  keyboard confirm spends a Shield Charge if the cursor targets a legal owned
  Tile.
- Board visual: show Shielded Tiles with an owner-colored ring that does not
  obscure atom count or Capacity.
- Snapshot contract: add version 3 using separate metadata for `ruleset`,
  Shielded Tile positions, and per-player Shield Charge counts; keep existing
  ASCII board cell tokens unchanged.
- Documentation: update `CONTEXT.md` with glossary terms `Shield`,
  `Shield Charge`, and `Shielded Atoms`.
- ADR: add a short ADR for snapshot v3 Shield metadata, because choosing
  separate metadata over board-token encoding is a durable contract decision.

## Test Plan

- Rule tests: legal and illegal Shield action targets, charge consumption, no
  double-shielding, Classic Atoms unchanged.
- Cascade tests: Shield blocks one full opposing Explosion Wave, breaks
  afterward, friendly waves pass through, outgoing explosions unchanged.
- Multi-player tests: same-wave incoming atoms from multiple opponents are all
  blocked at the Shielded Tile.
- Flow tests: Shield tool mode, keyboard cursor action, terminal states, NPC
  Shield decisions.
- Snapshot tests: v1/v2 still parse, v3 round-trips ruleset, charges, and
  Shielded Tiles.

## Assumptions

- Shielded Atoms starts with two Shield Charges per Player per Match.
- Shielding consumes the Player's whole turn.
- Shielded Atoms applies to local, 1P vs NPC, and NPC-vs-NPC when that ruleset
  is selected.
- No random effects are introduced; the variant stays deterministic and
  replayable.
