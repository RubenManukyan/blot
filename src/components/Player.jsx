export default function Player({ player, active, position, cardCount, hiddenHand, isLocalSeat, localTeam }) {
  return (
    <div className={`player-seat seat-${position}${active ? ' seat-active' : ''}`}>
      {hiddenHand && <div className="opponent-hand" aria-label={`${cardCount} cards hidden`}>{Array.from({ length: cardCount }, (_, index) => <span className="mini-back" key={`${player.index}-${index}`} />)}</div>}
      <div className="player-profile">
        <div className={`player-avatar avatar-team-${player.team}`}>{player.avatar}</div>
        <div className="player-details"><strong>{player.name}</strong><span>{isLocalSeat ? 'Your seat' : `${player.human ? player.team === localTeam ? 'partner' : 'opponent' : player.personality} · ${cardCount} cards`}</span></div>
        <span className={`team-mark team-${player.team}`} title={player.team === 0 ? 'Gold team' : 'Green team'} />
      </div>
      {active && <span className="turn-label">{player.human ? 'YOUR TURN' : 'THINKING'}</span>}
    </div>
  )
}