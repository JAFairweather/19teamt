# NOIR

*A spycraft mystery game where information is the board.*

**Cases you unlock. Assets you burn.**

An AI game master holds the case; clues, dossiers, and assets are encrypted
scopes on nostr; solving puzzles earns you grants; mistakes get your assets
burned — a key rotation you feel. Four eras, duotone imagery, and a reading
experience built on a great slowly-turning wheel of text.

Built on [NIP-DA Scoped Data Grants](https://github.com/JAFairweather/nostr-scoped-data-grants)
(kinds 30440 / 440 / 441 / 10440). The protocol is frozen; Noir is a pure
client plus one game-master service. The protocol's honest caveat — a key
holder can share the key — is embraced here as the espionage mechanic.

| Game concept | Protocol primitive |
|---|---|
| Case file, dossiers, NPC records | kind-30440 scopes, GM-authored |
| Earning intel | kind-440 grant to the player |
| **Burn notice** | scope-key rotation + kind-441, rendered as an actual BURN NOTICE card |
| Your case notebook | your kind-10440 Grant Index — survives devices, recoverable from nsec |
| Player actions | gift-wrapped rumors to the GM npub |
| Leaking intel to another player | re-wrapping a scope key — possible **by design**; the world can find out |

## Status: M1 — the Wheel + a canned case

This is milestone 1 of 6 (see `docs/noir-spec.md` §11): the full drum reading
UX with flat-mode fallback, the command line, and one hand-authored Berlin
mini-case (**The Last Visa**, 5 scopes) served by a stub GM **over the real
protocol** — real encrypted scopes, real grants, and one scripted burn that
is a genuine key rotation plus a kind-441.

No AI is involved yet. That's the acceptance test: the reading experience
has to sell the game with zero AI. The director (Claude-driven narrative,
casegen from seeds, structured verdicts) is M3.

## Run it

```bash
npm install
npm run smoke        # full protocol loop in-memory: world → grants → burn → verdict
npm run serve        # then open /client/ — the playable Berlin mini-case
```

The demo runs everything in-page: an in-memory relay, the stub GM, and you.
Every dossier you read arrived as ciphertext and was unlocked by a grant;
open devtools and inspect the relay if you want the tradecraft view.

Playing tips: read the briefing carefully, type plainly (`ask …`, `open …`,
`check …`, `accuse …`), and mind the heat. Pressing your informant is
possible. It is not free.

## Layout

```
client/     the player experience — vanilla ESM, no build step
  wheel.mjs   the Wheel reading surface (spec §6) + flat mode
  game.mjs    command line, notebook (Grant Index view), case state
  art.mjs     era palettes, duotone pipeline seam (spec §7)
  burn.mjs    burn-notice interstitials, end cards
gm/         game-master side
  stubgm.mjs  M1 scripted GM — real protocol, scripted prose
  cases/      hand-authored case skeletons
eras/       era bibles (spec §10) — tone law, palettes, sensitivity lines
lib/        vendored from nostr-scoped-data-grants (CC0): nipxx.mjs, relay.mjs, liverelay.mjs
shared/     wrap.mjs — NIP-59 rumors: field reports (14), dispatches (15), burn notices (441)
test/       smoke.mjs — protocol loop + fair-play commitment + observer privacy
docs/       the build spec
```

## Fair play, verifiably

Every case publishes a sha256 commitment to its solution in the case's
public kind-0 **before** the first grant is issued. All scopes are
pre-authored and published (encrypted) before you act. The GM cannot move
the goalposts; `test/smoke.mjs` proves the property. See `SECURITY.md` for
the full provable-vs-trusted split.

## Roadmap

- **M1** ✅ The Wheel + canned case over the real protocol
- **M2** Grant-Index-as-notebook everywhere, nsec device recovery mid-case, NIP-49 keys at rest, live relays
- **M3** The Director: Claude narrative + interrogations, casegen from seeds, structured verdicts
- **M4** Duotone imagery on Blossom, photo-analysis puzzles
- **M5** All four eras, Meridian overland layer, homages, surveillance minigame
- **M6** Multiplayer: fragment dealing, trades, watermark leak detection, betrayal

License: MIT (app code). Vendored `lib/` is CC0 from the protocol repo.
