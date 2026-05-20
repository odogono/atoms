import { describe, expect, it } from 'bun:test';

const runCli = (args: string[]) =>
  Bun.spawnSync({
    cmd: ['bun', 'run', 'benchmark-strategies', '--', ...args],
    cwd: process.cwd(),
    stderr: 'pipe',
    stdout: 'pipe'
  });

describe('benchmark-strategies CLI', () => {
  it('prints JSON and fails when the benchmark gate is not met', () => {
    const result = runCli([
      '--json',
      '--max-turns',
      '1',
      '--challenger',
      'tactical',
      '--baseline',
      'baseline'
    ]);

    expect(result.exitCode).toBe(1);

    const output = JSON.parse(result.stdout.toString());
    expect(output.summary).toMatchObject({
      baselineId: 'baseline',
      challengerId: 'tactical',
      passed: false
    });
    expect(output.duels.length).toBeGreaterThan(0);
  });

  it('rejects unknown strategies', () => {
    const result = runCli(['--challenger', 'unknown']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Unknown challenger strategy: unknown'
    );
  });
});
