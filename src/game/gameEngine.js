import { chooseBid, chooseCard } from './ai.js'
import { dealHands, shuffleDeck } from './deck.js'
import { RULES, legalCards, teamForPlayer, winningPlay } from './rules.js'
import { scoreCompletedRound } from './scoring.js'

export const PLAYER_INFO = [
  { name: 'You', avatar: 'Y', human: true },
  { name: 'Aram', avatar: 'A', human: false, personality: 'measured' },
  { name: 'Mariam', avatar: 'M', human: false, personality: 'bold' },
  { name: 'Levon', avatar: 'L', human: false, personality: 'patient' },
]

export function createMatch(previousScores = [0, 0], dealer = Math.floor(Math.random() * 4), round = 1) {
  const hands = dealHands(shuffleDeck())
  const firstBidder = (dealer + 1) % 4
  return {
    phase: 'bidding',
    players: PLAYER_INFO.map((player, index) => ({ ...player, index, team: teamForPlayer(index), hand: hands[index] })),
    scores: [...previousScores],
    dealer,
    round,
    bidding: { turn: firstBidder, highest: null, consecutivePasses: 0, history: [], firstBidder },
    contract: null,
    trump: null,
    turn: firstBidder,
    trick: [],
    trickComplete: false,
    tricksWon: [],
    lastTrickTeam: null,
    beloteTeam: null,
    beloteAnnounced: [false, false, false, false],
    selectedCard: null,
    message: 'Bidding begins. Choose a contract or pass.',
    roundResult: null,
    redealCount: 0,
  }
}

function pushBid(state, playerIndex, action) {
  const history = [...state.bidding.history, { playerIndex, ...action }]
  const consecutivePasses = action.type === 'pass' ? state.bidding.consecutivePasses + 1 : 0
  let highest = state.bidding.highest
  if (action.type === 'bid') highest = { playerIndex, team: teamForPlayer(playerIndex), value: action.value, suit: action.suit }
  const bidding = { ...state.bidding, history, highest, consecutivePasses }

  if (!highest && consecutivePasses >= 4) {
    return createMatch(state.scores, (state.dealer + 1) % 4, state.round)
  }
  if (highest && consecutivePasses >= 3) {
    const lead = (state.dealer + 1) % 4
    return { ...state, phase: 'play', bidding, contract: highest, trump: highest.suit, turn: lead, message: `${PLAYER_INFO[highest.playerIndex].name} wins ${highest.value} in ${highest.suit}. Play begins.` }
  }
  const nextTurn = (playerIndex + 1) % 4
  return { ...state, bidding: { ...bidding, turn: nextTurn }, turn: nextTurn, message: action.type === 'pass' ? `${PLAYER_INFO[playerIndex].name} passes.` : `${PLAYER_INFO[playerIndex].name} bids ${action.value} in ${action.suit}.` }
}

export function submitBid(state, playerIndex, action) {
  if (state.phase !== 'bidding' || state.bidding.turn !== playerIndex) return state
  if (action.type === 'pass') return pushBid(state, playerIndex, action)
  const minimum = state.bidding.highest ? state.bidding.highest.value + RULES.bidStep : RULES.minimumBid
  if (!Number.isInteger(action.value) || action.value < minimum || action.value > RULES.maximumBid || (action.value - RULES.minimumBid) % RULES.bidStep !== 0) return state
  if (!['hearts', 'diamonds', 'clubs', 'spades'].includes(action.suit)) return state
  return pushBid(state, playerIndex, { type: 'bid', value: action.value, suit: action.suit })
}

export function legalCardsForTurn(state, playerIndex = state.turn) {
  return legalCards(state.players[playerIndex].hand, state.trickComplete ? [] : state.trick, playerIndex, state.trump)
}

