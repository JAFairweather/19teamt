// smoke.mjs — Noir M1 smoke test, patterned after the protocol repo.
//
//   node test/smoke.mjs          # in-memory relay (CI-safe, no network)
//
// Plays "The Last Visa (mini)" end to end over the real protocol:
// pre-authored world, grant-driven progression, a genuine burn (rotation +
// 441), fair-play commitment verification, and an adversarial observer check.

import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { Relay } from '../lib/relay.mjs'
import { receiveGrants, latestGrants, fetchScope } from '../lib/nipxx.mjs'
import { sendFieldReport, receiveRumors, KIND_GM_DISPATCH, KIND_BURN_NOTICE } from '../shared/wrap.mjs'
import { StubGM } from '../gm/stubgm.mjs'
import * as berlin from '../gm/cases/berlin-minicase.mjs'

let passed = 0, failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`)
  ok ? passed++ : failed++
}

const sha256hex = async (str) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const relay = new Relay()
const player = generateSecretKey()
const playerPub = getPublicKey(player)
const gm = new StubGM(relay, berlin)

const notebook = async () => latestGrants(await receiveGrants(relay, player))
const readable = async () => {
  const out = []
  for (const g of await notebook()) {
    const res = await fetchScope(relay, g)
    out.push({ ...g, ...res })
  }
  return out
}
const say = async (text) => {
  await sendFieldReport(relay, player, gm.pub, text, berlin.CASE_ID)
  await gm.poll()
}

console.log('\n1. GM authors the world before play')
const { commitment } = await gm.start(playerPub)
const worldEvents = relay.query({ kinds: [30440] })
check('all five scopes published as 30440 before first command', worldEvents.length === 5)
check('inciting grant received', (await notebook()).length === 1)
check('briefing decrypts', (await readable())[0]?.data?.title?.includes('BRIEFING'))

console.log('\n2. Fair-play commitment')
check('kind-0 carries solution commitment', (() => {
  const [profile] = relay.query({ kinds: [0], authors: [gm.pub] })
  return JSON.parse(profile.content).noir.solution_commitment === commitment
})())
check('commitment matches the skeleton solution', commitment === await sha256hex(berlin.solutionCommitment.canonical()))

console.log('\n3. Progression is grant issuance')
await say('The intercept decodes to zoo locker nine. Going there now.')
check('cipher answer grants the locker scope', (await notebook()).length === 2)
await say('completely wrong nonsense answer')
check('wrong answer raises heat, grants nothing', gm.heat === berlin.heat.wrongAnswer && (await notebook()).length === 2)
await say('Take the cloakroom ticket to Josty and ask Adler about Weiss')
check('informant scope granted', (await notebook()).length === 3)
const adlerBefore = (await readable()).find(s => s.data?.kind === 'npc')
check('informant statement decrypts', adlerBefore?.status === 'ok')

console.log('\n4. The burn is a real rotation + 441')
await say('press Adler for the name')
const afterBurn = await readable()
const adlerAfter = afterBurn.find(g => g.scopeId === adlerBefore.scopeId)
check('burned scope reads STALE with the old key', adlerAfter.status === 'stale')
const burns = await receiveRumors(relay, player, [KIND_BURN_NOTICE])
check('kind-441 burn notice delivered', burns.length === 1 && JSON.parse(burns[0].content).reason.includes('pressed'))
check('441 addresses the rotated scope', burns[0].tags.find(t => t[0] === 'a')[1].endsWith(adlerBefore.scopeId))

console.log('\n5. Finish the case anyway')
await say('check who held the tuesday duty window')
check('roster granted after the burn', (await notebook()).some(g => g.scopeName?.includes('Roster')))
await say('accuse Brandt')
const final = await readable()
check('accusation grants the resolution scope', final.some(s => s.data?.kind === 'epilogue' && s.status === 'ok'))
const dispatches = await receiveRumors(relay, player, [KIND_GM_DISPATCH])
check('case marked solved', dispatches.some(d => JSON.parse(d.content).ended === 'solved'))

console.log('\n6. Adversarial observer (what a relay operator learns)')
// The case's *title* is public by design (it lives in the kind-0 alongside
// the commitment). Its *contents* — people, places, answers — must not be.
const view = relay.observerView()
const leaked = JSON.stringify(view).match(/BRANDT|KELLER|ADLER|WEISS|JOSTY|SILBER|LOCKER|ROSTER/i)
check('no case secrets visible to the relay', !leaked, leaked ? `leaked: ${leaked[0]}` : '')
check('grants indistinguishable (only 1059 wraps visible)', view.every(e => [0, 1059, 30440].includes(e.kind)))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
