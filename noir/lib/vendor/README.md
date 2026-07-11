# Vendored runtime deps

Single-file ESM bundles so the client runs with no build step and no CDN.
Regenerate after bumping nostr-tools:

```bash
npx esbuild node_modules/nostr-tools/lib/esm/index.js --bundle --format=esm --minify --outfile=lib/vendor/nostr-tools.mjs
npx esbuild node_modules/nostr-tools/lib/esm/pool.js  --bundle --format=esm --minify --outfile=lib/vendor/nostr-tools-pool.mjs
```

The browser importmap in `client/index.html` maps the bare `nostr-tools`
specifiers here; Node resolves the same specifiers from `node_modules`.
