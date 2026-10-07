import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeck, dealHands } from '../src/game/deck.js'
import { cardPoints, legalCards, winningPlay } from '../src/game/rules.js'
import { scoreCompletedRound } from '../src/game/scoring.js'
import { createMatch, legalCardsForTurn, playCard, submitBid, takeAiTurn } from '../src/game/gameEngine.js'

const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank })

test('deck has 32 unique cards and deals eight to each seat', () => {
  const deck = createDeck()
  const hands = dealHands(deck)
  assert.equal(deck.length, 32)
  assert.equal(new Set(deck.map((item) => item.id)).size, 32)
  assert.deepEqual(hands.map((hand) => hand.length), [8, 8, 8, 8])
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