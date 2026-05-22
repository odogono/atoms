export type AppRoute = 'match' | 'setups';

const normalizeBasePath = (basePath: string | undefined): string => {
  if (!basePath) {
    return '';
  }

  const trimmed = basePath.replaceAll(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
};

export const getAppRoute = (
  pathname: string,
  basePath: string | undefined
): AppRoute => {
  const normalizedBasePath = normalizeBasePath(basePath);
  const pathWithinApp =
    normalizedBasePath && pathname.startsWith(normalizedBasePath)
      ? pathname.slice(normalizedBasePath.length) || '/'
      : pathname;

  return pathWithinApp === '/setups' ? 'setups' : 'match';
};

export const getAppRoutePath = (
  route: AppRoute,
  basePath: string | undefined
): string => {
  const normalizedBasePath = normalizeBasePath(basePath);
  const routePath = route === 'setups' ? '/setups' : '/';

  return normalizedBasePath ? `${normalizedBasePath}${routePath}` : routePath;
};
