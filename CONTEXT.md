# Atoms

Atoms is a turn-based browser board game about placing atoms, triggering chain reactions, and converting opponents' territory until one player remains.

## Language

**Board**:
The rectangular grid of cells where the match is played.

**Cell**:
One coordinate on the board. A cell is either a playable tile or a hole.

**Tile**:
One playable cell on the board that may contain atoms owned by at most one player.

**Hole**:
Absent board space inside the board grid. A hole is not playable, cannot contain atoms, does not receive atoms during an explosion wave, and does not count toward tile capacity.

**Atom**:
A game piece on a tile. An atom may be owned by one Player or be Neutral.

**Neutral Atom**:
An atom that starts on the Board without belonging to any Player. Neutral Atoms block direct placement, do not affect Elimination or Victory, and become Player-owned through Capture.

**Player**:
A participant that takes turns placing atoms and owns atoms by color.

**NPC**:
A Player whose placements are chosen by code.

**Match**:
One playable session of Atoms, from initial Board through Victory or Stalemate, including selected mode, Board size, turn flow, and Cascade playback.

**Capacity**:
The number of orthogonal playable tile neighbours a tile has.
_Avoid_: Limit, threshold

**Critical Mass**:
The state where a tile's atom count reaches its capacity.
_Avoid_: Full, overloaded

**Explosion Wave**:
A simultaneous step in which every tile at critical mass emits atoms to its neighbours.
_Avoid_: Blast, burst

**Cascade**:
The complete sequence of explosion waves caused by one placed atom.
_Avoid_: Chain, combo

**Capture**:
The conversion of a tile's atoms to the owner of an incoming atom.
_Avoid_: Takeover, steal

**Elimination**:
The removal of a player who has taken a turn and no longer owns any atoms.
_Avoid_: Death, defeat

**Victory**:
The end state where only one non-eliminated player remains.
_Avoid_: Win condition, game over

**Stalemate**:
A terminal draw state where a Cascade repeats while multiple non-eliminated players remain.
_Avoid_: Crash, error, timeout

## Relationships

- A **Board** contains many **Cells**.
- A **Cell** is either a **Tile** or a **Hole**.
- A **Match** contains one active **Board** and its participating **Players**.
- An **NPC** is a **Player** controlled by the Match UI instead of a human.
- A **Tile** contains zero or more **Atoms** owned by at most one **Player**, or Neutral Atoms.
- A **Hole** contains no **Atoms** and has no owner.
- A **Neutral Atom** is not a **Player** and never takes a turn.
- A **Tile** reaches **Critical Mass** when its atom count equals or exceeds its **Capacity**.
- An **Explosion Wave** may cause **Capture** and may start another **Explosion Wave**.
- An **Explosion Wave** may cause **Elimination**.
- A **Cascade** belongs to exactly one turn.
- A **Cascade** may resolve to a stable **Board**, **Victory**, or **Stalemate**.
- **Victory** is checked after each **Explosion Wave** and after a stable **Board**.
- **Stalemate** is checked only when a repeating **Cascade** still has multiple non-eliminated **Players**.

## Example dialogue

> **Dev:** "If Player 1's atom lands on a red tile during an Explosion Wave, do we replace the red atoms or add to them?"
> **Domain expert:** "That is a Capture: add the incoming atom, then all atoms on that Tile become Player 1's color."

> **Dev:** "If an Explosion Wave reaches a Hole, does the atom disappear?"
> **Domain expert:** "No. A Hole is absent board space, so it is not a neighbour and no atom is emitted to it."

> **Dev:** "Can a Player place an atom on a Tile containing Neutral Atoms?"
> **Domain expert:** "No. Neutral Atoms already occupy the Tile. They can only become Player-owned through Capture."

## Flagged ambiguities

- "critical mass" was first described as always four atoms; resolved: **Capacity** is the tile's orthogonal neighbour count, so corners have capacity 2, edges 3, and interior tiles 4.
- "chain reaction" was used informally; resolved: use **Cascade** for the whole turn reaction and **Explosion Wave** for each simultaneous step.
- "all cascades stabilize" was assumed informally; resolved: under neighbour-count **Capacity**, some **Cascades** repeat forever.
- "Victory requires a stable Board" was previously accepted; resolved: **Elimination** after an **Explosion Wave** can produce **Victory** before a repeating **Cascade** becomes **Stalemate**.
- "hole" could have meant a blocked tile; resolved: a **Hole** is not a **Tile**, but absent board space represented by a **Cell** in the rectangular **Board** grid.
- "orphaned atoms" was used informally; resolved: use **Neutral Atom** for atoms that start without Player ownership.
