import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  getLegalPlacements,
  type PlayerId
} from '../src/helpers/atoms-match-rules';
import { parseMatchSnapshotJson } from '../src/helpers/atoms-match-snapshot';
import { getMatchStrategy } from '../src/helpers/atoms-match-strategy';
import {
  createBenchmarkCorpus,
  runStrategyBenchmark,
  runStrategyDuel,
  type StrategyBenchmarkCorpusEntry,
  type StrategyBenchmarkDuelResult
} from '../src/helpers/atoms-strategy-benchmark';

type CliOptions = {
  baselineId: string;
  challengerId: string;
  json: boolean;
  maxTurns: number;
};

const DEFAULT_MAX_TURNS = 10_000;
const SNAPSHOT_DIRECTORY = 'examples/snapshots';
const usage = `Usage: bun run benchmark-strategies -- [--challenger tactical] [--baseline baseline] [--max-turns N] [--json]\n`;

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const parsePositiveInteger = (value: string, flag: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail(`${flag} must be a positive integer.`);
  }
  return parsed;
};

const readFlagValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1] ?? fail(`${flag} requires a value.`);
  if (value.startsWith('--')) {
    fail(`${flag} requires a value.`);
  }
  return value;
};

const parseArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    baselineId: 'baseline',
    challengerId: 'tactical',
    json: false,
    maxTurns: DEFAULT_MAX_TURNS
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage);
      process.exit(0);
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--baseline') {
      options.baselineId = readFlagValue(args, index, '--baseline');
      index += 1;
      continue;
    }

    if (arg.startsWith('--baseline=')) {
      options.baselineId = arg.slice('--baseline='.length);
      continue;
    }

    if (arg === '--challenger') {
      options.challengerId = readFlagValue(args, index, '--challenger');
      index += 1;
      continue;
    }

    if (arg.startsWith('--challenger=')) {
      options.challengerId = arg.slice('--challenger='.length);
      continue;
    }

    if (arg === '--max-turns') {
      options.maxTurns = parsePositiveInteger(
        readFlagValue(args, index, '--max-turns'),
        '--max-turns'
      );
      index += 1;
      continue;
    }

    if (arg.startsWith('--max-turns=')) {
      options.maxTurns = parsePositiveInteger(
        arg.slice('--max-turns='.length),
        '--max-turns'
      );
      continue;
    }

    fail(`Unknown option: ${arg}\n${usage}`);
  }

  return options;
};

const shouldIncludeSnapshot = (entry: StrategyBenchmarkCorpusEntry) =>
  entry.match.status === 'playing' &&
  getLegalPlacements(entry.match).length > 0;

const loadSnapshotCorpus = async (): Promise<
  StrategyBenchmarkCorpusEntry[]
> => {
  const fileNames = await readdir(SNAPSHOT_DIRECTORY);
  const entries: StrategyBenchmarkCorpusEntry[] = [];

  for (const fileName of fileNames.sort()) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const path = join(SNAPSHOT_DIRECTORY, fileName);
    const source = await readFile(path, 'utf8');
    const parsed = parseMatchSnapshotJson(source);
    if (!parsed.ok) {
      continue;
    }

    const entry = {
      id: fileName,
      match: parsed.match,
      source: 'snapshot' as const
    };
    if (shouldIncludeSnapshot(entry)) {
      entries.push(entry);
    }
  }

  return entries;
};

const runSeatSwaps = (
  corpus: StrategyBenchmarkCorpusEntry[],
  options: CliOptions
) => {
  const challenger =
    getMatchStrategy(options.challengerId) ??
    fail(`Unknown challenger strategy: ${options.challengerId}`);
  const baseline =
    getMatchStrategy(options.baselineId) ??
    fail(`Unknown baseline strategy: ${options.baselineId}`);
  const results: StrategyBenchmarkDuelResult[] = [];

  for (const entry of corpus) {
    for (const challengerPlayerId of ['player-1', 'player-2'] as PlayerId[]) {
      results.push(
        runStrategyDuel(entry.match, {
          baseline,
          challenger,
          challengerPlayerId,
          fixtureId: `${entry.source}:${entry.id}:${challengerPlayerId}`,
          maxTurns: options.maxTurns
        })
      );
    }
  }

  return results;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatHumanResult = (
  summary: ReturnType<typeof runStrategyBenchmark>,
  duels: StrategyBenchmarkDuelResult[]
) =>
  [
    `Challenger: ${summary.challengerId}`,
    `Baseline: ${summary.baselineId}`,
    `Games: ${summary.totalGames}`,
    `Decisive games: ${summary.decisiveGames}`,
    `Challenger wins: ${summary.challengerWins}`,
    `Baseline wins: ${summary.baselineWins}`,
    `Draws: ${summary.draws}`,
    `Challenger decisive win rate: ${formatPercent(
      summary.challengerDecisiveWinRate
    )}`,
    `Challenger score rate: ${formatPercent(summary.challengerScoreRate)}`,
    `Result: ${summary.passed ? 'passed' : 'failed'}`,
    '',
    ...duels.map(
      duel =>
        `${duel.fixtureId}: ${duel.outcome} (${duel.reason}, ${duel.turnsSimulated} turns)`
    )
  ].join('\n');

const main = async () => {
  const options = parseArgs(Bun.argv.slice(2));
  const corpus = [...(await loadSnapshotCorpus()), ...createBenchmarkCorpus()];
  const duels = runSeatSwaps(corpus, options);
  const summary = runStrategyBenchmark(duels, {
    baselineId: options.baselineId,
    challengerId: options.challengerId
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ duels, summary }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatHumanResult(summary, duels)}\n`);
  }

  if (!summary.passed) {
    process.exit(1);
  }
};

await main();
