import { useEffect, useRef, useState } from 'react'
import GameTable from './components/GameTable.jsx'
import MainMenu from './components/MainMenu.jsx'
import { createMatch, playCard, startNextRound, submitBid, takeAiTurn } from './game/gameEngine.js'
import './App.css'
import './components/MainMenu.css'

function App() {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).has('room') ? 'online' : 'menu')
  const [match, setMatch] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('blot-sound') !== 'off')
  const [notice, setNotice] = useState('')
  const [onlineLobby, setOnlineLobby] = useState(null)
  const [onlineRoom, setOnlineRoom] = useState(null)
  const [onlineSeat, setOnlineSeat] = useState(0)
  const [onlineNotice, setOnlineNotice] = useState('')
  const socketRef = useRef(null)

  useEffect(() => {
    if (!match || onlineRoom) return undefined
    const automatedTurn = (match.phase === 'bidding' && !match.players[match.bidding.turn].human)
      || (match.phase === 'play' && !match.players[match.turn].human)
    if (!automatedTurn) return undefined
    const timer = window.setTimeout(() => setMatch((current) => current ? takeAiTurn(current) : current), 720)
    return () => window.clearTimeout(timer)
  }, [match, onlineRoom])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  function playSound(kind = 'card') {
    if (!soundEnabled) return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const frequencies = kind === 'win' ? [523, 659] : kind === 'trick' ? [392, 523] : [300, 220]
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequencies[0], context.currentTime)
      if (frequencies[1]) oscillator.frequency.linearRampToValueAtTime(frequencies[1], context.currentTime + 0.12)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.19)
      oscillator.onended = () => context.close()
    } catch {
      return
    }
  }

  function startGame() {
    setMatch(createMatch())
    setNotice('')
    setView('game')
    playSound('trick')
  }

  function connectOnline(request) {
    setOnlineNotice('')
    const currentSocket = socketRef.current
    if (currentSocket?.readyState === WebSocket.OPEN) {
      currentSocket.send(JSON.stringify(request))
      return
    }
    if (currentSocket?.readyState === WebSocket.CONNECTING) {
      setOnlineNotice('Connecting. Please try again in a moment.')
      return
    }

    const configuredUrl = import.meta.env.VITE_GAME_SERVER_URL
    if (import.meta.env.PROD && !configuredUrl) {
      setOnlineNotice('Online multiplayer is not configured on this site. A game server is required.')
      return
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = configuredUrl || `${protocol}//${window.location.hostname}:3001`
    const socket = new WebSocket(url)
    socketRef.current = socket
    socket.addEventListener('open', () => socket.send(JSON.stringify(request)), { once: true })
    socket.addEventListener('message', (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        setOnlineNotice('Received an invalid response from the game server.')
        return
      }
      if (message.type === 'lobby') {
        setOnlineLobby(message)
        if (!message.started) {
          setOnlineRoom(message.roomCode)
          setOnlineSeat(message.seat)
          setOnlineNotice('')
          setView('online')
        }
      } else if (message.type === 'match') {
        setOnlineRoom(message.roomCode)
        setOnlineSeat(message.seat)
        setMatch(message.match)
        setNotice('')
        setView('game')
      } else if (message.type === 'error') {
        setOnlineNotice(message.message)
        setNotice(message.message)
      } else if (message.type === 'left_room') {
        setOnlineLobby(null)
        setOnlineRoom(null)
        setMatch(null)
        setView('menu')
      }
    })
    socket.addEventListener('error', () => setOnlineNotice('Could not connect to the game server.'))
    socket.addEventListener('close', () => {
      if (socketRef.current === socket) setOnlineNotice('Connection to the game server was lost.')
    })
  }

  function sendOnline(message) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    } else {
      setOnlineNotice('Connection to the game server was lost.')
    }
  }

  function leaveOnline() {
    if (socketRef.current?.readyState === WebSocket.OPEN) sendOnline({ type: 'leave_room' })
    else socketRef.current?.close()
    setOnlineLobby(null)
    setOnlineRoom(null)
    setMatch(null)
    setOnlineNotice('')
    setView('menu')
  }

  function toggleSound() {
    setSoundEnabled((enabled) => {
      const next = !enabled
      localStorage.setItem('blot-sound', next ? 'on' : 'off')
      return next
    })
  }

  function onPlay(cardId) {
    if (!match) return
    if (onlineRoom) {
      sendOnline({ type: 'play', cardId })
      return
    }
    const result = playCard(match, onlineSeat, cardId)
    if (result.error) {
      setNotice(result.error)
      return
    }
    setNotice('')
    setMatch(result.state)
    playSound(result.state.phase === 'gameOver' ? 'win' : result.state.tricksWon.length > match.tricksWon.length ? 'trick' : 'card')
  }

  return view !== 'game' ? (
    <MainMenu
      view={view}
      soundEnabled={soundEnabled}
      onlineLobby={onlineLobby}
      onlineNotice={onlineNotice}
      onNavigate={(nextView) => { setOnlineNotice(''); setView(nextView) }}
      onStart={startGame}
      onToggleSound={toggleSound}
      onCreateOnline={(name) => connectOnline({ type: 'create_room', name })}
      onJoinOnline={(name, roomCode) => connectOnline({ type: 'join_room', name, roomCode })}
      onStartOnline={() => sendOnline({ type: 'start_game' })}
      onLeaveOnline={leaveOnline}
    />
  ) : (
    <main className="app-shell game-shell">
      {match && <GameTable
        state={match}
        notice={notice}
        playerIndex={onlineSeat}
        roomCode={onlineRoom}
        isOnline={Boolean(onlineRoom)}
        isHost={Boolean(onlineLobby?.host)}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onNavigateHome={() => setView(onlineRoom ? 'online' : 'menu')}
        onBid={(action) => onlineRoom ? sendOnline({ type: 'bid', action }) : setMatch((current) => current ? submitBid(current, onlineSeat, action) : current)}
        onPlay={onPlay}
        onNewRound={() => onlineRoom ? sendOnline({ type: 'next_round' }) : setMatch((current) => current ? startNextRound(current) : current)}
        onRestart={() => onlineRoom ? sendOnline({ type: 'restart_match' }) : startGame()}
      />}
    </main>
  )
}

export default App
