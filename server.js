import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'node:http'
import process from 'node:process'
import { createMatch, playCard, startNextRound, submitBid, takeAiTurn } from './src/game/gameEngine.js'

const port = Number(process.env.PORT || process.env.GAME_SERVER_PORT || 3001)
const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok' }))
    return
  }
  response.writeHead(404)
  response.end()
})
const server = new WebSocketServer({ server: httpServer })
const rooms = new Map()
const tournaments = new Map()
const matchmakingQueue = []
const codeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const tournamentTimeZone = 'America/Los_Angeles'
const tournamentTime = { hour: 14, minute: 0 }
const quickTournamentDelay = Number(process.env.QUICK_TOURNAMENT_DELAY_MS ?? 5 * 60 * 1000)
if (!Number.isSafeInteger(quickTournamentDelay) || quickTournamentDelay < 0) {
  throw new Error('QUICK_TOURNAMENT_DELAY_MS must be a non-negative integer.')
}
let quickTournamentEvent = null
const tournamentDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: tournamentTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function makeRoomCode() {
  let code
  do {
    code = Array.from({ length: 6 }, () => codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)]).join('')
  } while (rooms.has(code) || tournaments.has(code))
  return code
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 16) : ''
  return name || 'Player'
}

function datePartsInTournamentZone(date) {
  return Object.fromEntries(tournamentDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]))
}

function tournamentTimeToUtc(year, month, day) {
  const desiredLocal = Date.UTC(year, month - 1, day, tournamentTime.hour, tournamentTime.minute)
  let timestamp = desiredLocal
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = datePartsInTournamentZone(new Date(timestamp))
    const representedLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
    timestamp += desiredLocal - representedLocal
  }
  return new Date(timestamp)
}

function upcomingTournamentEvents(now = new Date()) {
  const local = datePartsInTournamentZone(now)
  const localDate = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day)))
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday)
  let daysUntilSunday = (7 - weekday) % 7
  let nextStart = tournamentTimeToUtc(localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, localDate.getUTCDate() + daysUntilSunday)
  if (nextStart <= now) daysUntilSunday += 7
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(localDate.getTime() + (daysUntilSunday + index * 7) * 24 * 60 * 60 * 1000)
    const startsAt = tournamentTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    return { id: `tournament-${dateKey}`, startsAt: startsAt.toISOString() }
  })
}

function getQuickTournamentEvent() {
  if (!quickTournamentEvent) {
    quickTournamentEvent = {
      id: `quick-${makeRoomCode()}`,
      startsAt: new Date(Date.now() + quickTournamentDelay).toISOString(),
      quick: true,
    }
  }
  return quickTournamentEvent
}

function getScheduledTournament(event) {
  let tournament = tournaments.get(event.id)
  if (!tournament) {
    tournament = {
      code: event.id,
      eventId: event.id,
      startsAt: event.startsAt,
      scheduled: true,
      quick: Boolean(event.quick),
      host: null,
      players: [],
      teams: new Map(),
      teamOrder: [],
      rounds: [],
      round: 0,
      champion: null,
      started: false,
    }
    tournaments.set(event.id, tournament)
  }
  return tournament
}

function playerCount(room) {
  return room.seats.filter(Boolean).length
}

function tournamentSnapshot(tournament, client) {
  return {
    type: 'tournament',
    roomCode: tournament.code,
    eventId: tournament.eventId || null,
    startsAt: tournament.startsAt || null,
    scheduled: Boolean(tournament.scheduled),
    quick: Boolean(tournament.quick),
    custom: Boolean(tournament.custom),
    title: tournament.title || null,
    host: tournament.host === client,
    started: tournament.started,
    round: tournament.round,
    champion: tournament.champion,
    players: tournament.players.map((player) => ({ name: player.name, team: player.teamName })),
    teams: [...tournament.teams.values()].map((team) => ({ name: team.name, players: team.players.map((player) => player.name) })),
    completeTeamCount: [...tournament.teams.values()].filter((team) => team.players.length === 2).length,
    rounds: tournament.rounds.map((round) => round.map((match) => ({
      teams: match.teamIds.map((id) => id ? tournament.teamOrder.find((team) => team.id === id)?.name || 'TBD' : 'BYE'),
      winner: match.winnerId ? tournament.teamOrder.find((team) => team.id === match.winnerId)?.name || null : null,
      complete: Boolean(match.winnerId),
      bye: Boolean(match.bye),
    }))),
  }
}

