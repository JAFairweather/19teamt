// settings.mjs — keys, era, accessibility (spec §3).
//
// M1 honesty note: the player key is stored as plain hex in localStorage.
// M2 replaces this with NIP-49 ncryptsec at rest behind a passphrase, per
// family convention (Nontact/Nvelope). Do not ship M2 without that.

import { generateSecretKey, getPublicKey } from 'nostr-tools'

const KEY = 'noir.player.sk'
const FLAT = 'noir.flatmode'
const ERA = 'noir.era'

const toHex = (b) => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h) => Uint8Array.from(h.match(/../g), x => parseInt(x, 16))

export function getOrCreatePlayerKey() {
  let hex = localStorage.getItem(KEY)
  if (!hex) {
    hex = toHex(generateSecretKey())
    localStorage.setItem(KEY, hex)
  }
  const sk = fromHex(hex)
  return { sk, pub: getPublicKey(sk) }
}

export function resetPlayerKey() {
  localStorage.removeItem(KEY)
  return getOrCreatePlayerKey()
}

/** Flat mode defaults ON under prefers-reduced-motion; user choice wins. */
export function getFlatMode() {
  const saved = localStorage.getItem(FLAT)
  if (saved != null) return saved === '1'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
export function setFlatMode(on) { localStorage.setItem(FLAT, on ? '1' : '0') }

export function getEra() { return localStorage.getItem(ERA) ?? 'berlin-1938' }
export function setEra(era) { localStorage.setItem(ERA, era) }
