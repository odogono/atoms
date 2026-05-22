# Atoms

Atoms is a turn-based browser board game about placing atoms, triggering chain reactions, and converting opponents' territory until one player remains.

## Language

**Board**:
The rectangular grid of cells where the match is played.

**Cell**:
One coordinate on the board. A cell is either a playable tile or a hole.

**Tile**:
One playable cell on the board that may contain atoms owned by at most one player.

**Destructible Tile**:
A playable Tile with Hit Points. A Destructible Tile becomes a Hole when its Hit Points reach zero.

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

**NPC Strategy**:
The policy an NPC uses to choose one legal placement on its turn.

**Match**:
One playable session of Atoms, from initial Board through Victory or Stalemate, including selected mode, Board size, turn flow, and Cascade playback.

**Golf Mode**:
A solo puzzle mode where one Player tries to clear a curated starting Board of opposing Player-owned Atoms in as few Strokes as possible.

**Shielded Atoms**:
An opt-in Match ruleset where Players may spend Shield Charges to protect owned Tiles during Explosion Waves.

**Shield Charge**:
A limited Player resource in Shielded Atoms spent to add one Shield to one owned Tile.

**Shield**:
A temporary protection on one Shielded Tile that blocks opposing incoming atoms during one Explosion Wave.

**Shielded Tile**:
A Player-owned Tile with an active Shield.

**Golf Course**:
An ordered series of Golf Holes scored as one run.

**Golf Hole**:
One curated Golf Mode challenge with a full starting Match state and a target of clearing opposing Player-owned Atoms.

**Stroke**:
One Golf Mode placement and its resulting Cascade.
_Avoid_: Turn

**Match Snapshot**:
A serialized Match state that can be saved, loaded, or used as simulation input.
_Avoid_: Map

**Board Setup**:
The initial shape and contents of a Board before turn play, including dimensions, Holes, Neutral Atoms, and Destructible Tiles.
_Avoid_: Map

**Board Setup Draft**:
An in-progress Board Setup being edited before it is valid enough to save or use in a Match.

**Round**:
A completed cycle of turns by the Match's non-eliminated Players.

**Capacity**:
The number of orthogonal playable tile neighbours a tile has.
_Avoid_: Limit, threshold

**Critical Mass**:
The state where a tile's atom count reaches its capacity.
_Avoid_: Full, overloaded

**Hit Points**:
The durability remaining on a Destructible Tile.
_Avoid_: Health, durability

**Explosion Wave**:
A simultaneous step in which every tile at critical mass emits atoms to its neighbours.
_Avoid_: Blast, burst

**Cascade**:
The complete sequence of explosion waves caused by one placed atom.
_Avoid_: Chain, combo

**Collapse**:
The removal of Tiles that no longer have enough playable neighbours after board space is destroyed.
_Avoid_: Cave-in, support check

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

**Board Control**:
A measure of how many Tiles each Player owns on the Board.
_Avoid_: Colour balance

**Critical Pressure**:
A measure of how close each Player's owned Tiles are to Critical Mass.
_Avoid_: Dominance, threat level

## Relationships

