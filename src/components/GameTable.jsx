import { useState } from 'react'
import BiddingPanel from './BiddingPanel.jsx'
import Player from './Player.jsx'
import PlayingCard from './PlayingCard.jsx'
import Scoreboard from './Scoreboard.jsx'
import { HandReplay } from './FeaturePages.jsx'
import { chooseCard } from '../game/ai.js'
import { legalCardsForTurn } from '../game/gameEngine.js'
import { cardStrength, describeIllegalPlay, SUIT_NAMES, SUIT_SYMBOLS, winningPlay } from '../game/rules.js'

const CARD_NAMES = { J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' }

function formatCard(card) {
  return `${CARD_NAMES[card.rank] || card.rank} of ${SUIT_NAMES[card.suit].toLowerCase()}`
}

function explainPracticePlay(state, playerIndex, card) {
  const activeTrick = state.trickComplete ? [] : state.trick
  if (!activeTrick.length) {
    const sameSuit = state.players[playerIndex].hand.filter((held) => held.suit === card.suit)
    const isStrongestInSuit = sameSuit.every((held) => cardStrength(card, state.trump) >= cardStrength(held, state.trump))
    return isStrongestInSuit
      ? `It’s your strongest ${SUIT_NAMES[card.suit].toLowerCase()}, so it gives you a good chance to win the lead—unless someone trumps it.`
      : `You’re leading, so any card is legal. This starts ${SUIT_NAMES[card.suit].toLowerCase()} and keeps the trick moving.`
  }

  const leadSuit = activeTrick[0].card.suit
  if (state.players[playerIndex].hand.some((held) => held.suit === leadSuit)) {
    return `You have ${SUIT_NAMES[leadSuit].toLowerCase()} cards, so you must follow the suit that was led.`
  }

  const currentWinner = winningPlay(activeTrick, state.trump)
  const partnerWinning = state.players[currentWinner.playerIndex].team === state.players[playerIndex].team
  if (partnerWinning) {
    return `Your partner is winning, so you can save your trump and discard a card from ${SUIT_NAMES[card.suit].toLowerCase()}.`
  }
  if (state.players[playerIndex].hand.some((held) => held.suit === state.trump)) {
    return currentWinner.card.suit === state.trump
      ? `The other team is winning with trump, so you must beat it if you can. This ${SUIT_NAMES[state.trump].toLowerCase()} is a legal overtrump.`
      : `The other team is winning and you’re out of the led suit, so you must trump.`
  }
  return `You’re out of ${SUIT_NAMES[leadSuit].toLowerCase()} and have no trump, so this discard is legal.`
}

function describePlayGuide(state, playerIndex) {
  if (state.turn !== playerIndex) return `${state.players[state.turn].name} is playing. Watch the trick, then the guide will update for your turn.`
  const hand = state.players[playerIndex].hand
  const trick = state.trickComplete ? [] : state.trick
  if (!trick.length) return 'You are leading. Any card is legal; the suit you choose starts the trick.'

  const leadSuit = trick[0].card.suit
  if (hand.some((card) => card.suit === leadSuit)) return `Follow ${SUIT_NAMES[leadSuit]} if you can. The highlighted cards are the ones you may play.`

  const trumps = hand.filter((card) => card.suit === state.trump)
  if (!trumps.length) return `You have no ${SUIT_NAMES[state.trump]} trump cards, so any card is legal.`

  const currentWinner = winningPlay(trick, state.trump)
  if (state.players[currentWinner.playerIndex].team === state.players[playerIndex].team) {
    return 'Your partner is winning this trick. You may play any card; consider saving your trump cards.'
  }

  if (currentWinner.card.suit === state.trump) {
    const canOvertrump = trumps.some((card) => cardStrength(card, state.trump) > cardStrength(currentWinner.card, state.trump))
    return canOvertrump
      ? 'An opponent is winning with trump. You must play a higher trump if you can.'
      : 'An opponent is winning with trump. You must play a trump, but none can beat it.'
  }

  return 'An opponent is winning and you have trump. You must play a trump card.'
}

function TrickCard({ play, trump, current, position, name }) {
  if (!play) return null
  const winner = current && winningPlay(current, trump)?.playerIndex === play.playerIndex
  return <div className={`trick-play trick-${position}${winner ? ' trick-winner' : ''}`}><PlayingCard card={play.card} disabled compact /><span>{name}</span></div>
}

function RoundSummary({ state, playerIndex, canManageRoom, isOnline, onNewRound, onRestart, onReview }) {
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
        <div className="result-points-breakdown"><span>Card points <strong>{result.cardPoints[0]} : {result.cardPoints[1]}</strong></span><span>Last trick <strong>{state.lastTrickTeam === 0 ? '+10 Gold' : '+10 Green'}</strong></span><span>Belote bonus <strong>+{result.bonuses[0]} : +{result.bonuses[1]}</strong></span><span>Hand score <strong>{result.roundPoints[0]} : {result.roundPoints[1]}</strong></span></div>
        <button type="button" className="result-home result-review-button" onClick={onReview}>Review this hand ↗</button>
        <button type="button" className="button button-gold result-button" disabled={!canManageRoom} onClick={gameOver ? onRestart : onNewRound}>{gameOver ? isOnline ? 'Rematch with friends' : 'Play again' : 'New round'} <span>↗</span></button>
        <button type="button" className="result-home" disabled={!canManageRoom} onClick={onRestart}>Start a new match</button>
      </section>
    </div>
  )
}

