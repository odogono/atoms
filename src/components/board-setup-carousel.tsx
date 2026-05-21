import { useEffect, useMemo, useState } from 'react';

import { Canvas } from '@react-three/fiber';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { GameBoard } from '@components/game-board';
import { useTheme } from '@contexts/theme/context';
import {
  createBoardSetupPreviewMatch,
  type BoardSetup
} from '@helpers/atoms-board-setup';
import {
  getWrappedCarouselIndex,
  type CarouselDirection
} from '@helpers/board-setup-carousel';
import { cn } from '@helpers/tailwind';
import { usePrefersReducedMotion } from '@hooks/use-prefers-reduced-motion';

const noop = () => undefined;
const slideDurationMs = 260;

const getSetupIndex = (
  boardSetups: BoardSetup[],
  selectedBoardSetupId: string
) =>
  Math.max(
    0,
    boardSetups.findIndex(setup => setup.id === selectedBoardSetupId)
  );

const getSlideClassName = (
  role: 'current' | 'previous',
  direction: CarouselDirection
) => {
  if (role === 'current') {
    return direction === 1
      ? 'board-setup-carousel-enter-next'
      : 'board-setup-carousel-enter-previous';
  }

  return direction === 1
    ? 'board-setup-carousel-exit-next'
    : 'board-setup-carousel-exit-previous';
};

const BoardSetupPreview = ({ setup }: { setup: BoardSetup }) => {
  const { theme } = useTheme();
  const match = useMemo(
    () => createBoardSetupPreviewMatch(setup, { playerCount: 2 }),
    [setup]
  );

  return (
    <Canvas
      camera={{ fov: 42, position: [8, 9, 8] }}
      dpr={[1, 2]}
      shadows
      style={{
        background:
          theme === 'dark'
            ? 'linear-gradient(#0f172a, #020617)'
            : 'linear-gradient(#e2e8f0, #cbd5e1)'
      }}
    >
      <GameBoard
        currentWave={null}
        cursorTile={null}
        hoveredTile={null}
        illegalTile={null}
        isInteractive={false}
        isResolving={false}
        match={match}
        onTileClick={noop}
        onTileHover={noop}
        renderHoles
        showLegalPlacements={false}
      />
    </Canvas>
  );
};

const BoardSetupPanel = ({
  className,
  setup
}: {
  className?: string;
  setup: BoardSetup;
}) => (
  <div className={cn('absolute inset-0 grid grid-rows-[1fr_auto]', className)}>
    <div className="min-h-0 overflow-hidden rounded-md border border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-950">
      <BoardSetupPreview setup={setup} />
    </div>
    <p className="mt-3 truncate text-center text-base font-semibold text-slate-950 dark:text-white">
      {setup.name}
    </p>
  </div>
);

export const BoardSetupCarousel = ({
  boardSetups,
  onSelect,
  selectedBoardSetupId
}: {
  boardSetups: BoardSetup[];
  onSelect: (boardSetupId: string) => void;
  selectedBoardSetupId: string;
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [previousSetup, setPreviousSetup] = useState<BoardSetup | null>(null);
  const [slideDirection, setSlideDirection] = useState<CarouselDirection>(1);
  const currentIndex = getSetupIndex(boardSetups, selectedBoardSetupId);
  const currentSetup = boardSetups[currentIndex];
  const isSliding = previousSetup !== null && !prefersReducedMotion;

  useEffect(() => {
    if (!isSliding) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPreviousSetup(null);
    }, slideDurationMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isSliding, selectedBoardSetupId]);

  if (!currentSetup) {
    return null;
  }

  const navigate = (direction: CarouselDirection) => {
    const nextIndex = getWrappedCarouselIndex(
      currentIndex,
      direction,
      boardSetups.length
    );
    const nextSetup = boardSetups[nextIndex];
    if (!nextSetup || nextSetup.id === currentSetup.id) {
      return;
    }

    setSlideDirection(direction);
    setPreviousSetup(prefersReducedMotion ? null : currentSetup);
    onSelect(nextSetup.id);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem]">
        <button
          aria-label="Previous Board Setup"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => {
            navigate(-1);
          }}
          type="button"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" />
        </button>

        <div
          aria-live="polite"
          className="relative h-56 min-w-0 overflow-hidden sm:h-64"
        >
          {isSliding && previousSetup ? (
            <BoardSetupPanel
              className={getSlideClassName('previous', slideDirection)}
              setup={previousSetup}
            />
          ) : null}
          <BoardSetupPanel
            className={
              isSliding
                ? getSlideClassName('current', slideDirection)
                : undefined
            }
            setup={currentSetup}
          />
        </div>

        <button
          aria-label="Next Board Setup"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => {
            navigate(1);
          }}
          type="button"
        >
          <ChevronRight aria-hidden className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
