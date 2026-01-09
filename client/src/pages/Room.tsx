import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Participant, Rule, GameMode, EmoticonMessage, UserNotification, ChatMessage, DrawingData, RoomSyncData, GameResult, RoomType, BettingState } from '../types';
import GameCanvas, { type GameCanvasHandle } from '../components/GameCanvas';

interface RoomProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    roomName: string;
    userName: string;
    initialHostStatus?: { isHost: boolean; hostId: string };
}

interface WinnerResult {
    participant: Participant;
    rule: Rule;
    timestamp: number;
}

const Room: React.FC<RoomProps> = ({ socket, roomName, userName, initialHostStatus }) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameSeed, setGameSeed] = useState<number>(0);
    const [newRule, setNewRule] = useState('');
    const [winners, setWinners] = useState<WinnerResult[]>([]);
    const [isHost, setIsHost] = useState(initialHostStatus?.isHost || false);
    const [hostId, setHostId] = useState<string>(initialHostStatus?.hostId || '');
    const [gameMode, setGameMode] = useState<GameMode>('all_results');
    const [emoticons, setEmoticons] = useState<EmoticonMessage[]>([]);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newChatMessage, setNewChatMessage] = useState('');
    const [drawingsLeft, setDrawingsLeft] = useState(2);
    const [latestWinner, setLatestWinner] = useState<{ participant: Participant; rule: Rule } | null>(null);
    const drawMode = 'pin'; // Only pin mode supported
    const [gameFinished, setGameFinished] = useState(false);
    const [arrivedParticipants, setArrivedParticipants] = useState<Set<string>>(new Set());
    const [showStartEffect, setShowStartEffect] = useState(false);
    const [showFinishEffect, setShowFinishEffect] = useState(false);
    const [isSpectator, setIsSpectator] = useState(false); // Joined mid-game
    const [confetti, setConfetti] = useState<Array<{id: number; x: number; color: string; delay: number}>>([]);
    const [finishConfetti, setFinishConfetti] = useState<Array<{id: number; x: number; y: number; color: string; delay: number; size: number}>>([]);
    const gameCanvasRef = useRef<GameCanvasHandle>(null);

    // Betting mode state
    const [roomType, setRoomType] = useState<RoomType>('roulette');
    const [bettingState, setBettingState] = useState<BettingState>({ bets: [], bettingOpen: true, bettingTitle: '내기' });
    const [bettingResult, setBettingResult] = useState<{ winningRuleId: string; winners: Participant[]; losers: Participant[] } | null>(null);
    const [myBet, setMyBet] = useState<string | null>(null); // ruleId of my bet

    // Update host status when prop changes
    useEffect(() => {
        if (initialHostStatus && (initialHostStatus.isHost || initialHostStatus.hostId)) {
            console.log('🔄 Updating host status from props:', initialHostStatus);
            setIsHost(initialHostStatus.isHost);
            setHostId(initialHostStatus.hostId);
        }
    }, [initialHostStatus?.isHost, initialHostStatus?.hostId]);

    // Debug: Log isHost changes
    useEffect(() => {
        console.log('🔍 isHost state changed:', isHost, 'hostId:', hostId);
    }, [isHost, hostId]);

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

            // Trigger start effect
            setShowStartEffect(true);

            // Generate confetti
            const confettiColors = ['#ff6b6b', '#feca57', '#54a0ff', '#5f27cd', '#48dbfb', '#ff9f43', '#4cd137', '#f472b6'];
            const newConfetti = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                delay: Math.random() * 0.5
            }));
            setConfetti(newConfetti);

            // Hide start effect after animation
            setTimeout(() => {
                setShowStartEffect(false);
                setConfetti([]);
            }, 3000);
        });

        socket.on('host_status', ({ isHost: hostStatus, hostId: id }) => {
            console.log('Host status received:', hostStatus, 'Host ID:', id, 'My Socket ID:', socket.id);
            setIsHost(hostStatus);
            setHostId(id);
            if (hostStatus) {
                console.log('🎩 You are the HOST!');
            } else {
                console.log('👤 You are a participant');
            }
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

        socket.on('chat_received', (data) => {
            console.log('Chat received:', data);
            setChatMessages(prev => [...prev, data]);
        });

        socket.on('drawing_received', (data) => {
            console.log('🎨 Drawing received:', data);
            if (gameCanvasRef.current) {
                gameCanvasRef.current.addRemoteDrawing(data);
            }
        });

        socket.on('room_sync', (data: RoomSyncData) => {
            console.log('🔄 Room sync received:', data);
            // Apply synced data
            setParticipants(data.participants);
            setRules(data.rules);
            setGameMode(data.gameMode);
            setHostId(data.hostId);
            setIsHost(socket.id === data.hostId);
            setRoomType(data.roomType);
            if (data.bettingState) {
                setBettingState(data.bettingState);
                const myBetData = data.bettingState.bets.find(b => b.odrederId === socket.id);
                if (myBetData) {
                    setMyBet(myBetData.ruleId);
                }
            }

            // Handle different game statuses
            if (data.status === 'playing') {
                // User joined mid-game - show as spectator with current results
                console.log('👀 Joined mid-game as spectator');
                setIsSpectator(true);
                setIsPlaying(true); // Show that game is in progress
                setGameFinished(false);

                // Show current results (arrivals so far)
                if (data.gameResults.length > 0) {
                    const syncedWinners: WinnerResult[] = data.gameResults
                        .sort((a, b) => a.order - b.order)
                        .map(result => ({
                            participant: { id: result.participantId, name: result.participantName },
                            rule: { id: result.ruleId, label: result.ruleLabel, weight: 1 },
                            timestamp: result.timestamp
                        }));
                    setWinners(syncedWinners);

                    // Track arrived participants by name
                    const arrivedNames = new Set(data.gameResults.map(r => r.participantName));
                    setArrivedParticipants(arrivedNames);
                }
            } else if (data.status === 'finished' && data.gameResults.length > 0) {
                // Game already finished
                console.log('🏆 Syncing finished game results:', data.gameResults);
                setGameFinished(true);
                setIsPlaying(false);
                setIsSpectator(false);

                // Convert GameResult to WinnerResult format
                const syncedWinners: WinnerResult[] = data.gameResults
                    .sort((a, b) => a.order - b.order)
                    .map(result => ({
                        participant: { id: result.participantId, name: result.participantName },
                        rule: { id: result.ruleId, label: result.ruleLabel, weight: 1 },
                        timestamp: result.timestamp
                    }));
                setWinners(syncedWinners);
            } else {
                // Waiting status - normal join
                setIsSpectator(false);
            }

            // Apply all drawings
            if (data.drawings.length > 0 && gameCanvasRef.current) {
                // Small delay to ensure canvas is ready
                setTimeout(() => {
                    data.drawings.forEach(drawing => {
                        if (gameCanvasRef.current) {
                            gameCanvasRef.current.addRemoteDrawing(drawing);
                        }
                    });
                    console.log(`🎨 Applied ${data.drawings.length} synced drawings`);
                }, 500);
            }
        });

        socket.on('game_reset', () => {
            console.log('🔄 Game reset received - clearing state');
            setWinners([]);
            setGameFinished(false);
            setArrivedParticipants(new Set());
            setDrawingsLeft(2);
            setLatestWinner(null);
            setIsSpectator(false); // No longer spectating after reset
        });

        socket.on('kicked', () => {
            alert('방장에 의해 강제 퇴장당했습니다.');
            window.location.href = '/';
        });

        socket.on('room_destroyed', () => {
            alert('방이 파괴되었습니다.');
            window.location.href = '/';
        });

        // Betting mode listeners
        socket.on('room_type', ({ roomType: type }) => {
            console.log('Room type received:', type);
            setRoomType(type);
        });

        socket.on('betting_state_updated', (state) => {
            console.log('Betting state updated:', state);
            setBettingState(state);
            // Update myBet if I have a bet
            const myBetData = state.bets.find(b => b.odrederId === socket.id);
            if (myBetData) {
                setMyBet(myBetData.ruleId);
            }
        });

        socket.on('betting_result', (result) => {
            console.log('Betting result received:', result);
            setBettingResult(result);
        });

        // Request host status after setting up all listeners
        // This handles the race condition where host_status might have been sent before listeners were ready
        console.log('📤 Requesting host status for room:', roomName);
        socket.emit('request_host_status', { roomName });

        // Request room sync to get existing state (rules, drawings, etc.)
        console.log('📤 Requesting room sync for room:', roomName);
        socket.emit('request_room_sync', { roomName });

        return () => {
            socket.off('participant_list');
            socket.off('rule_list');
            socket.off('game_started');
            socket.off('host_status');
            socket.off('error_message');
            socket.off('game_mode_updated');
            socket.off('emoticon_received');
            socket.off('user_notification');
            socket.off('chat_received');
            socket.off('drawing_received');
            socket.off('room_sync');
            socket.off('game_reset');
            socket.off('kicked');
            socket.off('room_destroyed');
            socket.off('room_type');
            socket.off('betting_state_updated');
            socket.off('betting_result');
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
            // Clear server-side results and drawings first
            socket.emit('clear_results', { roomName });

            setIsPlaying(false); // Reset locally just in case
            setWinners([]); // Clear previous winners
            setDrawingsLeft(2); // Reset drawing count
            setLatestWinner(null); // Clear previous winner highlight
            setGameFinished(false); // Reset game finished state
            setArrivedParticipants(new Set()); // Reset arrived participants tracking
            setIsSpectator(false); // Reset spectator state
            setTimeout(() => {
                socket.emit('start_game', { roomName });
            }, 200); // Slight delay to ensure clear_results is processed first
        }
    };

    const handleWinner = (participant: Participant, rule: Rule) => {
        console.log('Winner detected in Room:', participant, rule);
        const newWinner: WinnerResult = {
            participant,
            rule,
            timestamp: Date.now()
        };

        // Set latest winner for highlighting
        setLatestWinner({ participant, rule });

        // Track arrived participants by name (separate from winners display)
        // Use participant.name because participant.id from PhysicsWorld is Matter.js internal ID
        const newArrivedSet = new Set(arrivedParticipants);

        // Skip if this participant already arrived (prevent duplicate detection)
        if (newArrivedSet.has(participant.name)) {
            console.log(`⚠️ Duplicate arrival detected for ${participant.name}, skipping`);
            return;
        }

        newArrivedSet.add(participant.name);
        setArrivedParticipants(newArrivedSet);
        const arrivedCount = newArrivedSet.size;
        const isFirstPlace = arrivedCount === 1;
        const isLastPlace = arrivedCount >= participants.length;

        // Play sound based on arrival order
        const playTone = (frequency: number, duration: number, delay: number, type: OscillatorType = 'sine') => {
            setTimeout(() => {
                try {
                    const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.frequency.value = frequency;
                    oscillator.type = type;
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + duration);
                } catch (e) {
                    console.log('Audio not supported');
                }
            }, delay);
        };

        // Play different sounds based on game mode and position
        if (gameMode === 'winner_only' && isFirstPlace) {
            // Winner celebration fanfare
            playTone(523.25, 0.2, 0);
            playTone(659.25, 0.2, 200);
            playTone(783.99, 0.2, 400);
            playTone(1046.50, 0.4, 600);
        } else if (gameMode === 'loser_only' && isLastPlace) {
            // Loser dramatic sound (descending tones)
            playTone(392.00, 0.3, 0, 'triangle');
            playTone(329.63, 0.3, 300, 'triangle');
            playTone(261.63, 0.5, 600, 'triangle');
        } else if (gameMode === 'all_results') {
            // Normal arrival ding
            playTone(880, 0.15, 0);
        }

        // Handle different game modes for display
        if (gameMode === 'all_results') {
            setWinners(prev => [...prev, newWinner]);
        } else if (gameMode === 'winner_only') {
            setWinners(prev => prev.length === 0 ? [newWinner] : prev);
        } else if (gameMode === 'loser_only') {
            // Always update to show the most recent (last) arrival
            setWinners([newWinner]);
        }

        // Host reports result to server for syncing with other clients
        if (isHost && socket) {
            const gameResult: GameResult = {
                participantId: participant.id,
                participantName: participant.name,
                ruleId: rule.id,
                ruleLabel: rule.label,
                order: arrivedCount,
                timestamp: Date.now()
            };
            socket.emit('report_result', { roomName, result: gameResult });
            console.log('📤 Reported result to server:', gameResult);
        }

        // Determine if game should end based on mode
        // - winner_only: End when first place arrives
        // - loser_only: End when last place arrives (all finished)
        // - all_results: End when all participants finish
        const shouldEndGame =
            (gameMode === 'winner_only' && isFirstPlace) ||
            (gameMode === 'loser_only' && isLastPlace) ||
            (gameMode === 'all_results' && arrivedCount >= participants.length);

        console.log(`🎯 Game end check: mode=${gameMode}, arrivedCount=${arrivedCount}, total=${participants.length}, shouldEnd=${shouldEndGame}`);

        if (shouldEndGame && participants.length > 0) {
            // For winner_only, we need to capture the winner before triggering effect
            const finalWinner = gameMode === 'winner_only' ? newWinner : null;

            setTimeout(() => {
                setIsPlaying(false);
                setGameFinished(true);
                setShowFinishEffect(true);

                // Notify server that game is finished (host only)
                if (isHost && socket) {
                    socket.emit('game_finished', { roomName });
                }

                // For winner_only, ensure winner is set
                if (gameMode === 'winner_only' && finalWinner) {
                    setWinners([finalWinner]);
                }

                // Generate mode-specific confetti colors
                const modeColors = gameMode === 'winner_only'
                    ? ['#ffd700', '#ffed4e', '#daa520', '#f9ca24', '#f0932b', '#ffffff'] // Gold/trophy colors
                    : gameMode === 'loser_only'
                    ? ['#ff4444', '#ff6b6b', '#e74c3c', '#c0392b', '#8b0000', '#2c2c2c'] // Red/dark dramatic
                    : ['#ff6b6b', '#feca57', '#54a0ff', '#5f27cd', '#48dbfb', '#ff9f43', '#4cd137', '#f472b6']; // Rainbow

                const newFinishConfetti = Array.from({ length: 80 }, (_, i) => ({
                    id: i,
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    color: modeColors[Math.floor(Math.random() * modeColors.length)],
                    delay: Math.random() * 1,
                    size: 8 + Math.random() * 12
                }));
                setFinishConfetti(newFinishConfetti);

                // Play mode-specific victory/defeat fanfare
                if (gameMode === 'winner_only') {
                    // Triumphant fanfare
                    playTone(523.25, 0.15, 0);
                    playTone(659.25, 0.15, 150);
                    playTone(783.99, 0.15, 300);
                    playTone(1046.50, 0.3, 450);
                    playTone(783.99, 0.15, 750);
                    playTone(1046.50, 0.5, 900);
                } else if (gameMode === 'loser_only') {
                    // Dramatic doom sound
                    playTone(196.00, 0.4, 0, 'sawtooth');
                    playTone(185.00, 0.4, 400, 'sawtooth');
                    playTone(174.61, 0.6, 800, 'sawtooth');
                } else {
                    // All results - cheerful finish
                    playTone(659.25, 0.15, 0);
                    playTone(783.99, 0.15, 150);
                    playTone(987.77, 0.15, 300);
                    playTone(1174.66, 0.4, 450);
                }

                setTimeout(() => {
                    setShowFinishEffect(false);
                    setFinishConfetti([]);
                }, 8000);
            }, 500);
        }

        // Clear highlight after 3 seconds
        setTimeout(() => {
            setLatestWinner(null);
        }, 3000);
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

    const handleSendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (newChatMessage.trim() && socket) {
            socket.emit('send_chat', { roomName, message: newChatMessage.trim() });
            setNewChatMessage('');
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

    // Betting mode handlers
    const handlePlaceBet = (ruleId: string) => {
        if (socket && bettingState.bettingOpen) {
            socket.emit('place_bet', { roomName, ruleId });
            setMyBet(ruleId);
        }
    };

    const handleCloseBetting = () => {
        if (socket && isHost) {
            socket.emit('close_betting', { roomName });
        }
    };

    const handleSelectWinner = (ruleId: string) => {
        if (socket && isHost && !bettingState.bettingOpen) {
            socket.emit('select_winner', { roomName, ruleId });
        }
    };

    const handleResetBetting = () => {
        if (socket && isHost) {
            socket.emit('reset_betting', { roomName });
            setBettingResult(null);
            setMyBet(null);
        }
    };

    const handleSetBettingTitle = (title: string) => {
        if (socket && isHost) {
            socket.emit('set_betting_title', { roomName, title });
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
                <h2>참가자 ({participants.length}명) {isHost && <span style={{fontSize: '0.8rem', color: '#ffd700'}}>👑 방장</span>}</h2>
                <ul className="participant-list">
                    {participants.map((p) => {
                        const isMe = p.name === userName;
                        const isWinner = latestWinner && latestWinner.participant.id === p.id;
                        const className = isMe ? 'me' : isWinner ? 'winner-highlight' : '';

                        return (
                            <li key={p.id} className={className}>
                                <span>
                                    {p.name}
                                    {p.id === hostId && <span className="host-icon" title="방장">👑</span>}
                                    {isWinner && (
                                        <span className="winner-icon" title="당첨!">🎉</span>
                                    )}
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
                        );
                    })}
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
                <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                <h2>채팅</h2>
                <div className="chat-container">
                    <div className="chat-messages">
                        {chatMessages.map((msg) => (
                            <div key={msg.timestamp} className="chat-message">
                                <span className="chat-user">{msg.userName}:</span>
                                <span className="chat-text">{msg.message}</span>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleSendChat} className="chat-input-form">
                        <input
                            type="text"
                            value={newChatMessage}
                            onChange={(e) => setNewChatMessage(e.target.value)}
                            placeholder="메시지를 입력하세요..."
                            className="chat-input"
                        />
                        <button type="submit" className="btn-primary small-btn">전송</button>
                    </form>
                </div>
            </div>

            <div className={`game-area glass-card ${isPlaying ? 'playing' : ''}`}>
                {/* Game start effect overlay */}
                {showStartEffect && (
                    <div className="start-effect-overlay">
                        <div className="start-flash"></div>
                        <div className="start-text">START!</div>
                        <div className="confetti-container">
                            {confetti.map((c) => (
                                <div
                                    key={c.id}
                                    className="confetti-piece"
                                    style={{
                                        left: `${c.x}%`,
                                        backgroundColor: c.color,
                                        animationDelay: `${c.delay}s`
                                    }}
                                />
                            ))}
                        </div>
                        <div className="start-rings">
                            <div className="ring ring-1"></div>
                            <div className="ring ring-2"></div>
                            <div className="ring ring-3"></div>
                        </div>
                    </div>
                )}

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

                {/* Top header bar */}
                <div className="game-header">
                    <div className="header-left">
                        <h2 className="room-code">
                            초대 코드: {roomName}
                            {socket && hostId ? (
                                isHost ? (
                                    <span className="host-badge">👑 방장</span>
                                ) : (
                                    <span className="participant-badge">👤 참가자</span>
                                )
                            ) : (
                                <span className="participant-badge" style={{opacity: 0.5}}>⏳ 확인 중...</span>
                            )}
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
                    <div className="header-right">
                        {isHost && roomType === 'roulette' && (
                            <>
                                <button
                                    className="btn-primary"
                                    onClick={handleStart}
                                    disabled={isPlaying}
                                >
                                    {isPlaying ? '돌아가는 중...' : gameFinished ? '다시 시작' : '룰렛 시작'}
                                </button>
                                <button
                                    className="btn-danger"
                                    onClick={handleDestroyRoom}
                                    title="방 파괴 (모든 사용자 강제 퇴장)"
                                >
                                    🗑️ 방 파괴
                                </button>
                            </>
                        )}
                        {isHost && roomType === 'betting' && (
                            <>
                                {bettingState.bettingOpen ? (
                                    <button
                                        className="btn-primary"
                                        onClick={handleCloseBetting}
                                        disabled={rules.length === 0}
                                    >
                                        🔒 베팅 마감
                                    </button>
                                ) : !bettingResult ? (
                                    <span className="betting-status">👆 당첨 옵션을 선택하세요</span>
                                ) : (
                                    <button
                                        className="btn-primary"
                                        onClick={handleResetBetting}
                                    >
                                        🔄 새로운 내기
                                    </button>
                                )}
                                <button
                                    className="btn-danger"
                                    onClick={handleDestroyRoom}
                                    title="방 파괴 (모든 사용자 강제 퇴장)"
                                >
                                    🗑️ 방 파괴
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Drawing tools bar - below header (roulette mode only) */}
                {roomType === 'roulette' && !isPlaying && drawingsLeft > 0 && (
                    <div className="drawing-toolbar">
                        <span className="drawing-count">📍 핀 설치 가능: {drawingsLeft}번</span>
                        <span className="drawing-hint">(클릭하면 핀이 설치됩니다)</span>
                    </div>
                )}
                {/* Game finish celebration overlay - theme based on game mode */}
                {showFinishEffect && (
                    <div className={`finish-effect-overlay finish-mode-${gameMode}`}>
                        {/* Confetti burst */}
                        <div className="finish-confetti-container">
                            {finishConfetti.map((c) => (
                                <div
                                    key={c.id}
                                    className="finish-confetti"
                                    style={{
                                        left: `${c.x}%`,
                                        top: `${c.y}%`,
                                        backgroundColor: c.color,
                                        width: `${c.size}px`,
                                        height: `${c.size}px`,
                                        animationDelay: `${c.delay}s`
                                    }}
                                />
                            ))}
                        </div>
                        {/* Celebration content based on game mode */}
                        <div className="finish-celebration-content">
                            {gameMode === 'winner_only' ? (
                                <>
                                    <div className="finish-icon winner-icon-big">🏆</div>
                                    <h2 className="finish-title winner-title">우승자 결정!</h2>
                                    {winners[0] && (
                                        <div className="winner-announcement">
                                            <span className="winner-crown">👑</span>
                                            <span className="winner-name">{winners[0].participant.name}</span>
                                            <span className="winner-crown">👑</span>
                                        </div>
                                    )}
                                    <p className="finish-subtitle">{winners[0]?.rule.label || '벌칙'}</p>
                                    <div className="finish-fireworks">
                                        <span className="firework gold">✨</span>
                                        <span className="firework gold">🌟</span>
                                        <span className="firework gold">✨</span>
                                    </div>
                                </>
                            ) : gameMode === 'loser_only' ? (
                                <>
                                    <div className="finish-icon loser-icon-big">💀</div>
                                    <h2 className="finish-title loser-title">꼴찌 결정!</h2>
                                    {winners[0] && (
                                        <div className="loser-announcement">
                                            <span className="loser-skull">☠️</span>
                                            <span className="loser-name">{winners[0].participant.name}</span>
                                            <span className="loser-skull">☠️</span>
                                        </div>
                                    )}
                                    <p className="finish-subtitle loser-penalty">{winners[0]?.rule.label || '벌칙'}</p>
                                    <div className="finish-fireworks loser-effects">
                                        <span className="effect-icon">🔥</span>
                                        <span className="effect-icon">⚡</span>
                                        <span className="effect-icon">🔥</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="finish-icon basket-icon-big">🎪</div>
                                    <h2 className="finish-title basket-title">바구니 배정 완료!</h2>
                                    <p className="finish-subtitle">모든 참가자가 바구니에 들어갔습니다!</p>
                                    <div className="basket-results-preview">
                                        {winners.map((w, idx) => {
                                            const basketIcons = ['🧺', '🎁', '🎀', '🎯', '🌟', '💎'];
                                            const basketColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];
                                            return (
                                                <div key={w.participant.id} className="basket-assignment" style={{ borderColor: basketColors[idx % basketColors.length] }}>
                                                    <span className="basket-icon">{basketIcons[idx % basketIcons.length]}</span>
                                                    <span className="basket-participant">{w.participant.name}</span>
                                                    <span className="basket-arrow">→</span>
                                                    <span className="basket-rule" style={{ color: basketColors[idx % basketColors.length] }}>{w.rule.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="finish-fireworks">
                                        <span className="firework">🎊</span>
                                        <span className="firework">🎉</span>
                                        <span className="firework">🎊</span>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Color wave effects - themed */}
                        <div className={`finish-wave wave-1 wave-${gameMode}`}></div>
                        <div className={`finish-wave wave-2 wave-${gameMode}`}></div>
                        <div className={`finish-wave wave-3 wave-${gameMode}`}></div>
                    </div>
                )}
                {/* Spectator mode indicator for mid-game joiners */}
                {isSpectator && isPlaying && (
                    <div className="spectator-badge">
                        👀 관전 중 - 게임이 진행 중입니다
                        <div className="spectator-progress">
                            도착: {winners.length} / {participants.length - 1} 명
                        </div>
                    </div>
                )}
                {/* Simple game finished indicator when celebration is over (roulette mode only) */}
                {roomType === 'roulette' && gameFinished && !isPlaying && !showFinishEffect && (
                    <div className="game-finished-badge">
                        🏆 게임 완료 - {isHost ? '다시 시작하려면 버튼을 누르세요' : '방장이 게임을 시작하면 참여할 수 있습니다'}
                    </div>
                )}

                {/* ROULETTE MODE - GameCanvas */}
                {roomType === 'roulette' && (
                    <>
                        <GameCanvas
                            ref={gameCanvasRef}
                            participants={participants}
                            rules={rules}
                            isPlaying={isPlaying}
                            gameSeed={gameSeed}
                            onWinner={handleWinner}
                            allowDrawing={!isPlaying && !gameFinished}
                            drawingsLeft={drawingsLeft}
                            onDrawingUsed={() => setDrawingsLeft(prev => Math.max(0, prev - 1))}
                            drawMode={drawMode}
                            gameMode={gameMode}
                            onLocalDrawing={(drawing) => {
                                if (socket) {
                                    const fullDrawing: DrawingData = {
                                        ...drawing,
                                        userId: socket.id || '',
                                        userName: userName
                                    };
                                    socket.emit('draw_object', { roomName, drawing: fullDrawing });
                                    console.log('📤 Emitting drawing:', fullDrawing);
                                }
                            }}
                        />
                        <div className="rules-legend">
                            {rules.map((r, i) => {
                                const basketIcons = ['🧺', '🎁', '🎀', '🎯', '🌟', '💎'];
                                const basketColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];
                                return (
                                    <div key={r.id} className="rule-badge" style={{ borderLeftColor: basketColors[i % basketColors.length] }}>
                                        {gameMode === 'all_results' ? (
                                            <>{basketIcons[i % basketIcons.length]} {r.label}</>
                                        ) : (
                                            <>슬롯 {i + 1}: {r.label}</>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* BETTING MODE UI */}
                {roomType === 'betting' && (
                    <div className="betting-area">
                        <div className="betting-title-section">
                            {isHost && bettingState.bettingOpen ? (
                                <input
                                    type="text"
                                    className="betting-title-input"
                                    value={bettingState.bettingTitle}
                                    onChange={(e) => handleSetBettingTitle(e.target.value)}
                                    placeholder="내기 제목을 입력하세요..."
                                />
                            ) : (
                                <h2 className="betting-title">{bettingState.bettingTitle}</h2>
                            )}
                            <div className="betting-status-badge">
                                {bettingState.bettingOpen ? (
                                    <span className="status-open">🟢 베팅 진행 중</span>
                                ) : bettingResult ? (
                                    <span className="status-finished">🏆 결과 발표!</span>
                                ) : (
                                    <span className="status-closed">🔒 베팅 마감됨</span>
                                )}
                            </div>
                        </div>

                        {/* Betting options */}
                        <div className="betting-options">
                            {rules.length === 0 ? (
                                <div className="no-options-message">
                                    {isHost ? '옵션을 추가해주세요 →' : '방장이 옵션을 추가하기를 기다리는 중...'}
                                </div>
                            ) : (
                                rules.map((rule, index) => {
                                    const optionColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];
                                    const color = optionColors[index % optionColors.length];
                                    const betCount = bettingState.bets.filter(b => b.ruleId === rule.id).length;
                                    const isMyBet = myBet === rule.id;
                                    const isWinningOption = bettingResult?.winningRuleId === rule.id;
                                    const canClick = bettingState.bettingOpen || (isHost && !bettingState.bettingOpen && !bettingResult);

                                    return (
                                        <div
                                            key={rule.id}
                                            className={`betting-option ${isMyBet ? 'my-bet' : ''} ${isWinningOption ? 'winning' : ''} ${canClick ? 'clickable' : ''}`}
                                            style={{ borderColor: color }}
                                            onClick={() => {
                                                if (bettingState.bettingOpen) {
                                                    handlePlaceBet(rule.id);
                                                } else if (isHost && !bettingResult) {
                                                    handleSelectWinner(rule.id);
                                                }
                                            }}
                                        >
                                            <div className="option-header" style={{ backgroundColor: color }}>
                                                <span className="option-number">{index + 1}</span>
                                                <span className="option-label">{rule.label}</span>
                                            </div>
                                            <div className="option-body">
                                                <div className="bet-count">
                                                    <span className="bet-count-number">{betCount}</span>
                                                    <span className="bet-count-label">명 베팅</span>
                                                </div>
                                                {isMyBet && <span className="my-bet-badge">내 베팅</span>}
                                                {isWinningOption && <span className="winning-badge">🏆 당첨!</span>}
                                            </div>
                                            {/* Show who bet on this option */}
                                            <div className="betters-list">
                                                {bettingState.bets
                                                    .filter(b => b.ruleId === rule.id)
                                                    .map(bet => (
                                                        <span
                                                            key={bet.odrederId}
                                                            className={`better-chip ${bettingResult && isWinningOption ? 'winner' : bettingResult && !isWinningOption ? 'loser' : ''}`}
                                                        >
                                                            {bet.odrerName}
                                                        </span>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Betting result overlay */}
                        {bettingResult && (
                            <div className="betting-result-overlay">
                                <div className="betting-result-content">
                                    <div className="result-icon">🎊</div>
                                    <h3 className="result-title">내기 결과</h3>
                                    <div className="result-winning-option">
                                        당첨: {rules.find(r => r.id === bettingResult.winningRuleId)?.label}
                                    </div>
                                    {bettingResult.winners.length > 0 && (
                                        <div className="result-section winners-section">
                                            <h4>🎉 승자 ({bettingResult.winners.length}명)</h4>
                                            <div className="result-names">
                                                {bettingResult.winners.map(w => (
                                                    <span key={w.id} className="winner-name-chip">{w.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {bettingResult.losers.length > 0 && (
                                        <div className="result-section losers-section">
                                            <h4>😢 패자 ({bettingResult.losers.length}명)</h4>
                                            <div className="result-names">
                                                {bettingResult.losers.map(l => (
                                                    <span key={l.id} className="loser-name-chip">{l.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="sidebar right-sidebar glass-card">
                {/* ROULETTE MODE - Right sidebar */}
                {roomType === 'roulette' && (
                    <>
                        {isHost && (
                            <div className="game-mode-section">
                                <h2>⚙️ 게임 모드</h2>
                                <div className="game-mode-buttons">
                                    <button
                                        className={`mode-btn ${gameMode === 'all_results' ? 'active' : ''}`}
                                        onClick={() => handleGameModeChange('all_results')}
                                        disabled={isPlaying}
                                    >
                                        🧺 바구니
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
                        <h2>
                            {gameMode === 'all_results' ? '🧺 바구니 배정 현황' : '🎯 당첨 결과'}
                            {gameMode === 'winner_only' && ' (1등)'}
                            {gameMode === 'loser_only' && ' (꼴찌)'}
                        </h2>
                        <div className="winners-list">
                            {winners.length === 0 ? (
                                <p className="empty-message">
                                    {gameMode === 'all_results' ? '아직 바구니에 들어간 참가자가 없습니다' : '아직 당첨자가 없습니다'}
                                </p>
                            ) : (
                                winners.map((winner, index) => {
                                    const basketIcons = ['🧺', '🎁', '🎀', '🎯', '🌟', '💎'];
                                    const basketColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];
                                    const colorIndex = rules.findIndex(r => r.id === winner.rule.id);
                                    return (
                                        <div key={`${winner.participant.id}-${winner.timestamp}`} className="winner-item" style={{ borderLeftColor: gameMode === 'all_results' ? basketColors[colorIndex % basketColors.length] : undefined }}>
                                            <span className="winner-badge" style={{ background: gameMode === 'all_results' ? basketColors[colorIndex % basketColors.length] : undefined }}>
                                                {gameMode === 'all_results' ? basketIcons[colorIndex % basketIcons.length] : (winners.length - index)}
                                            </span>
                                            <div className="winner-info">
                                                <div className="winner-name">{winner.participant.name}</div>
                                                <div className="winner-rule" style={{ color: gameMode === 'all_results' ? basketColors[colorIndex % basketColors.length] : undefined }}>
                                                    → {winner.rule.label}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                        <h2>룰 / 벌칙</h2>
                        {/* Mode-specific rule hint */}
                        {gameMode !== 'all_results' && (
                            <p className="rule-mode-hint">
                                {gameMode === 'winner_only' ? '🏆 1등만 모드: 룰 1개 필요' : '💀 꼴찌만 모드: 벌칙 1개 필요'}
                            </p>
                        )}
                        {gameMode === 'all_results' && (
                            <p className="rule-mode-hint">
                                🧺 바구니 모드: 여러 바구니 추가 가능 (각 바구니에 배정)
                            </p>
                        )}
                        <ul className="rule-list">
                            {rules.map((r) => (
                                <li key={r.id}>{r.label}</li>
                            ))}
                        </ul>
                        {isHost && (
                            <>
                                {/* Show form only if rules can be added based on game mode */}
                                {(gameMode === 'all_results' || rules.length === 0) && (
                                    <form onSubmit={handleAddRule} className="add-rule-form">
                                        <input
                                            type="text"
                                            value={newRule}
                                            onChange={(e) => setNewRule(e.target.value)}
                                            placeholder={gameMode === 'all_results' ? '새로운 룰 추가...' : gameMode === 'winner_only' ? '당첨 룰 입력...' : '벌칙 입력...'}
                                        />
                                        <button type="submit" className="btn-primary small-btn">+</button>
                                    </form>
                                )}
                                {gameMode !== 'all_results' && rules.length >= 1 && (
                                    <p className="rule-limit-notice">
                                        {gameMode === 'winner_only' ? '1등만 모드에서는 1개의 룰만 사용합니다' : '꼴찌만 모드에서는 1개의 벌칙만 사용합니다'}
                                    </p>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* BETTING MODE - Right sidebar */}
                {roomType === 'betting' && (
                    <>
                        <h2>🎲 베팅 옵션</h2>
                        <p className="rule-mode-hint">
                            {bettingState.bettingOpen
                                ? '클릭하여 베팅할 옵션을 선택하세요'
                                : bettingResult
                                    ? '내기 결과가 발표되었습니다!'
                                    : '방장이 당첨 옵션을 선택합니다'}
                        </p>
                        <ul className="rule-list">
                            {rules.map((r, index) => {
                                const optionColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];
                                const color = optionColors[index % optionColors.length];
                                const betCount = bettingState.bets.filter(b => b.ruleId === r.id).length;
                                return (
                                    <li key={r.id} style={{ borderLeft: `3px solid ${color}`, paddingLeft: '10px' }}>
                                        {r.label} ({betCount}명)
                                    </li>
                                );
                            })}
                        </ul>
                        {isHost && bettingState.bettingOpen && (
                            <form onSubmit={handleAddRule} className="add-rule-form">
                                <input
                                    type="text"
                                    value={newRule}
                                    onChange={(e) => setNewRule(e.target.value)}
                                    placeholder="새로운 옵션 추가..."
                                />
                                <button type="submit" className="btn-primary small-btn">+</button>
                            </form>
                        )}
                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                        <h2>📊 베팅 현황</h2>
                        <div className="betting-stats">
                            <div className="stat-item">
                                <span className="stat-label">총 베팅 수</span>
                                <span className="stat-value">{bettingState.bets.length}</span>
                            </div>
                            {myBet && (
                                <div className="stat-item my-bet-status">
                                    <span className="stat-label">내 베팅</span>
                                    <span className="stat-value">{rules.find(r => r.id === myBet)?.label || '알 수 없음'}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
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
            width: 280px;
            min-width: 250px;
            max-width: 320px;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .game-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            min-width: 0;
            overflow: hidden;
        }
        .participant-list, .rule-list {
            list-style: none;
            padding: 0;
            margin: 0;
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
        .participant-list li.winner-highlight {
            background: linear-gradient(90deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.2));
            border: 2px solid #ffd700;
            animation: winnerPulse 1.5s ease-in-out infinite;
            font-weight: bold;
            color: #ffd700;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }
        @keyframes winnerPulse {
            0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
            }
            50% {
                transform: scale(1.05);
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
            }
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        .winner-icon {
            margin-left: 0.5rem;
            font-size: 1.2rem;
            animation: celebrationSpin 1s ease-in-out infinite;
        }
        @keyframes celebrationSpin {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(10deg); }
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
        .rule-mode-hint {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.7);
            margin: 0.5rem 0;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border-left: 3px solid var(--primary-color);
        }
        .rule-limit-notice {
            font-size: 0.8rem;
            color: rgba(255, 215, 0, 0.8);
            margin-top: 0.5rem;
            padding: 6px 10px;
            background: rgba(255, 215, 0, 0.1);
            border-radius: 6px;
            text-align: center;
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
            font-size: 0.7rem;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
            vertical-align: middle;
        }
        .participant-badge {
            display: inline-block;
            margin-left: 10px;
            padding: 4px 10px;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: bold;
            border: 1px solid rgba(255, 255, 255, 0.2);
            vertical-align: middle;
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
            margin: 3px;
            padding: 4px 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            font-size: 0.75rem;
        }
        .rules-legend {
            width: 100%;
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            padding: 10px 0;
            margin-top: auto;
        }
        /* Game Header */
        .game-header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .header-right {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .room-code {
            margin: 0;
            font-size: 1rem;
            white-space: nowrap;
        }
        .copy-btn {
            padding: 0.4rem 0.8rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.3s ease;
            white-space: nowrap;
        }
        .copy-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }
        /* Drawing Toolbar */
        .drawing-toolbar {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            padding: 10px 15px;
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            border-radius: 10px;
            margin-bottom: 10px;
        }
        .drawing-count {
            color: #ff6b6b;
            font-weight: bold;
            font-size: 0.9rem;
        }
        .drawing-hint {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.8rem;
            margin-left: 8px;
        }
        /* Canvas wrapper */
        .game-canvas-wrapper {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 0;
            width: 100%;
        }
        .game-canvas-wrapper canvas {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
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
        .chat-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            max-height: 300px;
        }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            min-height: 200px;
            max-height: 200px;
        }
        .chat-message {
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            word-wrap: break-word;
        }
        .chat-user {
            font-weight: bold;
            color: var(--primary-color);
            margin-right: 0.5rem;
        }
        .chat-text {
            color: rgba(255, 255, 255, 0.9);
        }
        .chat-input-form {
            display: flex;
            gap: 0.5rem;
        }
        .chat-input {
            flex: 1;
            padding: 0.8rem;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: white;
            font-size: 0.9rem;
        }
        .chat-input:focus {
            outline: none;
            border-color: var(--primary-color);
            background: rgba(255, 255, 255, 0.1);
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
        /* Game playing state */
        .game-area.playing {
            animation: playingPulse 2s ease-in-out infinite;
            box-shadow: 0 0 30px rgba(56, 189, 248, 0.3),
                        0 0 60px rgba(129, 140, 248, 0.2);
        }
        @keyframes playingPulse {
            0%, 100% {
                box-shadow: 0 0 30px rgba(56, 189, 248, 0.3),
                            0 0 60px rgba(129, 140, 248, 0.2);
            }
            50% {
                box-shadow: 0 0 50px rgba(56, 189, 248, 0.5),
                            0 0 100px rgba(129, 140, 248, 0.3);
            }
        }
        /* Start effect overlay */
        .start-effect-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            overflow: hidden;
        }
        .start-flash {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%);
            animation: flashBurst 0.5s ease-out forwards;
        }
        @keyframes flashBurst {
            0% { opacity: 1; transform: scale(0); }
            50% { opacity: 1; transform: scale(1.5); }
            100% { opacity: 0; transform: scale(2); }
        }
        .start-text {
            font-size: 5rem;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b6b, #feca57, #54a0ff, #5f27cd);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: startTextAppear 0.5s ease-out forwards, gradientMove 1s ease infinite;
            text-shadow: none;
            filter: drop-shadow(0 0 30px rgba(255, 107, 107, 0.8));
            z-index: 10;
        }
        @keyframes startTextAppear {
            0% { transform: scale(0) rotate(-20deg); opacity: 0; }
            50% { transform: scale(1.3) rotate(5deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .confetti-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
        }
        .confetti-piece {
            position: absolute;
            top: -20px;
            width: 12px;
            height: 12px;
            border-radius: 2px;
            animation: confettiFall 3s ease-out forwards;
        }
        @keyframes confettiFall {
            0% {
                top: -20px;
                transform: rotate(0deg) translateX(0);
                opacity: 1;
            }
            100% {
                top: 100%;
                transform: rotate(720deg) translateX(100px);
                opacity: 0;
            }
        }
        .start-rings {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
        .ring {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 4px solid;
            animation: ringExpand 1.5s ease-out forwards;
        }
        .ring-1 {
            width: 50px;
            height: 50px;
            border-color: #ff6b6b;
            animation-delay: 0s;
        }
        .ring-2 {
            width: 50px;
            height: 50px;
            border-color: #54a0ff;
            animation-delay: 0.2s;
        }
        .ring-3 {
            width: 50px;
            height: 50px;
            border-color: #feca57;
            animation-delay: 0.4s;
        }
        @keyframes ringExpand {
            0% {
                width: 50px;
                height: 50px;
                opacity: 1;
            }
            100% {
                width: 600px;
                height: 600px;
                opacity: 0;
            }
        }
        /* Finish celebration overlay */
        .finish-effect-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.9) 100%);
            animation: finishOverlayAppear 0.5s ease-out forwards;
        }
        @keyframes finishOverlayAppear {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .finish-confetti-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
            pointer-events: none;
        }
        .finish-confetti {
            position: absolute;
            border-radius: 50%;
            animation: finishConfettiBurst 3s ease-out forwards;
            box-shadow: 0 0 10px currentColor;
        }
        @keyframes finishConfettiBurst {
            0% {
                transform: scale(0) rotate(0deg);
                opacity: 1;
            }
            50% {
                opacity: 1;
                transform: scale(1.5) rotate(180deg);
            }
            100% {
                transform: scale(0.5) rotate(360deg) translateY(200px);
                opacity: 0;
            }
        }
        .finish-celebration-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10;
            animation: celebrationBounce 0.8s ease-out forwards;
        }
        @keyframes celebrationBounce {
            0% { transform: scale(0) translateY(50px); opacity: 0; }
            50% { transform: scale(1.2) translateY(-20px); }
            70% { transform: scale(0.9) translateY(10px); }
            100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .finish-trophy {
            font-size: 6rem;
            animation: trophySpin 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.8));
        }
        @keyframes trophySpin {
            0%, 100% { transform: rotateY(0deg) scale(1); }
            25% { transform: rotateY(15deg) scale(1.1); }
            75% { transform: rotateY(-15deg) scale(1.1); }
        }
        .finish-title {
            font-size: 3.5rem;
            font-weight: 900;
            margin: 1rem 0 0.5rem 0;
            background: linear-gradient(135deg, #ffd700, #ff6b6b, #54a0ff, #4cd137);
            background-size: 300% 300%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: gradientShift 2s ease infinite;
            text-shadow: none;
            filter: drop-shadow(0 4px 20px rgba(255, 107, 107, 0.5));
        }
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        .finish-subtitle {
            font-size: 1.3rem;
            color: rgba(255, 255, 255, 0.9);
            margin: 0.5rem 0 1.5rem 0;
            animation: subtitleFade 1s ease-out 0.3s both;
        }
        @keyframes subtitleFade {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .finish-fireworks {
            display: flex;
            gap: 2rem;
            font-size: 3rem;
        }
        .firework {
            animation: fireworkPop 1.5s ease-in-out infinite;
        }
        .firework:nth-child(1) { animation-delay: 0s; }
        .firework:nth-child(2) { animation-delay: 0.3s; }
        .firework:nth-child(3) { animation-delay: 0.6s; }
        @keyframes fireworkPop {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.4); opacity: 1; }
        }
        .finish-wave {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 4px solid;
            pointer-events: none;
            animation: waveExpand 2s ease-out infinite;
        }
        .wave-1 {
            border-color: rgba(255, 107, 107, 0.6);
            animation-delay: 0s;
        }
        .wave-2 {
            border-color: rgba(76, 209, 55, 0.6);
            animation-delay: 0.4s;
        }
        .wave-3 {
            border-color: rgba(84, 160, 255, 0.6);
            animation-delay: 0.8s;
        }
        @keyframes waveExpand {
            0% {
                width: 100px;
                height: 100px;
                opacity: 1;
            }
            100% {
                width: 800px;
                height: 800px;
                opacity: 0;
            }
        }
        .game-finished-badge {
            position: absolute;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(76, 209, 55, 0.2), rgba(255, 215, 0, 0.2));
            border: 2px solid rgba(76, 209, 55, 0.5);
            color: #4cd137;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 1rem;
            z-index: 100;
            animation: badgePulse 2s ease-in-out infinite;
        }
        @keyframes badgePulse {
            0%, 100% { box-shadow: 0 0 10px rgba(76, 209, 55, 0.3); }
            50% { box-shadow: 0 0 25px rgba(76, 209, 55, 0.6); }
        }
        .spectator-badge {
            position: absolute;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(84, 160, 255, 0.2), rgba(129, 140, 248, 0.2));
            border: 2px solid rgba(84, 160, 255, 0.5);
            color: #54a0ff;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 1rem;
            z-index: 100;
            text-align: center;
            animation: spectatorPulse 2s ease-in-out infinite;
        }
        .spectator-progress {
            font-size: 0.85rem;
            margin-top: 6px;
            color: rgba(255, 255, 255, 0.8);
        }
        @keyframes spectatorPulse {
            0%, 100% { box-shadow: 0 0 10px rgba(84, 160, 255, 0.3); }
            50% { box-shadow: 0 0 25px rgba(84, 160, 255, 0.6); }
        }
        /* Game mode specific finish overlay styles */
        .finish-mode-winner_only {
            background: radial-gradient(ellipse at center, rgba(50, 40, 0, 0.85) 0%, rgba(20, 15, 0, 0.95) 100%);
        }
        .finish-mode-loser_only {
            background: radial-gradient(ellipse at center, rgba(60, 0, 0, 0.85) 0%, rgba(20, 0, 0, 0.95) 100%);
        }
        .finish-mode-all_results {
            background: radial-gradient(ellipse at center, rgba(0, 20, 40, 0.85) 0%, rgba(0, 10, 20, 0.95) 100%);
        }
        /* Winner mode specific styles */
        .finish-icon {
            font-size: 6rem;
            animation: iconBounce 1.5s ease-in-out infinite;
        }
        .winner-icon-big {
            filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.9));
        }
        .winner-title {
            background: linear-gradient(135deg, #ffd700, #ffed4e, #ffd700);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: goldShimmer 1.5s ease-in-out infinite;
        }
        @keyframes goldShimmer {
            0%, 100% { background-position: 0% 50%; filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.5)); }
            50% { background-position: 100% 50%; filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.8)); }
        }
        .winner-announcement {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 1rem 0;
            animation: announceSlideIn 0.8s ease-out 0.5s both;
        }
        @keyframes announceSlideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .winner-crown {
            font-size: 2rem;
            animation: crownFloat 2s ease-in-out infinite;
        }
        @keyframes crownFloat {
            0%, 100% { transform: translateY(0) rotate(-5deg); }
            50% { transform: translateY(-8px) rotate(5deg); }
        }
        .winner-name {
            font-size: 2.5rem;
            font-weight: 900;
            color: #ffd700;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 2px 10px rgba(0,0,0,0.5);
        }
        .firework.gold {
            color: #ffd700;
            filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.8));
        }
        /* Loser mode specific styles */
        .loser-icon-big {
            filter: drop-shadow(0 0 40px rgba(255, 50, 50, 0.7));
            animation: skullShake 0.5s ease-in-out infinite;
        }
        @keyframes skullShake {
            0%, 100% { transform: rotate(-3deg); }
            50% { transform: rotate(3deg); }
        }
        .loser-title {
            background: linear-gradient(135deg, #ff4444, #8b0000, #ff4444);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: bloodPulse 1s ease-in-out infinite;
        }
        @keyframes bloodPulse {
            0%, 100% { background-position: 0% 50%; filter: drop-shadow(0 0 15px rgba(255, 0, 0, 0.5)); }
            50% { background-position: 100% 50%; filter: drop-shadow(0 0 30px rgba(255, 0, 0, 0.8)); }
        }
        .loser-announcement {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 1rem 0;
            animation: loserReveal 1s ease-out 0.5s both;
        }
        @keyframes loserReveal {
            0% { opacity: 0; transform: scale(0.5); }
            50% { transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
        .loser-skull {
            font-size: 2rem;
            animation: skullBob 1s ease-in-out infinite;
        }
        @keyframes skullBob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        .loser-name {
            font-size: 2.5rem;
            font-weight: 900;
            color: #ff4444;
            text-shadow: 0 0 20px rgba(255, 0, 0, 0.6), 0 2px 10px rgba(0,0,0,0.5);
        }
        .loser-penalty {
            color: #ff6666;
            font-size: 1.5rem;
            font-weight: bold;
        }
        .loser-effects {
            gap: 1.5rem;
        }
        .effect-icon {
            font-size: 2.5rem;
            animation: effectPulse 0.8s ease-in-out infinite;
        }
        .effect-icon:nth-child(1) { animation-delay: 0s; }
        .effect-icon:nth-child(2) { animation-delay: 0.2s; }
        .effect-icon:nth-child(3) { animation-delay: 0.4s; }
        @keyframes effectPulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; }
        }
        /* Basket mode (all results) specific styles */
        .basket-icon-big {
            filter: drop-shadow(0 0 30px rgba(255, 107, 107, 0.7));
        }
        .basket-title {
            background: linear-gradient(135deg, #ff6b6b, #feca57, #4cd137, #54a0ff, #f472b6);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: rainbowShift 3s ease-in-out infinite;
        }
        .basket-results-preview {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin: 1rem 0;
            max-height: 200px;
            overflow-y: auto;
        }
        .basket-assignment {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(255, 255, 255, 0.1);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            border-left: 4px solid;
            animation: slideInBasket 0.5s ease-out forwards;
        }
        @keyframes slideInBasket {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .basket-icon {
            font-size: 1.5rem;
        }
        .basket-participant {
            font-weight: bold;
            color: white;
            flex: 1;
        }
        .basket-arrow {
            color: rgba(255, 255, 255, 0.5);
        }
        .basket-rule {
            font-weight: bold;
        }
        /* Legacy race styles (keeping for compatibility) */
        .race-icon-big {
            filter: drop-shadow(0 0 30px rgba(84, 160, 255, 0.7));
        }
        .race-title {
            background: linear-gradient(135deg, #54a0ff, #4cd137, #feca57, #ff6b6b);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: rainbowShift 3s ease-in-out infinite;
        }
        @keyframes rainbowShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        .race-results-preview {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin: 1rem 0;
            animation: resultsSlideIn 0.8s ease-out 0.5s both;
        }
        @keyframes resultsSlideIn {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .race-place {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
        }
        .place-1 { background: linear-gradient(90deg, rgba(255, 215, 0, 0.3), transparent); }
        .place-2 { background: linear-gradient(90deg, rgba(192, 192, 192, 0.3), transparent); }
        .place-3 { background: linear-gradient(90deg, rgba(205, 127, 50, 0.3), transparent); }
        .place-medal {
            font-size: 1.8rem;
        }
        .place-name {
            font-size: 1.2rem;
            font-weight: bold;
            color: white;
        }
        /* Wave colors per mode */
        .wave-winner_only.wave-1 { border-color: rgba(255, 215, 0, 0.6); }
        .wave-winner_only.wave-2 { border-color: rgba(255, 237, 78, 0.5); }
        .wave-winner_only.wave-3 { border-color: rgba(218, 165, 32, 0.4); }
        .wave-loser_only.wave-1 { border-color: rgba(255, 0, 0, 0.6); }
        .wave-loser_only.wave-2 { border-color: rgba(139, 0, 0, 0.5); }
        .wave-loser_only.wave-3 { border-color: rgba(60, 0, 0, 0.4); }
        .wave-all_results.wave-1 { border-color: rgba(84, 160, 255, 0.6); }
        .wave-all_results.wave-2 { border-color: rgba(76, 209, 55, 0.5); }
        .wave-all_results.wave-3 { border-color: rgba(254, 202, 87, 0.4); }
        @keyframes iconBounce {
            0%, 100% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.1) rotate(-5deg); }
            75% { transform: scale(1.1) rotate(5deg); }
        }

        /* ==================== BETTING MODE STYLES ==================== */
        .betting-status {
            padding: 0.5rem 1rem;
            background: rgba(255, 215, 0, 0.2);
            border: 1px solid rgba(255, 215, 0, 0.4);
            border-radius: 8px;
            color: #ffd700;
            font-weight: bold;
            font-size: 0.9rem;
        }
        .betting-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px;
            gap: 20px;
            overflow-y: auto;
        }
        .betting-title-section {
            text-align: center;
            margin-bottom: 10px;
        }
        .betting-title-input {
            width: 100%;
            padding: 1rem;
            font-size: 1.5rem;
            font-weight: bold;
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            color: white;
        }
        .betting-title-input:focus {
            outline: none;
            border-color: var(--primary-color);
        }
        .betting-title {
            font-size: 2rem;
            margin: 0;
            color: white;
        }
        .betting-status-badge {
            margin-top: 10px;
        }
        .status-open {
            color: #4cd137;
            font-weight: bold;
        }
        .status-closed {
            color: #feca57;
            font-weight: bold;
        }
        .status-finished {
            color: #ffd700;
            font-weight: bold;
        }
        .betting-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            flex: 1;
        }
        .no-options-message {
            text-align: center;
            padding: 3rem;
            color: rgba(255, 255, 255, 0.5);
            font-style: italic;
            grid-column: 1 / -1;
        }
        .betting-option {
            background: rgba(255, 255, 255, 0.05);
            border: 3px solid;
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        .betting-option.clickable {
            cursor: pointer;
        }
        .betting-option.clickable:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .betting-option.my-bet {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }
        .betting-option.winning {
            box-shadow: 0 0 30px rgba(76, 209, 55, 0.7);
            animation: winningPulse 1s ease-in-out infinite;
        }
        @keyframes winningPulse {
            0%, 100% { box-shadow: 0 0 30px rgba(76, 209, 55, 0.5); }
            50% { box-shadow: 0 0 50px rgba(76, 209, 55, 0.8); }
        }
        .option-header {
            padding: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .option-number {
            width: 30px;
            height: 30px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
        }
        .option-label {
            font-size: 1.2rem;
            font-weight: bold;
            color: white;
        }
        .option-body {
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0, 0, 0, 0.2);
        }
        .bet-count {
            display: flex;
            align-items: baseline;
            gap: 5px;
        }
        .bet-count-number {
            font-size: 2rem;
            font-weight: bold;
            color: white;
        }
        .bet-count-label {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.7);
        }
        .my-bet-badge {
            padding: 5px 12px;
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            color: #1a1a1a;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .winning-badge {
            padding: 5px 12px;
            background: linear-gradient(135deg, #4cd137, #2ecc71);
            color: white;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
            animation: bounce 0.5s ease infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        .betters-list {
            padding: 10px 15px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            min-height: 30px;
        }
        .better-chip {
            padding: 4px 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.8);
        }
        .better-chip.winner {
            background: rgba(76, 209, 55, 0.3);
            color: #4cd137;
            border: 1px solid #4cd137;
        }
        .better-chip.loser {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
            border: 1px solid rgba(255, 107, 107, 0.5);
        }
        .betting-result-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            animation: fadeIn 0.5s ease-out;
        }
        .betting-result-content {
            background: linear-gradient(135deg, rgba(30, 30, 40, 0.95), rgba(20, 20, 30, 0.95));
            border: 2px solid rgba(255, 215, 0, 0.5);
            border-radius: 20px;
            padding: 30px 40px;
            text-align: center;
            max-width: 500px;
            animation: scaleIn 0.5s ease-out;
        }
        @keyframes scaleIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .result-icon {
            font-size: 4rem;
            margin-bottom: 10px;
        }
        .result-title {
            font-size: 1.8rem;
            color: #ffd700;
            margin: 0 0 15px 0;
        }
        .result-winning-option {
            font-size: 1.3rem;
            color: #4cd137;
            margin-bottom: 20px;
            padding: 10px 20px;
            background: rgba(76, 209, 55, 0.2);
            border-radius: 10px;
        }
        .result-section {
            margin: 15px 0;
            padding: 15px;
            border-radius: 10px;
        }
        .winners-section {
            background: rgba(76, 209, 55, 0.1);
            border: 1px solid rgba(76, 209, 55, 0.3);
        }
        .losers-section {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
        }
        .result-section h4 {
            margin: 0 0 10px 0;
            font-size: 1rem;
        }
        .result-names {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
        }
        .winner-name-chip {
            padding: 6px 14px;
            background: linear-gradient(135deg, #4cd137, #2ecc71);
            color: white;
            border-radius: 20px;
            font-weight: bold;
        }
        .loser-name-chip {
            padding: 6px 14px;
            background: rgba(255, 107, 107, 0.3);
            color: #ff6b6b;
            border-radius: 20px;
            border: 1px solid rgba(255, 107, 107, 0.5);
        }
        .betting-stats {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }
        .stat-label {
            color: rgba(255, 255, 255, 0.7);
        }
        .stat-value {
            font-weight: bold;
            color: white;
        }
        .my-bet-status {
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.3);
        }
        .my-bet-status .stat-value {
            color: #ffd700;
        }
        /* ==================== END BETTING MODE STYLES ==================== */
      `}</style>
        </div>
    );
};

export default Room;
