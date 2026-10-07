import { useState } from 'react'
import { availableBids, SUIT_NAMES, SUIT_SYMBOLS } from '../game/rules.js'

export default function BiddingPanel({ state, playerIndex = 0, onBid }) {
  const [suit, setSuit] = useState('hearts')
  const [selectedBid, setSelectedBid] = useState(82)
  const bids = availableBids(state.bidding.highest?.value ?? 0)
  const bidValue = bids.includes(selectedBid) ? selectedBid : bids[0]
  const humanTurn = state.bidding.turn === playerIndex
  const highest = state.bidding.highest
  return (
    <section className="bidding-panel" aria-label="Bidding controls">
      <div className="bidding-copy"><span className="eyebrow">AUCTION · ROUND {state.round}</span><h2>{humanTurn ? 'Your call.' : `${state.players[state.bidding.turn].name} is considering…`}</h2><p>{highest ? `${state.players[highest.playerIndex].name} holds ${highest.value} ${SUIT_NAMES[highest.suit]}.` : 'Set a contract from 82 to 162, or pass.'}</p></div>
      {humanTurn ? (
        <div className="bid-actions">
          <div className="suit-choice" aria-label="Choose trump suit">{Object.entries(SUIT_SYMBOLS).map(([key, symbol]) => <button type="button" key={key} className={`suit-option${suit === key ? ' suit-option-active' : ''}${key === 'hearts' || key === 'diamonds' ? ' red' : ''}`} onClick={() => setSuit(key)} aria-label={SUIT_NAMES[key]} title={SUIT_NAMES[key]}>{symbol}</button>)}</div>
          <label className="bid-select-label" htmlFor="bid-value">BID</label>
          <select id="bid-value" value={bidValue ?? ''} disabled={!bids.length} onChange={(event) => setSelectedBid(Number(event.target.value))}>{bids.length ? bids.map((value) => <option key={value} value={value}>{value}</option>) : <option value="">No higher bid</option>}</select>
          <button type="button" className="button button-gold bid-button" disabled={!bids.length} onClick={() => bids.length && onBid({ type: 'bid', value: bidValue, suit })}>Bid {bidValue ?? ''}</button>
          <button type="button" className="button button-quiet" onClick={() => onBid({ type: 'pass' })}>Pass</button>
        </div>
      ) : <div className="bid-wait"><span className="pulse-dot" /> The table is bidding</div>}
      <div className="bid-history" aria-label="Bidding history">{state.bidding.history.map((entry, index) => <span key={`${entry.playerIndex}-${index}`} className={entry.type === 'pass' ? 'history-pass' : 'history-bid'}>{state.players[entry.playerIndex].name} {entry.type === 'pass' ? 'passed' : `${entry.value} ${SUIT_SYMBOLS[entry.suit]}`}</span>)}</div>
    </section>
  )
}