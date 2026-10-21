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

async function startGameServer() {
  const port = await unusedPort()
  const child = spawn(process.execPath, [serverPath], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' })
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