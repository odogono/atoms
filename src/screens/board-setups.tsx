import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';

import { Canvas } from '@react-three/fiber';

import {
  ArrowLeft,
  Copy,
  Download,
  Eraser,
  Play,
  Redo2,
  Save,
  Shield,
  Trash2,
  Undo2,
  Upload
} from 'lucide-react';

import { GameBoard } from '@components/game-board';
import {
  applyBoardSetupTool,
  createBoardSetupId,
  createBoardSetupPreviewMatch,
  getBuiltInBoardSetups,
  getNextNeutralAtomCount,
  parseBoardSetupDocumentJson,
  resizeBoardSetup,
  serializeBoardSetupDocument,
  validateBoardSetup,
  type BoardSetup,
  type BoardSetupTool
} from '@helpers/atoms-board-setup';
import {
  getInitialCursor,
  isCursorDirection,
  moveCursor
} from '@helpers/atoms-cursor';
import { useTheme } from '@contexts/theme/context';
import { type Position } from '@helpers/atoms-match-rules';
import { cn } from '@helpers/tailwind';

type BoardSetupsScreenProps = {
  onBack: () => void;
  onSaveBoardSetups: Dispatch<SetStateAction<BoardSetup[]>>;
  onUseInNewMatch: (setupId: string) => void;
  savedBoardSetups: BoardSetup[];
};

type HistoryState = {
  future: BoardSetup[];
  past: BoardSetup[];
};

const iconClassName = 'h-4 w-4';

const BOARD_SETUP_TOOLS: Array<{
  description: string;
  label: string;
  tool: BoardSetupTool;
}> = [
  {
    description: 'Make a playable empty Tile.',
    label: 'Empty',
    tool: 'empty'
  },
  {
    description: 'Remove board space.',
    label: 'Hole',
    tool: 'hole'
  },
  {
    description: 'Place Neutral Atoms.',
    label: 'Neutral',
    tool: 'neutral'
  },
  {
    description: 'Make a Tile destructible.',
    label: 'Destructible',
    tool: 'destructible'
  }
];


const getOutOfBoundsContentCount = (
  setup: BoardSetup,
  dimensions: Pick<BoardSetup, 'columns' | 'rows'>
) =>
  [...setup.holes, ...setup.neutralAtoms, ...setup.destructibleTiles].filter(
    position =>
      position.column >= dimensions.columns || position.row >= dimensions.rows
  ).length;

const upsertSetup = (setups: BoardSetup[], setup: BoardSetup) => {
  const index = setups.findIndex(candidate => candidate.id === setup.id);
  if (index === -1) {
    return [...setups, setup];
  }

  return setups.map(candidate =>
    candidate.id === setup.id ? setup : candidate
  );
};

const getSavedDraftName = (draft: BoardSetup, source: BoardSetup) =>
  draft.name === source.name ? `${draft.name} Copy` : draft.name;

const isInteractiveTarget = (target: EventTarget | null) => {
  if (!target || !('tagName' in target)) {
    return false;
  }

  const element = target as HTMLElement;
  return (
    element.isContentEditable ||
    ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)
  );
};

