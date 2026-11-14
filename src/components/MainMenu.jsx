import { useEffect, useState } from 'react'
import BeginnerPage from './BeginnerPage.jsx'
import { DailyChallengePage, FriendsPage, ReviewPage, SettingsPage, SkillDrillsPage, StatsPage, TutorialPage } from './FeaturePages.jsx'

const menuItems = [{ id: 'practice', label: 'Practice game', mark: '✦' }, { id: 'daily', label: 'Daily challenge', mark: '◷' }, { id: 'tutorial', label: 'Interactive tutorial', mark: '01' }, { id: 'skills', label: 'Skill drills', mark: '◎' }, { id: 'review', label: 'Replay & review', mark: '↻' }, { id: 'online', label: 'Play online', mark: '◎' }, { id: 'tournaments', label: 'Tournaments', mark: '♜' }, { id: 'beginner', label: 'New to Blot?', mark: '?' }, { id: 'stats', label: 'Player stats', mark: '↗' }, { id: 'friends', label: 'Friends', mark: '♡' }, { id: 'howTo', label: 'Full rules', mark: '?' }, { id: 'settings', label: 'Settings', mark: '◉' }, { id: 'about', label: 'About Blot', mark: '✳' }]

function Brand({ small = false }) {
  return <div className={`brand-lockup${small ? ' brand-small' : ''}`}><span className="brand-mark">Բ</span><span><strong>BAZAR BLOT</strong><small>ARMENIAN CARD GAME</small></span></div>
}

