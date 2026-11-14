import { useCallback, useEffect, useRef, useState } from 'react'
import GameTable from './components/GameTable.jsx'
import MainMenu from './components/MainMenu.jsx'
import { seededRandom } from './game/deck.js'
import { createMatch, playCard, startNextRound, submitBid, takeAiTurn } from './game/gameEngine.js'
import { readFriends, readHandHistory, readPlayerPreferences, readPlayerStats, recordCompletedGame, recordCompletedHand, saveFriends, savePlayerPreferences, seedFromString } from './game/playerProfile.js'
import './App.css'
import './components/MainMenu.css'

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10)
}

function getDailyArchiveDates() {
  const today = new Date(`${getTodayDateKey()}T00:00:00Z`)
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today.getTime() - index * 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
  })
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function App() {
  const [view, setView] = useState(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.has('room') || query.has('watch')) return 'online'
    if (query.has('tournament')) return 'tournaments'
    if (isValidDateKey(query.get('daily') || '')) return 'daily'
    return 'menu'
  })
  const [match, setMatch] = useState(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [dailyChallenge, setDailyChallenge] = useState(false)
  const [spectatorMode, setSpectatorMode] = useState(false)
  const [challengeDate, setChallengeDate] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('daily')
    return isValidDateKey(requested || '') ? requested : getTodayDateKey()
  })
  const [gameSeed, setGameSeed] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('blot-sound') !== 'off')
  const [preferences, setPreferences] = useState(readPlayerPreferences)
  const [stats, setStats] = useState(readPlayerStats)
  const [handHistory, setHandHistory] = useState(readHandHistory)
  const [friends, setFriends] = useState(readFriends)
  const [notice, setNotice] = useState('')
  const [onlineLobby, setOnlineLobby] = useState(null)
  const [publicRooms, setPublicRooms] = useState([])
  const [onlineQueue, setOnlineQueue] = useState(null)
  const [onlineRoom, setOnlineRoom] = useState(null)
  const [onlineTournament, setOnlineTournament] = useState(null)
  const [scheduledTournaments, setScheduledTournaments] = useState([])
  const [tournamentTimeZone, setTournamentTimeZone] = useState('America/Los_Angeles')
  const [onlineSeat, setOnlineSeat] = useState(0)
  const [onlineNotice, setOnlineNotice] = useState('')
  const socketRef = useRef(null)
  const recordedMatchRef = useRef(null)
  const recordedHandRef = useRef(null)

  useEffect(() => {
    if (!match || onlineRoom) return undefined
    const automatedTurn = (match.phase === 'bidding' && !match.players[match.bidding.turn].human)
      || (match.phase === 'play' && !match.players[match.turn].human)
    if (!automatedTurn) return undefined
    const timer = window.setTimeout(() => setMatch((current) => current
      ? takeAiTurn(current, seededRandom(seedFromString(`${gameSeed}:${current.phase}:${current.bidding.history.length}:${current.tricksWon.length}:${current.trick.length}:${current.turn}`)), preferences.aiDifficulty)
      : current), practiceMode ? preferences.aiSpeed : 720)
    return () => window.clearTimeout(timer)
  }, [match, onlineRoom, practiceMode, preferences.aiSpeed, preferences.aiDifficulty, gameSeed])

  useEffect(() => {
    if (!match || spectatorMode || match.phase !== 'gameOver' || recordedMatchRef.current === match) return
    recordedMatchRef.current = match
    setStats(recordCompletedGame(stats, match.roundResult.matchWinner, match.players[onlineSeat].team, dailyChallenge ? challengeDate : ''))
  }, [match, dailyChallenge, challengeDate, onlineSeat, stats, spectatorMode])

  useEffect(() => {
    if (!match || !['roundOver', 'gameOver'].includes(match.phase) || recordedHandRef.current === match) return
    recordedHandRef.current = match
    try {
      setHandHistory(recordCompletedHand(match))
    } catch {
      setNotice('Could not save this hand review on this device.')
    }
  }, [match])

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

  function startGame(mode = 'regular', seed = null) {
    const resolvedSeed = seed ?? Math.floor(Math.random() * 0x1_0000_0000)
    const isPractice = mode === 'practice' || mode === 'daily'
    setMatch(createMatch([0, 0], undefined, 1, seededRandom(resolvedSeed)))
    setGameSeed(resolvedSeed)
    setPracticeMode(isPractice)
    setDailyChallenge(mode === 'daily')
    setSpectatorMode(false)
    setNotice('')
    setView('game')
    playSound('trick')
  }

  function startDailyChallenge(date = challengeDate) {
    setChallengeDate(date)
    startGame('daily', seedFromString(`blot-daily:${date}`))
  }

  function replayDeal() {
    if (gameSeed !== null) startGame(dailyChallenge ? 'daily' : 'practice', gameSeed)
  }

  const connectOnline = useCallback((request) => {
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
      } else if (message.type === 'tournament') {
        setOnlineNotice('')
        setOnlineTournament(message)
        setScheduledTournaments((current) => {
          if (!message.scheduled) return current
          const item = { ...message, id: message.eventId, playerCount: message.players.length, teamCount: message.teams.length }
          return current.some((entry) => entry.id === item.id)
            ? current.map((entry) => entry.id === item.id ? { ...entry, ...item } : entry)
            : [...current, item].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        })
      } else if (message.type === 'tournaments') {
        setOnlineNotice('')
        setScheduledTournaments(message.items)
        setTournamentTimeZone(message.timeZone)
      } else if (message.type === 'rooms') {
        setPublicRooms(message.rooms)
      } else if (message.type === 'matchmaking') {
        setOnlineQueue(message.status === 'waiting' ? message : null)
        setOnlineNotice('')
        setView('online')
      } else if (message.type === 'match') {
        setOnlineQueue(null)
        setOnlineRoom(message.roomCode)
        setOnlineSeat(message.seat)
        setMatch(message.match)
        setSpectatorMode(Boolean(message.spectator))
        setOnlineSeat(message.seat ?? 0)
        setPracticeMode(false)
        setDailyChallenge(false)
        setGameSeed(null)
        setNotice('')
        setView('game')
      } else if (message.type === 'error') {
        setOnlineQueue(null)
        setOnlineNotice(message.message)
        setNotice(message.message)
      } else if (message.type === 'left_room') {
        setOnlineLobby(null)
        setOnlineRoom(null)
        setMatch(null)
        setSpectatorMode(false)
        setPublicRooms([])
        setView('menu')
      } else if (message.type === 'left_tournament') {
        setOnlineTournament(null)
        setOnlineRoom(null)
        setOnlineLobby(null)
        setMatch(null)
        setView('tournaments')
      }
    })
    socket.addEventListener('error', () => setOnlineNotice('Could not connect to the game server.'))
    socket.addEventListener('close', () => {
      if (socketRef.current === socket) {
        setOnlineQueue(null)
        setOnlineNotice('Connection to the game server was lost.')
      }
    })
  }, [])

  useEffect(() => {
    if (view === 'tournaments') connectOnline({ type: 'list_tournaments' })
    if (view === 'online') {
      const watchCode = new URLSearchParams(window.location.search).get('watch')
      connectOnline(watchCode ? { type: 'spectate_room', roomCode: watchCode } : { type: 'list_rooms' })
    }
  }, [view, connectOnline])

  function sendOnline(message) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    } else {
      setOnlineNotice('Connection to the game server was lost.')
    }
  }

  function leaveOnline() {
    if (spectatorMode) {
      const url = new URL(window.location.href)
      url.searchParams.delete('watch')
      window.history.replaceState({}, '', url.toString())
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) sendOnline({ type: onlineTournament ? 'leave_tournament' : onlineQueue ? 'cancel_match' : 'leave_room' })
    else socketRef.current?.close()
    setOnlineLobby(null)
    setOnlineQueue(null)
    setOnlineRoom(null)
    setOnlineTournament(null)
    setMatch(null)
    setSpectatorMode(false)
    setOnlineNotice('')
    setView('menu')
  }

  function showTournaments() {
    setOnlineNotice('')
    setView('tournaments')
  }

  function toggleSound() {
    setSoundEnabled((enabled) => {
      const next = !enabled
      localStorage.setItem('blot-sound', next ? 'on' : 'off')
      return next
    })
  }

  function updatePreferences(next) {
    savePlayerPreferences(next)
    setPreferences(next)
  }

  function updateFriends(next) {
    try {
      const saved = saveFriends(next)
      setFriends(saved)
      return true
    } catch {
      return false
    }
  }

  async function shareDailyChallenge() {
    const date = challengeDate
    const url = new URL(window.location.href)
    url.searchParams.set('daily', date)
    try {
      await navigator.clipboard.writeText(`${url.toString()} — Today’s Blot challenge: ${date}`)
      setOnlineNotice('Daily challenge link copied.')
      window.setTimeout(() => setOnlineNotice(''), 2500)
    } catch {
      setOnlineNotice('Could not copy the challenge link. You can still invite a friend to play from the online table.')
    }
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
      preferences={preferences}
      stats={stats}
      friends={friends}
      handHistory={handHistory}
      challengeDate={challengeDate}
      dailyDates={getDailyArchiveDates()}
      onlineLobby={onlineLobby}
      publicRooms={publicRooms}
      onlineQueue={onlineQueue}
      onlineTournament={onlineTournament}
      scheduledTournaments={scheduledTournaments}
      tournamentTimeZone={tournamentTimeZone}
      onlineNotice={onlineNotice}
      onNavigate={(nextView) => { if (nextView === 'tournaments') showTournaments(); else { setOnlineNotice(''); setView(nextView) } }}
      onStart={() => startGame('regular')}
      onStartPractice={() => startGame('practice')}
      onStartDaily={startDailyChallenge}
      onDateChange={setChallengeDate}
      onShareDaily={shareDailyChallenge}
      onPreferencesChange={updatePreferences}
      onFriendsChange={updateFriends}
      onInviteFriends={() => { setOnlineNotice(''); setView('online') }}
      onSpectateRoom={(roomCode) => connectOnline({ type: 'spectate_room', roomCode })}
      onRefreshRooms={() => connectOnline({ type: 'list_rooms' })}
      onToggleSound={toggleSound}
      onCreateOnline={(name, isPublic = true) => connectOnline({ type: 'create_room', name, public: isPublic })}
      onJoinOnline={(name, roomCode) => connectOnline({ type: 'join_room', name, roomCode })}
      onFindMatch={(name) => connectOnline({ type: 'find_match', name })}
      onJoinTournament={(name, roomCode, teamName) => connectOnline({ type: 'join_tournament', name, roomCode, teamName })}
      onCreateTournament={(name, teamName, tournamentName, startsAt) => connectOnline({ type: 'create_tournament', name, teamName, tournamentName, startsAt })}
      onStartTournament={() => sendOnline({ type: 'start_tournament' })}
      onCancelMatch={() => sendOnline({ type: 'cancel_match' })}
      onStartOnline={() => sendOnline({ type: 'start_game' })}
      onLeaveOnline={leaveOnline}
      onLeaveTournament={() => sendOnline({ type: 'leave_tournament' })}
    />
  ) : (
    <main className={`app-shell game-shell card-size-${preferences.cardSize}`}>
      {match && <GameTable
        state={match}
        notice={notice}
        practiceMode={practiceMode}
        dailyChallenge={dailyChallenge}
        hintsAlwaysOn={preferences.hintsAlwaysOn}
        cardSize={preferences.cardSize}
        playerIndex={onlineSeat}
        roomCode={onlineRoom}
        isOnline={Boolean(onlineRoom)}
        isHost={onlineTournament ? match.phase === 'roundOver' : Boolean(onlineLobby?.host)}
        isTournament={Boolean(onlineTournament)}
        isSpectator={spectatorMode}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onUpdateHints={(enabled) => updatePreferences({ ...preferences, hintsAlwaysOn: enabled })}
        onReplayPractice={replayDeal}
        onNavigateHome={() => spectatorMode ? leaveOnline() : setView(onlineTournament ? 'tournaments' : onlineRoom ? 'online' : 'menu')}
        onBid={(action) => onlineRoom ? sendOnline({ type: 'bid', action }) : setMatch((current) => current ? submitBid(current, onlineSeat, action) : current)}
        onPlay={onPlay}
        onNewRound={() => onlineRoom ? sendOnline({ type: 'next_round' }) : setMatch((current) => current ? startNextRound(current) : current)}
        onRestart={() => onlineRoom ? sendOnline({ type: 'restart_match' }) : startGame(dailyChallenge ? 'daily' : practiceMode ? 'practice' : 'regular', gameSeed)}
      />}
    </main>
  )
}

export default App
