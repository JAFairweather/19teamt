# Noir — Claude Code Build Specification

**A spycraft mystery game where information is the board.** An AI game master holds the case; clues, dossiers, and assets are encrypted scopes; solving puzzles earns you grants; mistakes get your assets burned — a key rotation you feel. Four eras, duotone imagery, and a reading experience built on a great slowly-turning wheel of text.

**Tagline:** *Noir. Cases you unlock. Assets you burn.*

**Version:** 1.0 draft · **License:** MIT (app code) · **Protocol dependency:** NIP-DA Scoped Data Grants, PR nostr-protocol/nips#2411 (`github.com/JAFairweather/nostr-scoped-data-grants`)

---

## 1. Context and required reading

- `SPEC.md` + `nipxx.mjs` + `liverelay.mjs` in the protocol repo — reuse, never reimplement. Protocol is frozen; Noir is a pure client + one game-master service.
- `nvoy-spec.md` — the GM service reuses Nvoy's agent-side pattern (a keypair-holding service that issues/rotates grants and receives gift-wrapped messages). Read §5–6 there before writing `gm/`.
- `nvelope-spec.md` §2.1 — encrypted-blob pattern (Blossom) reused for imagery.
- Anthropic API docs (the GM's narrative engine) — streaming, system prompts, tool use for structured verdicts.
- Era touchstones for tone (do not quote or reproduce any of them): le Carré and Erik Larson for Berlin; boris-vian-era Saint-Germain jazz cellars for Paris; Chandler-in-the-swamp for New Orleans; Cormac McCarthy's borderlands register for the 1849 era. Homage targets: Zork, Oregon Trail (mechanical winks only — see §8; no copied text or assets).

## 2. Core loop and why the protocol IS the game

| Game concept | Protocol primitive |
|---|---|
| The case file, each dossier/clue/NPC record | kind-30440 scopes (opaque `d`), authored by the GM npub |
| Earning intel (solved puzzle, persuaded NPC) | kind-440 grant to the player |
| **Burn notice** (blown asset, betrayal, heat maxed) | scope-key rotation + kind-441 — the 441 renders in-game as an actual BURN NOTICE card |
| Your inventory / case notebook | your kind-10440 Grant Index — survives devices, recoverable from your nsec |
| Player actions, interrogation dialogue | gift-wrapped rumors to the GM npub |
| Leaking intel to another player | re-wrapping a scope key you hold — **possible by design**, exactly like real tradecraft; the GM can detect narrative consequences and burn what leaked |
| Case artwork | encrypted Blossom blobs granted with their scopes |

The symmetric-key "limitation" (a key holder can share the key) is embraced as the espionage mechanic: you *can* pass secrets, and the world *can* find out. This should be stated proudly in the design notes — the protocol's honest caveat becomes gameplay.

## 3. System components

```
noir/
├── client/                    # the player experience (web, vanilla ESM + one canvas/CSS3D module)
│   ├── index.html
│   ├── wheel.mjs              # the Wheel reading surface (§6)
│   ├── game.mjs               # command input, inventory (Grant Index view), case state
│   ├── art.mjs                # duotone image fetch/decrypt/present, era palettes
│   ├── burn.mjs               # burn-notice interstitials, death/failure cards
│   └── settings.mjs           # ncryptsec keys, relays, era select, accessibility
├── gm/                        # game-master service (Node/TS) — Nvoy-pattern agent
│   ├── src/
│   │   ├── identity.ts        # GM keypair per case-series
│   │   ├── director.ts        # Claude API narrative engine, era bibles as system prompts
│   │   ├── casegen.ts         # case graph generation from seed (§4), scope authoring
│   │   ├── verdict.ts         # puzzle-solution judging (structured tool-use output)
│   │   ├── grants.ts          # issue 440s, rotate/burn, 441 burn notices (via nipxx.mjs)
│   │   ├── heat.ts            # heat/tradecraft economy (§5.4)
│   │   ├── imagegen.ts        # duotone scene pipeline (§7)
│   │   └── lobby.ts           # multiplayer session assembly (§9)
│   └── README.md
├── eras/                      # era bibles (§10): tone, vocabulary, palette, puzzle flavor, historical guardrails
│   ├── berlin-1938.md
│   ├── paris-1954.md
│   ├── neworleans-1968.md
│   └── meridian-1849.md
├── lib/                       # vendored nipxx.mjs, liverelay.mjs
├── test/                      # smoke + e2e per protocol repo pattern
└── SECURITY.md                # what's provable (grants) vs. trusted (the GM), fair-play notes
```

Single-player needs only `client/` + one running `gm/` (hosted or `npx noir-gm --local`). Multiplayer adds nothing but the lobby.

## 4. Case generation (casegen.ts)

A case is a directed graph generated from a seed: nodes are scopes (dossiers, evidence, NPC files, locations), edges are unlock conditions (puzzle solved, NPC persuaded, item traded, timeline reconstructed). Generation rules:

1. **Deterministic skeleton, generative flesh.** The graph topology, solution, culprit, and puzzle answers are fixed at generation from the seed (fairness + testability + replay integrity). The prose, dialogue, and imagery are generated fresh by the director against that skeleton, so two players on the same seed face the same *case* but never the same *text*.
2. Every case has: an inciting scope (granted at start), 8–15 intermediate scopes, 2–4 red herrings, at least one **burnable asset** (an informant scope that heat or betrayal can destroy), and one endgame scope (the resolution dossier) gated on an accusation.
3. The GM pre-authors all scopes at case start (encrypted, published) — progression is purely grant issuance. This makes the "world" verifiable: a player can see (as opaque events) that the case existed before they acted. Publish a commitment hash of the solution in the case's public kind-0 note so post-game players can verify the GM didn't move the goalposts. **Fair-play property; test it.**
4. Solutions/keys never appear in director prompts sent near player-influenced text except when judging; judging uses structured tool output, not free prose, to prevent prompt-injected spoilers.

## 5. Puzzle mechanics (invented set for v1)

Every puzzle type keys to the era bible for flavor. Verdicts come from `verdict.ts` (exact-match or structured LLM judging with the skeleton answer as ground truth — never vibes).

1. **Ciphers of the period.** Book ciphers (page/line/word against an in-game text you've been granted), Vigenère with a keyword hidden in another dossier, radio number-station groups (Berlin), jazz set-list acrostics (Paris). Solving = submit plaintext to GM → grant.
2. **Cross-file corroboration.** The answer exists in no single scope: a name in dossier A + a date in dossier B + a photo detail in image C. Mechanically rewards actually reading; the accusation endgame is the big version of this.
3. **Interrogation.** Live dialogue with an NPC (director-driven, persona from the era bible, hidden disposition state). Persuade, bribe, or press — pressing too hard raises heat and can burn the informant (real rotation, permanent this run). Structured outcome: the NPC yields a grant, clams up, or burns.
4. **Dead drops & locations.** Free-text movement/examination commands parsed by the director against the location graph ("check the third pew," "ask the coat-check girl about the trumpet case"). Correct drop = grant. Wrong loitering = heat.
5. **Photo analysis.** A detail embedded in the generated duotone image (a reflected sign, a headline fragment, wrong-era wristwatch) is the answer; the image is the puzzle. `imagegen.ts` must composite these details deterministically over the generated art (overlay layer), never rely on the model to render text exactly.
6. **Timeline reconstruction.** Order 5–8 event fragments; submit the sequence.
7. **Tail / counter-surveillance minigame** (drum-native): moving text on the Wheel where you flag the recurring stranger across three scenes.
8. **The Accusation.** Endgame: name culprit + motive + evidence chain (pick the supporting scope IDs from your notebook). Correct → resolution grant + epilogue. Wrong → consequences per era (not always death — sometimes the wrong man hangs and you live with the epilogue).

### 5.4 Heat (the economy)
One meter, 0–100, GM-side authoritative. Loud actions raise it (failed bribes, forced locks, pressed interrogations, leaked intel discovered); tradecraft lowers it (laying low costs in-game days, safe-house scope). Thresholds: 60 = tail acquired (surveillance minigame triggers), 80 = an asset burns (GM rotates the most-exposed informant scope, 441 burn-notice card), 100 = case ends (era-flavored failure). Heat makes rotation a *pacing tool*, not just a punishment.

## 6. The Wheel (the reading surface — core UX, not decoration)

Text lives on a virtual drum ~25 feet in diameter that the player rotates through a fixed viewing window:

- **Geometry:** CSS 3D (or Canvas fallback) cylinder, axis horizontal, face toward the viewer. Only ~7–9 lines occupy the legible band. Lines rise from the lower edge (or descend — user setting), passing through: transparent → dim → **full white at the focal line** → dim → transparent. Opacity and slight scale/blur follow the cylinder's curvature so text visibly *wraps away* top and bottom.
- **Input:** scroll wheel / trackpad / touch drag / ↑↓ rotate the drum with momentum and gentle detents at paragraph boundaries. Space = advance one beat. New GM text arrives onto the drum from below with a soft mechanical settle; the drum never scrolls jarringly on its own.
- **The command line** sits fixed beneath the window, era-styled (typewriter, telegraph, teletype per era), with a blinking block cursor. Player input gets typed onto the drum as part of the transcript — the case file is one continuous reel you can rotate back through (full session history lives on the drum; rotating far back is how you re-read).
- **Imagery integration:** the duotone scene renders as a full-bleed backdrop *behind* the drum at low luminance; on image-reveal beats the drum parts (text fades to edges) and the image comes forward for inspection (pan/zoom for photo-analysis puzzles), then recedes.
- **Type:** era-appropriate faces (spec candidates: Special Elite / typewriter for Berlin & Meridian, a grotesque for Paris, a slab for New Orleans) — licensing-checked webfonts, one per era, plus a monospace fallback.
- **Accessibility is non-negotiable:** a "flat mode" toggle rendering the identical transcript as plain scrollable text (motion-sensitivity + screen readers), reduced-motion media query honored by default, and all imagery carrying generated alt text.
- Performance budget: 60fps on a mid-tier phone; degrade curvature effects before frame rate.

## 7. Duotone imagery (art.mjs + imagegen.ts)

- One signature color per era over near-black: **Berlin = sepia**, **Paris = smoky blue**, **New Orleans = swamp green**, **Meridian = bone-white**. Palette constants live in the era bibles and drive UI chrome, drum focal-line tint, and image treatment alike — the era IS a color.
- Pipeline: director emits a scene brief → image model generates grayscale-biased art → `imagegen.ts` post-processes deterministically: grayscale → tone-curve → duotone map to the era color → grain + vignette. Post-processing in code guarantees palette consistency regardless of model drift; never ship raw model output.
- Puzzle details (§5.5) composited as a deterministic overlay layer.
- Storage: encrypted to the owning scope's key, on Blossom (Nvelope pattern); granted with the scope. Art is *intel* — it obeys the same access control as text, and a burned scope's images burn with it.
- Image model choice is an open decision (§13); the interface is a single `generateScene(brief, era)` seam so the backend is swappable.

## 8. Homages (winks, never reproductions)

Rules: mechanical and referential nods only; no copied text, assets, or protected expression; each fires once per case at most, discoverable not intrusive.

- A **brass lantern** appears as a findable item in every era's junk drawer; carrying it prevents one specific darkness mishap.
- Entering an unlit space without light: an original two-line warning about something hungry in the dark (evoking, never quoting, the grue).
- `xyzzy` as a command: the GM breaks the fourth wall for one dry line, then never again.
- A hidden `west` response in each era's opening location.
- **Meridian era runs an Oregon Trail-shaped overland layer:** provisioning choices, river crossings, party health — and yes, one possible failure card reading simply "You have died of dysentery." (Short factual phrase, fine to use; the surrounding card design must be original.)
- Save-file naming UI offers "LOAD GAME / SAVE GAME" in period teletype caps.

## 9. Multiplayer (M6 — design now, build last)

- 2–4 players join a lobby (GM-issued session scope). `casegen` deals **complementary fragments**: each player's starting grants overlap ~30% and no player's reachable subgraph contains the full accusation chain — cooperation or theft is mandatory.
- **Player-to-player trades:** re-wrap a scope key to another player (a 440 they issue). First-class UI ("pass the dossier across the table").
- **Leak detection:** scopes carry per-player watermark fields (each player's copy of certain facts differs in planted micro-details); when leaked intel surfaces in another player's GM interactions, the GM knows who leaked, and the world reacts — the leaked asset burns for everyone, and the leaker gains a reputation flag NPCs respond to.
- **Betrayal:** informing the GM on another player lowers your heat and raises theirs. The endgame accusation can be filed solo (winner-take-credit) or jointly (shared epilogue).
- Sessions are asynchronous-friendly (nostr's natural grain): the case doesn't require simultaneity, and the GM narrates elapsed time.

## 10. Era bibles (`eras/*.md` — write these as real documents, ~2 pages each)

Each bible: tone & vocabulary guardrails for the director; palette + type; period texture (locations, sounds, objects); puzzle-flavor mapping; NPC archetypes; historical sensitivity notes; failure-card styles. Premises:

1. **Berlin 1938 — "The Last Visa."** Exit papers, embassy queues, a courier who didn't arrive. Paranoia as weather. Sensitivity note: the era's persecution is context handled with gravity, never set-dressing for camp; the bible sets those lines explicitly.
2. **Paris 1954 — "The Blue Cellar."** Saint-Germain jazz caves, a horn player with two passports, seduction and double agents, smoke you can taste.
3. **New Orleans 1968 — "Vieux Carré."** A vice cop on the take, a missing photographer, river humidity, hanging vines, café au lait at dawn as a dead drop.
4. **West Texas 1849 — "The Meridian."** A bounty company's ledger doesn't add up. Borderland dread, bone-white light, the overland survival layer (§8). McCarthy register: spare, biblical, violent offstage more than on.

## 11. Milestones (each independently demoable)

- **M1 — The Wheel + a canned case.** Full drum UX (§6) with flat-mode fallback, command line, one hand-authored Berlin mini-case (5 scopes) served by a stub GM over the real protocol (grants, one scripted burn). Acceptance: the reading experience sells the game with zero AI; burn notice renders as a 441.
- **M2 — Protocol depth.** Grant-Index-as-notebook, device recovery mid-case from nsec, fair-play commitment hash verified post-game, heat economy with authoritative GM state.
- **M3 — The Director.** Claude-driven narrative + interrogations against the Berlin bible; casegen graphs from seeds; structured verdicts; puzzle types 1–4, 6, 8. Acceptance: two playthroughs of one seed share the solution but not a sentence of prose.
- **M4 — Imagery.** Duotone pipeline, encrypted Blossom delivery, photo-analysis puzzles (type 5), drum/image reveal choreography.
- **M5 — Four eras + homages.** Remaining bibles, era theming end-to-end, Meridian overland layer, easter eggs, surveillance minigame (type 7).
- **M6 — Multiplayer.** Lobby, fragment dealing, trades, watermark leak detection, betrayal, joint/solo endgames.

## 12. Testing, safety, non-goals

- Protocol smoke tests per repo pattern; adversarial observer assertions (a relay watcher learns nothing about case structure or player progress).
- **Fair-play tests:** solution commitment verifies; a spoiler-hunting prompt-injection suite against interrogation NPCs must never extract skeleton answers.
- Determinism tests: same seed → same graph/solution across runs.
- Content guardrails live in the era bibles + director system prompt: period-authentic darkness without gratuitous cruelty; the game renders violence noir-style (implication, aftermath) — spec this as prompt policy with tests.
- Non-goals v1: no real-money anything, no persistent MMO world, no user-generated cases (v2 candidate: community case-authoring is a natural fit since a case is just scopes + a skeleton), no native mobile apps (responsive web).

## 13. Open decisions for the human

1. GM hosting model: hosted service (cases-as-a-service, natural business seam) vs. local-first `npx noir-gm` (pure, but each player runs their own AI keys). Proposal: both; local-first for devs, hosted for players.
2. Image backend for `generateScene` (quality vs. cost vs. self-hostability) and per-case image budget.
3. Whether the notebook UI exposes raw protocol artifacts (kind numbers, event IDs) as a "tradecraft view" for the nostr-dev audience — proposal: yes, as a toggle; it's the best NIP-DA demo ever if visible.
4. Case pricing/length target for v1 (proposal: 60–90 minute single-player cases).
5. Era 1 for M3: Berlin (proposed, richest spy grammar) vs. New Orleans (most forgiving tonally); see §10.
