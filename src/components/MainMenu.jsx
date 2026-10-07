import { useState } from 'react'

const menuItems = [{ id: 'online', label: 'Play online', mark: '◎' }, { id: 'howTo', label: 'How to play', mark: '?' }, { id: 'settings', label: 'Settings', mark: '◉' }, { id: 'about', label: 'About Blot', mark: '✳' }]

function Brand({ small = false }) {
  return <div className={`brand-lockup${small ? ' brand-small' : ''}`}><span className="brand-mark">Բ</span><span><strong>BAZAR BLOT</strong><small>ARMENIAN CARD GAME</small></span></div>
}

function OnlinePage({ lobby, notice, onCreate, onJoin, onStart, onLeave }) {
  const [name, setName] = useState(() => localStorage.getItem('blot-player-name') || '')
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase() || '')
  const [linkCopied, setLinkCopied] = useState(false)

  function saveName() {
    const cleanName = name.trim().slice(0, 16) || 'Player'
    localStorage.setItem('blot-player-name', cleanName)
    return cleanName
  }

  const inviteUrl = new URL(window.location.href)
  if (lobby) inviteUrl.searchParams.set('room', lobby.roomCode)

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl.toString())
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

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

  return (
    <section className="info-panel online-panel">
      <span className="eyebrow">ONLINE TABLE</span>
      <h1>Play online</h1>
      <p className="info-lead">Take a seat with friends and play a live match.</p>
      <label className="online-field-label" htmlFor="online-player-name">PLAYER NAME</label>
      <input id="online-player-name" className="online-input" value={name} maxLength={16} placeholder="Your name" onChange={(event) => setName(event.target.value)} />
      {notice && <p className="online-error" role="alert">{notice}</p>}
      <div className="online-entry-actions">
        <button type="button" className="button button-gold" onClick={() => onCreate(saveName())}>Create a room <span>↗</span></button>
        <div className="online-join-row"><input className="online-input room-code-input" value={roomCode} maxLength={6} placeholder="ROOM CODE" aria-label="Room code" onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /><button type="button" className="button button-quiet" disabled={roomCode.trim().length !== 6} onClick={() => onJoin(saveName(), roomCode)}>{roomCode ? 'Join linked room' : 'Join room'}</button></div>
      </div>
      <button type="button" className="button button-quiet back-button" onClick={onLeave}>← Back to table</button>
    </section>
  )
}

function InfoPage({ view, soundEnabled, onToggleSound, onNavigate }) {
  if (view === 'settings') return (
    <section className="info-panel settings-panel"><span className="eyebrow">PREFERENCES</span><h1>Settings</h1>
      <div className="setting-row"><span><strong>Table sounds</strong><small>Card, trick, and match tones</small></span><button type="button" className={`toggle${soundEnabled ? ' toggle-on' : ''}`} aria-pressed={soundEnabled} onClick={onToggleSound}><span /></button></div>
      <div className="setting-note">Sound is stored on this device.</div><button type="button" className="button button-quiet back-button" onClick={() => onNavigate('menu')}>← Back to table</button>
    </section>
  )
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

export default function MainMenu({ view, soundEnabled, onlineLobby, onlineNotice, onNavigate, onStart, onToggleSound, onCreateOnline, onJoinOnline, onStartOnline, onLeaveOnline }) {
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
          <nav className="menu-links" aria-label="Main menu">{menuItems.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(item.id)}><span className="menu-link-mark">{item.mark}</span><span>{item.label}</span><span className="menu-link-arrow">↗</span></button>)}</nav>
        </div>
      ) : view === 'online' ? <OnlinePage lobby={onlineLobby} notice={onlineNotice} onCreate={onCreateOnline} onJoin={onJoinOnline} onStart={onStartOnline} onLeave={onLeaveOnline} /> : <InfoPage view={view} soundEnabled={soundEnabled} onToggleSound={onToggleSound} onNavigate={onNavigate} />}
      <footer className="menu-footer"><span>BAZAR BLOT</span><span>2 VS 2 · FIRST TO 501</span><button type="button" className="sound-link" onClick={onToggleSound}>{soundEnabled ? '◖ Sound on' : '◖ Sound off'}</button></footer>
    </main>
  )
}