function broadcastTournament(tournament) {
  tournament.players.forEach((player) => {
    if (player.client) send(player.client.socket, tournamentSnapshot(tournament, player.client))
  })
}

function shuffle(values) {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }
  return shuffled
}

function startTournamentRound(tournament, teamIds) {
  const roundMatches = []
  let bracketSize = 1
  while (bracketSize < teamIds.length) bracketSize *= 2
  const matchCount = teamIds.length - bracketSize / 2
  const byeCount = teamIds.length - matchCount * 2
  const roundTeamIds = shuffle(teamIds)
  for (let index = 0; index < byeCount; index += 1) {
    roundMatches.push({ teamIds: [roundTeamIds[index], null], winnerId: roundTeamIds[index], roomCode: null, bye: true })
  }
  const playingTeams = roundTeamIds.slice(byeCount)
  for (let index = 0; index < playingTeams.length; index += 2) {
    const teamA = tournament.teamOrder.find((team) => team.id === playingTeams[index])
    const teamB = tournament.teamOrder.find((team) => team.id === playingTeams[index + 1])
    const match = { teamIds: [teamA.id, teamB.id], winnerId: null, roomCode: makeRoomCode() }
    const room = { code: match.roomCode, seats: [null, null, null, null], spectators: [], public: false, hostSeat: 0, state: null, aiTimer: null, tournamentCode: tournament.code, tournamentMatch: match }
    rooms.set(room.code, room)
    const roster = [teamA.players[0], teamB.players[0], teamA.players[1], teamB.players[1]]
    const state = createMatch()
    state.players = state.players.map((player, seat) => ({
      ...player,
      name: roster[seat].name,
      avatar: roster[seat].name.slice(0, 1).toUpperCase(),
      human: Boolean(roster[seat].client),
    }))
    roster.forEach((player, seat) => {
      if (!player.client) return
      room.seats[seat] = { name: player.name, client: player.client }
      player.client.roomCode = room.code
      player.client.seat = seat
    })
    room.state = state
    roundMatches.push(match)
    broadcastMatch(room)
    queueAiTurn(room)
  }
  tournament.rounds.push(roundMatches)
  tournament.round = tournament.rounds.length
  broadcastTournament(tournament)
}

function startTournament(tournament, hostStarted = false) {
  const eligibleTeams = [...tournament.teams.values()].filter((team) => team.players.length === 2)
  const canStart = tournament.custom
    ? eligibleTeams.length >= 2 && (hostStarted || Date.now() >= Date.parse(tournament.startsAt))
    : tournament.quick
      ? eligibleTeams.length >= 2
      : eligibleTeams.length === 8
  if (tournament.started || !canStart) return
  if (tournament.startsAt && Date.now() < Date.parse(tournament.startsAt) && !hostStarted) return
  tournament.started = true
  tournament.teamOrder = eligibleTeams.map((team, index) => ({ ...team, id: `team-${index + 1}` }))
  const teamIds = shuffle(tournament.teamOrder.map((team) => team.id))
  startTournamentRound(tournament, teamIds)
}

function sendScheduledTournaments(client) {
  const events = [getQuickTournamentEvent(), ...upcomingTournamentEvents()].map((event) => {
    const tournament = getScheduledTournament(event)
    return {
      ...tournamentSnapshot(tournament, client),
      id: event.id,
      startsAt: event.startsAt,
      playerCount: tournament.players.length,
      teamCount: tournament.teams.size,
      completeTeamCount: [...tournament.teams.values()].filter((team) => team.players.length === 2).length,
    }
  })
  send(client.socket, { type: 'tournaments', timeZone: tournamentTimeZone, items: events })
}

setInterval(() => {
  for (const tournament of tournaments.values()) {
    if (tournament.scheduled) startTournament(tournament)
  }
}, 1_000).unref()

