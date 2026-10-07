import { SUIT_NAMES, SUIT_SYMBOLS } from '../game/rules.js'

export default function Scoreboard({ state }) {
  return (
    <aside className="scoreboard" aria-label="Match score">
      <div className="scoreboard-topline"><span>ROUND {String(state.round).padStart(2, '0')}</span><span>FIRST TO 501</span></div>
      <div className="score-teams">
        <div className="score-team score-gold"><span className="team-dot" /><span className="score-team-name">GOLD</span><strong>{state.scores[0]}</strong></div>
        <span className="score-divider">:</span>
        <div className="score-team score-green"><span className="team-dot" /><span className="score-team-name">GREEN</span><strong>{state.scores[1]}</strong></div>
      </div>
      {state.contract && <div className="contract-line"><span>CONTRACT</span><strong>{state.contract.value}</strong><span className={`contract-suit ${state.trump === 'hearts' || state.trump === 'diamonds' ? 'red' : ''}`}>{SUIT_SYMBOLS[state.trump]}</span><span>{SUIT_NAMES[state.trump]}</span></div>}
    </aside>
  )
}