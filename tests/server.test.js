import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { WebSocket } from 'ws'

const serverPath = fileURLToPath(new URL('../server.js', import.meta.url))

async function unusedPort() {
  const portServer = createServer()
  await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve))
  const { port } = portServer.address()
  await new Promise((resolve) => portServer.close(resolve))
  return port
}

async function startGameServer(environment = {}) {
  const port = await unusedPort()
  const child = spawn(process.execPath, [serverPath], { env: { ...process.env, ...environment, PORT: String(port) }, stdio: 'ignore' })
  const healthUrl = `http://127.0.0.1:${port}/health`
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Game server exited before becoming ready.')
    try {
      const response = await fetch(healthUrl)
      if (response.ok) return { child, url: `ws://127.0.0.1:${port}` }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  child.kill()
  throw new Error('Game server did not become ready.')
}

function messageReader(socket) {
  const messages = []
  const waiters = []
  socket.on('message', (payload) => {
    const message = JSON.parse(payload.toString())
    const waiterIndex = waiters.findIndex((waiter) => waiter.predicate(message))
    if (waiterIndex < 0) messages.push(message)
    else waiters.splice(waiterIndex, 1)[0].resolve(message)
  })
  return {
    next(predicate) {
      const messageIndex = messages.findIndex(predicate)
      if (messageIndex >= 0) return Promise.resolve(messages.splice(messageIndex, 1)[0])
      return new Promise((resolve) => waiters.push({ predicate, resolve }))
    },
  }
}

async function connectPlayer(url, name) {
  const socket = new WebSocket(url)
  await once(socket, 'open')
  const reader = messageReader(socket)
  socket.send(JSON.stringify({ type: 'find_match', name }))
  return { socket, reader }
}

test('matchmaking cancels cleanly and starts a four-player online match', async (context) => {
  const gameServer = await startGameServer()
  context.after(() => {
    gameServer.child.kill()
  })

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))

  const first = await connectPlayer(gameServer.url, 'One')
  const second = await connectPlayer(gameServer.url, 'Two')
  players.push(first, second)
  assert.equal((await first.reader.next((message) => message.type === 'matchmaking')).waiting, 1)
  assert.equal((await second.reader.next((message) => message.type === 'matchmaking')).waiting, 2)

  first.socket.send(JSON.stringify({ type: 'cancel_match' }))
  assert.equal((await first.reader.next((message) => message.status === 'cancelled')).type, 'matchmaking')
  assert.equal((await second.reader.next((message) => message.type === 'matchmaking')).waiting, 1)
  second.socket.send(JSON.stringify({ type: 'cancel_match' }))
  await second.reader.next((message) => message.status === 'cancelled')

  for (const player of [first, second]) {
    player.socket.send(JSON.stringify({ type: 'find_match', name: player === first ? 'One' : 'Two' }))
    await player.reader.next((message) => message.type === 'matchmaking' && message.status === 'waiting')
  }
  const third = await connectPlayer(gameServer.url, 'Three')
  players.push(third)
  await third.reader.next((message) => message.type === 'matchmaking')
  const fourth = await connectPlayer(gameServer.url, 'Four')
  players.push(fourth)

  const matches = await Promise.all(players.map(({ reader }) => reader.next((message) => message.type === 'match')))
  assert.equal(new Set(matches.map((message) => message.roomCode)).size, 1)
  assert.ok(matches.every((message) => message.match.players.every((player) => player.human)))
  assert.deepEqual(matches.map((message) => message.seat).sort(), [0, 1, 2, 3])
})

