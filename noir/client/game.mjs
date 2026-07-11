// game.mjs — command input, notebook (Grant Index view), case state (spec §3).
//
// M1 runs in demo mode: an in-memory relay and the stub GM live in-page, so
// the whole game — scopes, grants, burns — is real protocol traffic you can
// inspect, with zero infrastructure. Pointing this at LiveRelay + a remote
// GM (M2/M3) changes the transport, not this file's logic.

import { Relay } from '../lib/relay.mjs'
import { receiveGrants, latestGrants, fetchScope } from '../lib/nipxx.mjs'
import {
  sendFieldReport, receiveRumors, KIND_GM_DISPATCH, KIND_BURN_NOTICE,
} from '../shared/wrap.mjs'
import { StubGM } from '../gm/stubgm.mjs'
import * as berlin from '../gm/cases/berlin-minicase.mjs'
import { Wheel } from './wheel.mjs'
import { applyEra } from './art.mjs'
import { showBurnCard, showEndCard } from './burn.mjs'
import { getOrCreatePlayerKey, getFlatMode, setFlatMode, getEra } from './settings.mjs'

const $ = (sel) => document.querySelector(sel)

const era = applyEra(getEra())
const { sk: playerSk, pub: playerPub } = getOrCreatePlayerKey()

const relay = new Relay()
const gm = new StubGM(relay, berlin)

const wheel = new Wheel($('#drum'), $('#flat'))
wheel.setFlatMode(getFlatMode())
$('#flat-toggle').checked = getFlatMode()

const seen = new Set()          // wrap ids already rendered
const knownScopes = new Set()   // scopeIds already announced on the drum
let gameOver = false

// ---------------------------------------------------------------- notebook

async function refreshNotebook() {
  const grants = latestGrants(await receiveGrants(relay, playerSk))
  const list = $('#notebook-list')
  list.innerHTML = ''
  for (const g of grants) {
    const res = await fetchScope(relay, g)
    const li = document.createElement('li')
    li.className = res.status === 'ok' ? 'scope-ok' : 'scope-stale'
    li.innerHTML = `<span class="scope-name"></span><span class="scope-status">${res.status === 'ok' ? '' : 'BURNED'}</span>`
    li.querySelector('.scope-name').textContent = g.scopeName ?? g.scopeId
    if (res.status === 'ok') {
      li.title = 'Read on the drum'
      li.addEventListener('click', () => {
        wheel.append(`— ${res.data.title ?? g.scopeName} —`, 'doc-title')
        wheel.append(res.data.body ?? '', 'doc')
      })
    } else {
      li.title = 'Key rotated past your grant. You keep what you already read.'
    }
    list.appendChild(li)
  }
  $('#heat-value').textContent = gm.heat
  $('#heat-lamp').style.setProperty('--heat', gm.heat / 100)
  return grants
}

// ------------------------------------------------------------ GM mail sync

async function syncFromGM() {
  const rumors = await receiveRumors(relay, playerSk, [KIND_GM_DISPATCH, KIND_BURN_NOTICE])
  for (const r of rumors) {
    if (seen.has(r._wrapId)) continue
    seen.add(r._wrapId)
    if (r.kind === KIND_BURN_NOTICE) {
      const { reason } = JSON.parse(r.content)
      const scopeId = r.tags.find(t => t[0] === 'a')?.[1].split(':')[2]
      const grants = latestGrants(await receiveGrants(relay, playerSk))
      const scopeName = grants.find(g => g.scopeId === scopeId)?.scopeName
      wheel.append(`■ BURN NOTICE — ${scopeName ?? 'asset'} ■`, 'burn-line')
      showBurnCard({ scopeName, reason })
    } else {
      const { text, granted, ended } = JSON.parse(r.content)
      wheel.append(text, 'gm')
      if (ended) {
        gameOver = true
        if (ended !== 'solved') showEndCard({ ended })
        else setTimeout(async () => {
          // surface the epilogue automatically on a win
          const grants = latestGrants(await receiveGrants(relay, playerSk))
          for (const g of grants) {
            const res = await fetchScope(relay, g)
            if (res.status === 'ok' && res.data.kind === 'epilogue') {
              wheel.append(`— ${res.data.title} —`, 'doc-title')
              wheel.append(res.data.body, 'doc')
            }
          }
          showEndCard({ ended })
        }, 600)
      }
    }
  }
  // Announce newly granted scopes on the drum and open them.
  const grants = latestGrants(await receiveGrants(relay, playerSk))
  for (const g of grants) {
    if (knownScopes.has(g.scopeId)) continue
    knownScopes.add(g.scopeId)
    const res = await fetchScope(relay, g)
    if (res.status !== 'ok') continue
    wheel.append(`▸ GRANT RECEIVED — ${g.scopeName} (kind-440)`, 'grant-line')
    wheel.append(`— ${res.data.title ?? g.scopeName} —`, 'doc-title')
    wheel.append(res.data.body ?? '', 'doc')
  }
  await refreshNotebook()
}

// ---------------------------------------------------------------- commands

async function submit(text) {
  if (!text.trim() || gameOver) return
  wheel.append(`> ${text}`, 'player')
  await sendFieldReport(relay, playerSk, gm.pub, text, berlin.CASE_ID)
  await gm.poll()               // demo mode: the GM lives in-page
  await syncFromGM()
}

const input = $('#cmd')
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = input.value
    input.value = ''
    submit(text)
  }
})
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && document.activeElement !== input) {
    e.preventDefault()
    wheel.advanceBeat()
  } else if (e.key.length === 1 && document.activeElement !== input) {
    input.focus()
  }
})

$('#flat-toggle').addEventListener('change', (e) => {
  setFlatMode(e.target.checked)
  wheel.setFlatMode(e.target.checked)
})

// ------------------------------------------------------------------- start

$('#era-label').textContent = era.label
wheel.append('N O I R', 'title-line')
wheel.append('Cases you unlock. Assets you burn.', 'gm dim')
await gm.start(playerPub)
await syncFromGM()
input.focus()
