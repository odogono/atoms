import type { BoardDimensions, Position } from './atoms-match-rules';

export type CursorDirection =
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getInitialCursor = (board: BoardDimensions): Position => ({
  column: Math.floor((board.columns - 1) / 2),
  row: Math.floor((board.rows - 1) / 2)
});

export const moveCursor = (
  board: BoardDimensions,
  position: Position,
  direction: CursorDirection
): Position => {
  const nextPosition = { ...position };

  if (direction === 'ArrowUp') {
    nextPosition.row -= 1;
  }
  if (direction === 'ArrowRight') {
    nextPosition.column += 1;
  }
  if (direction === 'ArrowDown') {
    nextPosition.row += 1;
  }
  if (direction === 'ArrowLeft') {
    nextPosition.column -= 1;
  }

  return {
    column: clamp(nextPosition.column, 0, board.columns - 1),
    row: clamp(nextPosition.row, 0, board.rows - 1)
  };
};
