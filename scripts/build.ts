import tailwind from 'bun-plugin-tailwind';

const result = await Bun.build({
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  entrypoints: ['./src/index.html'],
  env: 'BUN_PUBLIC_*',
  minify: true,
  outdir: './dist',
  plugins: [tailwind],
  sourcemap: 'linked',
  splitting: true,
  target: 'browser'
});

if (!result.success) {
  process.stderr.write(result.logs.map(String).join('\n'));
  process.exit(1);
}
