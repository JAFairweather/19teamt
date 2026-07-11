// berlin-minicase.mjs — the hand-authored M1 case: "The Last Visa" (mini).
// Five scopes, one burnable informant, one endgame accusation, one Vigenère.
//
// This file is the *skeleton* in spec §4 terms: topology, documents, answers,
// culprit — all fixed. The stub GM serves it verbatim; from M3 the director
// re-fleshes the prose per playthrough while this graph stays the law.
//
// Scope ids are opaque on the wire (spec §4/SPEC.md): the human names below
// never appear in a d tag — the GM maps them to random ids per session.

export const CASE_ID = 'berlin-last-visa-mini'
export const ERA = 'berlin-1938'

// Vigenère, key SILBER (Weiss's workname, stated in the briefing footer):
// plaintext ZOOLOCKERNINE → RWZMS TCMCO MEW
export const scopes = {
  briefing: {
    name: 'Case Briefing — REISEBÜRO',
    burnable: false,
    payload: {
      kind: 'dossier',
      title: 'BRIEFING — OPERATION REISEBÜRO',
      body: [
        'Berlin. November 1938. The city smells of coal smoke and wet wool,',
        'and everyone at the embassy queue has learned not to look up.',
        '',
        'Our courier WEISS did not make Tuesday\'s drop. He carried exit-visa',
        'blanks — forty of them — and a list of the names they were meant for.',
        'If the blanks are moving without us, someone is selling them.',
        '',
        'SIGNALS intercepted one fragment, keyed the old way. Weiss always',
        'ciphered under his workname. Decode it and you have his fallback.',
        '',
        '    INTERCEPT 11/8:  RWZMS TCMCO MEW',
        '',
        'Report in plain language. Submit the decoded fallback when you have it.',
        '',
        '— Station. (Courier registry: WEISS, workname SILBER, route 7.)',
      ].join('\n'),
    },
  },

  locker: {
    name: 'Zoo Bahnhof — Locker Nine',
    burnable: false,
    payload: {
      kind: 'evidence',
      title: 'CONTENTS — LOCKER 9, ZOO BAHNHOF',
      body: [
        'A courier satchel, empty of blanks. Inside the lining:',
        '',
        '- A ledger page. Six entries, all Tuesdays, all initialed "B." or "K."',
        '  Sums in Reichsmarks that a clerk\'s salary does not explain.',
        '- A cloakroom ticket, Café Josty, stamped twice.',
        '- A pencil note in Weiss\'s hand: "If I go quiet ask the coat-check',
        '  at Josty — ADLER. She counts everyone."',
        '',
        'The ledger initials belong to somebody in the visa section.',
        'Two clerks sign with those letters. You need an eye that was there.',
      ].join('\n'),
    },
  },

  adler: {
    name: 'Informant — Frau Adler',
    burnable: true,
    payload: {
      kind: 'npc',
      title: 'STATEMENT — FRAU ADLER, CAFÉ JOSTY (COAT-CHECK)',
      body: [
        'She talks with her hands below the counter, where hands can\'t be seen.',
        '',
        '"Your man Weiss. Tuesdays, last table, always the same company —',
        'a man from the embassy visa section. Armband, ink on the thumb.',
        'Weiss passed him papers twice. The second time, the man paid.',
        '',
        'Which one? I never learned his name. But he was DUTY those nights —',
        'they come straight from the evening window, still wearing the badge.',
        'Check who held the Tuesday window. That is your seller."',
        '',
        'She will not repeat any of this to anyone with a uniform.',
        'Handle her gently. She is the only pair of eyes we have.',
      ].join('\n'),
    },
  },

  roster: {
    name: 'Embassy Visa Section — Duty Roster',
    burnable: false,
    payload: {
      kind: 'dossier',
      title: 'DUTY ROSTER — VISA SECTION, EVENING WINDOW (NOV)',
      body: [
        'Photographed through glass; the corner is flared but legible.',
        '',
        '  Tue  1 Nov   evening window:  BRANDT',
        '  Tue  8 Nov   evening window:  BRANDT',
        '  Tue 15 Nov   evening window:  KELLER (crossed out) → BRANDT',
        '  Tue 22 Nov   evening window:  BRANDT',
        '',
        'Keller traded away every Tuesday this month. Brandt volunteered',
        'for a window nobody wants. The ledger says Tuesdays. Adler says',
        'the duty man. The roster says who the duty man was.',
      ].join('\n'),
    },
  },

  resolution: {
    name: 'Resolution — Case Closed',
    burnable: false,
    payload: {
      kind: 'epilogue',
      title: 'RESOLUTION — OPERATION REISEBÜRO',
      body: [
        'BRANDT, visa section, second window. He sold the blanks by the',
        'Tuesday lamplight and initialed his own ledger like a shopkeeper.',
        'The forty names are recovered. Thirty-one of the visas will still',
        'be honored. That is the arithmetic you get to keep.',
        '',
        'Weiss was found at the Anhalter freight sidings. He had kept the',
        'list separate from the blanks, the way he was trained to.',
        'The list is why thirty-one families board a train this winter.',
        '',
        'Station notes your handling of the Adler asset in the file.',
        'The file does not say thank you. It never does.',
      ].join('\n'),
    },
  },
}

