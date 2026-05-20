import { describe, expect, it } from 'bun:test';

import { getBoardCameraPose } from '../atoms-camera';

describe('atoms board camera', () => {
  it('centres the board when no tile is focused', () => {
    expect(getBoardCameraPose({ columns: 8, rows: 8 })).toEqual({
      position: [8.8, 11.2, 8.8],
      target: [0, 0, 0]
    });
  });

  it('drifts partway toward the focused tile using board-centred coordinates', () => {
    expect(
      getBoardCameraPose({ columns: 8, rows: 8 }, { column: 7, row: 0 })
    ).toEqual({
      position: [9.675, 11.2, 7.925],
      target: [0.875, 0, -0.875]
    });
  });

  it('keeps the camera board-centred when focus strength is zero', () => {
    expect(
      getBoardCameraPose(
        { columns: 8, rows: 8 },
        { column: 7, row: 0 },
        { focusStrength: 0 }
      )
    ).toEqual({
      position: [8.8, 11.2, 8.8],
      target: [0, 0, 0]
    });
  });
});