test('public games can be spectated without exposing player hands or allowing actions', async (context) => {
  const gameServer = await startGameServer()
  context.after(() => gameServer.child.kill())

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))
  const hostSocket = new WebSocket(gameServer.url)
  await once(hostSocket, 'open')
  const host = { socket: hostSocket, reader: messageReader(hostSocket) }
  players.push(host)
  hostSocket.send(JSON.stringify({ type: 'create_room', name: 'Host', public: true }))
  const lobby = await host.reader.next((message) => message.type === 'lobby')
  const guestSocket = new WebSocket(gameServer.url)
  await once(guestSocket, 'open')
  const guest = { socket: guestSocket, reader: messageReader(guestSocket) }
  players.push(guest)
  guestSocket.send(JSON.stringify({ type: 'join_room', name: 'Guest', roomCode: lobby.roomCode }))
  await host.reader.next((message) => message.type === 'lobby' && message.seats.filter(Boolean).length === 2)

  hostSocket.send(JSON.stringify({ type: 'start_game' }))
  await Promise.all(players.map(({ reader }) => reader.next((message) => message.type === 'match')))

  const spectatorSocket = new WebSocket(gameServer.url)
  await once(spectatorSocket, 'open')
  const spectator = { socket: spectatorSocket, reader: messageReader(spectatorSocket) }
  players.push(spectator)
  spectatorSocket.send(JSON.stringify({ type: 'list_rooms' }))
  const publicRooms = await spectator.reader.next((message) => message.type === 'rooms')
  assert.equal(publicRooms.rooms[0].roomCode, lobby.roomCode)

  spectatorSocket.send(JSON.stringify({ type: 'spectate_room', roomCode: lobby.roomCode }))
  const watched = await spectator.reader.next((message) => message.type === 'match' && message.spectator)
  assert.ok(watched.match.players.every((player) => player.hand.every((heldCard) => heldCard === null)))
  assert.equal(watched.roomCode, lobby.roomCode)

  spectatorSocket.send(JSON.stringify({ type: 'play', cardId: 'not-a-player-card' }))
  assert.match((await spectator.reader.next((message) => message.type === 'error')).message, /Spectators cannot take player actions/)
  spectatorSocket.send(JSON.stringify({ type: 'leave_room' }))
  assert.equal((await spectator.reader.next((message) => message.type === 'left_room')).type, 'left_room')
})

test('online tournaments require eight duos and start four quarterfinal matches', async (context) => {
  const gameServer = await startGameServer()
  context.after(() => gameServer.child.kill())

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))

  const first = new WebSocket(gameServer.url)
  await once(first, 'open')
  const firstReader = messageReader(first)
  players.push({ socket: first, reader: firstReader })
  first.send(JSON.stringify({
    type: 'create_tournament',
    name: 'Player 1',
    teamName: 'Duo 1',
    tournamentName: 'Test Bracket',
    startsAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }))
  const lobby = await firstReader.next((message) => message.type === 'tournament')
  assert.equal(lobby.custom, true)
  assert.equal(lobby.title, 'Test Bracket')
  assert.equal(lobby.players.length, 1)
  assert.equal(lobby.teams[0].name, 'Duo 1')

  for (let index = 2; index <= 16; index += 1) {
    const socket = new WebSocket(gameServer.url)
    await once(socket, 'open')
    const reader = messageReader(socket)
    players.push({ socket, reader })
    socket.send(JSON.stringify({
      type: 'join_tournament',
      roomCode: lobby.roomCode,
      name: `Player ${index}`,
      teamName: `Duo ${Math.ceil(index / 2)}`,
    }))
    await reader.next((message) => message.type === 'tournament' || message.type === 'error')
  }

  first.send(JSON.stringify({ type: 'start_tournament' }))
  const matches = await Promise.all(players.map(({ reader }) => reader.next((message) => message.type === 'match')))
  const tournamentUpdates = await Promise.all(players.slice(0, 16).map(({ reader }) => reader.next((message) => message.type === 'tournament' && message.started)))
  assert.ok(tournamentUpdates.every((message) => message.players.length === 16 && message.teams.length === 8))
  assert.ok(tournamentUpdates.every((message) => message.round === 1 && message.rounds[0].length === 4))
  assert.equal(new Set(matches.map((message) => message.roomCode)).size, 4)
  assert.ok(matches.every((message) => message.match.players[0].team !== message.match.players[1].team))
  assert.ok(matches.every((message) => message.match.players[0].team === message.match.players[2].team))
  assert.ok(matches.every((message) => message.match.players[1].team === message.match.players[3].team))
  assert.ok(matches.every((message) => message.match.players.filter((player) => player.human).length === 4))

  const lateJoiner = new WebSocket(gameServer.url)
  await once(lateJoiner, 'open')
  const lateReader = messageReader(lateJoiner)
  players.push({ socket: lateJoiner, reader: lateReader })
  lateJoiner.send(JSON.stringify({ type: 'join_tournament', roomCode: lobby.roomCode, name: 'Late', teamName: 'Duo 9' }))
  assert.match((await lateReader.next((message) => message.type === 'error')).message, /already started/)
})

