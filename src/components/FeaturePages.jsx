import { useState } from 'react'
import { chooseCard } from '../game/ai.js'
import { cardPoints, SUIT_NAMES, SUIT_SYMBOLS, winningPlay } from '../game/rules.js'
import { DEFAULT_PREFERENCES } from '../game/playerProfile.js'
import './FeaturePages.css'

const tutorialSteps = [
  {
    title: 'Find your partner',
    copy: 'Four players sit around the table. The player opposite you is on your team; the two players beside you are your opponents.',
    question: 'Where is your teammate?',
    choices: ['Across the table', 'Next to me'],
    answer: 0,
  },
  {
    title: 'Learn the card order',
    copy: 'Most suits rank Ace, 10, King, Queen, Jack, 9, 8, 7. Trump has a special order: Jack, 9, Ace, 10, King, Queen, 8, 7.',
    question: 'Which card is strongest in the trump suit?',
    choices: ['The Ace', 'The Jack'],
    answer: 1,
  },
  {
    title: 'Follow the suit',
    copy: 'The first card sets the suit for the trick. If you have a card in that suit, you must play it. When you are out of it, the other rules kick in.',
    question: 'Hearts were led, and you have a heart. What must you do?',
    choices: ['Play a heart', 'Play any card you like'],
    answer: 0,
  },
  {
    title: 'Know when to trump',
    copy: 'If you cannot follow suit and the other team is winning, play trump if you have one. If they already played trump and you can beat it, you must overtrump. If your partner is winning, save your trump.',
    question: 'You are out of the led suit, an opponent is winning, and you have trump. What should you do?',
    choices: ['Play a trump card', 'Discard any card'],
    answer: 0,
  },
  {
    title: 'Bid and count points',
    copy: 'Bidding chooses the trump suit and the points your team promises to earn. Cards are worth points; the last trick adds 10. Make your bid and be the first team to reach 501.',
    question: 'What is your goal after your team wins the bid?',
    choices: ['Reach your bid for the hand', 'Collect every trick yourself'],
    answer: 0,
  },
]

