import type { BoardDimensions, Position } from './atoms-match-rules';

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};

type BoardCameraPoseOptions = {
  focusStrength?: number;
};

const DEFAULT_FOCUS_STRENGTH = 0.25;
const round = (value: number) => Number(value.toFixed(4));

export const getBoardPoint = (
  board: BoardDimensions,
  position: Position,
  y = 0
): [number, number, number] => [
  round(position.column - (board.columns - 1) / 2),
  round(y),
  round(position.row - (board.rows - 1) / 2)
];

export const getBoardCameraPose = (
  board: BoardDimensions,
  focusedTile?: Position | null,
  options: BoardCameraPoseOptions = {}
): CameraPose => {
  const largestSide = Math.max(board.rows, board.columns);
  const focusStrength = focusedTile
    ? (options.focusStrength ?? DEFAULT_FOCUS_STRENGTH)
    : 0;
  const focusedPoint: [number, number, number] = focusedTile
    ? getBoardPoint(board, focusedTile)
    : [0, 0, 0];
  const target: [number, number, number] = [
    round(focusedPoint[0] * focusStrength),
    round(focusedPoint[1] * focusStrength),
    round(focusedPoint[2] * focusStrength)
  ];
  const offset = largestSide * 1.1;

  return {
    position: [
      round(target[0] + offset),
      round(largestSide * 1.4),
      round(target[2] + offset)
    ],
    target
  };
};
