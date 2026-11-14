import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeck, dealHands, seededRandom } from '../src/game/deck.js'
import { cardPoints, legalCards, winningPlay } from '../src/game/rules.js'
import { scoreCompletedRound } from '../src/game/scoring.js'
import { createMatch, legalCardsForTurn, playCard, submitBid, takeAiTurn } from '../src/game/gameEngine.js'
import { recommendBid } from '../src/game/bidding.js'
import { readHandHistory, readPlayerStats, recordCompletedGame, recordCompletedHand } from '../src/game/playerProfile.js'
import { chooseCard } from '../src/game/ai.js'

const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank })

test('deck has 32 unique cards and deals eight to each seat', () => {
  const deck = createDeck()
  const hands = dealHands(deck)
  assert.equal(deck.length, 32)
  assert.equal(new Set(deck.map((item) => item.id)).size, 32)
  assert.deepEqual(hands.map((hand) => hand.length), [8, 8, 8, 8])
})

test('a seeded daily deal gives every player the same dealer and cards', () => {
  const first = createMatch([0, 0], undefined, 1, seededRandom(20261110))
  const second = createMatch([0, 0], undefined, 1, seededRandom(20261110))
  assert.equal(first.dealer, second.dealer)
  assert.deepEqual(first.players.map((player) => player.hand), second.players.map((player) => player.hand))
  assert.notDeepEqual(first.players[0].hand, createMatch([0, 0], undefined, 1, seededRandom(20261111)).players[0].hand)
})

test('player stats record wins, losses, draws, streaks, and completed daily challenges', () => {
  const originalStorage = globalThis.localStorage
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  }
  try {
    let stats = readPlayerStats()
    stats = recordCompletedGame(stats, 0, 0, '2026-11-10')
    stats = recordCompletedGame(stats, 0, 0, '2026-11-10')
    stats = recordCompletedGame(stats, 1, 0)
    stats = recordCompletedGame(stats, null, 0)
    assert.deepEqual(stats, {
      games: 4,
      wins: 2,
      losses: 1,
      draws: 1,
      dailyChallenges: 1,
      dailyCompletedDate: '2026-11-10',
      dailyCompletedDates: ['2026-11-10'],
      currentStreak: 0,
      bestStreak: 2,
    })
    assert.deepEqual(readPlayerStats(), stats)
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  }
})

test('completed hand reviews are saved and capped to the twenty most recent', () => {
  const originalStorage = globalThis.localStorage
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  }
  try {
    const finishedHand = {
      phase: 'roundOver',
      round: 1,
      players: [{ name: 'You', team: 0 }, { name: 'Aram', team: 1 }, { name: 'Mariam', team: 0 }, { name: 'Levon', team: 1 }],
      trump: 'hearts',
      contract: { value: 82, suit: 'hearts' },
      bidding: { history: [] },
      tricksWon: [{ winner: 0, plays: [{ playerIndex: 0, card: card('hearts', 'A') }] }],
      roundResult: { scores: [82, 80] },
    }
    for (let index = 0; index < 21; index += 1) recordCompletedHand({ ...finishedHand, round: index + 1 })
    const history = readHandHistory()
    assert.equal(history.length, 20)
    assert.equal(history[0].round, 21)
    assert.deepEqual(history[0].tricksWon[0].plays[0].card, card('hearts', 'A'))
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  }
})

test('bidding coach recommends pass for a weak hand and easy AI follows the led suit', () => {
  const weakHand = ['7', '8', '7', '8', '7', '8', '7', '8'].map((rank, index) => card(['hearts', 'diamonds', 'clubs', 'spades'][index % 4], rank))
  assert.equal(recommendBid(weakHand).action, 'pass')
  const hand = [card('hearts', '7'), card('clubs', 'A')]
  const trick = [{ playerIndex: 0, card: card('hearts', '8') }]
  const selected = chooseCard(hand, trick, 1, 'spades', [], 'measured', 'easy', () => 0)
  assert.equal(selected.id, card('hearts', '7').id)
})