export function playCard(state, playerIndex, cardId) {
  if (state.phase !== 'play' || state.turn !== playerIndex) return { state, error: 'It is not your turn.' }
  const player = state.players[playerIndex]
  const card = player.hand.find((held) => held.id === cardId)
  if (!card) return { state, error: 'That card is not in your hand.' }
  const activeTrick = state.trickComplete ? [] : state.trick
  if (!legalCardsForTurn(state, playerIndex).some((legal) => legal.id === cardId)) {
    const leadSuit = activeTrick[0]?.card.suit
    const current = activeTrick.length ? winningPlay(activeTrick, state.trump) : null
    const handHasLead = leadSuit && player.hand.some((held) => held.suit === leadSuit)
    const hasTrump = player.hand.some((held) => held.suit === state.trump)
    const mustOvertrump = !handHasLead && hasTrump && current?.card.suit === state.trump && current.playerIndex % 2 !== playerIndex % 2
    return { state, error: mustOvertrump ? 'You must beat the trump already played if you can.' : handHasLead ? 'You must follow the suit led.' : 'You must trump while the other team is winning.' }
  }

  const newPlayers = state.players.map((item, index) => index === playerIndex ? { ...item, hand: item.hand.filter((held) => held.id !== cardId) } : item)
  const trick = [...activeTrick, { playerIndex, card }]
  const holdsBelote = player.hand.some((held) => held.suit === state.trump && held.rank === (card.rank === 'K' ? 'Q' : 'K'))
  const beloteAnnounced = [...state.beloteAnnounced]
  let beloteTeam = state.beloteTeam
  let announcement = ''
  if (holdsBelote && (card.rank === 'K' || card.rank === 'Q') && !beloteAnnounced[playerIndex]) {
    beloteAnnounced[playerIndex] = true
    beloteTeam = player.team
    announcement = ' Belote-Rebelote +20.'
  }

  if (trick.length < 4) {
    return {
      state: { ...state, players: newPlayers, trick, trickComplete: false, turn: (playerIndex + 1) % 4, beloteAnnounced, beloteTeam, selectedCard: null, message: `${player.name} plays ${card.rank} of ${card.suit}.${announcement}` },
      error: null,
    }
  }

  const winning = winningPlay(trick, state.trump)
  const winnerTeam = teamForPlayer(winning.playerIndex)
  const completedTrick = { plays: trick, winner: winning.playerIndex }
  const tricksWon = [...state.tricksWon, completedTrick]
  if (newPlayers[0].hand.length === 0) {
    const roundResult = scoreCompletedRound({ tricksWon, trump: state.trump, lastTrickTeam: winnerTeam, beloteTeam, contract: state.contract })
    const scores = state.scores.map((score, team) => score + roundResult.roundPoints[team])
    const winner = scores.some((score) => score >= RULES.targetScore)
      ? scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
      : -1
    return {
      state: {
        ...state,
        players: newPlayers,
        phase: winner >= 0 ? 'gameOver' : 'roundOver',
        trick,
        trickComplete: true,
        tricksWon,
        lastTrickTeam: winnerTeam,
        turn: winning.playerIndex,
        scores,
        roundResult: { ...roundResult, scores, matchWinner: winner >= 0 ? winner : null },
        beloteAnnounced,
        beloteTeam,
        selectedCard: null,
        message: winner >= 0 ? `Team ${winner === 0 ? 'Gold' : 'Green'} wins the match.` : 'Round complete.',
      },
      error: null,
    }
  }
  return {
    state: { ...state, players: newPlayers, trick, trickComplete: true, tricksWon, lastTrickTeam: winnerTeam, turn: winning.playerIndex, beloteAnnounced, beloteTeam, selectedCard: null, message: `${PLAYER_INFO[winning.playerIndex].name} takes the trick.${announcement}` },
    error: null,
  }
}

export function takeAiTurn(state, random = Math.random) {
  if (state.phase === 'bidding' && state.players[state.bidding.turn].human === false) {
    const playerIndex = state.bidding.turn
    const bid = chooseBid(state.players[playerIndex].hand, state.bidding.highest?.value ?? 0, random)
    return submitBid(state, playerIndex, bid ? { type: 'bid', ...bid } : { type: 'pass' })
  }
  if (state.phase === 'play' && state.players[state.turn].human === false) {
    const playerIndex = state.turn
    const playedCards = state.tricksWon.flatMap((trick) => trick.plays.map((play) => play.card))
    const card = chooseCard(state.players[playerIndex].hand, state.trickComplete ? [] : state.trick, playerIndex, state.trump, playedCards)
    return playCard(state, playerIndex, card.id).state
  }
  return state
}

export function startNextRound(state) {
  return createMatch(state.scores, (state.dealer + 1) % 4, state.round + 1)
}