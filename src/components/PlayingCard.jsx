import { SUIT_SYMBOLS } from '../game/rules.js'

export default function PlayingCard({ card, hidden = false, selected = false, disabled = false, onClick, compact = false }) {
  if (hidden) return <div className={`playing-card card-back${compact ? ' card-compact' : ''}`} aria-label="Face-down card"><span className="back-medallion">Բ</span></div>
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <button type="button" className={`playing-card card-face${red ? ' suit-red' : ' suit-black'}${selected ? ' is-selected' : ''}${compact ? ' card-compact' : ''}`} onClick={onClick} disabled={disabled} aria-label={`${card.rank} of ${card.suit}`}>
      <span className="card-corner"><b>{card.rank}</b><span>{SUIT_SYMBOLS[card.suit]}</span></span>
      <span className="card-center-symbol">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="card-corner card-corner-bottom"><b>{card.rank}</b><span>{SUIT_SYMBOLS[card.suit]}</span></span>
    </button>
  )
}