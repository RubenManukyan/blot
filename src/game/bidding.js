import { availableBids, RULES } from './rules.js'
import { SUITS } from './deck.js'

export function evaluateHandForBid(hand, trump) {
  const trumpCards = hand.filter((card) => card.suit === trump)
  const trumpPower = trumpCards.reduce((sum, card) => sum + ({ J: 4.5, '9': 3.2, A: 2.1, '10': 1.7, K: 0.8, Q: 0.5, '8': 0.2, '7': 0 }[card.rank]), 0)
  const sideAces = hand.filter((card) => card.suit !== trump && card.rank === 'A').length
  const voids = SUITS.filter((suit) => suit !== trump && !hand.some((card) => card.suit === suit)).length
  return trumpPower + sideAces * 1.15 + voids * 0.55 + Math.max(0, trumpCards.length - 2) * 0.8
}

export function chooseBid(hand, highestBid, random = Math.random, personality = 'measured') {
  const bids = availableBids(highestBid)
  if (!bids.length) return null
  const options = SUITS
    .map((suit) => ({ suit, strength: evaluateHandForBid(hand, suit) }))
    .sort((left, right) => right.strength - left.strength)
  const best = options[0]
  const threshold = ({ bold: 3.7, patient: 5.1, measured: 4.4 }[personality] ?? 4.4) + Math.max(0, highestBid - RULES.minimumBid) / 30
  if (best.strength < threshold || random() > Math.min(0.9, 0.48 + (best.strength - threshold) * 0.12)) return null
  const desired = RULES.minimumBid + Math.max(0, Math.floor((best.strength - threshold) / 1.6)) * RULES.bidStep
  const bid = bids.filter((value) => value <= desired).at(-1) ?? bids[0]
  if (bid > RULES.maximumBid) return null
  return { value: bid, suit: best.suit }
}