function finishTournamentMatch(room) {
  const tournament = tournaments.get(room.tournamentCode)
  const match = room.tournamentMatch
  if (!tournament || !match || match.winnerId || room.state.phase !== 'gameOver') return
  if (room.state.roundResult.matchWinner === null) {
    const previousState = room.state
    const nextState = startNextRound(previousState)
    room.state = {
      ...nextState,
      players: nextState.players.map((player, index) => ({
        ...player,
        name: previousState.players[index].name,
        avatar: previousState.players[index].avatar,
        human: Boolean(room.seats[index]?.client),
      })),
    }
    broadcastMatch(room)
    return
  }
  match.winnerId = match.teamIds[room.state.roundResult.matchWinner]
  const currentRound = tournament.rounds.at(-1)
  if (!currentRound.every((roundMatch) => roundMatch.winnerId)) {
    broadcastTournament(tournament)
    return
  }
  const winners = currentRound.map((roundMatch) => roundMatch.winnerId)
  if (winners.length === 1) {
    tournament.champion = tournament.teamOrder.find((team) => team.id === winners[0])?.name || null
    broadcastTournament(tournament)
    return
  }
  startTournamentRound(tournament, winners)
}

function leaveTournament(client) {
  const tournament = tournaments.get(client.tournamentCode)
  if (!tournament) return
  const player = tournament.players.find((entry) => entry.client === client)
  if (player) {
    if (tournament.started) {
      player.client = null
      broadcastTournament(tournament)
    } else {
      tournament.players = tournament.players.filter((entry) => entry !== player)
      const team = tournament.teams.get(player.teamKey)
      if (team) {
        team.players = team.players.filter((entry) => entry !== player)
        if (!team.players.length) tournament.teams.delete(player.teamKey)
      }
      if (tournament.host === client) tournament.host = tournament.players[0]?.client || null
      if (!tournament.players.length) tournaments.delete(tournament.code)
      else broadcastTournament(tournament)
    }
  }
  client.tournamentCode = null
}

function sendLobby(room) {
  room.seats.forEach((seat, index) => {
    if (!seat?.client) return
    send(seat.client.socket, {
      type: 'lobby',
      roomCode: room.code,
      seat: index,
      host: room.hostSeat === index,
      started: Boolean(room.state),
      canStart: room.hostSeat === index && playerCount(room) >= 2 && !room.state,
      seats: room.seats.map((player, seatIndex) => player ? { index: seatIndex, name: player.name, connected: Boolean(player.client) } : null),
    })
  })
}

function broadcastQueueStatus() {
  matchmakingQueue.forEach((client) => send(client.socket, { type: 'matchmaking', status: 'waiting', waiting: matchmakingQueue.length }))
}

function matchForSeat(room, seat) {
  return {
    ...room.state,
    players: room.state.players.map((player, index) => ({
      ...player,
      hand: index === seat ? player.hand : Array(player.hand.length).fill(null),
    })),
  }
}

function matchForSpectator(room) {
  return {
    ...room.state,
    players: room.state.players.map((player) => ({ ...player, hand: Array(player.hand.length).fill(null) })),
  }
}

function publicRoomList() {
  return [...rooms.values()]
    .filter((room) => room.public && room.state && room.state.phase !== 'gameOver')
    .map((room) => ({
      roomCode: room.code,
      players: room.seats.filter(Boolean).map((player) => player.name),
      playerCount: playerCount(room),
      spectatorCount: room.spectators?.length || 0,
    }))
}

function sendPublicRooms(client) {
  send(client.socket, { type: 'rooms', rooms: publicRoomList() })
}

function broadcastMatch(room) {
  room.seats.forEach((player, seat) => {
    if (!player?.client) return
    send(player.client.socket, { type: 'match', roomCode: room.code, seat, spectator: false, spectatorCount: room.spectators?.length || 0, match: matchForSeat(room, seat) })
  })
  room.spectators?.forEach((client) => send(client.socket, { type: 'match', roomCode: room.code, spectator: true, spectatorCount: room.spectators.length, match: matchForSpectator(room) }))
}

function addRoomPlayer(room, client, seat, name) {
  room.seats[seat] = { name, client }
  client.roomCode = room.code
  client.seat = seat
}

function applyRoomPlayers(room, state) {
  return {
    ...state,
    players: state.players.map((player, index) => {
      const roomPlayer = room.seats[index]
      if (!roomPlayer) return player
      return { ...player, name: roomPlayer.name, avatar: roomPlayer.name.slice(0, 1).toUpperCase(), human: true }
    }),
  }
}