function TutorialPage({ onNavigate, onStartPractice }) {
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState(null)
  const current = tutorialSteps[step]
  const correct = answer === current.answer

  function chooseAnswer(index) {
    setAnswer(index)
  }

  function changeStep(nextStep) {
    setStep(nextStep)
    setAnswer(null)
  }

  return (
    <section className="info-panel feature-page tutorial-page">
      <span className="eyebrow">YOUR FIRST HAND · STEP {step + 1} OF {tutorialSteps.length}</span>
      <h1>Learn by <em>playing.</em></h1>
      <p className="info-lead">No rush. We’ll cover the basics together, one small step at a time.</p>
      <div className="tutorial-progress" aria-label={`Step ${step + 1} of ${tutorialSteps.length}`}>
        {tutorialSteps.map((item, index) => <span key={item.title} className={index <= step ? 'tutorial-progress-active' : ''} />)}
      </div>
      <article className="tutorial-card">
        <span className="tutorial-step-number">0{step + 1}</span>
        <h2>{current.title}</h2>
        <p>{current.copy}</p>
        <fieldset className="tutorial-question">
          <legend>{current.question}</legend>
          {current.choices.map((choice, index) => (
            <button type="button" className={`tutorial-choice${answer === index ? correct ? ' tutorial-correct' : ' tutorial-incorrect' : ''}`} key={choice} onClick={() => chooseAnswer(index)}>
              <span>{answer === index ? correct ? '✓' : '↻' : String.fromCharCode(65 + index)}</span>{choice}
            </button>
          ))}
        </fieldset>
        {answer !== null && <p className={`tutorial-feedback${correct ? ' tutorial-feedback-correct' : ''}`} role="status">{correct ? 'Exactly right. Nice work!' : 'Not quite—give it another try. You can do it.'}</p>}
      </article>
      <div className="feature-actions">
        <button type="button" className="button button-quiet" disabled={step === 0} onClick={() => changeStep(step - 1)}>← Back</button>
        {step < tutorialSteps.length - 1
          ? <button type="button" className="button button-gold" disabled={!correct} onClick={() => changeStep(step + 1)}>Next lesson ↗</button>
          : <button type="button" className="button button-gold" disabled={!correct} onClick={onStartPractice}>Practice with Ani ↗</button>}
      </div>
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

function DailyChallengePage({ date, completed, dates, notice, onStart, onDateChange, onNavigate, onShare }) {
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  return (
    <section className="info-panel feature-page daily-page">
      <span className="eyebrow">SHARED DAILY DEAL · UTC</span>
      <h1>Daily <em>challenge.</em></h1>
      <p className="info-lead">{dateLabel}. Take on the shared deal for this date, learn as you play, and see how your hand turns out.</p>
      <div className="daily-deal-card">
        <span className="daily-deal-mark" aria-hidden="true">Բ</span>
        <div><span className="eyebrow">DAILY DEAL</span><strong>{date}</strong><small>{completed ? 'You’ve completed this daily challenge. Replay any time.' : 'Everyone gets the same shuffled cards for this UTC date.'}</small></div>
        <span className={`daily-status${completed ? ' daily-status-done' : ''}`}>{completed ? 'COMPLETE' : 'READY'}</span>
      </div>
      <label className="daily-archive-label" htmlFor="daily-archive">CHALLENGE ARCHIVE · LAST 30 DAYS</label>
      <select id="daily-archive" className="preference-select daily-archive-select" value={date} onChange={(event) => onDateChange(event.target.value)}>{dates.map((archiveDate) => <option value={archiveDate} key={archiveDate}>{archiveDate}{archiveDate === date ? ' · selected' : ''}</option>)}</select>
      <div className="daily-actions">
        <button type="button" className="button button-gold" onClick={onStart}>{completed ? 'Replay this deal ↗' : 'Play this deal ↗'}</button>
        <button type="button" className="button button-quiet" onClick={onShare}>Share challenge</button>
      </div>
      {notice && <p className="daily-notice" role="status">{notice}</p>}
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

function FriendsPage({ friends, onlineLobby, onFriendsChange, onInvite, onNavigate }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const activeNames = new Set((onlineLobby?.seats || []).filter(Boolean).map((player) => player.name.toLowerCase()))

  function addFriend(event) {
    event.preventDefault()
    const cleanName = name.trim().slice(0, 16)
    if (!cleanName) return
    if (friends.some((friend) => friend.toLowerCase() === cleanName.toLowerCase())) {
      setError('That name is already in your friends list.')
      return
    }
    if (onFriendsChange([...friends, cleanName])) {
      setName('')
      setError('')
    } else {
      setError('Could not save your friends list on this device.')
    }
  }

  function removeFriend(friend) {
    onFriendsChange(friends.filter((entry) => entry !== friend))
  }

  return (
    <section className="info-panel feature-page friends-page">
      <span className="eyebrow">YOUR TABLE COMPANIONS</span>
      <h1>Friends <em>list.</em></h1>
      <p className="info-lead">Keep your usual table close. Friends are saved on this device; start an invite room to bring them into a game.</p>
      <form className="friend-add-form" onSubmit={addFriend}>
        <label className="visually-hidden" htmlFor="friend-name">Friend’s name</label>
        <input id="friend-name" value={name} maxLength={16} placeholder="Add a player by name" onChange={(event) => { setName(event.target.value); setError('') }} />
        <button type="submit" className="button button-gold" disabled={!name.trim()}>Add friend</button>
      </form>
      {error && <p className="online-error" role="alert">{error}</p>}
      <p className="friends-presence-note">Online status is shown when a friend is at your current table. Global friend presence requires player accounts.</p>
      <div className="friends-list">
        {friends.length ? friends.map((friend) => {
          const inRoom = activeNames.has(friend.toLowerCase())
          return <article className="friend-row" key={friend}><span className={`friend-avatar${inRoom ? ' friend-avatar-online' : ''}`}>{friend.slice(0, 1).toUpperCase()}</span><strong>{friend}</strong><span className={`friend-presence${inRoom ? ' friend-presence-online' : ''}`}><i />{inRoom ? 'At your table' : 'Not in this room'}</span><button type="button" className="friend-remove" aria-label={`Remove ${friend}`} onClick={() => removeFriend(friend)}>Remove</button></article>
        }) : <p className="friends-empty">Your list is empty for now. Add someone you’d like to play with.</p>}
      </div>
      <div className="feature-actions"><button type="button" className="button button-gold" onClick={onInvite}>Invite friends to play ↗</button></div>
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

const achievementList = [
  { id: 'first-game', title: 'First hand', detail: 'Complete your first match.', unlocked: (stats) => stats.games >= 1 },
  { id: 'first-win', title: 'First victory', detail: 'Win your first match.', unlocked: (stats) => stats.wins >= 1 },
  { id: 'five-wins', title: 'Table regular', detail: 'Win five matches.', unlocked: (stats) => stats.wins >= 5 },
  { id: 'win-streak', title: 'On a roll', detail: 'Reach a three-match win streak.', unlocked: (stats) => stats.bestStreak >= 3 },
  { id: 'daily-first', title: 'Daily player', detail: 'Complete a daily challenge.', unlocked: (stats) => stats.dailyChallenges >= 1 },
  { id: 'daily-five', title: 'Daily regular', detail: 'Complete five daily challenges.', unlocked: (stats) => stats.dailyChallenges >= 5 },
]

function StatsPage({ stats, onNavigate }) {
  const winRate = stats.games ? Math.round(stats.wins / stats.games * 100) : 0
  return (
    <section className="info-panel feature-page stats-page">
      <span className="eyebrow">YOUR TABLE · SAVED ON THIS DEVICE</span>
      <h1>Player <em>stats.</em></h1>
      <p className="info-lead">Every match is a little more practice. Here’s how you’re doing.</p>
      <div className="stats-grid">
        <article><span>GAMES PLAYED</span><strong>{stats.games}</strong></article>
        <article><span>WINS</span><strong>{stats.wins}</strong></article>
        <article><span>WIN RATE</span><strong>{winRate}%</strong></article>
        <article><span>LOSSES</span><strong>{stats.losses}</strong></article>
        <article><span>BEST WIN STREAK</span><strong>{stats.bestStreak}</strong></article>
        <article><span>DAILY CHALLENGES</span><strong>{stats.dailyChallenges}</strong></article>
      </div>
      <section className="achievement-section" aria-label="Achievements"><div className="achievement-heading"><span className="eyebrow">MILESTONES</span><strong>{achievementList.filter((item) => item.unlocked(stats)).length}/{achievementList.length} unlocked</strong></div><div className="achievement-grid">{achievementList.map((item) => {
        const unlocked = item.unlocked(stats)
        return <article className={`achievement-card${unlocked ? ' achievement-unlocked' : ''}`} key={item.id}><span aria-hidden="true">{unlocked ? '✦' : '○'}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><i>{unlocked ? 'EARNED' : 'LOCKED'}</i></article>
      })}</div></section>
      <p className="stats-note">Stats are stored in this browser and include completed local matches. Draws: {stats.draws}.</p>
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

function SettingsPage({ soundEnabled, preferences, onToggleSound, onPreferencesChange, onNavigate }) {
  function update(key, value) {
    onPreferencesChange({ ...preferences, [key]: value })
  }

  return (
    <section className="info-panel settings-panel feature-page"><span className="eyebrow">PREFERENCES</span><h1>Settings</h1>
      <div className="setting-row"><span><strong>Table sounds</strong><small>Card, trick, and match tones</small></span><button type="button" className={`toggle${soundEnabled ? ' toggle-on' : ''}`} aria-label="Table sounds" aria-pressed={soundEnabled} onClick={onToggleSound}><span /></button></div>
      <div className="setting-row"><span><strong>Practice AI pace</strong><small>How long the practice opponents take between turns</small></span><select className="preference-select" aria-label="Practice AI pace" value={preferences.aiSpeed} onChange={(event) => update('aiSpeed', Number(event.target.value))}><option value={720}>Quick</option><option value={1400}>Relaxed</option><option value={2200}>Slow</option></select></div>
      <div className="setting-row"><span><strong>AI difficulty</strong><small>Choose the strength of the local opponents</small></span><select className="preference-select" aria-label="AI difficulty" value={preferences.aiDifficulty} onChange={(event) => update('aiDifficulty', event.target.value)}><option value="easy">Easy</option><option value="standard">Standard</option><option value="challenging">Challenging</option></select></div>
      <div className="setting-row"><span><strong>Always show practice hints</strong><small>Show Ani’s card suggestion every turn. You can still ask for a hint in practice.</small></span><button type="button" className={`toggle${preferences.hintsAlwaysOn ? ' toggle-on' : ''}`} aria-label="Always show practice hints" aria-pressed={preferences.hintsAlwaysOn} onClick={() => update('hintsAlwaysOn', !preferences.hintsAlwaysOn)}><span /></button></div>
      <div className="setting-row"><label htmlFor="card-size"><strong>Card size</strong><small>Choose the size that feels comfortable</small></label><select className="preference-select" id="card-size" value={preferences.cardSize} onChange={(event) => update('cardSize', event.target.value)}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></div>
      <p className="setting-note">Preferences are saved on this device. Current defaults: {DEFAULT_PREFERENCES.cardSize} cards and hints on request.</p><button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

const drills = [
  { title: 'Follow the suit', tag: 'LEGAL PLAY', prompt: 'Hearts were led. You hold the 7 of hearts and the Ace of clubs. What must you play?', choices: ['7 of hearts', 'Ace of clubs'], answer: 0, explain: 'When you have a card in the suit that was led, you must follow suit.' },
  { title: 'Cut with trump', tag: 'TRUMPING', prompt: 'Clubs were led. You have no clubs, the other team is winning, and you hold a spade trump. What should you do?', choices: ['Play a spade trump', 'Discard any card'], answer: 0, explain: 'If you are void in the led suit and opponents are winning, you must trump when able.' },
  { title: 'Trust your partner', tag: 'TEAM PLAY', prompt: 'Your partner is already winning with the highest trump. You are out of the led suit. What is usually the smarter play?', choices: ['Save your trump and discard', 'Spend a higher trump'], answer: 0, explain: 'Your partner is currently winning, so you can usually save trump for a later trick.' },
  { title: 'Count the points', tag: 'SCORING', prompt: 'In a non-trump suit, how many points are the Ace, 10, and King worth together?', choices: ['25 points', '35 points'], answer: 0, explain: 'A non-trump Ace is 11, a 10 is 10, and a King is 4: 11 + 10 + 4 = 25.' },
  { title: 'Choose a contract', tag: 'BIDDING', prompt: 'Your hand has very little trump strength and no side-suit Aces. What is a cautious opening choice?', choices: ['Pass and let the table decide', 'Promise a high contract'], answer: 0, explain: 'A bid is a promise. Passing is sensible when your hand does not look strong enough to support a contract.' },
]

function SkillDrillsPage({ onNavigate, onStartPractice }) {
  const [answers, setAnswers] = useState({})
  return <section className="info-panel feature-page skills-page"><span className="eyebrow">SHORT TABLE-SIDE EXERCISES</span><h1>Practice by <em>skill.</em></h1><p className="info-lead">Pick a situation, make your call, then Ani explains the rule and the team-play thinking behind it. These drills never reveal an opponent’s hidden cards.</p>
    <div className="skill-drill-list">{drills.map((drill, index) => {
      const answer = answers[index]
      return <article className="skill-drill-card" key={drill.title}><span className="eyebrow">{drill.tag}</span><h2>{drill.title}</h2><p>{drill.prompt}</p><div className="skill-drill-choices">{drill.choices.map((choice, choiceIndex) => <button type="button" key={choice} className={`tutorial-choice${answer === choiceIndex ? choiceIndex === drill.answer ? ' tutorial-correct' : ' tutorial-incorrect' : ''}`} onClick={() => setAnswers((current) => ({ ...current, [index]: choiceIndex }))}><span>{answer === choiceIndex ? choiceIndex === drill.answer ? '✓' : '↻' : String.fromCharCode(65 + choiceIndex)}</span>{choice}</button>)}</div>{answer !== undefined && <p className={`tutorial-feedback${answer === drill.answer ? ' tutorial-feedback-correct' : ''}`} role="status">{answer === drill.answer ? 'Ani: ' : 'Not quite. Ani: '}{drill.explain}</p>}</article>
    })}</div>
    <div className="feature-actions"><button type="button" className="button button-gold" onClick={onStartPractice}>Play a full practice hand ↗</button></div><button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
  </section>
}

function HandReplay({ hand, onClose }) {
  const [cursor, setCursor] = useState(-1)
  const [showCoach, setShowCoach] = useState(false)
  const flatPlays = hand.tricksWon.flatMap((trick, trickIndex) => trick.plays.map((play) => ({ ...play, trickIndex })))
  const indexedPlays = flatPlays.map((play, index) => ({ ...play, index }))
  const visible = flatPlays.slice(0, cursor + 1)
  const activeTrickIndex = cursor < 0 ? 0 : flatPlays[Math.min(cursor, flatPlays.length - 1)]?.trickIndex ?? 0
  const trick = hand.tricksWon[activeTrickIndex]
  const trickPlays = visible.filter((play) => play.trickIndex === activeTrickIndex)
  const trickCardPoints = trick?.plays.reduce((sum, play) => sum + cardPoints(play.card, hand.trump), 0) || 0
  const lastTrickBonus = activeTrickIndex === 7 ? 10 : 0
  const trickPoints = trickCardPoints + lastTrickBonus
  const played = cursor >= 0 ? flatPlays[cursor] : null
  const previousPlays = played ? flatPlays.slice(Math.floor(cursor / 4) * 4, cursor) : []
  const previousWinner = previousPlays.length ? winningPlay(previousPlays, hand.trump) : null
  const playsBefore = indexedPlays.filter((play) => play.index < cursor)
  const reconstructedHand = played ? indexedPlays.filter((play) => play.playerIndex === played.playerIndex && play.index >= cursor).map((play) => play.card) : []
  const recommendation = played && reconstructedHand.length
    ? chooseCard(reconstructedHand, previousPlays, played.playerIndex, hand.trump, playsBefore.map((play) => play.card), 'measured', 'standard', () => 0)
    : null
  const coachReason = !played
    ? 'Start the replay to review each card in order. I can compare the actual play with a suggestion from the cards this player held at that moment.'
    : !previousPlays.length
      ? `I’d lead ${SUIT_NAMES[recommendation.suit].toLowerCase()} with the ${recommendation.rank}. That starts the suit while keeping the rest of the hand available.`
      : reconstructedHand.some((card) => card.suit === previousPlays[0].card.suit)
        ? `You must follow ${SUIT_NAMES[previousPlays[0].card.suit].toLowerCase()} when you have it. I’d play the ${recommendation.rank} of ${SUIT_NAMES[recommendation.suit].toLowerCase()}.`
        : previousWinner && hand.players[previousWinner.playerIndex]?.team === hand.players[played.playerIndex]?.team
          ? `Your partner was already ahead. I’d keep trump for later and discard the ${recommendation.rank} of ${SUIT_NAMES[recommendation.suit].toLowerCase()}.`
          : `The other team was ahead and you were out of the led suit. I’d play the ${recommendation.rank} of ${SUIT_NAMES[recommendation.suit].toLowerCase()}${recommendation.suit === hand.trump ? ' to trump' : ' as a discard'}.`
  const coachText = played
    ? `Ani: ${coachReason} You actually played ${played.card.rank} of ${SUIT_NAMES[played.card.suit].toLowerCase()}. The trick was worth ${trickPoints} points${lastTrickBonus ? ' including the 10-point last-trick bonus' : ''}${trick ? ` and went to ${hand.players[trick.winner]?.name || 'the winning seat'}` : ''}.`
    : `Ani: ${coachReason}`
  const dateLabel = hand.playedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(hand.playedAt)) : `Round ${hand.round}`
  return <div className="replay-backdrop" role="dialog" aria-modal="true" aria-labelledby="replay-title"><section className="replay-panel"><div className="replay-heading"><div><span className="eyebrow">HAND REVIEW · {dateLabel}</span><h2 id="replay-title">Replay & review</h2></div><button type="button" className="replay-close" onClick={onClose} aria-label="Close hand review">×</button></div>
    <div className="replay-summary"><span>{hand.contract ? `${hand.contract.value} in ${SUIT_NAMES[hand.trump]}` : 'Contract unavailable'}</span><strong>{hand.roundResult?.contractMade ? 'Contract made' : 'Contract failed · defense scored 162'}</strong></div>
    <div className="replay-score-breakdown"><div><span>GOLD CARD POINTS</span><strong>{hand.roundResult?.cardPoints?.[0] ?? 0}</strong></div><div><span>GREEN CARD POINTS</span><strong>{hand.roundResult?.cardPoints?.[1] ?? 0}</strong></div><div><span>LAST TRICK</span><strong>{hand.lastTrickTeam === 0 ? '+10 Gold' : '+10 Green'}</strong></div><div><span>BELOTE BONUS</span><strong>+{(hand.roundResult?.bonuses || []).reduce((sum, value) => sum + value, 0)}</strong></div><div><span>ROUND TOTAL</span><strong>{(hand.roundResult?.roundPoints || [0, 0]).join(' : ')}</strong></div></div>
    <div className="replay-trick-heading"><span className="eyebrow">TRICK {String(activeTrickIndex + 1).padStart(2, '0')} / 08</span><strong>{trick ? `${hand.players[trick.winner]?.name || 'Winning player'} won · ${trickPoints} points${lastTrickBonus ? ' incl. last-trick bonus' : ''}` : 'No trick data'}</strong></div>
    <div className="replay-cards">{trickPlays.map((play) => <article className="replay-card" key={`${play.playerIndex}-${play.card.id}`}><span className={['hearts', 'diamonds'].includes(play.card.suit) ? 'replay-card-red' : ''}>{play.card.rank}<i>{SUIT_SYMBOLS[play.card.suit]}</i></span><small>{hand.players[play.playerIndex]?.name || `Seat ${play.playerIndex + 1}`}</small></article>)}</div>
    <div className="replay-controls"><button type="button" className="button button-quiet" onClick={() => { setCursor(Math.max(-1, cursor - 1)); setShowCoach(false) }} disabled={cursor < 0}>← Previous card</button><span>{Math.max(0, cursor + 1)} / {flatPlays.length} cards</span><button type="button" className="button button-gold" onClick={() => { setCursor(Math.min(flatPlays.length - 1, cursor + 1)); setShowCoach(false) }} disabled={cursor >= flatPlays.length - 1}>Next card →</button></div>
    <button type="button" className="replay-coach-toggle" onClick={() => setShowCoach((open) => !open)} aria-expanded={showCoach}>Ask Ani about this moment</button>{showCoach && <p className="replay-coach" role="status">{coachText}{previousWinner && ` Before this card, ${hand.players[previousWinner.playerIndex]?.name} was ahead. If that was your partner, saving trump may have been an option.`}</p>}
    {hand.biddingHistory?.length > 0 && <details className="replay-bidding"><summary>Review the bidding ({hand.biddingHistory.length} calls)</summary><div>{hand.biddingHistory.map((call, index) => <span key={index}>{hand.players[call.playerIndex]?.name || `Seat ${call.playerIndex + 1}`} {call.type === 'pass' ? 'passed' : `bid ${call.value} ${SUIT_NAMES[call.suit]}`}</span>)}</div></details>}
  </section></div>
}

function ReviewPage({ hands, onNavigate }) {
  const [selected, setSelected] = useState(null)
  const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return <section className="info-panel feature-page review-page"><span className="eyebrow">YOUR LAST 20 COMPLETED HANDS · THIS DEVICE</span><h1>Replay & <em>review.</em></h1><p className="info-lead">Step through each card, review the bidding and scoring, and ask Ani to explain what happened.</p>
    <div className="review-list">{hands.length ? hands.map((hand) => <article className="review-list-row" key={hand.id}><div><strong>{hand.contract ? `${hand.contract.value} in ${SUIT_NAMES[hand.trump]}` : 'Completed hand'}</strong><small>{hand.playedAt ? dateFormatter.format(new Date(hand.playedAt)) : `Round ${hand.round}`} · {hand.tricksWon.length} tricks</small></div><span>{(hand.roundResult?.roundPoints || [0, 0]).join(' : ')}</span><button type="button" className="button button-quiet" onClick={() => setSelected(hand)}>Review ↗</button></article>) : <p className="review-empty">No completed hands yet. Finish a match and your recent hands will appear here.</p>}</div>
    <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>{selected && <HandReplay hand={selected} onClose={() => setSelected(null)} />}
  </section>
}

export { DailyChallengePage, FriendsPage, HandReplay, ReviewPage, SettingsPage, SkillDrillsPage, StatsPage, TutorialPage }
