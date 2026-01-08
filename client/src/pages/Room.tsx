import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Participant, Rule, GameMode, EmoticonMessage, UserNotification } from '../types';
import GameCanvas from '../components/GameCanvas';

interface RoomProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    roomName: string;
    userName: string;
}

interface WinnerResult {
    participant: Participant;
    rule: Rule;
    timestamp: number;
}

const Room: React.FC<RoomProps> = ({ socket, roomName, userName }) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameSeed, setGameSeed] = useState<number>(0);
    const [newRule, setNewRule] = useState('');
    const [winners, setWinners] = useState<WinnerResult[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [hostId, setHostId] = useState<string>('');
    const [gameMode, setGameMode] = useState<GameMode>('all_results');
    const [emoticons, setEmoticons] = useState<EmoticonMessage[]>([]);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);

    useEffect(() => {
        if (!socket) {
            console.log('Socket not ready yet');
            return;
        }

        console.log('Setting up socket listeners for room:', roomName);

        socket.on('participant_list', (list) => {
            console.log('Received participant_list:', list);
            setParticipants(list);
        });

        socket.on('rule_list', (list) => {
            console.log('Received rule_list:', list);
            setRules(list);
        });

        socket.on('game_started', ({ seed }) => {
            console.log('Game started with seed:', seed);
            setGameSeed(seed);
            setIsPlaying(true);
        });

        socket.on('host_status', ({ isHost: hostStatus, hostId: id }) => {
            console.log('Host status received:', hostStatus, id);
            setIsHost(hostStatus);
            setHostId(id);
        });

        socket.on('error_message', ({ message }) => {
            alert(message);
        });

        socket.on('game_mode_updated', ({ mode }) => {
            console.log('Game mode updated:', mode);
            setGameMode(mode);
        });

        socket.on('emoticon_received', (data) => {
            console.log('Emoticon received:', data);
            setEmoticons(prev => [...prev, data]);
            // Auto-remove emoticon after 3 seconds
            setTimeout(() => {
                setEmoticons(prev => prev.filter(e => e.timestamp !== data.timestamp));
            }, 3000);
        });

        socket.on('user_notification', (data) => {
            console.log('User notification:', data);
            setNotifications(prev => [...prev, data]);
            // Auto-remove notification after 5 seconds
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.timestamp !== data.timestamp));
            }, 5000);
        });

        socket.on('kicked', () => {
            alert('방장에 의해 강제 퇴장당했습니다.');
            window.location.href = '/';
        });

        socket.on('room_destroyed', () => {
            alert('방이 파괴되었습니다.');
            window.location.href = '/';
        });

        return () => {
            socket.off('participant_list');
            socket.off('rule_list');
            socket.off('game_started');
            socket.off('host_status');
            socket.off('error_message');
            socket.off('game_mode_updated');
            socket.off('emoticon_received');
            socket.off('user_notification');
            socket.off('kicked');
            socket.off('room_destroyed');
        };
    }, [socket, roomName]);

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
            setWinners([]); // Clear previous winners
            setTimeout(() => {
                socket.emit('start_game', { roomName });
            }, 100);
        }
    };

    const handleWinner = (participant: Participant, rule: Rule) => {
        console.log('Winner detected in Room:', participant, rule);
        const newWinner: WinnerResult = {
            participant,
            rule,
            timestamp: Date.now()
        };

        // Handle different game modes
        if (gameMode === 'all_results') {
            // Show all results
            setWinners(prev => [...prev, newWinner]);
        } else if (gameMode === 'winner_only') {
            // Only show the first winner
            setWinners(prev => {
                if (prev.length === 0) {
                    return [newWinner];
                }
                return prev;
            });
        } else if (gameMode === 'loser_only') {
            // Keep updating to show the last person (loser)
            setWinners([newWinner]);
        }

        // Visual feedback
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ0PVqzn77BdGAg+ltryxnMpBSl+zPLaizsIGGS57OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWW77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4MUKXh8bllHAU2jdXyz3ssBSh5yfDaizYIGWS77OihUQ4=');
        audio.play().catch(() => {});
    };

    const handleGameModeChange = (mode: GameMode) => {
        if (socket && isHost) {
            socket.emit('set_game_mode', { roomName, mode });
        }
    };

    const handleSendEmoticon = (emoticon: string) => {
        if (socket) {
            socket.emit('send_emoticon', { roomName, emoticon });
        }
    };

    const handleKickUser = (userId: string) => {
        if (socket && confirm('이 사용자를 강제 퇴장시키겠습니까?')) {
            socket.emit('kick_user', { roomName, userId });
        }
    };

    const handleDestroyRoom = () => {
        if (socket && confirm('방을 파괴하시겠습니까? 모든 사용자가 강제 퇴장됩니다.')) {
            socket.emit('destroy_room', { roomName });
        }
    };

    // Automatically stop the game after 30 seconds to allow replay
    useEffect(() => {
        if (isPlaying) {
            const timer = setTimeout(() => {
                console.log('Game timeout - allowing replay');
                setIsPlaying(false);
            }, 30000); // 30 seconds
            return () => clearTimeout(timer);
        }
    }, [isPlaying]);

    return (
        <div className="room-container">
            <div className="sidebar left-sidebar glass-card">
                <h2>참가자 ({participants.length}명)</h2>
                <ul className="participant-list">
                    {participants.map((p) => (
                        <li key={p.id} className={p.name === userName ? 'me' : ''}>
                            <span>
                                {p.name}
                                {p.id === hostId && <span className="host-icon">👑</span>}
                            </span>
                            {isHost && p.id !== hostId && (
                                <button
                                    className="kick-btn"
                                    onClick={() => handleKickUser(p.id)}
                                    title="강제 퇴장"
                                >
                                    ❌
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
                <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                <h2>이모티콘</h2>
                <div className="emoticon-buttons">
                    {['👍', '😂', '❤️', '🎉', '😮', '👏', '🔥', '😢'].map((emoticon) => (
                        <button
                            key={emoticon}
                            className="emoticon-btn"
                            onClick={() => handleSendEmoticon(emoticon)}
                        >
                            {emoticon}
                        </button>
                    ))}
                </div>
            </div>

            <div className="game-area glass-card">
                {/* Emoticon overlay */}
                <div className="emoticon-overlay">
                    {emoticons.map((emo) => (
                        <div key={emo.timestamp} className="floating-emoticon">
                            <div className="emoticon-content">
                                <span className="emoticon-symbol">{emo.emoticon}</span>
                                <span className="emoticon-sender">{emo.userName}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Notification overlay */}
                <div className="notification-overlay">
                    {notifications.map((notif) => (
                        <div key={notif.timestamp} className={`notification ${notif.type}`}>
                            {notif.type === 'join' ? '🚪 ' : '👋 '}
                            <strong>{notif.userName}</strong>님이 {notif.type === 'join' ? '입장' : '퇴장'}했습니다
                        </div>
                    ))}
                </div>

                <div className="game-header">
                    <div className="room-info">
                        <h2>
                            초대 코드: {roomName}
                            {isHost && <span className="host-badge">👑 방장</span>}
                        </h2>
                        <button
                            className="copy-btn"
                            onClick={async () => {
                                const fullUrl = `${window.location.origin}/room/${roomName}`;
                                try {
                                    await navigator.clipboard.writeText(fullUrl);
                                    alert('초대 링크가 복사되었습니다!\n' + fullUrl);
                                } catch (err) {
                                    console.error('Failed to copy:', err);
                                    // Fallback for older browsers
                                    const textArea = document.createElement('textarea');
                                    textArea.value = fullUrl;
                                    textArea.style.position = 'fixed';
                                    textArea.style.left = '-999999px';
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    try {
                                        document.execCommand('copy');
                                        alert('초대 링크가 복사되었습니다!\n' + fullUrl);
                                    } catch (e) {
                                        alert('복사 실패. 링크: ' + fullUrl);
                                    }
                                    document.body.removeChild(textArea);
                                }
                            }}
                            title="초대 링크 복사"
                        >
                            📋 링크 복사
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="btn-primary"
                            onClick={handleStart}
                            disabled={isPlaying || !isHost}
                            title={!isHost ? '방장만 게임을 시작할 수 있습니다' : ''}
                        >
                            {isPlaying ? '돌아가는 중...' : '룰렛 시작'}
                        </button>
                        {isHost && (
                            <button
                                className="btn-danger"
                                onClick={handleDestroyRoom}
                                title="방 파괴 (모든 사용자 강제 퇴장)"
                            >
                                🗑️ 방 파괴
                            </button>
                        )}
                    </div>
                </div>
                <GameCanvas
                    participants={participants}
                    rules={rules}
                    isPlaying={isPlaying}
                    gameSeed={gameSeed}
                    onWinner={handleWinner}
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
                {isHost && (
                    <div className="game-mode-section">
                        <h2>⚙️ 게임 모드</h2>
                        <div className="game-mode-buttons">
                            <button
                                className={`mode-btn ${gameMode === 'all_results' ? 'active' : ''}`}
                                onClick={() => handleGameModeChange('all_results')}
                                disabled={isPlaying}
                            >
                                전체 결과
                            </button>
                            <button
                                className={`mode-btn ${gameMode === 'winner_only' ? 'active' : ''}`}
                                onClick={() => handleGameModeChange('winner_only')}
                                disabled={isPlaying}
                            >
                                1등만
                            </button>
                            <button
                                className={`mode-btn ${gameMode === 'loser_only' ? 'active' : ''}`}
                                onClick={() => handleGameModeChange('loser_only')}
                                disabled={isPlaying}
                            >
                                꼴찌만
                            </button>
                        </div>
                        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                )}
                <h2>🎯 당첨 결과
                    {gameMode === 'winner_only' && ' (1등)'}
                    {gameMode === 'loser_only' && ' (꼴찌)'}
                </h2>
                <div className="winners-list">
                    {winners.length === 0 ? (
                        <p className="empty-message">아직 당첨자가 없습니다</p>
                    ) : (
                        winners.map((winner, index) => (
                            <div key={`${winner.participant.id}-${winner.timestamp}`} className="winner-item">
                                <span className="winner-badge">{winners.length - index}</span>
                                <div className="winner-info">
                                    <div className="winner-name">{winner.participant.name}</div>
                                    <div className="winner-rule">→ {winner.rule.label}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
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
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .participant-list li.me {
            color: var(--primary-color);
            font-weight: bold;
        }
        .kick-btn {
            padding: 4px 8px;
            background: rgba(255, 107, 107, 0.2);
            border: 1px solid rgba(255, 107, 107, 0.5);
            border-radius: 6px;
            color: #ff6b6b;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s ease;
        }
        .kick-btn:hover {
            background: rgba(255, 107, 107, 0.4);
            border-color: #ff6b6b;
            transform: scale(1.1);
        }
        .host-icon {
            margin-left: 8px;
            font-size: 0.9rem;
        }
        .host-badge {
            display: inline-block;
            margin-left: 10px;
            padding: 4px 10px;
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            color: #1a1a1a;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
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
        .room-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .room-info h2 {
            margin: 0;
            font-size: 1.2rem;
            letter-spacing: 0.1em;
        }
        .copy-btn {
            padding: 0.5rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }
        .copy-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }
        .winners-list {
            max-height: 300px;
            overflow-y: auto;
            margin-top: 1rem;
        }
        .winner-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            margin-bottom: 10px;
            background: rgba(76, 209, 55, 0.1);
            border-left: 3px solid #4cd137;
            border-radius: 8px;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .winner-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            background: #4cd137;
            color: #1a1a1a;
            border-radius: 50%;
            font-weight: bold;
            font-size: 0.9rem;
            flex-shrink: 0;
        }
        .winner-info {
            flex: 1;
        }
        .winner-name {
            font-weight: bold;
            font-size: 1rem;
            color: white;
        }
        .winner-rule {
            font-size: 0.85rem;
            color: #4cd137;
            margin-top: 2px;
        }
        .empty-message {
            text-align: center;
            color: rgba(255, 255, 255, 0.5);
            padding: 2rem 1rem;
            font-style: italic;
        }
        .game-mode-section {
            margin-bottom: 1rem;
        }
        .game-mode-buttons {
            display: flex;
            gap: 8px;
            margin-top: 0.5rem;
        }
        .mode-btn {
            flex: 1;
            padding: 0.6rem;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.3s ease;
        }
        .mode-btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        .mode-btn.active {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-color: #667eea;
            font-weight: bold;
        }
        .mode-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .emoticon-buttons {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-top: 0.5rem;
        }
        .emoticon-btn {
            padding: 0.8rem;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            font-size: 1.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .emoticon-btn:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
            transform: scale(1.1);
        }
        .emoticon-btn:active {
            transform: scale(0.95);
        }
        .emoticon-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            overflow: hidden;
            z-index: 100;
        }
        .floating-emoticon {
            position: absolute;
            left: 50%;
            bottom: 20%;
            transform: translateX(-50%);
            animation: floatUp 3s ease-out forwards;
        }
        @keyframes floatUp {
            0% {
                bottom: 20%;
                opacity: 1;
                transform: translateX(-50%) scale(1);
            }
            50% {
                transform: translateX(-50%) scale(1.5);
            }
            100% {
                bottom: 80%;
                opacity: 0;
                transform: translateX(-50%) scale(1);
            }
        }
        .emoticon-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .emoticon-symbol {
            font-size: 3rem;
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
        }
        .emoticon-sender {
            font-size: 0.8rem;
            color: white;
            background: rgba(0, 0, 0, 0.6);
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: bold;
        }
        .notification-overlay {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 200;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        }
        .notification {
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            animation: slideInDown 0.3s ease-out, fadeOut 0.5s ease-in 4.5s forwards;
            white-space: nowrap;
        }
        .notification.join {
            border-left: 4px solid #4cd137;
        }
        .notification.leave {
            border-left: 4px solid #ff6b6b;
        }
        @keyframes slideInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeOut {
            to {
                opacity: 0;
            }
        }
      `}</style>
        </div>
    );
};

export default Room;
