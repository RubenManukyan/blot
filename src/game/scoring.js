import { cardPoints, RULES, teamForPlayer } from './rules.js'

export function scoreCompletedRound({ tricksWon, trump, lastTrickTeam, beloteTeam, contract }) {
  const cardPointsByTeam = [0, 0]
  tricksWon.forEach((trick) => {
    if (trick.plays.length) {
      const team = teamForPlayer(trick.winner)
      cardPointsByTeam[team] += trick.plays.reduce((sum, play) => sum + cardPoints(play.card, trump), 0)
    }
  })
  cardPointsByTeam[lastTrickTeam] += RULES.lastTrickBonus

  const bonuses = [0, 0]
  if (beloteTeam !== null) bonuses[beloteTeam] += RULES.beloteBonus
  const earnedBeforeContract = cardPointsByTeam.map((points, team) => points + bonuses[team])
  const contractMade = earnedBeforeContract[contract.team] >= contract.value
  const roundPoints = contractMade
    ? earnedBeforeContract
    : earnedBeforeContract.map((_, team) => team === contract.team ? bonuses[team] : 162 + bonuses[team])

  return {
    cardPoints: cardPointsByTeam,
    bonuses,
    earnedBeforeContract,
    roundPoints,
    contractMade,
    contractTeam: contract.team,
    roundWinner: roundPoints[0] === roundPoints[1] ? null : roundPoints[0] > roundPoints[1] ? 0 : 1,
  }
}