import { describe, expect, it } from 'bun:test';

import { getAppRoute, getAppRoutePath } from '../atoms-app-route';

describe('atoms app routes', () => {
  it('keeps local development routes rooted at / when no base path is set', () => {
    expect(getAppRoute('/', undefined)).toBe('match');
    expect(getAppRoute('/setups', undefined)).toBe('setups');
    expect(getAppRoutePath('match', undefined)).toBe('/');
    expect(getAppRoutePath('setups', undefined)).toBe('/setups');
  });

  it('resolves GitHub Pages project routes under the configured base path', () => {
    expect(getAppRoute('/atoms/', '/atoms/')).toBe('match');
    expect(getAppRoute('/atoms/setups', '/atoms/')).toBe('setups');
    expect(getAppRoutePath('match', '/atoms/')).toBe('/atoms/');
    expect(getAppRoutePath('setups', '/atoms/')).toBe('/atoms/setups');
  });

  it('normalizes base path input while matching and creating paths', () => {
    expect(getAppRoute('/atoms/setups', 'atoms')).toBe('setups');
    expect(getAppRoutePath('setups', '/atoms/')).toBe('/atoms/setups');
    expect(getAppRoutePath('match', '/')).toBe('/');
  });
});
