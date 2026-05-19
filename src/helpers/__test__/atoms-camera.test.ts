import { describe, expect, it } from 'bun:test';

import { getBoardCameraPose } from '../atoms-camera';

describe('atoms board camera', () => {
  it('centres the board when no tile is focused', () => {
    expect(getBoardCameraPose({ columns: 8, rows: 8 })).toEqual({
      position: [8.8, 11.2, 8.8],
      target: [0, 0, 0]
    });
  });

  it('focuses the hovered tile using board-centred coordinates', () => {
    expect(
      getBoardCameraPose({ columns: 8, rows: 8 }, { column: 7, row: 0 })
    ).toEqual({
      position: [12.3, 11.2, 5.3],
      target: [3.5, 0, -3.5]
    });
  });
});
