import { useState } from 'react'
import BiddingPanel from './BiddingPanel.jsx'
import Player from './Player.jsx'
import PlayingCard from './PlayingCard.jsx'
import Scoreboard from './Scoreboard.jsx'
import { legalCardsForTurn } from '../game/gameEngine.js'
import { SUIT_SYMBOLS, winningPlay } from '../game/rules.js'

function TrickCard({ play, trump, current, position, name }) {
  if (!play) return null
  const winner = current && winningPlay(current, trump)?.playerIndex === play.playerIndex
  return <div className={`trick-play trick-${position}${winner ? ' trick-winner' : ''}`}><PlayingCard card={play.card} disabled compact /><span>{name}</span></div>
}

function RoundSummary({ state, playerIndex, canManageRoom, onNewRound, onRestart }) {
  const result = state.roundResult
  const gameOver = state.phase === 'gameOver'
  const winner = gameOver ? result.matchWinner : result.roundWinner
  return (
    <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <section className="result-panel"><div className="result-ornament">Բ <span>✳</span> Բ</div><span className="eyebrow">{gameOver ? 'MATCH COMPLETE' : `ROUND ${state.round} COMPLETE`}</span>
        <h2 id="result-title">{winner === null ? 'A level hand.' : `${winner === 0 ? 'Gold' : 'Green'} takes it.`}</h2>
        {gameOver && <p className="result-lead">{winner === state.players[playerIndex].team ? 'Your partnership wins the match.' : `${state.players.filter((player) => player.team === winner).map((player) => player.name).join(' and ')} win the match.`}</p>}
        <div className="result-score-row"><div><span className="score-gold-text">GOLD</span><strong>{result.roundPoints[0]}</strong><small>+{result.roundPoints[0]} this hand</small></div><span className="result-colon">:</span><div><span className="score-green-text">GREEN</span><strong>{result.roundPoints[1]}</strong><small>+{result.roundPoints[1]} this hand</small></div></div>
        <div className="result-total">MATCH TOTAL <strong>{result.scores[0]}</strong><span>—</span><strong>{result.scores[1]}</strong></div>
        <div className="result-detail">{result.contractMade ? 'Contract made' : 'Contract set: opponents score 162'}{result.bonuses.some(Boolean) ? ` · Belote-Rebelote +${result.bonuses.reduce((sum, value) => sum + value, 0)}` : ''}</div>
        <button type="button" className="button button-gold result-button" disabled={!canManageRoom} onClick={gameOver ? onRestart : onNewRound}>{gameOver ? 'Play again' : 'New round'} <span>↗</span></button>
        <button type="button" className="result-home" disabled={!canManageRoom} onClick={onRestart}>Start a new match</button>
      </section>
    </div>
  )
}