export default function GameTable({ state, notice, soundEnabled, practiceMode = false, dailyChallenge = false, isSpectator = false, hintsAlwaysOn = false, cardSize = 'standard', playerIndex = 0, roomCode, isOnline = false, isHost = true, isTournament = false, onToggleSound, onUpdateHints, onReplayPractice, onNavigateHome, onBid, onPlay, onNewRound, onRestart }) {
  const [selectedId, setSelectedId] = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [practiceFeedback, setPracticeFeedback] = useState('')
  const [practiceShowLegal, setPracticeShowLegal] = useState(false)
  const [practiceHintOpen, setPracticeHintOpen] = useState(false)
  const [inviteStatus, setInviteStatus] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const humanTurn = !isSpectator && state.phase === 'play' && state.turn === playerIndex
  const legalIds = humanTurn ? new Set(legalCardsForTurn(state, playerIndex).map((card) => card.id)) : new Set()
  const human = state.players[playerIndex]
  const trick = state.trick
  const positions = ['bottom', 'right', 'top', 'left']
  const localTeam = human.team
  const playedCards = [
    ...state.tricksWon.flatMap((completedTrick) => completedTrick.plays),
    ...(state.trickComplete ? [] : trick),
  ]
  const activeTrick = state.trickComplete ? [] : trick
  const suggestedCard = practiceMode && humanTurn
    ? chooseCard(human.hand, activeTrick, playerIndex, state.trump, playedCards, human.personality)
    : null
  const suggestedReason = suggestedCard ? explainPracticePlay(state, playerIndex, suggestedCard) : ''

  function selectCard(cardId) {
    if (!humanTurn) return
    if (practiceMode && !legalIds.has(cardId)) {
      const card = human.hand.find((held) => held.id === cardId)
      const reason = card && describeIllegalPlay(human.hand, activeTrick, card, playerIndex, state.trump)
      const suggestion = suggestedCard
        ? `Try the ${formatCard(suggestedCard)} instead. ${suggestedReason}`
        : 'Try one of the highlighted cards instead.'
      setPracticeFeedback(`Not quite. ${reason || 'That card is not legal on this trick.'} ${suggestion}`)
      setPracticeShowLegal(true)
      setSelectedId(null)
      return
    }
    if (practiceMode) {
      setPracticeFeedback('')
      setPracticeShowLegal(false)
    }
    if (selectedId === cardId) {
      onPlay(cardId)
      setSelectedId(null)
      return
    }
    setSelectedId(cardId)
  }

  async function copyRoomInvite() {
    const url = new URL(window.location.href)
    url.searchParams.delete('tournament')
    url.searchParams.delete('room')
    url.searchParams.delete('daily')
    url.searchParams.set('watch', roomCode)
    try {
      await navigator.clipboard.writeText(url.toString())
      setInviteStatus('Invite link copied')
    } catch {
      setInviteStatus('Could not copy the invite link')
    }
  }

  return (
    <>
      <header className="game-header">
        <button type="button" className="table-brand" onClick={onNavigateHome} aria-label="Return to main menu"><span className="brand-mark">Բ</span><span><strong>ԲԼՈՏ</strong><small>ARMENIAN CARD TABLE</small></span></button>
        <div className="header-match-note"><span className="live-dot" /> {isSpectator ? 'WATCHING LIVE' : dailyChallenge ? 'DAILY CHALLENGE' : practiceMode ? 'GUIDED PRACTICE' : isOnline ? `ROOM ${roomCode}` : 'LIVE MATCH'} <i /> ROUND {String(state.round).padStart(2, '0')}</div>
        <div className="header-actions">{isOnline && !isSpectator && <button type="button" className="home-button invite-button" onClick={copyRoomInvite} aria-label="Copy spectator link">{inviteStatus || 'Watch link'}</button>}{!isSpectator && <button type="button" className="icon-button" onClick={onToggleSound} aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'} title={soundEnabled ? 'Sound on' : 'Sound off'}>{soundEnabled ? '♫' : '♪'}</button>}{(!isOnline || (isHost && !isTournament)) && !isSpectator && <button type="button" className="icon-button restart-icon" onClick={onRestart} aria-label={practiceMode ? 'Replay this deal' : 'Restart match'} title={practiceMode ? 'Replay this deal' : 'Restart match'}>↻</button>}<button type="button" className="home-button" onClick={onNavigateHome}>{isSpectator ? 'Leave watch' : isOnline ? 'Room' : 'Exit table'}</button></div>
      </header>
      <div className={`game-content card-size-${cardSize}`}>
        <div className="table-toolbar"><div><span className="eyebrow">{practiceMode ? 'ANI IS AT YOUR SIDE' : 'THE MATCH'}</span><h1>{dailyChallenge ? <>Daily <em>challenge</em></> : practiceMode ? <>Practice <em>Blot</em></> : <>Partnership <em>Blot</em></>}</h1></div><Scoreboard state={state} /></div>
        <section className="table-board" aria-label="Card table">
          <div className="felt-grain" aria-hidden="true" />
          {state.players.map((player, index) => <Player key={player.index} player={player} position={positions[(index - playerIndex + 4) % 4]} cardCount={player.hand.length} hiddenHand={isSpectator || index !== playerIndex} isLocalSeat={!isSpectator && index === playerIndex} isSpectator={isSpectator} localTeam={localTeam} active={state.phase === 'bidding' ? state.bidding.turn === index : state.phase === 'play' && state.turn === index} />)}
          <div className="table-center">
            <div className="trick-count">TRICK <strong>{Math.min(state.tricksWon.length + 1, 8)}</strong><span>/ 8</span></div>
            <div className="trick-cards">{trick.map((play) => <TrickCard key={play.card.id} play={play} trump={state.trump} current={trick} position={(play.playerIndex - playerIndex + 4) % 4} name={state.players[play.playerIndex].name} />)}</div>
            <div className="table-status"><span>{state.phase === 'bidding' ? 'BIDDING' : state.trump ? `${SUIT_SYMBOLS[state.trump]} ${state.trump.toUpperCase()} TRUMP` : 'SHUFFLING'}</span><i />{state.phase === 'bidding' ? state.bidding.turn === playerIndex ? 'Your call' : `${state.players[state.bidding.turn].name}'s call` : state.trick.length ? `${state.players[winningPlay(state.trick, state.trump).playerIndex].name} is ahead` : `${state.players[state.turn].name} leads`}</div>
            {state.phase === 'play' && <div className="current-trick-winner">{state.trick.length === 4 ? `${state.players[winningPlay(state.trick, state.trump).playerIndex].name} takes the trick` : `${state.tricksWon.length} tricks played`}</div>}
          </div>
          <div className="team-legend"><span><i className="gold-legend" /> GOLD · {state.players.filter((player) => player.team === 0).map((player) => player.name).join(' + ')}</span><span><i className="green-legend" /> GREEN · {state.players.filter((player) => player.team === 1).map((player) => player.name).join(' + ')}</span></div>
        </section>
        {isSpectator && <div className="spectator-banner" role="status">{state.phase === 'gameOver' ? 'This match is complete. Review the final score, then leave the table when you’re ready.' : 'You’re watching a live game. Player hands are hidden and the table is read-only.'}</div>}
        {isSpectator && state.phase === 'bidding' && <section className="spectator-auction" aria-label="Bidding history"><span className="eyebrow">LIVE AUCTION</span>{state.bidding.history.map((entry, index) => <span key={index}>{state.players[entry.playerIndex].name} {entry.type === 'pass' ? 'passed' : `bid ${entry.value} ${SUIT_SYMBOLS[entry.suit]}`}</span>)}</section>}
        {playedCards.length > 0 && <section className="played-history" aria-label="Cards already played"><span className="eyebrow">PLAYED · {playedCards.length}/32</span><div>{playedCards.map((play, index) => <span key={`${play.card.id}-${index}`} className={`played-card${play.card.suit === 'hearts' || play.card.suit === 'diamonds' ? ' played-red' : ''}`} title={`${play.card.rank} of ${play.card.suit}`}>{play.card.rank}{SUIT_SYMBOLS[play.card.suit]}</span>)}</div></section>}
        {state.phase === 'bidding' && !isSpectator && <BiddingPanel state={state} playerIndex={playerIndex} onBid={onBid} practiceMode={practiceMode} />}
        {(state.phase === 'play' || state.phase === 'bidding') && !isSpectator && <section className="hand-area" aria-label="Your hand">
          <div className="hand-heading"><div><span className="eyebrow">{practiceMode ? 'YOUR HAND · ANI WILL HELP' : 'YOUR HAND'}</span><span className="cards-left">{human.hand.length} cards</span></div><div className="hand-heading-actions"><div className="hand-instruction">{humanTurn ? practiceMode ? 'Choose any card to hear why it is or isn’t legal' : 'Select a card, then play it' : state.phase === 'bidding' ? 'Your cards are visible only to you' : `${state.players[state.turn].name} is playing…`}</div><button type="button" className="guide-toggle" aria-expanded={guideOpen} aria-controls="gameplay-guide" onClick={() => setGuideOpen((open) => !open)}>{guideOpen ? 'Hide guide' : 'How to play'}</button></div></div>
          {practiceMode && <div className={`practice-coach-tip${practiceFeedback ? ' practice-coach-correction' : ''}`} role={practiceFeedback ? 'alert' : 'status'}>
            <span>ANI’S PRACTICE TIP</span>
            <p>{practiceFeedback || (state.phase === 'bidding'
              ? state.bidding.turn === playerIndex
                ? 'Bidding is a promise to win points. Choose a suit and a bid your hand can support, or pass if you’re unsure.'
                : `${state.players[state.bidding.turn].name} is bidding. Once the contract is set, I’ll help you with each play.`
              : humanTurn && suggestedCard && (hintsAlwaysOn || practiceHintOpen)
                ? `I’d play the ${formatCard(suggestedCard)}. ${suggestedReason}`
                : 'Watch the trick, then ask me for a hint whenever you want one.')}</p>
            {practiceFeedback && suggestedCard && <small>The green-highlighted cards are legal. Choose one to continue.</small>}
          </div>}
          {practiceMode && <div className="practice-controls">
            {state.phase === 'play' && humanTurn && <button type="button" className="guide-toggle" aria-pressed={hintsAlwaysOn || practiceHintOpen} onClick={() => setPracticeHintOpen((open) => !open)}>{hintsAlwaysOn ? 'Hints always on' : practiceHintOpen ? 'Hide hint' : 'Show a hint'}</button>}
            <button type="button" className="guide-toggle" onClick={() => onUpdateHints(!hintsAlwaysOn)} aria-pressed={hintsAlwaysOn}>{hintsAlwaysOn ? 'Turn off automatic hints' : 'Always show hints'}</button>
            <button type="button" className="guide-toggle" onClick={onReplayPractice}>{dailyChallenge ? 'Replay today’s deal' : 'Replay this deal'}</button>
          </div>}
          {guideOpen && <div className="gameplay-guide" id="gameplay-guide" role="region" aria-label="How to play">
            <span className="guide-label">{state.phase === 'bidding' ? 'BIDDING' : humanTurn ? 'YOUR PLAY' : 'NEXT TURN'}</span>
            <p>{state.phase === 'bidding'
              ? state.bidding.turn === playerIndex
                ? 'Choose a trump suit and bid the points your team expects to score. Pass if you do not want to bid.'
                : `${state.players[state.bidding.turn].name} is bidding. The highest bid sets the contract and trump suit.`
              : describePlayGuide(state, playerIndex)}</p>
            {humanTurn && <small>Highlighted cards are legal plays right now.</small>}
          </div>}
          <div className="hand-cards">{human.hand.map((card) => <PlayingCard key={card.id} card={card} selected={selectedId === card.id} hinted={Boolean((practiceMode && humanTurn && (card.id === suggestedCard?.id && (hintsAlwaysOn || practiceHintOpen) || ((practiceShowLegal || hintsAlwaysOn) && legalIds.has(card.id)))) || (guideOpen && legalIds.has(card.id)))} disabled={!humanTurn} onClick={() => selectCard(card.id)} />)}</div>
          <div className="hand-footer"><span className={`card-validation${notice ? ' validation-error' : ''}`} role="status">{notice || (selectedId && !legalIds.has(selectedId) ? 'You must follow suit or trump when required.' : humanTurn ? practiceMode ? 'Choose a card. Ani will help if you need it.' : 'Your play is ready.' : state.phase === 'bidding' ? 'Choose a contract or pass.' : 'Waiting for your turn.')}</span>{state.phase === 'play' && <button type="button" className="button button-gold play-card-button" disabled={!humanTurn || !selectedId} onClick={() => { if (selectedId) onPlay(selectedId); setSelectedId(null); setPracticeFeedback(''); setPracticeShowLegal(false); setPracticeHintOpen(false) }}>Play card <span>↗</span></button>}</div>
        </section>}
        <footer className="table-footer"><span>PLAYING PARTNERSHIP BLOT</span><span>{state.players.filter((player) => player.team === 0).map((player) => player.name).join(' & ')} <i /> {state.players.filter((player) => player.team === 1).map((player) => player.name).join(' & ')}</span><span>FIRST TO 501</span></footer>
      </div>
      {notice && <div className="notice-toast" role="alert">{notice}</div>}
      {(state.phase === 'roundOver' || state.phase === 'gameOver') && !isSpectator && <RoundSummary state={state} playerIndex={playerIndex} canManageRoom={!isOnline || isHost} isOnline={isOnline} onNewRound={onNewRound} onRestart={onRestart} onReview={() => setReviewOpen(true)} />}
      {reviewOpen && <HandReplay hand={{ id: `${state.round}`, playedAt: new Date().toISOString(), round: state.round, players: state.players.map(({ name, team }) => ({ name, team })), trump: state.trump, contract: state.contract, lastTrickTeam: state.lastTrickTeam, biddingHistory: state.bidding.history, tricksWon: state.tricksWon, roundResult: state.roundResult }} onClose={() => setReviewOpen(false)} />}
    </>
  )
}