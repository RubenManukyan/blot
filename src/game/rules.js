import { SUITS } from './deck.js'

export const RULES = Object.freeze({
  name: 'Partnership Blot',
  minimumBid: 82,
  bidStep: 10,
  maximumBid: 162,
  targetScore: 501,
  seatsPerTeam: 2,
  lastTrickBonus: 10,
  beloteBonus: 20,
  allPass: 'redeal',
})

export const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export const SUIT_NAMES = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades',
}

export function teamForPlayer(playerIndex) {
  return playerIndex % 2 === 0 ? 0 : 1
}

export function cardPoints(card, trump) {
  if (card.suit === trump) {
    return { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 }[card.rank]
  }
  return { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 }[card.rank]
}

export function cardStrength(card, trump) {
  const trumpOrder = { J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1 }
  const plainOrder = { A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1 }
  return card.suit === trump ? trumpOrder[card.rank] : plainOrder[card.rank]
}

export function winningPlay(plays, trump) {
  if (!plays.length) return null
  const leadSuit = plays[0].card.suit
  return plays.reduce((winner, play) => {
    const winnerCategory = winner.card.suit === trump ? 2 : winner.card.suit === leadSuit ? 1 : 0
    const playCategory = play.card.suit === trump ? 2 : play.card.suit === leadSuit ? 1 : 0
    if (playCategory > winnerCategory) return play
    if (playCategory === winnerCategory && playCategory > 0 && cardStrength(play.card, trump) > cardStrength(winner.card, trump)) return play
    return winner
  })
}

export function legalCards(hand, trick, playerIndex, trump) {
  if (!trick.length) return hand
  const leadSuit = trick[0].card.suit
  const following = hand.filter((card) => card.suit === leadSuit)
  if (following.length) return following

  const trumps = hand.filter((card) => card.suit === trump)
  const currentWinner = winningPlay(trick, trump)
  const partnerIsWinning = currentWinner.playerIndex % 2 === playerIndex % 2
  if (!trumps.length || partnerIsWinning) return hand

  if (currentWinner.card.suit === trump) {
    const overtrumps = trumps.filter((card) => cardStrength(card, trump) > cardStrength(currentWinner.card, trump))
    if (overtrumps.length) return overtrumps
  }
  return trumps
}

export function describeIllegalPlay(hand, trick, card, playerIndex, trump) {
  if (!hand.some((heldCard) => heldCard.id === card.id)) return 'That card is not in your hand.'
  if (!trick.length) return ''
  const legal = legalCards(hand, trick, playerIndex, trump)
  if (legal.some((candidate) => candidate.id === card.id)) return ''
  const leadSuit = trick[0].card.suit
  if (hand.some((heldCard) => heldCard.suit === leadSuit)) return `You must follow ${SUIT_NAMES[leadSuit]}.`
  const currentWinner = winningPlay(trick, trump)
  if (hand.some((heldCard) => heldCard.suit === trump) && currentWinner.playerIndex % 2 !== playerIndex % 2) {
    if (currentWinner.card.suit === trump && hand.some((heldCard) => heldCard.suit === trump && cardStrength(heldCard, trump) > cardStrength(currentWinner.card, trump))) {
      return 'You must overtrump if you can.'
    }
    return 'You must play a trump card while the other team is winning.'
  }
  return 'That card cannot be played on this trick.'
}

export function availableBids(highestBid) {
  const first = Math.max(RULES.minimumBid, highestBid + RULES.bidStep)
  return Array.from({ length: Math.max(0, Math.floor((RULES.maximumBid - first) / RULES.bidStep) + 1) }, (_, index) => first + index * RULES.bidStep)
}

export const SUIT_ORDER = SUITS