function isAiTurn(state) {
  const turn = state.phase === 'bidding' ? state.bidding.turn : state.phase === 'play' ? state.turn : null
  return turn !== null && !state.players[turn].human
}

function queueAiTurn(room) {
  if (room.aiTimer) clearTimeout(room.aiTimer)
  if (!room.state || !isAiTurn(room.state)) return
  room.aiTimer = setTimeout(() => {
    room.aiTimer = null
    if (!room.state || !isAiTurn(room.state)) return
    room.state = takeAiTurn(room.state)
    broadcastMatch(room)
    if (room.tournamentCode && room.state.phase === 'gameOver') finishTournamentMatch(room)
    queueAiTurn(room)
  }, 700)
}

function beginMatch(room) {
  room.state = applyRoomPlayers(room, createMatch())
  sendLobby(room)
  broadcastMatch(room)
  queueAiTurn(room)
}

function startQueuedMatch() {
  const clients = matchmakingQueue.splice(0, 4)
  const room = { code: makeRoomCode(), seats: [null, null, null, null], spectators: [], public: false, hostSeat: 0, state: null, aiTimer: null }
  rooms.set(room.code, room)
  clients.forEach((client, seat) => {
    client.matchmaking = false
    addRoomPlayer(room, client, seat, client.playerName)
  })
  beginMatch(room)
  broadcastQueueStatus()
}

function sendError(client, message) {
  send(client.socket, { type: 'error', message })
}

function detach(client) {
  if (client.matchmaking) {
    const queueIndex = matchmakingQueue.indexOf(client)
    if (queueIndex >= 0) matchmakingQueue.splice(queueIndex, 1)
    client.matchmaking = false
    broadcastQueueStatus()
  }
  if (client.spectating) {
    const room = rooms.get(client.roomCode)
    if (room) {
      room.spectators = room.spectators.filter((spectator) => spectator !== client)
      broadcastMatch(room)
    }
    client.roomCode = null
    client.seat = null
    client.spectating = false
    return
  }
  const room = rooms.get(client.roomCode)
  if (!room || client.seat === null) {
    if (client.tournamentCode) leaveTournament(client)
    return
  }
  const seat = room.seats[client.seat]
  if (seat?.client === client) {
    if (room.state) {
      room.state = {
        ...room.state,
        players: room.state.players.map((player, index) => index === client.seat ? { ...player, human: false } : player),
      }
      room.seats[client.seat] = null
      if (room.hostSeat === client.seat) room.hostSeat = room.seats.findIndex((player) => player?.client)
      broadcastMatch(room)
      sendLobby(room)
      queueAiTurn(room)
    } else {
      room.seats[client.seat] = null
      if (room.hostSeat === client.seat) room.hostSeat = room.seats.findIndex(Boolean)
      if (playerCount(room) === 0) rooms.delete(room.code)
      else sendLobby(room)
    }
  }
  client.roomCode = null
  client.seat = null
  if (client.tournamentCode) leaveTournament(client)
}

