import { build } from 'esbuild'

await build({
  entryPoints: ['client.js'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2023',
  legalComments: 'none',
})