- A **Board** contains many **Cells**.
- A **Cell** is either a **Tile** or a **Hole**.
- A **Match** contains one active **Board** and its participating **Players**.
- **Shielded Atoms** is a ruleset for **Matches**, not for **Golf Mode**.
- A **Player** has **Shield Charges** only in **Shielded Atoms**.
- A **Shield Charge** may be spent to make one owned **Tile** a **Shielded Tile**.
- A **Shielded Tile** has exactly one **Shield**.
- A **Shield** blocks opposing incoming **Atoms** during one **Explosion Wave**.
- **Golf Mode** uses normal placement, Capture, Explosion Wave, Cascade, and Stalemate rules.
- A **Golf Course** contains one or more **Golf Holes**.
- A **Golf Hole** starts from a complete **Match** state, not from a **Board Setup**.
- A **Stroke** belongs to one **Golf Hole**.
- A **Match Snapshot** represents one **Match** at a specific point in turn flow.
- A **Board Setup** describes the starting **Board** for a **Match**.
- A **Board Setup Draft** becomes a **Board Setup** when it is valid enough to save or use in a **Match**.
- A **Board Setup** may include **Destructible Tiles**.
- An **NPC** is a **Player** controlled by the Match UI instead of a human.
- An **NPC Strategy** belongs to an **NPC** turn and chooses one legal placement.
- A **Tile** contains zero or more **Atoms** owned by at most one **Player**, or Neutral Atoms.
- A **Destructible Tile** is a **Tile** and may contain **Atoms** like any other **Tile**.
- **Hit Points** belong to exactly one **Destructible Tile**.
- A **Hole** contains no **Atoms** and has no owner.
- A **Neutral Atom** is not a **Player** and never takes a turn.
- A **Tile** reaches **Critical Mass** when its atom count equals or exceeds its **Capacity**.
- An **Explosion Wave** may cause **Capture** and may start another **Explosion Wave**.
- An **Explosion Wave** may cause **Elimination**.
- An **Explosion Wave** may reduce **Hit Points** and turn **Destructible Tiles** into **Holes**.
- **Collapse** may turn unsupported **Tiles** into **Holes**.
- A **Cascade** belongs to exactly one turn.
- A **Cascade** may resolve to a stable **Board**, **Victory**, or **Stalemate**.
- **Victory** is checked after each **Explosion Wave** and after a stable **Board**.
- **Stalemate** is checked only when a repeating **Cascade** still has multiple non-eliminated **Players**.
- A **Round** contains one turn by each non-eliminated **Player**.
- **Board Control** and **Critical Pressure** describe Player-owned **Tiles** only; **Neutral Atoms** do not contribute to either measure.

## Example dialogue

> **Dev:** "If Player 1's atom lands on a red tile during an Explosion Wave, do we replace the red atoms or add to them?"
> **Domain expert:** "That is a Capture: add the incoming atom, then all atoms on that Tile become Player 1's color."

> **Dev:** "If an Explosion Wave reaches a Hole, does the atom disappear?"
> **Domain expert:** "No. A Hole is absent board space, so it is not a neighbour and no atom is emitted to it."

> **Dev:** "Can a Player place an atom on a Tile containing Neutral Atoms?"
> **Domain expert:** "No. Neutral Atoms already occupy the Tile. They can only become Player-owned through Capture."

> **Dev:** "Can a Player place an atom on a Destructible Tile?"
> **Domain expert:** "Yes. A Destructible Tile is still a Tile; only Explosion Waves reduce its Hit Points."

> **Dev:** "Is a Golf Hole just a Board Setup with atoms already on it?"
> **Domain expert:** "No. A Golf Hole needs Player-owned Atoms, active Player, and scoring context, so it starts from a complete Match state."

## Flagged ambiguities

- "critical mass" was first described as always four atoms; resolved: **Capacity** is the tile's orthogonal neighbour count, so corners have capacity 2, edges 3, and interior tiles 4.
- "chain reaction" was used informally; resolved: use **Cascade** for the whole turn reaction and **Explosion Wave** for each simultaneous step.
- "all cascades stabilize" was assumed informally; resolved: under neighbour-count **Capacity**, some **Cascades** repeat forever.
- "Victory requires a stable Board" was previously accepted; resolved: **Elimination** after an **Explosion Wave** can produce **Victory** before a repeating **Cascade** becomes **Stalemate**.
- "hole" could have meant a blocked tile; resolved: a **Hole** is not a **Tile**, but absent board space represented by a **Cell** in the rectangular **Board** grid.
- "orphaned atoms" was used informally; resolved: use **Neutral Atom** for atoms that start without Player ownership.
- "map" was used informally; resolved: use **Match Snapshot** for arbitrary serialized Match state, and **Board Setup** only for Board dimensions, Holes, Neutral Atoms, and Destructible Tiles.
- "destroyed tile" could have meant an empty Tile; resolved: a destroyed **Destructible Tile** becomes a **Hole**.
- "Board Setup" previously omitted Destructible Tiles; resolved: **Board Setup** includes every pre-turn Board feature that can exist before a Match starts, including **Destructible Tiles**.
- "Board Setup" could mean an invalid in-editor shape; resolved: use **Board Setup Draft** for editable intermediate shapes, and reserve **Board Setup** for valid shapes that can be saved or used in a **Match**.
- "Golf board" could have meant a **Board Setup**; resolved: use **Golf Hole** for a curated puzzle with Player-owned starting Atoms.
- "shield" could have meant a permanent Tile state; resolved: a **Shield** is temporary protection on a Player-owned **Shielded Tile**.
