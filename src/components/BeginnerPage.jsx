import { useEffect, useRef, useState } from 'react'
import { cardStrength, RULES } from '../game/rules.js'
import { RANKS } from '../game/deck.js'
import './BeginnerPage.css'

const trumpOrder = [...RANKS].sort((first, second) => (
  cardStrength({ rank: second, suit: 'hearts' }, 'hearts')
  - cardStrength({ rank: first, suit: 'hearts' }, 'hearts')
))
const plainOrder = [...RANKS].sort((first, second) => (
  cardStrength({ rank: second, suit: 'hearts' }, 'spades')
  - cardStrength({ rank: first, suit: 'hearts' }, 'spades')
))

const quickQuestions = [
  'Which cards are strongest?',
  'How do I win a trick?',
  'What does trump mean?',
]

function answerQuestion(question) {
  const text = question.toLowerCase()

  if (/order|rank|strongest|highest|power|jack|nine/.test(text)) {
    return `Great question. In the trump suit, the order from strongest to weakest is ${trumpOrder.join(' > ')}. In every other suit, it’s ${plainOrder.join(' > ')}. The Jack and 9 get a big boost when they’re trump.`
  }
  if (/follow|legal|must play|have to|suit led/.test(text)) {
    return 'When a trick starts, try to play a card in that same suit if you have one. If you’re out of that suit and the other team is winning, play trump if you can—and beat their trump if you’re able. If your partner is already winning, you can play any card.'
  }
  if (/partner.*(win|ahead)|win.*partner|can i play anything|anything/.test(text)) {
    return 'If your partner is winning and you’re out of the suit that was led, you don’t have to trump—you can play any card. But if you have a card in the led suit, you still need to follow suit.'
  }
  if (/deal|cards in (my )?hand|how many cards/.test(text)) {
    return 'Blot uses 32 cards: 7, 8, 9, 10, Jack, Queen, King, and Ace in each suit. Everyone gets eight cards, so you’ll play eight tricks in a hand.'
  }
  if (/trump/.test(text)) {
    return 'Trump is the suit chosen in the bidding. It beats cards from the other suits, even an Ace. One twist: trump cards have their own order, and the Jack is the strongest trump.'
  }
  if (/trick|win|beat|take/.test(text)) {
    return 'A trick is one card from each of the four players. The highest card in the suit that was led wins—unless someone plays trump, which beats the other suits. The winner leads the next trick. For example, with spades as trump, the Jack of spades beats the Ace of hearts.'
  }
  if (/bid|auction|call|contract|pass/.test(text)) {
    return `Bidding is your team’s promise to score at least a certain number of points, with a suit as trump. The first bid is ${RULES.minimumBid}; bids go up by ${RULES.bidStep}. Bid when your hand looks promising, or pass if you’re not sure.`
  }
  if (/point|score|501|belote|rebelote/.test(text)) {
    return `You and your partner collect points by winning tricks. The team that won the bidding has to make its bid; if it falls short, the other team scores ${RULES.maximumBid} for the hand. First team to ${RULES.targetScore} wins. King and Queen of trump together are worth an extra 20 points.`
  }
  if (/partner|team|opposite|seat/.test(text)) {
    return 'You have a partner sitting directly across from you. You’ll take turns with the other team, so keep an eye on who’s winning each trick—and don’t spend a high card if your partner already has it covered.'
  }
  if (/hello|hi\b|hey\b|start|begin|new to blot|what is blot|rules?/.test(text)) {
    return 'Welcome to the table! Blot is a four-player card game: you and the player across from you are partners. Win tricks, follow the suit that was led when you can, and use trump to take a trick. Want to start with card order, trump, or scoring?'
  }

  return 'I’m happy to help you learn. I know the rules, card order, bidding, trump, tricks, and scoring. What part of the game has you curious?'
}

function CardOrder({ label, order, trump = false }) {
  return (
    <div className={`beginner-order${trump ? ' beginner-order-trump' : ''}`}>
      <div className="beginner-order-label"><strong>{label}</strong><span>{trump ? '♥ trump example' : 'any non-trump suit'}</span></div>
      <ol aria-label={`${label} card order, strongest to weakest`}>
        {order.map((rank) => <li key={rank}>{rank}</li>)}
      </ol>
    </div>
  )
}

