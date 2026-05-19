# Atoms

Atoms is a turn-based browser board game about placing atoms, triggering chain reactions, and converting opponents' territory until one player remains.

## Language

**Board**:
The rectangular grid of tiles where the match is played.

**Tile**:
One position on the board that may contain atoms owned by at most one player.

**Atom**:
A colored game piece on a tile, owned by exactly one player.

**Player**:
A participant that takes turns placing atoms and owns atoms by color.

**Match**:
One playable session of Atoms, from initial Board through Victory or Stalemate, including selected mode, Board size, turn flow, and Cascade playback.

**Capacity**:
The number of orthogonal neighbours a tile has.
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

- A **Board** contains many **Tiles**.
- A **Match** contains one active **Board** and its participating **Players**.
- A **Tile** contains zero or more **Atoms** owned by at most one **Player**.
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

## Flagged ambiguities

- "critical mass" was first described as always four atoms; resolved: **Capacity** is the tile's orthogonal neighbour count, so corners have capacity 2, edges 3, and interior tiles 4.
- "chain reaction" was used informally; resolved: use **Cascade** for the whole turn reaction and **Explosion Wave** for each simultaneous step.
- "all cascades stabilize" was assumed informally; resolved: under neighbour-count **Capacity**, some **Cascades** repeat forever.
- "Victory requires a stable Board" was previously accepted; resolved: **Elimination** after an **Explosion Wave** can produce **Victory** before a repeating **Cascade** becomes **Stalemate**.
