import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LandingProps {
    onJoin: (roomName: string, userName: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onJoin }) => {
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');
    const navigate = useNavigate();

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && room.trim()) {
            onJoin(room, name);
            navigate(`/room/${room}`);
        }
    };

    return (
        <div className="landing-container">
            <div className="glass-card">
                <h1 className="title">룰렛 투게더</h1>
                <form onSubmit={handleJoin} className="form">
                    <div className="input-group">
                        <label htmlFor="name">이름</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="이름을 입력하세요"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="room">방 이름</label>
                        <input
                            id="room"
                            type="text"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="방 이름을 입력하세요"
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary">
                        게임 입장
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Landing;