test('trick winner prioritizes trump, then led suit, not an off-suit rank', () => {
  const plays = [
    { playerIndex: 0, card: card('hearts', 'A') },
    { playerIndex: 1, card: card('spades', '7') },
    { playerIndex: 2, card: card('spades', 'A') },
    { playerIndex: 3, card: card('clubs', '7') },
  ]
  assert.equal(winningPlay(plays, 'spades').playerIndex, 2)
  assert.equal(winningPlay(plays.slice(0, 3), 'clubs').playerIndex, 0)
})

test('legal cards require following suit and enforce cutting and overtrumping', () => {
  const heartsLead = [{ playerIndex: 0, card: card('hearts', '7') }]
  assert.deepEqual(legalCards([card('hearts', '8'), card('clubs', 'A')], heartsLead, 1, 'spades').map((item) => item.rank), ['8'])

  const opponentTrump = [
    { playerIndex: 0, card: card('hearts', '7') },
    { playerIndex: 1, card: card('spades', '8') },
  ]
  assert.deepEqual(legalCards([card('spades', '9'), card('clubs', 'A')], opponentTrump, 2, 'spades').map((item) => item.rank), ['9'])

  const partnerWinning = [
    { playerIndex: 0, card: card('hearts', '7') },
    { playerIndex: 1, card: card('spades', '8') },
  ]
  assert.deepEqual(legalCards([card('spades', '9'), card('clubs', 'A')], partnerWinning, 3, 'spades').map((item) => item.rank), ['9', 'A'])
})

test('round scoring settles a failed contract for the opposing team', () => {
  const result = scoreCompletedRound({
    tricksWon: [{ winner: 0, plays: [{ card: card('hearts', 'A') }] }],
    trump: 'spades',
    lastTrickTeam: 1,
    beloteTeam: null,
    contract: { team: 0, value: 162 },
  })
  assert.equal(result.contractMade, false)
  assert.deepEqual(result.roundPoints, [0, 162])
})

test('a complete hand advances through auction, eight tricks, and match completion', () => {
  let state = createMatch([490, 490], 3)
  state = submitBid(state, 0, { type: 'bid', value: 82, suit: 'hearts' })
  for (const playerIndex of [1, 2, 3]) state = submitBid(state, playerIndex, { type: 'pass' })
  assert.equal(state.phase, 'play')

  let turns = 0
  while (state.phase === 'play' && turns < 40) {
    if (state.turn === 0) {
      const result = playCard(state, 0, legalCardsForTurn(state, 0)[0].id)
      assert.equal(result.error, null)
      state = result.state
    } else {
      state = takeAiTurn(state)
    }
    turns += 1
  }

  assert.equal(state.phase, 'gameOver')
  assert.ok([0, 1].includes(state.roundResult.matchWinner))
  assert.equal(state.tricksWon.length, 8)
  assert.equal(state.roundResult.roundPoints[0] + state.roundResult.roundPoints[1], 162 + state.roundResult.bonuses[0] + state.roundResult.bonuses[1])
})

test('card values total 152 before the ten-point last trick bonus', () => {
  const deck = createDeck()
  for (const trump of ['hearts', 'diamonds', 'clubs', 'spades']) {
    assert.equal(deck.reduce((sum, item) => sum + cardPoints(item, trump), 0), 152)
  }
})

test('four opening passes redeal without changing scores or advancing the round', () => {
  let state = createMatch([120, 90], 3, 4)
  for (let index = 0; index < 4; index += 1) {
    state = submitBid(state, state.bidding.turn, { type: 'pass' })
  }
  assert.equal(state.phase, 'bidding')
  assert.equal(state.round, 4)
  assert.equal(state.dealer, 0)
  assert.deepEqual(state.scores, [120, 90])
  assert.deepEqual(state.players.map((player) => player.hand.length), [8, 8, 8, 8])
})