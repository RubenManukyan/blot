import { chooseBid } from './bidding.js'
import { createDeck } from './deck.js'
import { cardStrength, legalCards, teamForPlayer, winningPlay } from './rules.js'

export { chooseBid }

function cardCost(card, trump, personality) {
  const strength = cardStrength(card, trump)
  const preserveWeight = personality === 'patient' ? 2.6 : personality === 'bold' ? 1.5 : 2
  return (card.suit === trump ? 40 : 0) + strength * preserveWeight
}

export function chooseCard(hand, trick, playerIndex, trump, playedCards = [], personality = 'measured') {
  const legal = legalCards(hand, trick, playerIndex, trump)
  if (legal.length === 1) return legal[0]

  if (!trick.length) {
    const playedIds = new Set(playedCards.map((card) => card.id))
    const unseenCards = createDeck().filter((card) =>
      !hand.some((held) => held.id === card.id) && !playedIds.has(card.id),
    )
    return [...legal].sort((left, right) => {
      const leftThreatened = unseenCards.some((card) => card.suit === left.suit && cardStrength(card, trump) > cardStrength(left, trump))
      const rightThreatened = unseenCards.some((card) => card.suit === right.suit && cardStrength(card, trump) > cardStrength(right, trump))
      const leftScore = (left.rank === 'A' ? 16 : left.rank === 'J' && left.suit === trump ? 20 : 0) + (leftThreatened ? 0 : 9) - cardCost(left, trump, personality) * 0.22
      const rightScore = (right.rank === 'A' ? 16 : right.rank === 'J' && right.suit === trump ? 20 : 0) + (rightThreatened ? 0 : 9) - cardCost(right, trump, personality) * 0.22
      return rightScore - leftScore
    })[0]
  }

  const currentWinner = winningPlay(trick, trump)
  const partnerWinning = teamForPlayer(currentWinner.playerIndex) === teamForPlayer(playerIndex)
  const canWin = legal.filter((card) => {
    const candidateWinner = winningPlay([...trick, { playerIndex, card }], trump)
    return candidateWinner.playerIndex === playerIndex
  })

  if (partnerWinning) {
    return [...legal].sort((left, right) => cardCost(left, trump, personality) - cardCost(right, trump, personality))[0]
  }
  if (canWin.length) {
    return [...canWin].sort((left, right) => cardCost(left, trump, personality) - cardCost(right, trump, personality))[0]
  }
  return [...legal].sort((left, right) => cardCost(left, trump, personality) - cardCost(right, trump, personality))[0]
}