function CoachChat() {
  const [messages, setMessages] = useState([
    { id: 0, speaker: 'coach', text: 'Hi, I’m Ani. I’ll help you get comfortable at the table—no question is too basic. What would you like to know?' },
  ])
  const [question, setQuestion] = useState('')
  const [thinking, setThinking] = useState(false)
  const chatRef = useRef(null)
  const nextId = useRef(1)
  const replyTimer = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, thinking])

  useEffect(() => () => window.clearTimeout(replyTimer.current), [])

  function askCoach(prompt = question) {
    const cleanQuestion = prompt.trim()
    if (!cleanQuestion || thinking) return

    setMessages((current) => [...current, {
      id: nextId.current++,
      speaker: 'you',
      text: cleanQuestion,
    }])
    setQuestion('')
    setThinking(true)
    replyTimer.current = window.setTimeout(() => {
      setMessages((current) => [...current, {
        id: nextId.current++,
        speaker: 'coach',
        text: answerQuestion(cleanQuestion),
      }])
      setThinking(false)
    }, 420)
  }

  return (
    <section className="coach-panel" aria-labelledby="coach-title">
      <header className="coach-header">
        <span className="coach-avatar" aria-hidden="true">A</span>
        <div><span className="coach-kicker">YOUR BUILT-IN AI COACH</span><h2 id="coach-title">A seat-side guide</h2></div>
        <span className="coach-status"><i /> HERE TO HELP</span>
      </header>
      <div className="coach-messages" ref={chatRef} role="log" aria-live="polite" aria-label="Conversation with Ani, your Blot coach">
        {messages.map((message) => (
          <div className={`coach-message coach-message-${message.speaker}`} key={message.id}>
            {message.speaker === 'coach' && <span className="coach-message-name">ANI</span>}
            <p>{message.text}</p>
          </div>
        ))}
        {thinking && <div className="coach-message coach-message-coach coach-thinking" aria-label="Ani is thinking"><span /><span /><span /></div>}
      </div>
      <div className="coach-prompts" aria-label="Try asking">
        {quickQuestions.map((prompt) => (
          <button type="button" className="coach-prompt" key={prompt} disabled={thinking} onClick={() => askCoach(prompt)}>{prompt}</button>
        ))}
      </div>
      <form className="coach-input-row" onSubmit={(event) => { event.preventDefault(); askCoach() }}>
        <label className="visually-hidden" htmlFor="coach-question">Ask Ani about Blot</label>
        <input id="coach-question" value={question} maxLength={240} placeholder="Ask me anything about Blot…" onChange={(event) => setQuestion(event.target.value)} />
        <button type="submit" className="button button-gold" disabled={!question.trim() || thinking}>Ask Ani <span aria-hidden="true">↗</span></button>
      </form>
      <p className="coach-note">I’m always here if you want to go over a rule again.</p>
    </section>
  )
}

export default function BeginnerPage({ onNavigate, onStart, onStartPractice }) {
  return (
    <section className="info-panel beginner-page">
      <span className="eyebrow">START HERE · NO EXPERIENCE NEEDED</span>
      <h1>New to <em>Blot?</em></h1>
      <p className="info-lead">Pull up a chair. We’ll take it one trick at a time.</p>
      <div className="beginner-layout">
        <div className="beginner-guide">
          <section className="beginner-basics" aria-labelledby="beginner-basics-title">
            <div className="beginner-section-heading"><span>THE BASICS</span><h2 id="beginner-basics-title">Three things to know</h2></div>
            <article><span>01</span><div><h3>You have a partner</h3><p>Four people play, and your teammate sits across from you. Work together to win tricks.</p></div></article>
            <article><span>02</span><div><h3>Play one card at a time</h3><p>Each of you plays a card to make a trick. Follow the suit led if you can. The winner leads the next one.</p></div></article>
            <article><span>03</span><div><h3>Trump can turn the trick</h3><p>The chosen trump suit beats other suits. Win enough tricks to make your team’s bid; first to {RULES.targetScore} points wins.</p></div></article>
          </section>
          <section className="beginner-card-orders" aria-labelledby="card-order-title">
            <div className="beginner-section-heading"><span>THE CHEAT SHEET</span><h2 id="card-order-title">Card order</h2><p>Read each row from strongest to weakest.</p></div>
            <CardOrder label="Trump suit" order={trumpOrder} trump />
            <CardOrder label="Other suits" order={plainOrder} />
            <p className="beginner-order-tip">That’s why the Jack of trump can beat an Ace from another suit.</p>
          </section>
        </div>
        <CoachChat />
      </div>
      <div className="beginner-actions">
        <button type="button" className="button button-gold" onClick={onStartPractice}>Try a guided practice game <span aria-hidden="true">↗</span></button>
        <button type="button" className="button button-quiet" onClick={onStart}>Play a regular game</button>
        <button type="button" className="button button-quiet" onClick={() => onNavigate('howTo')}>See the full rules</button>
      </div>
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}