// The case graph: how field reports unlock scopes. `match` runs against a
// normalized command (uppercased, punctuation stripped). First hit wins.
export const edges = [
  {
    to: 'locker',
    requires: ['briefing'],
    match: (t) => t.includes('ZOO') && t.includes('LOCKER') && (t.includes('NINE') || /\b9\b/.test(t)),
    response: 'The attendant takes your pfennigs without looking. Locker nine opens on the second key.',
  },
  {
    to: 'adler',
    requires: ['locker'],
    match: (t) => t.includes('ADLER') || (t.includes('JOSTY') && (t.includes('COAT') || t.includes('ASK') || t.includes('TICKET'))),
    response: 'Café Josty, four in the afternoon. The coat-check counter, and the woman Weiss trusted behind it.',
  },
  {
    to: 'roster',
    requires: ['adler'],
    match: (t) => t.includes('ROSTER') || (t.includes('TUESDAY') && (t.includes('DUTY') || t.includes('WINDOW') || t.includes('CHECK'))),
    response: 'A friend in the registry owes Station a favor. By morning you have a photograph of the roster.',
  },
]

// The accusation endgame (§5.8). Culprit fixed by the skeleton.
export const accusation = {
  culprit: 'BRANDT',
  wrong: ['KELLER', 'ADLER', 'WEISS'],
  unlocks: 'resolution',
  correctResponse: 'Station moves before the evening window opens.',
  wrongResponse: (name) =>
    `Station moves on ${name}. The interrogation gives them nothing, because there is nothing to give. ` +
    'By the time the error is plain, the blanks are gone and so is the seller. The case file closes unresolved.',
}

// Pressing the informant burns her (§5.3): real rotation, permanent this run.
export const burnTriggers = {
  press: {
    scope: 'adler',
    match: (t) => (t.includes('PRESS') || t.includes('THREATEN') || t.includes('FORCE')) && t.includes('ADLER'),
    reason: 'Asset compromised: subject pressed in a public place. Contact severed. Do not approach.',
    response: 'You lean on her, and her hands come up above the counter, and that is the end of it. ' +
      'A regular in a good coat has noticed the temperature change. By nightfall the arrangement is ash.',
  },
  heatThreshold: 80,
  heatReason: 'Asset compromised: surveillance pressure exceeded tolerance. Contact severed.',
}

// Heat deltas (§5.4, mini version).
export const heat = { wrongAnswer: 10, loiter: 5, pressedInterrogation: 40, max: 100, tail: 60 }

// Fair-play commitment (§4.3): sha256 of this canonical string is published
// in the case's public kind-0 before play begins.
export const solutionCommitment = {
  salt: 'reisebuero-1938-salz',
  canonical: () => JSON.stringify({ case: CASE_ID, culprit: accusation.culprit, salt: solutionCommitment.salt }),
}

export const opening = [
  'BERLIN — NOVEMBER 1938',
  '',
  'The briefing reaches you as a grant: one scope, one key, one courier',
  'who has gone quiet. Everything else in this city is somebody\'s secret,',
  'encrypted on relays that would sell you for the price of the coal.',
  '',
  'Your notebook holds what you have been granted. Nothing else is yours.',
  'Read the briefing. Type plainly. Mind the heat.',
].join('\n')