export const BoardSetupsScreen = ({
  onBack,
  onSaveBoardSetups,
  onUseInNewMatch,
  savedBoardSetups
}: BoardSetupsScreenProps) => {
  const { theme } = useTheme();
  const builtInSetups = useMemo(() => getBuiltInBoardSetups(), []);
  const allSetups = useMemo(
    () => [...builtInSetups, ...savedBoardSetups],
    [builtInSetups, savedBoardSetups]
  );
  const [selectedId, setSelectedId] = useState(
    () =>
      savedBoardSetups[0]?.id ?? builtInSetups[1]?.id ?? builtInSetups[0]!.id
  );
  const selectedSetup =
    allSetups.find(setup => setup.id === selectedId) ?? allSetups[0]!;
  const [draft, setDraft] = useState(() => selectedSetup);
  const selectedIsBuiltIn = draft.id.startsWith('preset-');
  const [history, setHistory] = useState<HistoryState>({
    future: [],
    past: []
  });
  const [tool, setTool] = useState<BoardSetupTool>('empty');
  const [destructibleHitPoints, setDestructibleHitPoints] = useState(1);
  const [cursorTile, setCursorTile] = useState(() => getInitialCursor(draft));
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importSource, setImportSource] = useState('');

  const validation = useMemo(() => validateBoardSetup(draft), [draft]);
  const draftIsValid = validation.ok;
  const match = useMemo(
    () => createBoardSetupPreviewMatch(draft, { playerCount: 2 }),
    [draft]
  );
  const exportSource = useMemo(
    () => serializeBoardSetupDocument(draft),
    [draft]
  );

  const selectSetup = useCallback((setup: BoardSetup) => {
    setSelectedId(setup.id);
    setDraft(setup);
    setHistory({ future: [], past: [] });
    setCursorTile(getInitialCursor(setup));
    setMessage(null);
  }, []);

  const commitDraft = useCallback((next: BoardSetup) => {
    setDraft(current => {
      setHistory(historyState => ({
        future: [],
        past: [...historyState.past, current]
      }));
      return next;
    });
  }, []);

  const applyToolAt = useCallback(
    (position: Position) => {
      const result = applyBoardSetupTool(draft, {
        destructibleHitPoints,
        neutralAtomCount:
          tool === 'neutral' ? getNextNeutralAtomCount(draft, position) : 1,
        position,
        tool
      });

      setMessage(null);
      commitDraft(result.setup);
    },
    [commitDraft, destructibleHitPoints, draft, tool]
  );

  const undo = useCallback(() => {
    setHistory(current => {
      const previous = current.past.at(-1);
      if (!previous) {
        return current;
      }
      let nextFuture = current.future;
      setDraft(draftState => {
        nextFuture = [draftState, ...current.future];
        return previous;
      });
      return {
        future: nextFuture,
        past: current.past.slice(0, -1)
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(current => {
      const next = current.future[0];
      if (!next) {
        return current;
      }
      let nextPast = current.past;
      setDraft(draftState => {
        nextPast = [...current.past, draftState];
        return next;
      });
      return {
        future: current.future.slice(1),
        past: nextPast
      };
    });
  }, []);

  const requireValidDraft = useCallback(() => {
    if (!validation.ok) {
      setMessage(validation.errors[0] ?? 'Board Setup Draft is not valid.');
      return false;
    }
    return true;
  }, [validation]);

  const saveDraft = useCallback(() => {
    if (!requireValidDraft()) {
      return;
    }

    const next = selectedIsBuiltIn
      ? {
          ...draft,
          id: createBoardSetupId(),
          name: getSavedDraftName(draft, selectedSetup)
        }
      : draft;
    onSaveBoardSetups(setups => upsertSetup(setups, next));
    setSelectedId(next.id);
    setDraft(next);
    setMessage('Board Setup saved.');
  }, [draft, onSaveBoardSetups, requireValidDraft, selectedIsBuiltIn, selectedSetup]);

  const duplicateSelected = useCallback(() => {
    if (!requireValidDraft()) {
      return;
    }

    const copy = {
      ...draft,
      id: createBoardSetupId(),
      name: `${draft.name} Copy`
    };
    onSaveBoardSetups(setups => [...setups, copy]);
    setSelectedId(copy.id);
    setDraft(copy);
    setMessage('Board Setup duplicated.');
  }, [draft, onSaveBoardSetups, requireValidDraft]);

  const deleteSelected = useCallback(() => {
    if (selectedIsBuiltIn) {
      return;
    }
    onSaveBoardSetups(setups =>
      setups.filter(candidate => candidate.id !== selectedId)
    );
    selectSetup(builtInSetups[1] ?? builtInSetups[0]!);
  }, [
    builtInSetups,
    onSaveBoardSetups,
    selectSetup,
    selectedId,
    selectedIsBuiltIn
  ]);

  const updateDimensions = useCallback(
    (dimensions: Pick<BoardSetup, 'columns' | 'rows'>) => {
      const dropped = getOutOfBoundsContentCount(draft, dimensions);
      if (
        dropped > 0 &&
        !window.confirm(
          `Resizing will drop ${dropped} cell edit${dropped === 1 ? '' : 's'} outside the new Board.`
        )
      ) {
        return;
      }

      const next = resizeBoardSetup(draft, dimensions);
      setMessage(null);
      commitDraft(next);
    },
    [commitDraft, draft]
  );

  const importSetup = useCallback(() => {
    const parsed = parseBoardSetupDocumentJson(importSource);
    if (!parsed.ok) {
      setMessage(parsed.errors[0] ?? 'Board Setup import failed.');
      return;
    }

    const imported = {
      ...parsed.boardSetup,
      id: createBoardSetupId()
    };
    setSelectedId(imported.id);
    setDraft(imported);
    setHistory({ future: [], past: [] });
    setCursorTile(getInitialCursor(imported));
    setImportSource('');
    setMessage('Board Setup Draft imported.');
  }, [importSource]);

  const useDraftInNewMatch = useCallback(() => {
    if (!requireValidDraft()) {
      return;
    }

    if (!selectedIsBuiltIn) {
      onSaveBoardSetups(setups => upsertSetup(setups, draft));
    }
    onUseInNewMatch(draft.id);
  }, [draft, onSaveBoardSetups, onUseInNewMatch, requireValidDraft, selectedIsBuiltIn]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (isCursorDirection(event.key)) {
        const direction = event.key;
        event.preventDefault();
        setCursorTile(current =>
          moveCursor(
            { columns: draft.columns, rows: draft.rows },
            current,
            direction
          )
        );
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        applyToolAt(cursorTile);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      const toolIndex = Number(event.key) - 1;
      const nextTool = BOARD_SETUP_TOOLS[toolIndex]?.tool;
      if (nextTool) {
        setTool(nextTool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [applyToolAt, cursorTile, draft.columns, draft.rows, redo, undo]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 text-slate-950 transition-colors sm:px-6 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:h-[calc(100vh-2rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="min-h-0 overflow-y-auto rounded-lg border border-slate-300 bg-white/85 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                  Board Setups
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  Editor
                </h1>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={onBack}
                type="button"
              >
                <ArrowLeft aria-hidden className={iconClassName} />
              </button>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <label className="text-sm font-medium" htmlFor="setup-select">
                Board Setup
              </label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                id="setup-select"
                onChange={event => {
                  const nextSetup = allSetups.find(
                    setup => setup.id === event.target.value
                  );
                  if (nextSetup) {
                    selectSetup(nextSetup);
                  }
                }}
                value={selectedId}
              >
                <optgroup label="Built-in">
                  {builtInSetups.map(setup => (
                    <option key={setup.id} value={setup.id}>
                      {setup.name} {setup.rows}x{setup.columns}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Saved">
                  {savedBoardSetups.map(setup => (
                    <option key={setup.id} value={setup.id}>
                      {setup.name} {setup.rows}x{setup.columns}
                    </option>
                  ))}
                </optgroup>
                {allSetups.some(setup => setup.id === selectedId) ? null : (
                  <optgroup label="Draft">
                    <option value={draft.id}>
                      {draft.name} {draft.rows}x{draft.columns}
                    </option>
                  </optgroup>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={!draftIsValid}
                onClick={duplicateSelected}
                title={
                  draftIsValid
                    ? undefined
                    : (validation.errors[0] ??
                      'Board Setup Draft is not valid.')
                }
                type="button"
              >
                <Copy aria-hidden className={iconClassName} />
                Duplicate
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                disabled={!draftIsValid}
                onClick={saveDraft}
                title={
                  draftIsValid
                    ? undefined
                    : (validation.errors[0] ??
                      'Board Setup Draft is not valid.')
                }
                type="button"
              >
                <Save aria-hidden className={iconClassName} />
                Save
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={selectedIsBuiltIn}
                onClick={deleteSelected}
                type="button"
              >
                <Trash2 aria-hidden className={iconClassName} />
                Delete
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                disabled={!draftIsValid}
                onClick={useDraftInNewMatch}
                title={
                  draftIsValid
                    ? undefined
                    : (validation.errors[0] ??
                      'Board Setup Draft is not valid.')
                }
                type="button"
              >
                <Play aria-hidden className={iconClassName} />
                Use
              </button>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <label className="text-sm font-medium" htmlFor="setup-name">
                Name
              </label>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                id="setup-name"
                onChange={event => {
                  commitDraft({ ...draft, name: event.target.value });
                }}
                value={draft.name}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Rows
                  </span>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    max={12}
                    min={4}
                    onChange={event => {
                      updateDimensions({
                        columns: draft.columns,
                        rows: Number(event.target.value)
                      });
                    }}
                    type="number"
                    value={draft.rows}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Columns
                  </span>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    max={12}
                    min={4}
                    onChange={event => {
                      updateDimensions({
                        columns: Number(event.target.value),
                        rows: draft.rows
                      });
                    }}
                    type="number"
                    value={draft.columns}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-sm font-medium">Tools</p>
              <div className="grid grid-cols-2 gap-2">
                {BOARD_SETUP_TOOLS.map((candidate, index) => (
                  <button
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition',
                      tool === candidate.tool
                        ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                        : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                    )}
                    key={candidate.tool}
                    onClick={() => {
                      setTool(candidate.tool);
                    }}
                    title={`${index + 1}. ${candidate.description}`}
                    type="button"
                  >
                    {candidate.tool === 'empty' ? (
                      <Eraser aria-hidden className={iconClassName} />
                    ) : candidate.tool === 'destructible' ? (
                      <Shield aria-hidden className={iconClassName} />
                    ) : candidate.tool === 'neutral' ? (
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-full border border-slate-500 bg-white"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-sm bg-slate-950 dark:bg-white"
                      />
                    )}
                    {candidate.label}
                  </button>
                ))}
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Hit Points
                </span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  max={9}
                  min={1}
                  onChange={event => {
                    setDestructibleHitPoints(Number(event.target.value));
                  }}
                  type="number"
                  value={destructibleHitPoints}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={history.past.length === 0}
                onClick={undo}
                type="button"
              >
                <Undo2 aria-hidden className={iconClassName} />
                Undo
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={history.future.length === 0}
                onClick={redo}
                type="button"
              >
                <Redo2 aria-hidden className={iconClassName} />
                Redo
              </button>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <label className="text-sm font-medium" htmlFor="setup-import">
                Import / Export
              </label>
              <textarea
                className="h-28 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                id="setup-import"
                onChange={event => {
                  setImportSource(event.target.value);
                }}
                placeholder={exportSource}
                value={importSource}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={() => {
                    setImportSource(exportSource);
                  }}
                  type="button"
                >
                  <Download aria-hidden className={iconClassName} />
                  Export
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  onClick={importSetup}
                  type="button"
                >
                  <Upload aria-hidden className={iconClassName} />
                  Import
                </button>
              </div>
            </div>

            {message ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-100">
                {message}
              </p>
            ) : null}
            {!validation.ok ? (
              <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-700/70 dark:bg-red-950/30 dark:text-red-100">
                {validation.errors[0]}
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="h-[26rem] min-h-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-200 sm:h-[34rem] lg:h-auto dark:border-slate-800 dark:bg-slate-900"
          onPointerLeave={() => {
            setHoveredTile(null);
          }}
        >
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
              cursorTile={cursorTile}
              hoveredTile={hoveredTile}
              illegalTile={null}
              isResolving={false}
              match={match}
              onTileClick={position => {
                setCursorTile(position);
                applyToolAt(position);
              }}
              onTileHover={position => {
                setHoveredTile(position);
                if (position) {
                  setCursorTile(position);
                }
              }}
              renderHoles
              showLegalPlacements={false}
            />
          </Canvas>
        </section>
      </div>
    </main>
  );
};
