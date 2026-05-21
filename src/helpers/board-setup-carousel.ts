export type CarouselDirection = -1 | 1;

export const getWrappedCarouselIndex = (
  currentIndex: number,
  direction: CarouselDirection,
  itemCount: number
) => {
  if (itemCount <= 0) {
    return -1;
  }

  return (currentIndex + direction + itemCount) % itemCount;
};
