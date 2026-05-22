import { describe, expect, it } from 'bun:test';

import {
  applyBoardSetupTool,
  createBlankBoardSetup,
  createBoardSetupPreviewMatch,
  createMatchFromBoardSetup,
  getNextNeutralAtomCount,
  parseBoardSetupDocumentJson,
  resizeBoardSetup,
  serializeBoardSetupDocument,
  validateBoardSetup
} from '../atoms-board-setup';
import { getCell, getTile, isHole } from '../atoms-match-rules';

describe('atoms board setup', () => {
  it('validates Board Setup dimensions', () => {
    expect(
      validateBoardSetup(createBlankBoardSetup({ columns: 3, rows: 8 })).errors
    ).toContain('Board Setup columns must be between 4 and 12.');
    expect(
      validateBoardSetup(createBlankBoardSetup({ columns: 8, rows: 13 })).errors
    ).toContain('Board Setup rows must be between 4 and 12.');
  });

  it('allows draft edits that temporarily create invalid Hole topology', () => {
    const setup = createBlankBoardSetup({ columns: 4, rows: 4 });
    const first = applyBoardSetupTool(setup, {
      position: { column: 0, row: 0 },
      tool: 'hole'
    });
    const second = applyBoardSetupTool(first.setup, {
      position: { column: 2, row: 0 },
      tool: 'hole'
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.setup.holes).toEqual([
      { column: 0, row: 0 },
      { column: 2, row: 0 }
    ]);
    expect(validateBoardSetup(second.setup).errors).toContain(
      'Tile at 0,1 has capacity 1; holes must leave every tile with capacity at least 2.'
    );
  });

  it('renders invalid Board Setup Drafts without creating playable Matches', () => {
    const setup = createBlankBoardSetup({
      columns: 4,
      holes: [
        { column: 0, row: 0 },
        { column: 2, row: 0 }
      ],
      rows: 4
    });
    const preview = createBoardSetupPreviewMatch(setup, { playerCount: 2 });

    expect(validateBoardSetup(setup).ok).toBe(false);
    expect(() => createMatchFromBoardSetup(setup, { playerCount: 2 })).toThrow(
      'capacity'
    );
    expect(isHole(getCell(preview, { column: 0, row: 0 }))).toBe(true);
    expect(isHole(getCell(preview, { column: 2, row: 0 }))).toBe(true);
  });

  it('keeps resized drafts even when the resulting topology is invalid', () => {
    const setup = createBlankBoardSetup({
      columns: 5,
      holes: [
        { column: 0, row: 0 },
        { column: 2, row: 0 }
      ],
      rows: 4
    });
    const resized = resizeBoardSetup(setup, { columns: 4, rows: 4 });

    expect(resized.holes).toEqual([
      { column: 0, row: 0 },
      { column: 2, row: 0 }
    ]);
    expect(validateBoardSetup(resized).errors).toContain(
      'Tile at 0,1 has capacity 1; holes must leave every tile with capacity at least 2.'
    );
  });

  it('allows draft Neutral Atom counts that reach Capacity', () => {
    const setup = createBlankBoardSetup({ columns: 4, rows: 4 });
    const result = applyBoardSetupTool(setup, {
      neutralAtomCount: 2,
      position: { column: 0, row: 0 },
      tool: 'neutral'
    });

    expect(result.ok).toBe(true);
    expect(result.setup.neutralAtoms).toEqual([
      { column: 0, count: 2, row: 0 }
    ]);
    expect(validateBoardSetup(result.setup).errors).toContain(
      'Neutral Atom at 0,0 must be below Capacity.'
    );
  });

  it('cycles Neutral Atom tool counts between zero and three', () => {
    const emptySetup = createBlankBoardSetup({ columns: 4, rows: 4 });
    const position = { column: 1, row: 1 };
    const first = applyBoardSetupTool(emptySetup, {
      neutralAtomCount: getNextNeutralAtomCount(emptySetup, position),
      position,
      tool: 'neutral'
    });
    const second = applyBoardSetupTool(first.setup, {
      neutralAtomCount: getNextNeutralAtomCount(first.setup, position),
      position,
      tool: 'neutral'
    });
    const third = applyBoardSetupTool(second.setup, {
      neutralAtomCount: getNextNeutralAtomCount(second.setup, position),
      position,
      tool: 'neutral'
    });
    const cleared = applyBoardSetupTool(third.setup, {
      neutralAtomCount: getNextNeutralAtomCount(third.setup, position),
      position,
      tool: 'neutral'
    });

    expect(first.setup.neutralAtoms).toEqual([{ column: 1, count: 1, row: 1 }]);
    expect(second.setup.neutralAtoms).toEqual([
      { column: 1, count: 2, row: 1 }
    ]);
    expect(third.setup.neutralAtoms).toEqual([{ column: 1, count: 3, row: 1 }]);
    expect(cleared.setup.neutralAtoms).toEqual([]);
  });

  it('clears Neutral Atoms without removing Destructible Tiles', () => {
    const setup = createBlankBoardSetup({
      columns: 4,
      destructibleTiles: [{ column: 1, hitPoints: 2, row: 1 }],
      neutralAtoms: [{ column: 1, count: 3, row: 1 }],
      rows: 4
    });
    const result = applyBoardSetupTool(setup, {
      neutralAtomCount: getNextNeutralAtomCount(setup, {
        column: 1,
        row: 1
      }),
      position: { column: 1, row: 1 },
      tool: 'neutral'
    });

    expect(result.setup.neutralAtoms).toEqual([]);
    expect(result.setup.destructibleTiles).toEqual([
      { column: 1, hitPoints: 2, row: 1 }
    ]);
  });

  it('validates Destructible Tile Hit Points', () => {
    const setup = createBlankBoardSetup({
      columns: 4,
      destructibleTiles: [{ column: 1, hitPoints: 10, row: 1 }],
      rows: 4
    });

    expect(validateBoardSetup(setup).errors).toContain(
      'Destructible Tile Hit Points must be between 1 and 9.'
    );
  });

  it('allows Neutral Atoms on Destructible Tiles', () => {
    const setup = createBlankBoardSetup({
      columns: 4,
      destructibleTiles: [{ column: 1, hitPoints: 2, row: 1 }],
      neutralAtoms: [{ column: 1, count: 1, row: 1 }],
      rows: 4
    });
    const match = createMatchFromBoardSetup(setup, { playerCount: 2 });

    expect(validateBoardSetup(setup).errors).toEqual([]);
    expect(getTile(match, { column: 1, row: 1 })).toEqual({
      atomCount: 1,
      hitPoints: 2,
      kind: 'tile',
      ownerId: null,
      shielded: false
    });
  });

  it('round-trips a versioned Board Setup document', () => {
    const setup = createBlankBoardSetup({
      columns: 5,
      destructibleTiles: [{ column: 2, hitPoints: 3, row: 2 }],
      holes: [{ column: 4, row: 4 }],
      name: 'Test Board',
      neutralAtoms: [{ column: 1, count: 1, row: 1 }],
      rows: 5
    });

    const source = serializeBoardSetupDocument(setup);
    const parsed = parseBoardSetupDocumentJson(source);

    expect(parsed).toEqual({
      boardSetup: setup,
      ok: true
    });
  });

  it('imports semantically invalid Board Setup documents as drafts', () => {
    const setup = createBlankBoardSetup({
      columns: 4,
      holes: [
        { column: 0, row: 0 },
        { column: 2, row: 0 }
      ],
      rows: 4
    });
    const parsed = parseBoardSetupDocumentJson(
      JSON.stringify({
        boardSetup: setup,
        version: 1
      })
    );

    expect(parsed).toEqual({
      boardSetup: setup,
      ok: true
    });
    if (parsed.ok) {
      expect(validateBoardSetup(parsed.boardSetup).ok).toBe(false);
    }
  });

  it('reports import errors without creating a setup', () => {
    const parsed = parseBoardSetupDocumentJson(
      JSON.stringify({
        boardSetup: createBlankBoardSetup({
          columns: 4,
          holes: [{ column: 1, row: 0 }],
          rows: 4
        }),
        version: 1
      }).replace(
        '"holes":[{"column":1,"row":0}]',
        '"holes":[{"column":99,"row":0}]'
      )
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('Position 0,99 is out of bounds.');
    }
  });

  it('creates Matches from Board Setups with 2 to 4 Players', () => {
    const setup = createBlankBoardSetup({
      columns: 4,
      holes: [{ column: 1, row: 1 }],
      rows: 4
    });
    const match = createMatchFromBoardSetup(setup, { playerCount: 4 });

    expect(match.players).toHaveLength(4);
    expect(isHole(getCell(match, { column: 1, row: 1 }))).toBe(true);
  });
});
