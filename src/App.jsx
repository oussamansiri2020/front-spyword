import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const socket = io('http://162.19.231.154:3000');

const AVATARS = ['🐺', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🦝', '🦄', '🐸',
  '🦉', '🐙', '🦋', '🦖', '🧙', '🤖', '👽', '🧛', '🥷', '🐲'];

function App() {
  const [phase, setPhase] = useState('LOGIN');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('🐺');
  const [roomId, setRoomId] = useState('');
  const [room, setRoom] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [myWord, setMyWord] = useState(null);
  const [myCategory, setMyCategory] = useState(null);
  const [turnPlayer, setTurnPlayer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notification, setNotification] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [wordRevealed, setWordRevealed] = useState(false);
  const [turnTimer, setTurnTimer] = useState(30);

  // Auto-fill room code from ?room= query param (QR scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r) setRoomId(r.toUpperCase());
  }, []);

  useEffect(() => {
    socket.on('updateRoom', (r) => {
      setRoom(r);
      if (r.gameState === 'LOBBY') setPhase('LOBBY');
    });

    socket.on('error', alert);

    socket.on('gameStarted', ({ role, word, category }) => {
      setMyRole(role);
      setMyWord(word);
      setMyCategory(category);
      setWordRevealed(false);
      setPhase('PLAYING');
      setMessages([]);
      addLog('🎮 Game started! You are a ' + role);
    });

    socket.on('turnUpdate', ({ currentPlayerId }) => setTurnPlayer(currentPlayerId));

    socket.on('playerAction', ({ username: u, action, payload }) => {
      if (action === 'WORD') addLog(`${u}: "${payload}"`);
    });

    socket.on('phaseChange', (p) => {
      setPhase(p);
      setHasVoted(false);
      setTurnTimer(30); // Reset timer display on phase change
      if (p === 'VOTING') addLog('🗳️ Voting phase! Who is the spy?');
      else if (p === 'PLAYING') addLog('🔄 New round starting...');
    });

    socket.on('timerTick', (remaining) => setTurnTimer(remaining));

    socket.on('roomCreated', (id) => { setRoomId(id); setPhase('LOBBY'); });

    socket.on('voteUpdate', ({ votesCast, total }) =>
      setNotification(`Votes: ${votesCast} / ${total}`));

    socket.on('roundResult', ({ message, role }) => {
      addLog(message + (role ? ` · ${role}` : ''));
      setNotification(message);
    });

    socket.on('gameOver', ({ winner, players }) => {
      setPhase('ENDED');
      setNotification(`🏆 Winner: ${winner}`);
      if (players) setRoom(prev => ({ ...prev, players }));
    });

    return () => {
      ['updateRoom', 'error', 'gameStarted', 'turnUpdate', 'playerAction',
        'phaseChange', 'roomCreated', 'voteUpdate', 'roundResult', 'gameOver', 'timerTick']
        .forEach(e => socket.off(e));
    };
  }, []);

  const addLog = msg => setMessages(prev => [...prev, msg]);

  const handleCreate = () => {
    if (!username) return alert('Enter your name!');
    socket.emit('createRoom', { username, avatar });
  };

  const handleJoin = () => {
    if (!username || !roomId) return alert('Enter name and room ID');
    socket.emit('joinRoom', { roomId, username, avatar });
    setPhase('LOBBY');
  };

  const handleStart = () => socket.emit('startGame', roomId);
  const handleSubmitWord = (w) => socket.emit('submitWord', { roomId, word: w });

  const handleVote = (suspectId) => {
    if (hasVoted) return;
    setHasVoted(true);
    socket.emit('vote', { roomId, suspectId });
  };

  const handleSkipVote = () => {
    if (hasVoted) return;
    setHasVoted(true);
    socket.emit('vote', { roomId, suspectId: 'SKIP' });
  };

  return (
    <div className="app-container">

      {/* ── Top Bar ── */}
      <header>
        <h1>🕵️ SpyWord</h1>
        {phase !== 'LOGIN' && (
          <div className="room-badge">
            Room&nbsp;<span className="highlight-code">{roomId}</span>
            &nbsp;·&nbsp;{avatar}&nbsp;{username}
          </div>
        )}
      </header>

      <div className="main-content">

        {/* ── LOGIN ── */}
        {phase === 'LOGIN' && (
          <div className="card login-card">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", marginBottom: 16 }}>Welcome</h2>

            <div className="avatar-preview">{avatar}</div>
            <p className="avatar-pick-label">Choose your avatar</p>
            <div className="avatar-grid">
              {AVATARS.map(a => (
                <button
                  key={a}
                  className={`avatar-btn ${avatar === a ? 'selected' : ''}`}
                  onClick={() => setAvatar(a)}
                >{a}</button>
              ))}
            </div>

            <input
              placeholder="Your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />

            <div className="login-actions">
              <div className="separator">Create Room</div>
              <button className="btn-primary" onClick={handleCreate}>+ Create Room</button>
              <div className="separator">Join Existing</div>
              <input
                placeholder="Enter room code"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
              <button className="btn-secondary" onClick={handleJoin}>Join Room →</button>
            </div>
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === 'LOBBY' && room && (
          <div className="card lobby-card">
            <h2>Lobby</h2>
            <div className="code-display">
              <p>Share this code</p>
              <div className="big-code">{roomId}</div>
            </div>

            <div className="qr-section">
              <p className="qr-label">Or scan to join</p>
              <div className="qr-wrapper">
                <QRCodeSVG
                  value={`${window.location.origin}${window.location.pathname}?room=${roomId}`}
                  size={148}
                  bgColor="#0a0a0a"
                  fgColor="#CCFF00"
                  level="M"
                />
              </div>
              <p className="qr-hint">Room: <strong>{roomId}</strong></p>
            </div>

            {/* Player Grid */}
            <ul className="player-list">
              {room.players.map(p => (
                <li
                  key={p.id}
                  className={p.id === turnPlayer ? 'is-current-turn' : ''}
                >
                  <span style={{ fontSize: '2rem' }}>{p.avatar}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.username}</span>
                </li>
              ))}
            </ul>

            {room.players.length >= 3 ? (
              socket.id === room.host
                ? <button className="btn-primary" onClick={handleStart}>▶ Start Game</button>
                : <p className="note">Waiting for host to start…</p>
            ) : (
              <p className="note">Waiting for players… (min 3)</p>
            )}
          </div>
        )}

        {/* ── PLAYING / VOTING ── */}
        {(phase === 'PLAYING' || phase === 'VOTING') && (
          <div className="game-layout">

            {/* Role & Secret Word Card */}
            <div className="card info-card">
              <h3>Your Role</h3>
              <div className={`role-badge ${myRole === 'IMPOSTER' ? 'imposter' : 'citizen'}`}>
                {myRole}
              </div>

              {/* Category badge — visible to everyone */}
              {myCategory && (
                <div style={{
                  margin: '0 0 12px',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: 'var(--lime)',
                  background: 'var(--lime-dim)',
                  border: '1px solid rgba(204,255,0,0.2)',
                  borderRadius: '20px',
                  padding: '4px 14px',
                  display: 'inline-block'
                }}>
                  📂 {myCategory}
                </div>
              )}

              {/* Fingerprint Reveal */}
              <div className="secret-card" onClick={() => setWordRevealed(true)}>
                {/* Frosted overlay (hidden once revealed) */}
                <div className={`secret-card-blur ${wordRevealed ? 'revealed' : ''}`}>
                  <span className="fingerprint-icon">☝️</span>
                  <span>Tap to reveal word</span>
                </div>
                <div className="secret-word-inner">
                  <p>Secret Word</p>
                  <div className="secret-word-value" style={{ visibility: wordRevealed ? 'visible' : 'hidden' }}>
                    {myWord}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="card action-card">
              {phase === 'PLAYING' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h3 style={{ margin: 0 }}>Current Turn</h3>
                    <CountdownRing seconds={turnTimer} total={30} />
                  </div>

                  {/* Player grid with pulsing active player */}
                  <ul className="player-list" style={{ marginBottom: 16 }}>
                    {room?.players.filter(p => p.isAlive).map(p => (
                      <li
                        key={p.id}
                        className={p.id === turnPlayer ? 'is-current-turn' : ''}
                      >
                        <span style={{ fontSize: '1.6rem' }}>{p.avatar}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{p.username}</span>
                      </li>
                    ))}
                  </ul>

                  {turnPlayer === socket.id ? (
                    <WordInput onSubmit={handleSubmitWord} avatar={avatar} username={username} />
                  ) : (
                    <div className="turn-waiting">
                      <span className="turn-waiting-avatar">
                        {room?.players.find(p => p.id === turnPlayer)?.avatar}
                      </span>
                      <span>
                        Waiting for <strong>{room?.players.find(p => p.id === turnPlayer)?.username}</strong>…
                      </span>
                    </div>
                  )}
                </>
              )}

              {phase === 'VOTING' && (
                <>
                  <h3>Vote to Eliminate</h3>
                  {hasVoted ? (
                    <p className="voted-msg">✅ Vote cast — waiting for others…</p>
                  ) : (
                    <>
                      <div className="vote-grid">
                        {room?.players.filter(p => p.isAlive && p.id !== socket.id).map(p => (
                          <button key={p.id} className="vote-btn" onClick={() => handleVote(p.id)}>
                            <span className="vote-avatar">{p.avatar}</span>
                            {p.username}
                          </button>
                        ))}
                      </div>
                      <button className="skip-btn" onClick={handleSkipVote}>⏭ Skip Vote</button>
                    </>
                  )}
                  <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-sec)' }}>
                    {notification}
                  </p>
                </>
              )}
            </div>

            {/* Game Log */}
            <div className="card log-card">
              <h3 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-sec)', marginBottom: 8 }}>
                Game Log
              </h3>
              <div className="log-window">
                {messages.map((m, i) => <div key={i} className="log-item">{m}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* ── GAME OVER ── */}
        {phase === 'ENDED' && (
          <div className="card ended-card">
            <h2>Game Over</h2>
            <h3 className="result-text">{notification}</h3>

            <div className="results-list">
              <h4>Identities Revealed</h4>
              <ul>
                {room?.players.map((p, i) => (
                  <li key={i} className={`result-item ${p.role}`}>
                    <span className="result-avatar">{p.avatar}</span>
                    <span className="name">{p.username}</span>
                    <span className="word-reveal">"{p.word}"</span>
                    <span className="role-tag">{p.role}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button className="btn-primary" onClick={() => window.location.reload()}>
              🔄 Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WordInput({ onSubmit, avatar, username }) {
  const [word, setWord] = useState('');
  return (
    <div className="word-input">
      <p className="your-turn-label">{avatar} Your turn, <strong>{username}</strong>!</p>
      <input
        value={word}
        onChange={e => setWord(e.target.value)}
        placeholder="Describe your secret word…"
        onKeyDown={e => e.key === 'Enter' && word && onSubmit(word)}
        autoFocus
      />
      <button onClick={() => word && onSubmit(word)}>Send ↵</button>
    </div>
  );
}

function CountdownRing({ seconds, total }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, seconds / total);
  const dashoffset = circ * (1 - progress);

  const color = seconds <= 10
    ? '#FF4444'
    : seconds <= 15
      ? '#FF8800'
      : '#CCFF00';

  return (
    <div className={`countdown-ring ${seconds <= 5 ? 'urgent' : ''}`}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        {/* Background track */}
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        {/* Progress arc */}
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 28 28)"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="countdown-text" style={{ color }}>{seconds}</span>
    </div>
  );
}

export default App;