test('custom tournaments require host start and at least two complete duos', async (context) => {
  const gameServer = await startGameServer()
  context.after(() => gameServer.child.kill())

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))

  for (let index = 1; index <= 4; index += 1) {
    const socket = new WebSocket(gameServer.url)
    await once(socket, 'open')
    players.push({ socket, reader: messageReader(socket) })
  }
  const startsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  players[0].socket.send(JSON.stringify({ type: 'create_tournament', name: 'Player 1', teamName: 'Duo 1', tournamentName: 'Friends Cup', startsAt }))
  const created = await players[0].reader.next((message) => message.type === 'tournament')
  assert.equal(created.startsAt, startsAt)
  players[0].socket.send(JSON.stringify({ type: 'start_tournament' }))
  assert.match((await players[0].reader.next((message) => message.type === 'error')).message, /At least two complete duos/)

  for (let index = 1; index < 4; index += 1) {
    players[index].socket.send(JSON.stringify({
      type: 'join_tournament',
      roomCode: created.roomCode,
      name: `Player ${index + 1}`,
      teamName: `Duo ${Math.ceil((index + 1) / 2)}`,
    }))
    await players[index].reader.next((message) => message.type === 'tournament')
  }

  players[1].socket.send(JSON.stringify({ type: 'start_tournament' }))
  assert.match((await players[1].reader.next((message) => message.type === 'error')).message, /Only the tournament host/)
  const waitingState = await players[0].reader.next((message) => message.type === 'tournament' && message.completeTeamCount === 2)
  assert.equal(waitingState.started, false)

  players[0].socket.send(JSON.stringify({ type: 'start_tournament' }))
  const [hostUpdate, joinerMatch] = await Promise.all([
    players[0].reader.next((message) => message.type === 'tournament' && message.started),
    players[1].reader.next((message) => message.type === 'match'),
  ])
  assert.equal(hostUpdate.rounds[0].length, 1)
  assert.equal(joinerMatch.match.players.filter((player) => player.human).length, 4)
})

test('custom tournaments reject past start times and start automatically at the chosen time', async (context) => {
  const gameServer = await startGameServer()
  context.after(() => gameServer.child.kill())

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))

  for (let index = 1; index <= 4; index += 1) {
    const socket = new WebSocket(gameServer.url)
    await once(socket, 'open')
    players.push({ socket, reader: messageReader(socket) })
  }
  players[0].socket.send(JSON.stringify({
    type: 'create_tournament',
    name: 'Player 1',
    teamName: 'Duo 1',
    tournamentName: 'Past Date',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
  }))
  assert.match((await players[0].reader.next((message) => message.type === 'error')).message, /in the future/)

  const startsAt = new Date(Date.now() + 2_500).toISOString()
  players[0].socket.send(JSON.stringify({
    type: 'create_tournament',
    name: 'Player 1',
    teamName: 'Duo 1',
    tournamentName: 'Scheduled Cup',
    startsAt,
  }))
  const created = await players[0].reader.next((message) => message.type === 'tournament')
  const registrations = players.slice(1).map((player, index) => {
    player.socket.send(JSON.stringify({
      type: 'join_tournament',
      roomCode: created.roomCode,
      name: `Player ${index + 2}`,
      teamName: `Duo ${Math.ceil((index + 2) / 2)}`,
    }))
    return player.reader.next((message) => message.type === 'tournament')
  })
  await Promise.all(registrations)
  const tournamentStarted = players[0].reader.next((message) => message.type === 'tournament' && message.started)
  const matches = await Promise.all(players.map((player) => player.reader.next((message) => message.type === 'match')))
  assert.ok((await tournamentStarted).started)
  assert.equal(matches.length, 4)
})

