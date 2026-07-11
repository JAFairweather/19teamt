// burn.mjs — burn-notice interstitials and end-of-case cards (spec §2, §5.8).
//
// A kind-441 is not a toast. It stops the room: full-screen card, stamped,
// era-tinted, dismissed deliberately. Failure cards use the same chassis;
// the Meridian era's dysentery card (spec §8) will too, when it exists.

export function showBurnCard({ scopeName, reason }, onDismiss) {
  return showCard({
    stamp: 'BURN NOTICE',
    title: scopeName ?? 'ASSET',
    body: reason,
    footer: 'kind-441 · key rotated · access to future updates severed',
  }, onDismiss)
}

export function showEndCard({ ended }, onDismiss) {
  const cards = {
    solved: {
      stamp: 'CASE CLOSED',
      title: 'RESOLUTION GRANTED',
      body: 'The resolution dossier is in your notebook. Read it on the drum.',
      footer: 'the epilogue is yours to keep',
    },
    failed: {
      stamp: 'CASE CLOSED',
      title: 'WRONG MAN',
      body: 'The accusation did not hold. Some files close without closing.',
      footer: 'you live with the epilogue',
    },
    heat: {
      stamp: 'EXFILTRATED',
      title: 'HEAT AT MAXIMUM',
      body: 'Station pulled you out. The case stays open; you do not.',
      footer: 'lay low. try another seed.',
    },
  }
  return showCard(cards[ended] ?? cards.failed, onDismiss)
}

function showCard({ stamp, title, body, footer }, onDismiss) {
  const overlay = document.createElement('div')
  overlay.className = 'card-overlay'
  overlay.innerHTML = `
    <div class="card" role="alertdialog" aria-label="${stamp}">
      <div class="card-stamp">${stamp}</div>
      <div class="card-title"></div>
      <div class="card-body"></div>
      <div class="card-footer"></div>
      <div class="card-hint">press any key</div>
    </div>`
  overlay.querySelector('.card-title').textContent = title
  overlay.querySelector('.card-body').textContent = body
  overlay.querySelector('.card-footer').textContent = footer
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('shown'))
  const dismiss = () => {
    window.removeEventListener('keydown', dismiss, true)
    overlay.removeEventListener('click', dismiss)
    overlay.classList.remove('shown')
    setTimeout(() => overlay.remove(), 300)
    onDismiss?.()
  }
  setTimeout(() => {
    window.addEventListener('keydown', dismiss, true)
    overlay.addEventListener('click', dismiss)
  }, 400)
  return dismiss
}
