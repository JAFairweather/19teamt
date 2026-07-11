// wheel.mjs — the Wheel (spec §6): the reading surface, not decoration.
//
// The transcript lives on a virtual drum, axis horizontal, rotated through a
// fixed viewing window. Lines pass transparent → dim → full white at the
// focal line → dim → transparent, with slight scale/blur following the
// curvature. The whole session history stays on the drum; rotating far back
// is how you re-read.
//
// Flat mode renders the identical transcript as plain scrollable text and is
// the default under prefers-reduced-motion. Same data, same order, always.

const STEP_DEG = 4.6            // angular distance between lines
const RADIUS = 460              // px — big drum, gentle curvature
const VISIBLE_DEG = 34          // cull beyond this
const FRICTION = 0.94
const DETENT_PULL = 0.12        // gentle snap toward paragraph boundaries

export class Wheel {
  constructor(drumEl, flatEl) {
    this.drum = drumEl
    this.flat = flatEl
    this.lines = []               // { text, cls, el, flatEl, para }
    this.rotation = 0             // degrees; line i sits at i * STEP_DEG
    this.velocity = 0
    this.paraStarts = [0]
    this.flatMode = false
    this._raf = null
    this._bindInput()
    this._tick = this._tick.bind(this)
    requestAnimationFrame(this._tick)
  }

  get tail() { return Math.max(0, this.lines.length - 1) * STEP_DEG }
  atTail() { return this.rotation > this.tail - STEP_DEG * 3.5 }

  setFlatMode(on) {
    this.flatMode = on
    this.drum.parentElement.classList.toggle('hidden', on)
    this.flat.classList.toggle('hidden', !on)
    if (on) this.flat.scrollTop = this.flat.scrollHeight
    else this._renderAll()
  }

  /** Append a block of text. Each block is one paragraph detent. */
  append(text, cls = '') {
    const wasAtTail = this.atTail() || this.lines.length === 0
    this.paraStarts.push(this.lines.length)
    for (const raw of String(text).split('\n')) {
      const line = { text: raw, cls, para: this.paraStarts.length - 1 }
      line.el = document.createElement('div')
      line.el.className = `drum-line ${cls}`
      line.el.textContent = raw || ' '
      this.drum.appendChild(line.el)
      line.flatEl = document.createElement('div')
      line.flatEl.className = `flat-line ${cls}`
      line.flatEl.textContent = raw || ' '
      this.flat.appendChild(line.flatEl)
      this.lines.push(line)
    }
    if (this.flatMode) {
      this.flat.scrollTop = this.flat.scrollHeight
    } else if (wasAtTail) {
      // New text settles in from below; ease the reader to it, never yank.
      this._target = this.tail
    }
    this._renderAll()
  }

  /** Space bar: advance one beat (next paragraph boundary). */
  advanceBeat() {
    if (this.flatMode) { this.flat.scrollTop += this.flat.clientHeight * 0.7; return }
    const cur = this.rotation / STEP_DEG
    const next = this.paraStarts.find(p => p > cur + 0.01)
    this._target = (next ?? this.lines.length - 1) * STEP_DEG
  }

  _bindInput() {
    const stage = this.drum.parentElement
    stage.addEventListener('wheel', (e) => {
      if (this.flatMode) return
      e.preventDefault()
      this._target = null
      this.velocity += e.deltaY * 0.012
    }, { passive: false })

    let touchY = null
    stage.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY }, { passive: true })
    stage.addEventListener('touchmove', (e) => {
      if (touchY == null || this.flatMode) return
      this._target = null
      this.velocity += (touchY - e.touches[0].clientY) * 0.03
      touchY = e.touches[0].clientY
    }, { passive: true })
    stage.addEventListener('touchend', () => { touchY = null })

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && !['ArrowUp', 'ArrowDown'].includes(e.key)) return
      if (e.key === 'ArrowUp') { this._target = null; this.velocity -= 1.4 }
      if (e.key === 'ArrowDown') { this._target = null; this.velocity += 1.4 }
    })
  }

  _tick() {
    if (!this.flatMode && this.lines.length) {
      if (this._target != null) {
        // Eased travel toward a requested position (new text, Space beat).
        const d = this._target - this.rotation
        if (Math.abs(d) < 0.05) { this.rotation = this._target; this._target = null }
        else this.rotation += d * 0.09
        this._renderAll()
      } else if (Math.abs(this.velocity) > 0.002) {
        this.rotation += this.velocity
        this.velocity *= FRICTION
        // Gentle detent at paragraph boundaries once momentum is nearly spent.
        if (Math.abs(this.velocity) < 0.25) {
          const nearest = Math.round(this.rotation / STEP_DEG) * STEP_DEG
          this.rotation += (nearest - this.rotation) * DETENT_PULL
        }
        this.rotation = Math.max(0, Math.min(this.tail + STEP_DEG, this.rotation))
        this._renderAll()
      }
    }
    this._raf = requestAnimationFrame(this._tick)
  }

  _renderAll() {
    for (let i = 0; i < this.lines.length; i++) {
      const delta = i * STEP_DEG - this.rotation      // angular distance from focal line
      const el = this.lines[i].el
      if (Math.abs(delta) > VISIBLE_DEG) {
        if (el.style.display !== 'none') el.style.display = 'none'
        continue
      }
      const t = Math.abs(delta) / VISIBLE_DEG          // 0 at focus → 1 at edge
      el.style.display = ''
      el.style.transform =
        `rotateX(${-delta}deg) translateZ(${RADIUS}px) scale(${1 - t * 0.06})`
      el.style.opacity = (1 - t) ** 1.6
      el.style.filter = t > 0.45 ? `blur(${(t - 0.45) * 2.2}px)` : ''
      el.classList.toggle('focal', Math.abs(delta) < STEP_DEG * 0.55)
    }
  }
}