function OnlinePage({ lobby, queue, tournament, rooms, notice, onCreate, onJoin, onFindMatch, onCancelMatch, onStart, onLeave, onWatch, onRefreshRooms }) {
  const [name, setName] = useState(() => localStorage.getItem('blot-player-name') || '')
  const [roomCode, setRoomCode] = useState(() => (new URLSearchParams(window.location.search).get('room') || new URLSearchParams(window.location.search).get('watch') || '').trim().toUpperCase())
  const [linkCopied, setLinkCopied] = useState(false)
  const [publicTable, setPublicTable] = useState(true)
  const hasRoomCode = roomCode.trim().length === 6

  function saveName() {
    const cleanName = name.trim().slice(0, 16) || 'Player'
    localStorage.setItem('blot-player-name', cleanName)
    return cleanName
  }

  const inviteUrl = new URL(window.location.href)
  if (lobby) inviteUrl.searchParams.set('room', lobby.roomCode)
  if (tournament) {
    inviteUrl.searchParams.delete('room')
    inviteUrl.searchParams.set('tournament', tournament.roomCode)
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl.toString())
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

  if (tournament) return (
    <section className="info-panel online-panel tournament-panel">
      <span className="eyebrow">{tournament.champion ? 'TOURNAMENT COMPLETE' : tournament.started ? `ROUND ${tournament.round} IN PROGRESS` : tournament.quick ? 'QUICK ONLINE TOURNAMENT' : '16-PLAYER ONLINE TOURNAMENT'}</span>
      <div className="online-room-heading"><h1>{tournament.champion ? `${tournament.champion} win!` : 'Duo bracket'}</h1></div>
      <div className="online-invite"><span className="online-field-label">TOURNAMENT INVITE LINK</span><div className="online-invite-row"><a className="online-invite-link" href={inviteUrl.toString()} target="_blank" rel="noreferrer">{inviteUrl.toString()}</a><button type="button" className="button button-quiet invite-copy-button" onClick={copyInviteLink}>{linkCopied ? 'Copied' : 'Copy link'}</button></div></div>
      {!tournament.started && <p className="info-lead">{tournament.quick ? `${tournament.players.length} players · ${tournament.completeTeamCount} complete duos. Starts after five minutes when at least two duos are ready.` : `${tournament.players.length} of 16 players · ${tournament.teams.length} of 8 duos. Both teammates enter the same duo name.`}</p>}
      {tournament.started && !tournament.champion && <p className="info-lead">Winners advance automatically. Keep this page open while your duo plays.</p>}
      <div className="tournament-teams">{tournament.teams.map((team) => <div className="tournament-team" key={team.name}><strong>{team.name}</strong><span>{team.players.join(' & ') || 'Waiting for duo partner'}</span></div>)}</div>
      {tournament.rounds.map((round, index) => <section className="tournament-round" key={index}><h2>{tournament.quick ? `Round ${index + 1}` : ['Quarterfinals', 'Semifinals', 'Final'][index] || `Round ${index + 1}`}</h2><div className="tournament-matches">{round.map((match, matchIndex) => <div className="tournament-match" key={matchIndex}><span className={match.winner === match.teams[0] ? 'tournament-winner' : ''}>{match.teams[0]}</span><i>{match.bye ? 'bye' : 'vs'}</i><span className={match.winner === match.teams[1] ? 'tournament-winner' : ''}>{match.teams[1]}</span>{match.complete && <small>{match.bye ? `${match.winner} advances by bye` : `${match.winner} advances`}</small>}</div>)}</div></section>)}
      {notice && <p className="online-error" role="alert">{notice}</p>}
      <button type="button" className="button button-quiet back-button" onClick={onLeave}>Leave tournament</button>
    </section>
  )

  if (lobby) return (
    <section className="info-panel online-panel">
      <span className="eyebrow">ONLINE TABLE</span>
      <div className="online-room-heading"><h1>Invite players</h1></div>
      <div className="online-invite"><span className="online-field-label">INVITE LINK</span><div className="online-invite-row"><a className="online-invite-link" href={inviteUrl.toString()} target="_blank" rel="noreferrer">{inviteUrl.toString()}</a><button type="button" className="button button-quiet invite-copy-button" onClick={copyInviteLink}>{linkCopied ? 'Copied' : 'Copy link'}</button></div></div>
      <p className="info-lead">{lobby.started ? 'The match is underway.' : `${lobby.seats.filter(Boolean).length} of 4 players joined`}</p>
      <div className="online-seats">{lobby.seats.map((seat, index) => <div className={`online-seat${seat ? ' online-seat-filled' : ''}`} key={index}><span className="online-seat-number">0{index + 1}</span><span className="online-seat-name">{seat?.name || 'Open seat'}</span>{seat && <span className="online-seat-status">{index === 0 ? 'HOST' : 'READY'}</span>}</div>)}</div>
      {notice && <p className="online-error" role="alert">{notice}</p>}
      <div className="online-lobby-actions">{!lobby.started && lobby.host && <button type="button" className="button button-gold" disabled={!lobby.canStart} onClick={onStart}>Start game <span>↗</span></button>}<button type="button" className="button button-quiet" onClick={onLeave}>Leave room</button></div>
      {!lobby.started && lobby.host && <p className="online-lobby-status">{lobby.canStart ? 'Ready when you are.' : 'Waiting for another player to join.'}</p>}
    </section>
  )

  if (queue) return (
    <section className="info-panel online-panel matchmaking-panel" aria-live="polite">
      <span className="eyebrow">WORLDWIDE MATCHMAKING</span>
      <h1>Finding players</h1>
      <p className="info-lead">Your table starts automatically when four players are ready.</p>
      <div className="matchmaking-status">
        <span className="matchmaking-count">{queue.waiting} <small>/ 4 PLAYERS</small></span>
        <div className="matchmaking-seats" aria-label={`${queue.waiting} of 4 players found`}>
          {[0, 1, 2, 3].map((seat) => <span key={seat} className={seat < queue.waiting ? 'matchmaking-seat-filled' : ''} />)}
        </div>
        <p>Keep this page open while we find other people to play with.</p>
      </div>
      {notice && <p className="online-error" role="alert">{notice}</p>}
      <button type="button" className="button button-quiet back-button" onClick={onCancelMatch}>Cancel search</button>
    </section>
  )

  return (
    <section className={`info-panel online-panel${hasRoomCode ? ' online-panel-join' : ''}`}>
      <span className="eyebrow">ONLINE TABLE</span>
      <h1>Play online</h1>
      <p className="info-lead">Find players around the world, create a table, or watch a live game.</p>
      <label className="online-field-label" htmlFor="online-player-name">PLAYER NAME</label>
      <input id="online-player-name" className="online-input" value={name} maxLength={16} placeholder="Your name" onChange={(event) => setName(event.target.value)} />
      {notice && <p className="online-error" role="alert">{notice}</p>}
      <button type="button" className="button button-gold online-find-button" onClick={() => onFindMatch(saveName())}>Find players <span>↗</span></button>
      <div className={`online-entry-actions${hasRoomCode ? ' online-entry-actions-join' : ''}`}>
        {!hasRoomCode && <><label className="public-table-toggle"><input type="checkbox" checked={publicTable} onChange={(event) => setPublicTable(event.target.checked)} /><span>List this table publicly for spectators</span></label><button type="button" className="button button-gold" onClick={() => onCreate(saveName(), publicTable)}>Create a room <span>↗</span></button></>}
        <div className="online-join-row"><input className="online-input room-code-input" value={roomCode} maxLength={6} placeholder="ROOM CODE" aria-label="Room code" onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /><button type="button" className={`button ${hasRoomCode ? 'button-gold online-join-button' : 'button-quiet'}`} disabled={!hasRoomCode} onClick={() => onJoin(saveName(), roomCode)}>Join as player</button><button type="button" className="button button-quiet" disabled={!hasRoomCode} onClick={() => onWatch(roomCode)}>Watch</button></div>
        {hasRoomCode && <button type="button" className="button button-quiet" onClick={() => onCreate(saveName())}>Create a different room</button>}
      </div>
      <section className="public-room-section"><div className="public-room-heading"><div><span className="eyebrow">PUBLIC TABLES</span><p>Watch a live game without seeing anyone’s hidden cards.</p></div><button type="button" className="button button-quiet" onClick={onRefreshRooms}>Refresh</button></div>{rooms.length ? rooms.map((room) => <article className="public-room-row" key={room.roomCode}><div><strong>Room {room.roomCode}</strong><small>{room.players.join(' · ')} · {room.playerCount}/4 players · {room.spectatorCount} watching</small></div><button type="button" className="button button-quiet" onClick={() => onWatch(room.roomCode)}>Watch ↗</button></article>) : <p className="public-room-empty">No public live tables right now. You can still watch with a room code or private watch link.</p>}</section>
      <button type="button" className="button button-quiet back-button" onClick={onLeave}>← Back to table</button>
    </section>
  )
}

