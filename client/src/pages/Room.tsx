import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Participant, Rule } from '../types';
import GameCanvas from '../components/GameCanvas';

interface RoomProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    roomName: string;
    userName: string;
}

const Room: React.FC<RoomProps> = ({ socket, roomName, userName }) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameSeed, setGameSeed] = useState<number>(0);
    const [newRule, setNewRule] = useState('');

    useEffect(() => {
        if (!socket) return;

        socket.on('participant_list', (list) => {
            setParticipants(list);
        });

        socket.on('rule_list', (list) => {
            setRules(list);
        });

        socket.on('game_started', ({ seed }) => {
            setGameSeed(seed);
            setIsPlaying(true);
        });

        return () => {
            socket.off('participant_list');
            socket.off('rule_list');
            socket.off('game_started');
        };
    }, [socket]);

    const handleAddRule = (e: React.FormEvent) => {
        e.preventDefault();
        if (newRule.trim() && socket) {
            socket.emit('create_rule', {
                roomName,
                rule: { id: Date.now().toString(), label: newRule, weight: 1 },
            });
            setNewRule('');
        }
    };

    const handleStart = () => {
        if (socket) {
            setIsPlaying(false); // Reset locally just in case
            setTimeout(() => {
                socket.emit('start_game', { roomName });
            }, 100);
        }
    };

    const REPLAY_TIMEOUT = 5000;
    useEffect(() => {
        if (isPlaying) {
            const timer = setTimeout(() => setIsPlaying(false), 10000);
            return () => clearTimeout(timer);
        }
    }, [isPlaying]);

    return (
        <div className="room-container">
            <div className="sidebar left-sidebar glass-card">
                <h2>참가자</h2>
                <ul className="participant-list">
                    {participants.map((p) => (
                        <li key={p.id} className={p.name === userName ? 'me' : ''}>
                            {p.name}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="game-area glass-card">
                <div className="game-header">
                    <h2>방: {roomName}</h2>
                    <button className="btn-primary" onClick={handleStart} disabled={isPlaying}>
                        {isPlaying ? '돌아가는 중...' : '룰렛 시작'}
                    </button>
                </div>
                <GameCanvas
                    participants={participants}
                    rules={rules}
                    isPlaying={isPlaying}
                    gameSeed={gameSeed}
                />
                <div className="rules-legend">
                    {rules.map((r, i) => (
                        <div key={r.id} className="rule-badge">
                            슬롯 {i + 1}: {r.label}
                        </div>
                    ))}
                </div>
            </div>

            <div className="sidebar right-sidebar glass-card">
                <h2>룰 / 벌칙</h2>
                <ul className="rule-list">
                    {rules.map((r) => (
                        <li key={r.id}>{r.label}</li>
                    ))}
                </ul>
                <form onSubmit={handleAddRule} className="add-rule-form">
                    <input
                        type="text"
                        value={newRule}
                        onChange={(e) => setNewRule(e.target.value)}
                        placeholder="새로운 룰 추가..."
                    />
                    <button type="submit" className="btn-primary small-btn">+</button>
                </form>
            </div>

            <style>{`
        .room-container {
            display: flex;
            width: 100%;
            height: 100vh;
            padding: 20px;
            gap: 20px;
            box-sizing: border-box;
        }
        .sidebar {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }
        .game-area {
            flex: 3;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .participant-list, .rule-list {
            list-style: none;
            padding: 0;
        }
        .participant-list li, .rule-list li {
            padding: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .participant-list li.me {
            color: var(--primary-color);
            font-weight: bold;
        }
        .add-rule-form {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }
        .add-rule-form input {
            flex: 1;
            min-width: 0;
        }
        .small-btn {
            padding: 0.5rem 1rem;
        }
        .rule-badge {
            display: inline-block;
            margin: 5px;
            padding: 5px 10px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            font-size: 0.8rem;
        }
        .rules-legend {
             width: 100%;
             display: flex;
             justify-content: center;
             flex-wrap: wrap;
             margin-top: 10px;
        }
        .game-header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 20px;
            margin-bottom: 10px;
        }
      `}</style>
        </div>
    );
};

export default Room;
