const STATS_KEY = 'blot-player-stats'
const FRIENDS_KEY = 'blot-friends'
const PREFERENCES_KEY = 'blot-preferences'
const HAND_HISTORY_KEY = 'blot-hand-history'

export const DEFAULT_PREFERENCES = Object.freeze({
  aiSpeed: 720,
  hintsAlwaysOn: false,
  cardSize: 'standard',
  aiDifficulty: 'standard',
})

export function readPlayerStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY) || '{}')
    return {
      games: Number.isInteger(saved.games) ? saved.games : 0,
      wins: Number.isInteger(saved.wins) ? saved.wins : 0,
      losses: Number.isInteger(saved.losses) ? saved.losses : 0,
      draws: Number.isInteger(saved.draws) ? saved.draws : 0,
      dailyChallenges: Number.isInteger(saved.dailyChallenges) ? saved.dailyChallenges : 0,
      dailyCompletedDate: typeof saved.dailyCompletedDate === 'string' ? saved.dailyCompletedDate : '',
      dailyCompletedDates: Array.isArray(saved.dailyCompletedDates) ? [...new Set(saved.dailyCompletedDates.filter((date) => typeof date === 'string'))] : [],
      currentStreak: Number.isInteger(saved.currentStreak) ? saved.currentStreak : 0,
      bestStreak: Number.isInteger(saved.bestStreak) ? saved.bestStreak : 0,
    }
  } catch {
    return { games: 0, wins: 0, losses: 0, draws: 0, dailyChallenges: 0, dailyCompletedDate: '', dailyCompletedDates: [], currentStreak: 0, bestStreak: 0 }
  }
}

export function recordCompletedGame(stats, winnerTeam, playerTeam = 0, dailyChallengeDate = '') {
  const isWin = winnerTeam === playerTeam
  const isDraw = winnerTeam === null
  const completedDailyDates = stats.dailyCompletedDates || []
  const isNewDailyCompletion = Boolean(dailyChallengeDate) && !completedDailyDates.includes(dailyChallengeDate)
  const currentStreak = isWin ? stats.currentStreak + 1 : 0
  const next = {
    games: stats.games + 1,
    wins: stats.wins + Number(isWin),
    losses: stats.losses + Number(!isWin && !isDraw),
    draws: stats.draws + Number(isDraw),
    dailyChallenges: stats.dailyChallenges + Number(isNewDailyCompletion),
    dailyCompletedDate: dailyChallengeDate || stats.dailyCompletedDate,
    dailyCompletedDates: isNewDailyCompletion ? [...completedDailyDates, dailyChallengeDate] : completedDailyDates,
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(next))
  return next
}

export function readPlayerPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')
    return {
      aiSpeed: [720, 1400, 2200].includes(saved.aiSpeed) ? saved.aiSpeed : DEFAULT_PREFERENCES.aiSpeed,
      hintsAlwaysOn: saved.hintsAlwaysOn === true,
      cardSize: ['small', 'standard', 'large'].includes(saved.cardSize) ? saved.cardSize : DEFAULT_PREFERENCES.cardSize,
      aiDifficulty: ['easy', 'standard', 'challenging'].includes(saved.aiDifficulty) ? saved.aiDifficulty : DEFAULT_PREFERENCES.aiDifficulty,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function readHandHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HAND_HISTORY_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((hand) => hand && typeof hand.id === 'string' && Array.isArray(hand.tricksWon)) : []
  } catch {
    return []
  }
}

export function recordCompletedHand(state) {
  if (!state?.roundResult || !Array.isArray(state.tricksWon)) return readHandHistory()
  const history = readHandHistory()
  const record = {
    id: `${Date.now()}-${state.round}-${state.roundResult.scores.join('-')}`,
    playedAt: new Date().toISOString(),
    round: state.round,
    players: state.players.map(({ name, team }) => ({ name, team })),
    trump: state.trump,
    contract: state.contract,
    lastTrickTeam: state.lastTrickTeam,
    biddingHistory: state.bidding.history,
    tricksWon: state.tricksWon,
    roundResult: state.roundResult,
  }
  const next = [record, ...history].slice(0, 20)
  localStorage.setItem(HAND_HISTORY_KEY, JSON.stringify(next))
  return next
}

export function savePlayerPreferences(preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
}

export function readFriends() {
  try {
    const friends = JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]')
    if (!Array.isArray(friends)) return []
    return [...new Set(friends.filter((friend) => typeof friend === 'string').map((friend) => friend.trim()).filter(Boolean))]
  } catch {
    return []
  }
}

export function saveFriends(friends) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends))
  return friends
}

export function seedFromString(value) {
  let seed = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }
  return seed >>> 0 || 1
}
