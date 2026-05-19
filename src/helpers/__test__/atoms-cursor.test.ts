import { describe, expect, it } from 'bun:test';

import {
  getInitialCursor,
  moveCursor,
  type CursorDirection
} from '../atoms-cursor';

const board = { columns: 8, rows: 8 };

describe('atoms board cursor', () => {
  it('starts near the centre of the board', () => {
    expect(getInitialCursor(board)).toEqual({ column: 3, row: 3 });
  });

  it.each([
    ['ArrowUp', { column: 3, row: 2 }],
    ['ArrowRight', { column: 4, row: 3 }],
    ['ArrowDown', { column: 3, row: 4 }],
    ['ArrowLeft', { column: 2, row: 3 }]
  ] satisfies Array<[CursorDirection, { column: number; row: number }]>)(
    'moves with %s',
    (direction, expectedPosition) => {
      expect(moveCursor(board, { column: 3, row: 3 }, direction)).toEqual(
        expectedPosition
      );
    }
  );

  it('does not move beyond board bounds', () => {
    expect(moveCursor(board, { column: 0, row: 0 }, 'ArrowUp')).toEqual({
      column: 0,
      row: 0
    });
    expect(moveCursor(board, { column: 7, row: 7 }, 'ArrowRight')).toEqual({
      column: 7,
      row: 7
    });
  });
});
