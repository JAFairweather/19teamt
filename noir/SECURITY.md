# Noir — Security & Fair-Play Notes

Noir is a game built directly on NIP-DA Scoped Data Grants. Its security
story splits cleanly into what is **provable** (cryptography) and what is
**trusted** (the GM). Stating that split honestly is a product requirement,
same as the sibling apps.

## Provable (the protocol)

- **Your notebook is yours.** Grants are kind-440 rumors gift-wrapped to your
  pubkey; the kind-10440 Grant Index is NIP-44 encrypted to yourself. Both are
  recoverable from your nsec alone, on any device, mid-case.
- **The world pre-exists your moves.** All case scopes are published
  (encrypted) before play begins. Relays timestamp them; you can see the
  opaque events existed before you acted.
- **The GM can't move the goalposts.** A sha256 commitment to the skeleton
  solution is published in the case's public kind-0 before the first grant.
  Post-game, the GM reveals the canonical solution string; anyone can hash it
  and compare. `test/smoke.mjs` exercises this.
- **A burn is real.** A burned asset is a scope-key rotation you were excluded
  from, plus a kind-441 notice. Your old key genuinely stops decrypting future
  generations. No flag on a server — arithmetic.
- **Relays learn almost nothing.** Ciphertext scopes with opaque `d` tags,
  gift-wrapped grants under ephemeral keys. The smoke test asserts an
  adversarial observer sees no case secrets and cannot distinguish
  grant traffic from any other wrapped mail.

## Trusted (the GM)

- **The GM holds the case keys.** It authored every scope; it can read them
  all, decide verdicts, and time grants. That is what a game master *is*. The
  commitment hash bounds the trust: the GM can be unfair in tone, but not
  swap the culprit after the fact.
- **Heat is GM-side authoritative state.** You can verify what you were
  granted; you take the meter's word for why.
- **Verdicts on free-text puzzles** (M3+) come from structured LLM judging
  against the fixed skeleton answer — never vibes — but judging quality is a
  trust surface, not a proof.

## Embraced caveat — the espionage mechanic

The protocol's honest limitation is that a symmetric key holder can share the
key. Noir does not paper over this: **leaking intel is gameplay** (spec §2,
§9). You *can* re-wrap a scope key to another player, exactly like real
tradecraft, and the world *can* find out — multiplayer scopes carry
per-player watermark details, so surfaced leaks identify the leaker and burn
the asset for everyone. A revoked player keeps what they already read; so
does a revoked spy. That parallel is the design.

## Player-facing honesty requirements

The client must say plainly, where it matters:

1. A burned scope stays readable exactly as far as you already read it.
2. Losing your nsec loses the notebook — there is no account recovery,
   because there is no account. (M2 adds NIP-49 passphrase encryption at
   rest; until then the demo stores a hot key in localStorage and says so.)
3. Relays see traffic metadata (IPs, timing). Noir is a game, not an
   operational security tool; do not use game keys for anything real.

## Reporting

Protocol issues belong upstream in `nostr-scoped-data-grants`. Game-layer
issues (spoiler extraction, verdict gaming, watermark defeats) are in scope
here — open an issue with reproduction steps. Prompt-injection reports
against interrogation NPCs are especially welcome; the M3 test suite
(spec §12) will regression-test every one we accept.