function handleMessage(client, message) {
  if (message.type === 'list_rooms') {
    sendPublicRooms(client)
    return
  }

  if (message.type === 'spectate_room') {
    if (client.roomCode || client.tournamentCode || client.matchmaking) return sendError(client, 'Leave your current room or search before watching another game.')
    const code = typeof message.roomCode === 'string' ? message.roomCode.trim().toUpperCase() : ''
    const room = rooms.get(code)
    if (!room?.state || room.state.phase === 'gameOver') return sendError(client, 'That live game was not found. Check the code or refresh public tables.')
    room.spectators ||= []
    room.spectators.push(client)
    client.roomCode = room.code
    client.seat = null
    client.spectating = true
    broadcastMatch(room)
    return
  }

  if (message.type === 'list_tournaments') {
    sendScheduledTournaments(client)
    return
  }

  if (message.type === 'create_tournament' || message.type === 'join_tournament') {
    if (client.roomCode || client.tournamentCode || client.matchmaking) return sendError(client, 'Leave your current game or search before joining a tournament.')
    const teamName = typeof message.teamName === 'string' ? message.teamName.trim().replace(/\s+/g, ' ').slice(0, 20) : ''
    if (!teamName) return sendError(client, 'Enter a duo name to join the tournament with your partner.')
    let tournament
    if (message.type === 'create_tournament') {
      const title = typeof message.tournamentName === 'string' ? message.tournamentName.trim().replace(/\s+/g, ' ').slice(0, 40) : ''
      if (!title) return sendError(client, 'Enter a name for your tournament.')
      const startTime = typeof message.startsAt === 'string' ? Date.parse(message.startsAt) : NaN
      if (!Number.isFinite(startTime) || startTime <= Date.now()) return sendError(client, 'Choose a tournament date and time in the future.')
      const code = makeRoomCode()
      tournament = { code, title, startsAt: new Date(startTime).toISOString(), scheduled: true, custom: true, host: client, players: [], teams: new Map(), teamOrder: [], rounds: [], round: 0, champion: null, started: false }
      tournaments.set(code, tournament)
    } else {
      const code = typeof message.roomCode === 'string' ? message.roomCode.trim().toUpperCase() : ''
      const event = [getQuickTournamentEvent(), ...upcomingTournamentEvents()].find((scheduledEvent) => scheduledEvent.id.toUpperCase() === code)
      tournament = tournaments.get(code) || (event ? getScheduledTournament(event) : null)
      if (!tournament) return sendError(client, 'That tournament was not found. Check the code and try again.')
      if (tournament.started) return sendError(client, 'That tournament has already started.')
    }
    const teamKey = teamName.toLowerCase()
    let team = tournament.teams.get(teamKey)
    if (team && team.players.length >= 2) return sendError(client, 'That duo already has two players. Ask your partner for the correct team name.')
    if (!team && tournament.teams.size >= 8) return sendError(client, 'All eight duos are full.')
    if (!team) {
      team = { name: teamName, players: [] }
      tournament.teams.set(teamKey, team)
    }
    const player = { name: cleanName(message.name), teamName: team.name, teamKey, client }
    team.players.push(player)
    tournament.players.push(player)
    client.tournamentCode = tournament.code
    broadcastTournament(tournament)
    startTournament(tournament)
    return
  }

  if (message.type === 'start_tournament') {
    const tournament = tournaments.get(client.tournamentCode)
    if (!tournament || !tournament.custom) return sendError(client, 'You are not in a custom tournament.')
    if (tournament.host !== client) return sendError(client, 'Only the tournament host can start it.')
    const completeTeamCount = [...tournament.teams.values()].filter((team) => team.players.length === 2).length
    if (completeTeamCount < 2) return sendError(client, 'At least two complete duos are needed to start.')
    startTournament(tournament, true)
    return
  }

  if (message.type === 'leave_tournament') {
    if (!client.tournamentCode) return sendError(client, 'You are not in a tournament.')
    leaveTournament(client)
    if (client.roomCode) {
      const room = rooms.get(client.roomCode)
      if (room && client.seat !== null && room.seats[client.seat]?.client === client) {
        room.seats[client.seat] = null
        if (room.state) room.state = { ...room.state, players: room.state.players.map((player, index) => index === client.seat ? { ...player, human: false } : player) }
        client.roomCode = null
        client.seat = null
        if (room.state) {
          broadcastMatch(room)
          queueAiTurn(room)
        }
      }
    }
    send(client.socket, { type: 'left_tournament' })
    sendScheduledTournaments(client)
    return
  }

  if (message.type === 'create_room') {
    if (client.roomCode || client.tournamentCode) return sendError(client, 'Leave your current room before creating another.')
    const room = { code: makeRoomCode(), seats: [null, null, null, null], spectators: [], public: message.public !== false, hostSeat: 0, state: null, aiTimer: null }
    rooms.set(room.code, room)
    addRoomPlayer(room, client, 0, cleanName(message.name))
    sendLobby(room)
    return
  }

  if (message.type === 'join_room') {
    if (client.roomCode || client.tournamentCode) return sendError(client, 'Leave your current room before joining another.')
    const code = typeof message.roomCode === 'string' ? message.roomCode.trim().toUpperCase() : ''
    const room = rooms.get(code)
    if (!room) return sendError(client, 'That room was not found. Check the code and try again.')
    if (room.state) return sendError(client, 'That game has already started.')
    const seat = room.seats.findIndex((player) => !player)
    if (seat < 0) return sendError(client, 'That room is full.')
    addRoomPlayer(room, client, seat, cleanName(message.name))
    sendLobby(room)
    return
  }

  if (message.type === 'find_match') {
    if (client.roomCode || client.tournamentCode) return sendError(client, 'Leave your current room before searching for players.')
    if (client.matchmaking) return send(client.socket, { type: 'matchmaking', status: 'waiting', waiting: matchmakingQueue.length })
    client.playerName = cleanName(message.name)
    client.matchmaking = true
    matchmakingQueue.push(client)
    if (matchmakingQueue.length === 4) startQueuedMatch()
    else broadcastQueueStatus()
    return
  }

  if (message.type === 'cancel_match') {
    if (client.matchmaking) {
      const queueIndex = matchmakingQueue.indexOf(client)
      if (queueIndex >= 0) matchmakingQueue.splice(queueIndex, 1)
      client.matchmaking = false
      send(client.socket, { type: 'matchmaking', status: 'cancelled', waiting: matchmakingQueue.length })
      broadcastQueueStatus()
    }
    return
  }

  const room = rooms.get(client.roomCode)
  if (client.spectating) {
    if (message.type === 'leave_room') {
      detach(client)
      send(client.socket, { type: 'left_room' })
      return
    }
    return sendError(client, 'Spectators cannot take player actions.')
  }
  if (!room || room.seats[client.seat]?.client !== client) return sendError(client, 'Join a room before taking that action.')

  if (message.type === 'leave_room') {
    detach(client)
    send(client.socket, { type: 'left_room' })
    return
  }

  if (message.type === 'start_game') {
    if (client.seat !== room.hostSeat) return sendError(client, 'Only the host can start this game.')
    if (playerCount(room) < 2) return sendError(client, 'Invite at least one other player to start.')
    if (room.state) return sendError(client, 'This game has already started.')
    beginMatch(room)
    return
  }

  if (!room.state) return sendError(client, 'The host has not started the game yet.')

  if (message.type === 'bid') {
    if (room.state.phase !== 'bidding' || room.state.bidding.turn !== client.seat) return sendError(client, 'It is not your turn to bid.')
    const nextState = submitBid(room.state, client.seat, message.action)
    if (nextState === room.state) return sendError(client, 'That bid is not valid.')
    room.state = nextState
  } else if (message.type === 'play') {
    if (room.state.phase !== 'play' || room.state.turn !== client.seat) return sendError(client, 'It is not your turn to play.')
    const result = playCard(room.state, client.seat, message.cardId)
    if (result.error) return sendError(client, result.error)
    room.state = result.state
  } else if (message.type === 'next_round') {
    if (room.tournamentCode && room.state.phase === 'gameOver') return sendError(client, 'This tournament match is complete.')
    if (!room.tournamentCode && client.seat !== room.hostSeat) return sendError(client, 'Only the host can start the next round.')
    if (!['roundOver', 'gameOver'].includes(room.state.phase)) return sendError(client, 'The current round is still in progress.')
    room.state = applyRoomPlayers(room, startNextRound(room.state))
  } else if (message.type === 'restart_match') {
    if (room.tournamentCode) return sendError(client, 'Tournament matches cannot be restarted.')
    if (client.seat !== room.hostSeat) return sendError(client, 'Only the host can restart the match.')
    room.state = applyRoomPlayers(room, createMatch())
  } else {
    return sendError(client, 'Unknown game action.')
  }

  broadcastMatch(room)
  if (room.tournamentCode && room.state.phase === 'gameOver') finishTournamentMatch(room)
  queueAiTurn(room)
}

server.on('connection', (socket) => {
  const client = { socket, roomCode: null, seat: null, spectating: false, tournamentCode: null, matchmaking: false, playerName: 'Player' }
  socket.on('message', (payload) => {
    let message
    try {
      message = JSON.parse(payload.toString())
    } catch {
      return sendError(client, 'Invalid message.')
    }
    try {
      handleMessage(client, message)
    } catch (error) {
      console.error('Could not process game action:', error)
      sendError(client, 'The game could not process that action.')
    }
  })
  socket.on('close', () => detach(client))
})

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Bazar Blot game server listening on port ${port}`)
})