function TournamentsPage({ tournaments, timeZone, tournament, notice, onJoin, onCreateTournament, onStartTournament, onLeaveTournament, onLeaveRegistration, onNavigate }) {
  const [name, setName] = useState(() => localStorage.getItem('blot-player-name') || '')
  const [teamName, setTeamName] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [now, setNow] = useState(null)
  const requestedId = new URLSearchParams(window.location.search).get('tournament')
  const registeredEventId = tournament?.eventId || tournament?.roomCode || ''
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  async function copyInvite(id) {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.searchParams.set('tournament', id)
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopiedId(id)
    } catch {
      setCopiedId('')
    }
  }

  function register(event) {
    const cleanName = name.trim().slice(0, 16) || 'Player'
    localStorage.setItem('blot-player-name', cleanName)
    onJoin(cleanName, event.id, teamName.trim())
  }

  function createTournament() {
    const cleanName = name.trim().slice(0, 16) || 'Player'
    localStorage.setItem('blot-player-name', cleanName)
    onCreateTournament(cleanName, teamName.trim(), tournamentName.trim(), new Date(startsAt).toISOString())
  }

  return (
    <section className="info-panel online-panel tournaments-page">
      <span className="eyebrow">QUICK TOURNAMENTS · EVERY SUNDAY</span>
      <h1>Upcoming tournaments</h1>
      <p className="info-lead">Create a tournament for your friends and choose when it starts, join a quick bracket starting in five minutes, or register for the weekly Sunday event.</p>
      <div className="tournament-registration">
        <label className="online-field-label" htmlFor="tournament-player-name">PLAYER NAME</label>
        <input id="tournament-player-name" className="online-input" value={name} maxLength={16} placeholder="Your name" onChange={(event) => setName(event.target.value)} />
        <label className="online-field-label tournament-field-label" htmlFor="tournament-team-name">DUO NAME</label>
        <input id="tournament-team-name" className="online-input" value={teamName} maxLength={20} placeholder="Use the same duo name as your partner" onChange={(event) => setTeamName(event.target.value)} />
        <label className="online-field-label tournament-field-label" htmlFor="tournament-name">YOUR TOURNAMENT NAME</label>
        <input id="tournament-name" className="online-input" value={tournamentName} maxLength={40} placeholder="e.g. Friday Night Blot" onChange={(event) => setTournamentName(event.target.value)} />
        <label className="online-field-label tournament-field-label" htmlFor="tournament-start-time">DATE AND TIME</label>
        <input id="tournament-start-time" className="online-input tournament-date-input" type="datetime-local" value={startsAt} min={now === null ? undefined : new Date(now - new Date(now).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)} onChange={(event) => setStartsAt(event.target.value)} required />
        <small className="tournament-time-note">Shown in your local time. At least two complete duos must be registered to start.</small>
        <button type="button" className="button button-gold create-tournament-button" disabled={!teamName.trim() || !tournamentName.trim() || !startsAt || Date.parse(startsAt) <= (now || 0) || Boolean(registeredEventId)} onClick={createTournament}>Create your tournament <span>↗</span></button>
      </div>
      {notice && <p className="online-error" role="alert">{notice}</p>}
      {tournament?.custom && <article className="scheduled-tournament scheduled-tournament-quick">
        <div className="scheduled-tournament-date"><span className="eyebrow">{tournament.started ? `ROUND ${tournament.round} IN PROGRESS` : 'YOUR TOURNAMENT'}</span><h2>{tournament.title}</h2><p>{tournament.started ? tournament.champion ? `${tournament.champion} wins!` : 'Bracket is underway.' : `${tournament.players.length} players · ${tournament.completeTeamCount}/8 complete duos · starts ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(tournament.startsAt))}`}</p></div>
        <div className="online-invite"><span className="online-field-label">INVITE LINK</span><div className="online-invite-row"><a className="online-invite-link" href={new URL(`?tournament=${tournament.roomCode}`, window.location.href).toString()} target="_blank" rel="noreferrer">{new URL(`?tournament=${tournament.roomCode}`, window.location.href).toString()}</a><button type="button" className="button button-quiet invite-copy-button" onClick={() => copyInvite(tournament.roomCode)}>{copiedId === tournament.roomCode ? 'Copied' : 'Copy link'}</button></div></div>
        {tournament.teams.length > 0 && <div className="scheduled-tournament-teams">{tournament.teams.map((team) => <span key={team.name}><strong>{team.name}</strong> · {team.players.join(' & ') || 'Waiting for partner'}</span>)}</div>}
        {tournament.rounds.map((round, index) => <section className="tournament-round" key={index}><h2>Round {index + 1}</h2><div className="tournament-matches">{round.map((match, matchIndex) => <div className="tournament-match" key={matchIndex}><span className={match.winner === match.teams[0] ? 'tournament-winner' : ''}>{match.teams[0]}</span><i>{match.bye ? 'bye' : 'vs'}</i><span className={match.winner === match.teams[1] ? 'tournament-winner' : ''}>{match.teams[1]}</span>{match.complete && <small>{match.bye ? `${match.winner} advances by bye` : `${match.winner} advances`}</small>}</div>)}</div></section>)}
        <div className="scheduled-tournament-actions">
          {!tournament.started && tournament.host && <button type="button" className="button button-gold" disabled={tournament.completeTeamCount < 2} onClick={onStartTournament}>Start now</button>}
          <button type="button" className="button button-quiet" onClick={onLeaveTournament}>Leave tournament</button>
        </div>
      </article>}
      {requestedId && !tournament && !tournaments.some((event) => event.id === requestedId) && <article className="scheduled-tournament scheduled-tournament-highlight">
        <div className="scheduled-tournament-date"><span className="eyebrow">TOURNAMENT INVITE</span><h2>Join a friend's tournament</h2><p>Enter your player and duo names above, then join the bracket.</p></div>
        <div className="scheduled-tournament-actions"><button type="button" className="button button-gold" disabled={!teamName.trim() || Boolean(registeredEventId)} onClick={() => register({ id: requestedId })}>Join tournament <span>↗</span></button></div>
      </article>}
      {tournaments.length ? <div className="scheduled-tournament-list">
        {tournaments.map((event) => {
          const registered = registeredEventId === event.id
          const full = event.playerCount >= 16
          const secondsRemaining = now === null ? null : Math.max(0, Math.ceil((Date.parse(event.startsAt) - now) / 1000))
          const countdown = secondsRemaining === null ? '' : `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`
          const status = event.champion
            ? `Champion: ${event.champion}`
            : event.started
              ? `Round ${event.round} in progress`
              : event.quick
                ? secondsRemaining === null
                  ? 'Checking start time…'
                  : secondsRemaining
                  ? `Starts in ${countdown} · ${event.completeTeamCount}/2 duos ready`
                  : `Waiting for two complete duos · ${event.completeTeamCount} ready`
                : full
                  ? 'Roster full · starts at scheduled time'
                  : `${event.playerCount} / 16 players · ${event.teamCount} / 8 duos`
          return (
            <article className={`scheduled-tournament${event.quick ? ' scheduled-tournament-quick' : ''}${requestedId === event.id ? ' scheduled-tournament-highlight' : ''}`} key={event.id}>
              <div className="scheduled-tournament-date"><span className="eyebrow">{event.quick ? 'QUICK TOURNAMENT' : event.started ? 'LIVE EVENT' : 'REGISTRATION OPEN'}</span><h2>{dateFormatter.format(new Date(event.startsAt))}</h2><p>{status}</p></div>
              <div className="scheduled-tournament-actions">
                {registered ? <><span className="tournament-registered">✓ Registered as {tournament.players.find((player) => player.name === name)?.team || tournament.teams.find((team) => team.players.includes(name))?.name || 'a duo'}</span>{!event.started && <button type="button" className="button button-quiet" onClick={onLeaveRegistration}>Cancel registration</button>}</> : <button type="button" className="button button-gold" disabled={!teamName.trim() || event.started || full || Boolean(registeredEventId)} onClick={() => register(event)}>Register duo <span>↗</span></button>}
                <button type="button" className="button button-quiet" onClick={() => copyInvite(event.id)}>{copiedId === event.id ? 'Link copied' : 'Copy invite link'}</button>
              </div>
              {event.teams?.length > 0 && <div className="scheduled-tournament-teams">{event.teams.map((team) => <span key={team.name}><strong>{team.name}</strong> · {team.players.join(' & ') || 'Waiting for partner'}</span>)}</div>}
              {event.rounds?.map((round, index) => <section className="tournament-round" key={index}><h2>{event.quick ? `Round ${index + 1}` : ['Quarterfinals', 'Semifinals', 'Final'][index] || `Round ${index + 1}`}</h2><div className="tournament-matches">{round.map((match, matchIndex) => <div className="tournament-match" key={matchIndex}><span className={match.winner === match.teams[0] ? 'tournament-winner' : ''}>{match.teams[0]}</span><i>{match.bye ? 'bye' : 'vs'}</i><span className={match.winner === match.teams[1] ? 'tournament-winner' : ''}>{match.teams[1]}</span>{match.complete && <small>{match.bye ? `${match.winner} advances by bye` : `${match.winner} advances`}</small>}</div>)}</div></section>)}
            </article>
          )
        })}
      </div> : <p className="tournament-loading">Loading this week’s schedule…</p>}
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

function InfoPage({ view, onNavigate }) {
  if (view === 'about') return (
    <section className="info-panel"><span className="eyebrow">A TRADITIONAL PARTNERSHIP GAME</span><h1>About Blot</h1>
      <p className="info-lead">A four-seat game of reading the table, trusting your partner, and knowing when to take the lead.</p>
      <p>This version uses a 32-card deck, partnership scoring, suit contracts, last-trick points, and the Belote-Rebelote bonus. The selected rules are documented in the game rules module.</p>
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
  return (
    <section className="info-panel howto-panel"><span className="eyebrow">AT A GLANCE</span><h1>How to play</h1>
      <p className="info-lead">Four players. Two teams. Eight tricks. Your partner sits across the table.</p>
      <div className="rules-list">
        <article><span>01</span><div><h3>The deal</h3><p>Each player receives eight cards from a 32-card deck. You and the player opposite are the Gold team; the other pair is Green.</p></div></article>
        <article><span>02</span><div><h3>Bidding</h3><p>Starting at 82, bid upward in steps of 10 and name a trump suit. Pass to leave the auction. Three passes after a bid award the contract; four passes redeal.</p></div></article>
        <article><span>03</span><div><h3>Trump & card order</h3><p>Follow the suit led when possible. If void, trump when the opposing team is winning; beat their trump if you can. Trump order is J, 9, A, 10, K, Q, 8, 7. Other suits rank A, 10, K, Q, J, 9, 8, 7.</p></div></article>
        <article><span>04</span><div><h3>Win a trick</h3><p>The highest trump wins. If no trump was played, the highest card in the led suit wins. The winner leads the next trick. Your teammate is always across from you.</p></div></article>
        <article><span>05</span><div><h3>Count points</h3><p>Card values total 152; the last trick adds 10. The contracting team must reach its bid. If it falls short, the opponents score 162 instead. King and Queen of trump together earn a 20-point Belote-Rebelote bonus.</p></div></article>
        <article><span>06</span><div><h3>Win the match</h3><p>The first partnership to reach 501 points wins. Score both teams after every hand; scores carry into the next round.</p></div></article>
      </div>
      <div className="example-trick"><span className="example-card red">A <b>♥</b></span><span className="example-arrow">→</span><span className="example-card">J <b>♠</b></span><p>With spades as trump, the Jack of spades beats the Ace of hearts.</p></div>
      <button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
}

export default function MainMenu({ view, soundEnabled, preferences, stats, friends, handHistory, onlineLobby, publicRooms, onlineQueue, onlineTournament, scheduledTournaments, tournamentTimeZone, onlineNotice, challengeDate, dailyDates, onNavigate, onStart, onStartPractice, onStartDaily, onDateChange, onShareDaily, onPreferencesChange, onFriendsChange, onInviteFriends, onToggleSound, onCreateOnline, onJoinOnline, onFindMatch, onCancelMatch, onStartOnline, onLeaveOnline, onJoinTournament, onCreateTournament, onStartTournament, onLeaveTournament, onSpectateRoom, onRefreshRooms }) {
  return (
    <main className={`app-shell menu-shell${view !== 'menu' ? ' subpage-shell' : ''}`}>
      <header className="menu-header"><Brand small /><span className="header-caption">CLASSIC BLOT <i /> 2 VS 2</span></header>
      {view === 'menu' ? (
        <div className="menu-content">
          <section className="menu-hero"><span className="eyebrow">YOUR NEXT TABLE</span><h1>Bazar<br /><em>Blot</em></h1><p>Partner up, call trumps, and play the classic Armenian trick-taking game.</p>
            <button type="button" className="button button-gold play-button" onClick={onStart}><span className="play-icon">▶</span> Play now <span className="button-arrow">↗</span></button>
          </section>
          <aside className="lobby-preview" aria-label="Classic Blot match preview">
            <div className="lobby-preview-top"><span>CLASSIC TABLE</span><span>4 PLAYERS</span></div>
            <div className="lobby-cards" aria-hidden="true"><span className="lobby-card lobby-card-one">A<b>♠</b></span><span className="lobby-card lobby-card-two">J<b>♥</b></span><span className="lobby-card lobby-card-three">10<b>♣</b></span><span className="lobby-card lobby-card-four">K<b>♦</b></span></div>
            <div className="lobby-score"><span><i /> GOLD <small>YOU + PARTNER</small></span><strong>00 <b>:</b> 00</strong><span><i /> GREEN <small>OPPONENTS</small></span></div>
            <div className="lobby-preview-bottom"><span>PARTNERSHIP PLAY</span><span>FIRST TO 501</span></div>
          </aside>
          <div className="menu-divider"><span>TABLE OPTIONS</span><i /></div>
          <nav className="menu-links" aria-label="Main menu">{menuItems.map((item) => <button type="button" key={item.id} onClick={() => item.id === 'practice' ? onStartPractice() : onNavigate(item.id)}><span className="menu-link-mark">{item.mark}</span><span>{item.label}</span><span className="menu-link-arrow">↗</span></button>)}</nav>
        </div>
      ) : view === 'online' ? <OnlinePage lobby={onlineLobby} queue={onlineQueue} tournament={onlineTournament} rooms={publicRooms || []} notice={onlineNotice} onCreate={onCreateOnline} onJoin={onJoinOnline} onFindMatch={onFindMatch} onCancelMatch={onCancelMatch} onStart={onStartOnline} onLeave={onLeaveOnline} onWatch={onSpectateRoom} onRefreshRooms={onRefreshRooms} /> : view === 'tournaments' ? <TournamentsPage tournaments={scheduledTournaments} timeZone={tournamentTimeZone} tournament={onlineTournament} notice={onlineNotice} onJoin={onJoinTournament} onCreateTournament={onCreateTournament} onStartTournament={onStartTournament} onLeaveTournament={onLeaveTournament} onLeaveRegistration={onLeaveTournament} onNavigate={onNavigate} /> : view === 'beginner' ? <BeginnerPage onNavigate={onNavigate} onStart={onStart} onStartPractice={onStartPractice} /> : view === 'tutorial' ? <TutorialPage onNavigate={onNavigate} onStartPractice={onStartPractice} /> : view === 'skills' ? <SkillDrillsPage onNavigate={onNavigate} onStartPractice={onStartPractice} /> : view === 'review' ? <ReviewPage hands={handHistory || []} onNavigate={onNavigate} /> : view === 'daily' ? <DailyChallengePage date={challengeDate} dates={dailyDates} completed={stats.dailyCompletedDates.includes(challengeDate)} notice={onlineNotice} onStart={() => onStartDaily(challengeDate)} onDateChange={onDateChange} onShare={onShareDaily} onNavigate={onNavigate} /> : view === 'stats' ? <StatsPage stats={stats} onNavigate={onNavigate} /> : view === 'friends' ? <FriendsPage friends={friends} onlineLobby={onlineLobby} onFriendsChange={onFriendsChange} onInvite={onInviteFriends} onNavigate={onNavigate} /> : view === 'settings' ? <SettingsPage soundEnabled={soundEnabled} preferences={preferences} onToggleSound={onToggleSound} onPreferencesChange={onPreferencesChange} onNavigate={onNavigate} /> : <InfoPage view={view} onNavigate={onNavigate} />}
      <footer className="menu-footer"><span>BAZAR BLOT</span><span>2 VS 2 · FIRST TO 501</span><button type="button" className="sound-link" onClick={onToggleSound}>{soundEnabled ? '◖ Sound on' : '◖ Sound off'}</button></footer>
    </main>
  )
}