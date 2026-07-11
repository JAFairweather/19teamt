// art.mjs — era palettes and the duotone treatment (spec §7).
//
// The era IS a color: one signature tone over near-black drives UI chrome,
// the drum's focal tint, and image treatment alike. Palette constants mirror
// the era bibles (eras/*.md) — change them there first.
//
// duotone() is the deterministic post-process seam: grayscale → tone curve →
// duotone map → grain + vignette. Never ship raw model output (M4).

export const ERAS = {
  'berlin-1938': {
    label: 'Berlin 1938 — The Last Visa',
    accent: '#c39a56',            // sepia
    accentDim: '#6b5530',
    ink: '#0a0806',
    font: "'Special Elite', 'Courier New', monospace",
  },
  'paris-1954': {
    label: 'Paris 1954 — The Blue Cellar',
    accent: '#7da7c7',            // smoky blue
    accentDim: '#3d5a70',
    ink: '#06080a',
    font: "'Archivo', 'Helvetica Neue', sans-serif",
  },
  'neworleans-1968': {
    label: 'New Orleans 1968 — Vieux Carré',
    accent: '#7fa06f',            // swamp green
    accentDim: '#42553a',
    ink: '#070a06',
    font: "'Zilla Slab', 'Georgia', serif",
  },
  'meridian-1849': {
    label: 'West Texas 1849 — The Meridian',
    accent: '#e6e1d3',            // bone-white
    accentDim: '#8a867c',
    ink: '#080807',
    font: "'Special Elite', 'Courier New', monospace",
  },
}

export function applyEra(eraId) {
  const era = ERAS[eraId] ?? ERAS['berlin-1938']
  const root = document.documentElement
  root.style.setProperty('--accent', era.accent)
  root.style.setProperty('--accent-dim', era.accentDim)
  root.style.setProperty('--ink', era.ink)
  root.style.setProperty('--era-font', era.font)
  return era
}

/**
 * Deterministic duotone post-process for case imagery (M4 seam, working now).
 * Takes anything drawable (ImageBitmap, <img>, canvas), returns a canvas
 * mapped to the era's tone over near-black, with grain and vignette.
 */
export function duotone(source, eraId, { grain = 0.06 } = {}) {
  const era = ERAS[eraId] ?? ERAS['berlin-1938']
  const [r2, g2, b2] = hex(era.accent)
  const [r1, g1, b1] = hex(era.ink)
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    y = y * y * (3 - 2 * y)                             // tone curve: crush + lift
    const n = (Math.random() - 0.5) * grain             // grain
    const t = Math.min(1, Math.max(0, y + n))
    d[i] = r1 + (r2 - r1) * t
    d[i + 1] = g1 + (g2 - g1) * t
    d[i + 2] = b1 + (b2 - b1) * t
  }
  ctx.putImageData(img, 0, 0)
  // vignette
  const g = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
