// stubgm.mjs — the M1 game master: no AI, real protocol.
//
// Serves a hand-authored case (gm/cases/*) over NIP-DA exactly the way the
// full director will (spec §3, §11 M1): every dossier is a kind-30440 scope
// published before play begins, progression is kind-440 grant issuance,
// a burned informant is a genuine key rotation plus a kind-441 burn notice.
// The only thing stubbed is the writer in the chair — responses are scripted.
//
// Runs identically in Node (tests) and the browser (demo mode), because the
// relay interface is just { publish, query } per lib/nipxx.mjs.

import { getPublicKey, generateSecretKey, finalizeEvent } from 'nostr-tools'
import { newScopeKey, publishScope, grant, rotateScope } from '../lib/nipxx.mjs'
import {
  KIND_FIELD_REPORT, receiveRumors, sendDispatch, sendBurnNotice,
} from '../shared/wrap.mjs'

const normalize = (text) => text.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

async function sha256hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const randomScopeId = () => 's' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => (b % 36).toString(36)).join('')

export class StubGM {
  constructor(relay, caseModule, gmSecret = generateSecretKey()) {
    this.relay = relay
    this.case = caseModule
    this.secret = gmSecret
    this.pub = getPublicKey(gmSecret)
    // per-scope wire state: opaque id, key, generation
    this.scopes = new Map()
    this.unlocked = new Set()
    this.burned = new Set()
    this.heat = 0
    this.over = false
    this.seenReports = new Set()
  }

  /** Author the whole world up front (§4.3), commit to the solution, deal the inciting grant. */
  async start(playerPub) {
    this.playerPub = playerPub
    for (const [name, def] of Object.entries(this.case.scopes)) {
      const wire = { scopeId: randomScopeId(), generation: 1, scopeKey: newScopeKey() }
      this.scopes.set(name, wire)
      await publishScope(this.relay, this.secret, {
        ...wire,
        payload: { name: def.name, ...def.payload },
      })
    }
    // Fair-play commitment in the case's public kind-0 (§4.3).
    const commitment = await sha256hex(this.case.solutionCommitment.canonical())
    const profile = finalizeEvent({
      kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [],
      content: JSON.stringify({
        name: `Noir GM — ${this.case.CASE_ID}`,
        about: 'Game master for a Noir case. All scopes pre-authored; solution committed below.',
        noir: { case: this.case.CASE_ID, era: this.case.ERA, solution_commitment: commitment },
      }),
    }, this.secret)
    await this.relay.publish(profile)

    await this.grantScope('briefing')
    await this.dispatch(this.case.opening)
    return { gmPub: this.pub, commitment }
  }

  async grantScope(name) {
    const wire = this.scopes.get(name)
    const def = this.case.scopes[name]
    this.unlocked.add(name)
    await grant(this.relay, this.secret, this.playerPub, { ...wire, scopeName: def.name })
  }

  dispatch(text, extra = {}) {
    return sendDispatch(this.relay, this.secret, this.playerPub, {
      caseId: this.case.CASE_ID, text, extra: { heat: this.heat, ...extra },
    })
  }

  /** Burn a scope for real: rotate the key past the player, then say so with a 441. */
  async burn(name, reason) {
    const wire = this.scopes.get(name)
    const def = this.case.scopes[name]
    const { generation } = await rotateScope(this.relay, this.secret, {
      scopeId: wire.scopeId, generation: wire.generation,
      payload: { name: def.name, ...def.payload },
      scopeName: def.name, survivors: [],   // no survivors: the player is cut off
    })
    wire.generation = generation
    this.burned.add(name)
    await sendBurnNotice(this.relay, this.secret, this.playerPub, {
      scopeId: wire.scopeId, generation, reason,
    })
  }

  addHeat(n) {
    this.heat = Math.min(this.case.heat.max, this.heat + n)
  }

  /** Read new field reports off the relay and play the case forward. */
  async poll() {
    if (this.over) return
    const reports = await receiveRumors(this.relay, this.secret, [KIND_FIELD_REPORT])
    for (const report of reports) {
      if (this.seenReports.has(report._wrapId)) continue
      this.seenReports.add(report._wrapId)
      await this.handle(report.content)
      if (this.over) break
    }
  }

  async handle(text) {
    const t = normalize(text)
    if (!t) return

    // Homage winks (§8) — one dry line each, never load-bearing.
    if (t === 'XYZZY') {
      return this.dispatch('Nothing happens. This is not that kind of cave, agent. It was worth trying exactly once.')
    }
    if (t === 'WEST' && this.unlocked.size === 1) {
      return this.dispatch('West of here the boulevard runs toward the Tiergarten, black branches over black water. Station did not send you here to admire it.')
    }

    // The accusation endgame (§5.8).
    if (t.startsWith('ACCUSE')) return this.accuse(t)

    // Scripted burn trigger: pressing the informant (§5.3).
    const press = this.case.burnTriggers.press
    if (this.unlocked.has(press.scope) && !this.burned.has(press.scope) && press.match(t)) {
      this.addHeat(this.case.heat.pressedInterrogation)
      await this.burn(press.scope, press.reason)
      await this.dispatch(press.response, { burned: press.scope })
      return this.checkHeat()
    }

    // Unlock edges, in order; first match on an available edge wins.
    for (const edge of this.case.edges) {
      if (this.unlocked.has(edge.to)) continue
      if (!edge.requires.every(r => this.unlocked.has(r))) continue
      if (edge.match(t)) {
        await this.grantScope(edge.to)
        return this.dispatch(edge.response, { granted: edge.to })
      }
    }

    // No edge matched: the city notices people who ask the wrong questions.
    this.addHeat(this.case.heat.wrongAnswer)
    await this.dispatch(
      'Nothing gives. A doorman remembers your face; somewhere a telephone is lifted and set down again. (Heat rises.)',
    )
    return this.checkHeat()
  }

  async accuse(t) {
    const { culprit, wrong, unlocks, correctResponse, wrongResponse } = this.case.accusation
    if (t.includes(culprit)) {
      await this.grantScope(unlocks)
      this.over = true
      return this.dispatch(correctResponse, { granted: unlocks, ended: 'solved' })
    }
    const named = wrong.find(w => t.includes(w)) ?? 'the wrong man'
    this.over = true
    return this.dispatch(wrongResponse(named), { ended: 'failed' })
  }

  async checkHeat() {
    const { press, heatThreshold, heatReason } = this.case.burnTriggers
    if (this.heat >= heatThreshold && this.unlocked.has(press.scope) && !this.burned.has(press.scope)) {
      await this.burn(press.scope, heatReason)
      await this.dispatch('Word reaches you sideways: your one pair of eyes has gone dark. The city closed over her like water.', { burned: press.scope })
    }
    if (this.heat >= this.case.heat.max) {
      this.over = true
      await this.dispatch(
        'A car with its lights off has been outside for an hour. Station orders you across the border by the milk train. The case stays open; you do not.',
        { ended: 'heat' },
      )
    }
  }
}