export default function GameTable({ state, notice, soundEnabled, playerIndex = 0, roomCode, isOnline = false, isHost = true, onToggleSound, onNavigateHome, onBid, onPlay, onNewRound, onRestart }) {
  const [selectedId, setSelectedId] = useState(null)
  const humanTurn = state.phase === 'play' && state.turn === playerIndex
  const legalIds = humanTurn ? new Set(legalCardsForTurn(state, playerIndex).map((card) => card.id)) : new Set()
  const human = state.players[playerIndex]
  const trick = state.trick
  const positions = ['bottom', 'right', 'top', 'left']
  const localTeam = human.team
  const playedCards = [
    ...state.tricksWon.flatMap((completedTrick) => completedTrick.plays),
    ...(state.trickComplete ? [] : trick),
  ]

  function selectCard(cardId) {
    if (!humanTurn) return
    if (selectedId === cardId) {
      onPlay(cardId)
      setSelectedId(null)
      return
    }
    setSelectedId(cardId)
  }

  return (
    <>
      <header className="game-header">
        <button type="button" className="table-brand" onClick={onNavigateHome} aria-label="Return to main menu"><span className="brand-mark">Բ</span><span><strong>ԲԼՈՏ</strong><small>ARMENIAN CARD TABLE</small></span></button>
        <div className="header-match-note"><span className="live-dot" /> {isOnline ? `ROOM ${roomCode}` : 'LIVE MATCH'} <i /> ROUND {String(state.round).padStart(2, '0')}</div>
        <div className="header-actions"><button type="button" className="icon-button" onClick={onToggleSound} aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'} title={soundEnabled ? 'Sound on' : 'Sound off'}>{soundEnabled ? '♫' : '♪'}</button>{(!isOnline || isHost) && <button type="button" className="icon-button restart-icon" onClick={onRestart} aria-label="Restart match" title="Restart match">↻</button>}<button type="button" className="home-button" onClick={onNavigateHome}>{isOnline ? 'Room' : 'Exit table'}</button></div>
      </header>
      <div className="game-content">
        <div className="table-toolbar"><div><span className="eyebrow">THE MATCH</span><h1>Partnership <em>Blot</em></h1></div><Scoreboard state={state} /></div>
        <section className="table-board" aria-label="Card table">
          <div className="felt-grain" aria-hidden="true" />
          {state.players.map((player, index) => <Player key={player.index} player={player} position={positions[(index - playerIndex + 4) % 4]} cardCount={player.hand.length} hiddenHand={index !== playerIndex} isLocalSeat={index === playerIndex} localTeam={localTeam} active={state.phase === 'bidding' ? state.bidding.turn === index : state.phase === 'play' && state.turn === index} />)}
          <div className="table-center">
            <div className="trick-count">TRICK <strong>{Math.min(state.tricksWon.length + 1, 8)}</strong><span>/ 8</span></div>
            <div className="trick-cards">{trick.map((play) => <TrickCard key={play.card.id} play={play} trump={state.trump} current={trick} position={(play.playerIndex - playerIndex + 4) % 4} name={state.players[play.playerIndex].name} />)}</div>
            <div className="table-status"><span>{state.phase === 'bidding' ? 'BIDDING' : state.trump ? `${SUIT_SYMBOLS[state.trump]} ${state.trump.toUpperCase()} TRUMP` : 'SHUFFLING'}</span><i />{state.phase === 'bidding' ? state.bidding.turn === playerIndex ? 'Your call' : `${state.players[state.bidding.turn].name}'s call` : state.trick.length ? `${state.players[winningPlay(state.trick, state.trump).playerIndex].name} is ahead` : `${state.players[state.turn].name} leads`}</div>
            {state.phase === 'play' && <div className="current-trick-winner">{state.trick.length === 4 ? `${state.players[winningPlay(state.trick, state.trump).playerIndex].name} takes the trick` : `${state.tricksWon.length} tricks played`}</div>}
          </div>
          <div className="team-legend"><span><i className="gold-legend" /> GOLD · {state.players.filter((player) => player.team === 0).map((player) => player.name).join(' + ')}</span><span><i className="green-legend" /> GREEN · {state.players.filter((player) => player.team === 1).map((player) => player.name).join(' + ')}</span></div>
        </section>
        {playedCards.length > 0 && <section className="played-history" aria-label="Cards already played"><span className="eyebrow">PLAYED · {playedCards.length}/32</span><div>{playedCards.map((play, index) => <span key={`${play.card.id}-${index}`} className={`played-card${play.card.suit === 'hearts' || play.card.suit === 'diamonds' ? ' played-red' : ''}`} title={`${play.card.rank} of ${play.card.suit}`}>{play.card.rank}{SUIT_SYMBOLS[play.card.suit]}</span>)}</div></section>}
        {state.phase === 'bidding' && <BiddingPanel state={state} playerIndex={playerIndex} onBid={onBid} />}
        {(state.phase === 'play' || state.phase === 'bidding') && <section className="hand-area" aria-label="Your hand">
          <div className="hand-heading"><div><span className="eyebrow">YOUR HAND</span><span className="cards-left">{human.hand.length} cards</span></div><div className="hand-instruction">{humanTurn ? 'Select a card, then play it' : state.phase === 'bidding' ? 'Your cards are visible only to you' : `${state.players[state.turn].name} is playing…`}</div></div>
          <div className="hand-cards">{human.hand.map((card) => <PlayingCard key={card.id} card={card} selected={selectedId === card.id} disabled={!humanTurn} onClick={() => selectCard(card.id)} />)}</div>
          <div className="hand-footer"><span className={`card-validation${notice ? ' validation-error' : ''}`} role="status">{notice || (selectedId && !legalIds.has(selectedId) ? 'You must follow suit or trump when required.' : humanTurn ? 'Your play is ready.' : state.phase === 'bidding' ? 'Choose a contract or pass.' : 'Waiting for your turn.')}</span>{state.phase === 'play' && <button type="button" className="button button-gold play-card-button" disabled={!humanTurn || !selectedId} onClick={() => { if (selectedId) onPlay(selectedId); setSelectedId(null) }}>Play card <span>↗</span></button>}</div>
        </section>}
        <footer className="table-footer"><span>PLAYING PARTNERSHIP BLOT</span><span>{state.players.filter((player) => player.team === 0).map((player) => player.name).join(' & ')} <i /> {state.players.filter((player) => player.team === 1).map((player) => player.name).join(' & ')}</span><span>FIRST TO 501</span></footer>
      </div>
      {notice && <div className="notice-toast" role="alert">{notice}</div>}
      {(state.phase === 'roundOver' || state.phase === 'gameOver') && <RoundSummary state={state} playerIndex={playerIndex} canManageRoom={!isOnline || isHost} onNewRound={onNewRound} onRestart={onRestart} />}
    </>
  )
}