test('quick tournament starts with at least two complete duos and gives smaller brackets byes', async (context) => {
  const gameServer = await startGameServer({ QUICK_TOURNAMENT_DELAY_MS: '3000' })
  context.after(() => gameServer.child.kill())

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))

  for (let index = 1; index <= 6; index += 1) {
    const socket = new WebSocket(gameServer.url)
    await once(socket, 'open')
    players.push({ socket, reader: messageReader(socket), name: `Quick Player ${index}` })
  }
  const firstReader = players[0].reader
  players[0].socket.send(JSON.stringify({ type: 'list_tournaments' }))
  const schedule = await firstReader.next((message) => message.type === 'tournaments')
  const quickEvent = schedule.items.find((event) => event.quick)
  assert.ok(quickEvent)
  assert.ok(Date.parse(quickEvent.startsAt) >= Date.now())

  const registrations = players.map((player, index) => {
    player.socket.send(JSON.stringify({
      type: 'join_tournament',
      roomCode: quickEvent.id,
      name: player.name,
      teamName: `Quick Duo ${Math.ceil((index + 1) / 2)}`,
    }))
    return player.reader.next((message) => message.type === 'tournament' || message.type === 'error')
  })
  const registrationsReceived = await Promise.all(registrations)
  assert.ok(registrationsReceived.every((message) => message.type === 'tournament'))

  const started = await Promise.all(players.map(({ reader }) => reader.next((message) => message.type === 'tournament' && message.started)))
  assert.ok(started.every((message) => message.quick && message.round === 1))
  assert.ok(started.every((message) => message.completeTeamCount === 3))
  assert.ok(started.every((message) => message.rounds[0].length === 2))
  assert.ok(started.every((message) => message.rounds[0].filter((match) => match.bye).length === 1))
  assert.ok(started.every((message) => message.rounds[0].some((match) => match.teams.includes('BYE'))))

  const activeTeams = started[0].rounds[0].find((match) => !match.bye).teams
  const activePlayers = started[0].players.filter((player) => activeTeams.includes(player.team))
  const activeMatches = await Promise.all(activePlayers.map((player) => {
    const connection = players.find((entry) => entry.name === player.name)
    return connection.reader.next((message) => message.type === 'match')
  }))
  assert.equal(activeMatches.length, 4)

  const scheduledEvents = await (async () => {
    const socket = new WebSocket(gameServer.url)
    await once(socket, 'open')
    const reader = messageReader(socket)
    players.push({ socket, reader })
    socket.send(JSON.stringify({ type: 'list_tournaments' }))
    return reader.next((message) => message.type === 'tournaments')
  })()
  assert.equal(scheduledEvents.items.filter((event) => !event.quick).length, 4)
})

test('scheduled tournaments list future Sunday events at 2 PM Pacific and allow up to eight duos', async (context) => {
  const gameServer = await startGameServer()
  context.after(() => gameServer.child.kill())

  const players = []
  context.after(() => players.forEach(({ socket }) => socket.terminate()))

  const first = new WebSocket(gameServer.url)
  await once(first, 'open')
  const firstReader = messageReader(first)
  players.push({ socket: first, reader: firstReader })
  first.send(JSON.stringify({ type: 'list_tournaments' }))
  const schedule = await firstReader.next((message) => message.type === 'tournaments')
  assert.equal(schedule.timeZone, 'America/Los_Angeles')
  const quickEvent = schedule.items.find((event) => event.quick)
  assert.ok(quickEvent)
  const quickStartDelay = Date.parse(quickEvent.startsAt) - Date.now()
  assert.ok(quickStartDelay <= 5 * 60 * 1000 && quickStartDelay > 295 * 1000)
  const weeklyEvents = schedule.items.filter((event) => !event.quick)
  assert.equal(weeklyEvents.length, 4)
  for (const event of weeklyEvents) {
    assert.ok(Date.parse(event.startsAt) > Date.now())
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(event.startsAt))
    const parts = Object.fromEntries(date.map(({ type, value }) => [type, value]))
    assert.equal(parts.weekday, 'Sun')
    assert.equal(Number(parts.hour), 14)
    assert.equal(parts.minute, '00')
  }

  const event = weeklyEvents[0]
  first.send(JSON.stringify({ type: 'join_tournament', roomCode: event.id, name: 'Player 1', teamName: 'Team 1' }))
  await firstReader.next((message) => message.type === 'tournament' && message.players.length === 1)

  for (let index = 2; index <= 16; index += 1) {
    const socket = new WebSocket(gameServer.url)
    await once(socket, 'open')
    const reader = messageReader(socket)
    players.push({ socket, reader })
    socket.send(JSON.stringify({
      type: 'join_tournament',
      roomCode: event.id,
      name: `Player ${index + 1}`,
      teamName: `Team ${Math.ceil(index / 2)}`,
    }))
    await reader.next((message) => message.type === 'tournament' || message.type === 'error')
  }

  const updated = await firstReader.next((message) => message.type === 'tournament' && message.eventId === event.id && message.players.length === 16)
  assert.equal(updated.players.length, 16)
  assert.equal(updated.teams.length, 8)
  assert.equal(updated.started, false)

  const extra = new WebSocket(gameServer.url)
  await once(extra, 'open')
  const extraReader = messageReader(extra)
  players.push({ socket: extra, reader: extraReader })
  extra.send(JSON.stringify({ type: 'join_tournament', roomCode: event.id, name: 'Extra', teamName: 'Ninth Team' }))
  assert.match((await extraReader.next((message) => message.type === 'error')).message, /full/)
})