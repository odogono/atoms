import { describe, expect, it } from 'bun:test';

import { getWrappedCarouselIndex } from '@helpers/board-setup-carousel';

describe('board setup carousel', () => {
  it('moves to adjacent items', () => {
    expect(getWrappedCarouselIndex(1, 1, 4)).toBe(2);
    expect(getWrappedCarouselIndex(2, -1, 4)).toBe(1);
  });

  it('wraps at either end', () => {
    expect(getWrappedCarouselIndex(0, -1, 4)).toBe(3);
    expect(getWrappedCarouselIndex(3, 1, 4)).toBe(0);
  });

  it('returns -1 when there are no carousel items', () => {
    expect(getWrappedCarouselIndex(0, 1, 0)).toBe(-1);
  });
});
