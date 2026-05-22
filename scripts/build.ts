import { copyFile, rm } from 'node:fs/promises';

import tailwind from 'bun-plugin-tailwind';

const normalizePublicPath = (
  basePath: string | undefined
): string | undefined => {
  if (!basePath) {
    return undefined;
  }

  const trimmed = basePath.replaceAll(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : undefined;
};

await rm('./dist', { force: true, recursive: true });

const result = await Bun.build({
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  entrypoints: ['./src/index.html'],
  env: 'BUN_PUBLIC_*',
  minify: true,
  outdir: './dist',
  plugins: [tailwind],
  publicPath: normalizePublicPath(process.env.BUN_PUBLIC_BASE_PATH),
  sourcemap: 'linked',
  splitting: true,
  target: 'browser'
});

if (!result.success) {
  process.stderr.write(result.logs.map(String).join('\n'));
  process.exit(1);
}

await copyFile('./dist/index.html', './dist/404.html');
