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
const codeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function makeRoomCode() {
  let code
  do {
    code = Array.from({ length: 6 }, () => codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)]).join('')
  } while (rooms.has(code))
  return code
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 16) : ''
  return name || 'Player'
}

function playerCount(room) {
  return room.seats.filter(Boolean).length
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

function matchForSeat(room, seat) {
  return {
    ...room.state,
    players: room.state.players.map((player, index) => ({
      ...player,
      hand: index === seat ? player.hand : Array(player.hand.length).fill(null),
    })),
  }
}

function broadcastMatch(room) {
  room.seats.forEach((player, seat) => {
    if (!player?.client) return
    send(player.client.socket, { type: 'match', roomCode: room.code, seat, match: matchForSeat(room, seat) })
  })
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
    queueAiTurn(room)
  }, 700)
}

function beginMatch(room) {
  room.state = applyRoomPlayers(room, createMatch())
  sendLobby(room)
  broadcastMatch(room)
  queueAiTurn(room)
}

function sendError(client, message) {
  send(client.socket, { type: 'error', message })
}

function detach(client) {
  const room = rooms.get(client.roomCode)
  if (!room || client.seat === null) return
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
}

function handleMessage(client, message) {
  if (message.type === 'create_room') {
    if (client.roomCode) return sendError(client, 'Leave your current room before creating another.')
    const room = { code: makeRoomCode(), seats: [null, null, null, null], hostSeat: 0, state: null, aiTimer: null }
    rooms.set(room.code, room)
    addRoomPlayer(room, client, 0, cleanName(message.name))
    sendLobby(room)
    return
  }

  if (message.type === 'join_room') {
    if (client.roomCode) return sendError(client, 'Leave your current room before joining another.')
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

  const room = rooms.get(client.roomCode)
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
    if (client.seat !== room.hostSeat) return sendError(client, 'Only the host can start the next round.')
    if (!['roundOver', 'gameOver'].includes(room.state.phase)) return sendError(client, 'The current round is still in progress.')
    room.state = applyRoomPlayers(room, startNextRound(room.state))
  } else if (message.type === 'restart_match') {
    if (client.seat !== room.hostSeat) return sendError(client, 'Only the host can restart the match.')
    room.state = applyRoomPlayers(room, createMatch())
  } else {
    return sendError(client, 'Unknown game action.')
  }

  broadcastMatch(room)
  queueAiTurn(room)
}

server.on('connection', (socket) => {
  const client = { socket, roomCode: null, seat: null }
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