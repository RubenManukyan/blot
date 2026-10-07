export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
export const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({
    id: `${suit}-${rank}`,
    suit,
    rank,
  })))
}

export function shuffleDeck(deck = createDeck(), random = Math.random) {
  const shuffled = [...deck]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

export function dealHands(deck = shuffleDeck()) {
  return Array.from({ length: 4 }, (_, playerIndex) =>
    deck.slice(playerIndex * 8, (playerIndex + 1) * 8),
  )
}