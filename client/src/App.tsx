import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import Landing from './pages/Landing';
import Room from './pages/Room';
import { useSocket } from './hooks/useSocket';
import type { GameMode, RoomType } from './types';
import './App.css';

function App() {
  const socket = useSocket();
  const [user, setUser] = useState<{ name: string; room: string } | null>(null);
  const [pendingJoin, setPendingJoin] = useState<{ roomName: string; userName: string; gameMode?: GameMode; roomType?: RoomType } | null>(null);
  const [hostStatus, setHostStatus] = useState<{ isHost: boolean; hostId: string }>({ isHost: false, hostId: '' });

  // Set up host_status listener globally BEFORE any join_room events
  useEffect(() => {
    if (!socket) return;

    console.log('Setting up global host_status listener');

    const handleHostStatus = ({ isHost, hostId }: { isHost: boolean; hostId: string }) => {
      console.log('🎯 Host status received in App:', isHost, 'Host ID:', hostId, 'My Socket ID:', socket.id);
      setHostStatus({ isHost, hostId });
      if (isHost) {
        console.log('🎩 You are the HOST!');
      } else {
        console.log('👤 You are a participant');
      }
    };

    socket.on('host_status', handleHostStatus);

    return () => {
      socket.off('host_status', handleHostStatus);
    };
  }, [socket]);

  // Handle pending join when socket becomes available
  useEffect(() => {
    if (socket && pendingJoin) {
      console.log('Socket ready, processing pending join:', pendingJoin);
      socket.emit('join_room', { roomName: pendingJoin.roomName, userName: pendingJoin.userName, roomType: pendingJoin.roomType });

      // Set game mode if provided (for room creator) - only for roulette mode
      if (pendingJoin.gameMode !== undefined && pendingJoin.roomType !== 'betting') {
        setTimeout(() => {
          socket.emit('set_game_mode', { roomName: pendingJoin.roomName, mode: pendingJoin.gameMode! });
        }, 100);
      }

      setUser({ name: pendingJoin.userName, room: pendingJoin.roomName });
      setPendingJoin(null);
    }
  }, [socket, pendingJoin]);

  const handleJoin = (roomName: string, userName: string, gameMode?: GameMode, roomType?: RoomType) => {
    console.log('handleJoin called:', { roomName, userName, gameMode, roomType, socketConnected: !!socket });
    if (socket) {
      console.log('Emitting join_room event');
      socket.emit('join_room', { roomName, userName, roomType });

      // Set game mode if provided (for room creator) - only for roulette mode
      if (gameMode !== undefined && roomType !== 'betting') {
        setTimeout(() => {
          socket.emit('set_game_mode', { roomName, mode: gameMode });
        }, 100);
      }

      setUser({ name: userName, room: roomName });
    } else {
      console.warn('Socket not ready yet, queueing join request');
      setPendingJoin({ roomName, userName, gameMode, roomType });
      setUser({ name: userName, room: roomName });
    }
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing onJoin={handleJoin} />} />
          <Route path="/room/:id" element={<RoomWrapper socket={socket} user={user} hostStatus={hostStatus} />} />
        </Routes>
      </div>
    </Router>
  );
}

// Wrapper to pass params
const RoomWrapper = ({ socket, user, hostStatus }: { socket: any, user: any, hostStatus: { isHost: boolean; hostId: string } }) => {
  const { id } = useParams();
  const [userName, setUserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  useEffect(() => {
    // If user is not set or room doesn't match, show name prompt
    if (!user || user.room !== id) {
      setShowNamePrompt(true);
    }
  }, [user, id]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() && socket && id) {
      console.log('Direct URL join:', { roomName: id, userName });
      socket.emit('join_room', { roomName: id, userName: userName.trim() });
      setShowNamePrompt(false);
    }
  };

  if (showNamePrompt && (!user || user.room !== id)) {
    return (
      <div className="landing-container">
        <div className="glass-card">
          <h1 className="title">방 참가하기</h1>
          <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'rgba(255,255,255,0.7)' }}>
            초대 코드: <strong style={{ letterSpacing: '0.2em', fontSize: '1.2rem' }}>{id}</strong>
          </p>
          <form onSubmit={handleNameSubmit} className="form">
            <div className="input-group">
              <label htmlFor="name">이름</label>
              <input
                id="name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="이름을 입력하세요"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary">
              입장하기
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <a href="/" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>← 홈으로</a>
          </div>
        </div>
      </div>
    );
  }

  return <Room socket={socket} roomName={id || ''} userName={user?.name || userName} initialHostStatus={hostStatus} />;
};

export default App;
