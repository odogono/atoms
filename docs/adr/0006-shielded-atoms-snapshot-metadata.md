# Shielded Atoms Snapshot Metadata

Atoms match snapshots use version 4 for explicit ruleset metadata. Version 4 stores the Match ruleset at the snapshot top level, keeps board rows as the existing human-editable ASCII occupancy tokens, and stores Shielded Atoms state in separate metadata: Shielded Tile positions and per-Player Shield Charge counts.

Version 3 remains the Destructible Tile metadata version. Shield data is not encoded in board cell tokens because Shields are a Tile modifier, not cell occupancy, and overloading the ASCII board would make saved Matches harder to read and edit by hand.

Older version 1 through 3 snapshots parse as Classic Atoms. New serializations emit version 4 so the ruleset is explicit for every saved Match.
