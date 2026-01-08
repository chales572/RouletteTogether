import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import Landing from './pages/Landing';
import Room from './pages/Room';
import { useSocket } from './hooks/useSocket';
import './App.css';

function App() {
  const socket = useSocket();
  const [user, setUser] = useState<{ name: string; room: string } | null>(null);

  const handleJoin = (roomName: string, userName: string) => {
    if (socket) {
      socket.emit('join_room', { roomName, userName });
      setUser({ name: userName, room: roomName });
    }
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing onJoin={handleJoin} />} />
          <Route path="/room/:id" element={<RoomWrapper socket={socket} user={user} />} />
        </Routes>
      </div>
    </Router>
  );
}

// Wrapper to pass params
const RoomWrapper = ({ socket, user }: { socket: any, user: any }) => {
  const { id } = useParams();

  if (!user || user.room !== id) {
    return (
      <div className="redirect-message">
        <p>Please join from the main page.</p>
        <a href="/">Go Home</a>
      </div>
    )
  }

  return <Room socket={socket} roomName={id || ''} userName={user.name} />;
};

export default App;
