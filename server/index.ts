import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Participant, Rule, GameState, ClientToServerEvents, ServerToClientEvents, GameMode, EmoticonMessage, UserNotification, ChatMessage, DrawingData, GameResult, RoomType, BettingState, Bet } from './types';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const PORT = 3000;

interface RoomData {
    participants: Participant[];
    rules: Rule[];
    status: 'waiting' | 'playing' | 'finished';
    hostId: string; // Socket ID of the room host
    gameMode: GameMode; // Game mode setting
    drawings: DrawingData[]; // Stored drawings for sync
    gameResults: GameResult[]; // Results from last/current game
    roomType: RoomType; // Room type: roulette or betting
    bettingState?: BettingState; // Betting mode state
}

const rooms = new Map<string, RoomData>();

// Health check endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Roulette Together Server is running',
        rooms: rooms.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomName, userName, roomType }) => {
        socket.join(roomName);

        let isHost = false;
        if (!rooms.has(roomName)) {
            // First person creates the room and becomes host
            const newRoomType = roomType || 'roulette';
            rooms.set(roomName, {
                participants: [],
                rules: [], // Empty rules - host will define them
                status: 'waiting',
                hostId: socket.id,
                gameMode: 'all_results', // Default game mode
                drawings: [], // Empty drawings
                gameResults: [], // Empty game results
                roomType: newRoomType,
                bettingState: newRoomType === 'betting' ? {
                    bets: [],
                    bettingOpen: true,
                    bettingTitle: '내기',
                } : undefined,
            });
            isHost = true;
        }

        const room = rooms.get(roomName)!;

        // Add participant if not already present
        const newParticipant: Participant = { id: socket.id, name: userName };
        room.participants.push(newParticipant);

        // Broadcast update
        io.to(roomName).emit('participant_list', room.participants);
        io.to(roomName).emit('rule_list', room.rules);

        // Notify the user if they are the host
        const isHostUser = socket.id === room.hostId;
        console.log(`🎯 Emitting host_status to ${socket.id}: isHost=${isHostUser}, hostId=${room.hostId}`);
        socket.emit('host_status', { isHost: isHostUser, hostId: room.hostId });

        // Notify about current game mode
        socket.emit('game_mode_updated', { mode: room.gameMode });

        // Notify about room type
        socket.emit('room_type', { roomType: room.roomType });

        // Send betting state if betting mode
        if (room.roomType === 'betting' && room.bettingState) {
            socket.emit('betting_state_updated', room.bettingState);
        }

        // Send user join notification to all users in the room
        const joinNotification: UserNotification = {
            userName,
            type: 'join',
            timestamp: Date.now()
        };
        io.to(roomName).emit('user_notification', joinNotification);

        console.log(`${userName} joined ${roomName}${isHost ? ' (HOST)' : ''}`);
    });

    // Request host status (for when client reconnects or needs to re-check)
    socket.on('request_host_status', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room) {
            const isHostUser = socket.id === room.hostId;
            console.log(`🔄 Re-sending host_status to ${socket.id}: isHost=${isHostUser}, hostId=${room.hostId}`);
            socket.emit('host_status', { isHost: isHostUser, hostId: room.hostId });
        }
    });

    socket.on('set_game_mode', ({ roomName, mode }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Only host can change game mode
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 게임 모드를 변경할 수 있습니다.' });
                return;
            }

            room.gameMode = mode;
            io.to(roomName).emit('game_mode_updated', { mode });
            console.log(`Game mode set to ${mode} in ${roomName}`);
        }
    });

    socket.on('create_rule', ({ roomName, rule }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Only host can create rules
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 룰/벌칙을 추가할 수 있습니다.' });
                return;
            }

            room.rules.push(rule);
            io.to(roomName).emit('rule_list', room.rules);
        }
    });

    socket.on('start_game', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Only host can start the game
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 게임을 시작할 수 있습니다.' });
                console.log(`Non-host ${socket.id} tried to start game in ${roomName}`);
                return;
            }

            // Check if there are rules
            if (room.rules.length === 0) {
                socket.emit('error_message', { message: '최소 1개 이상의 룰을 추가해주세요.' });
                return;
            }

            room.status = 'playing';
            // Clear drawings when new game starts (optional - keep drawings from before)
            // room.drawings = [];
            const seed = Math.random();
            io.to(roomName).emit('game_started', { simulationId: Date.now().toString(), seed });
            console.log(`Game started in ${roomName} with seed ${seed}`);
        }
    });

    socket.on('send_emoticon', ({ roomName, emoticon }) => {
        const room = rooms.get(roomName);
        if (room) {
            const participant = room.participants.find(p => p.id === socket.id);
            if (participant) {
                const emoticonMessage: EmoticonMessage = {
                    userId: socket.id,
                    userName: participant.name,
                    emoticon,
                    timestamp: Date.now()
                };
                io.to(roomName).emit('emoticon_received', emoticonMessage);
                console.log(`${participant.name} sent emoticon ${emoticon} in ${roomName}`);
            }
        }
    });

    socket.on('send_chat', ({ roomName, message }) => {
        const room = rooms.get(roomName);
        if (room) {
            const participant = room.participants.find(p => p.id === socket.id);
            if (participant) {
                const chatMessage: ChatMessage = {
                    userId: socket.id,
                    userName: participant.name,
                    message,
                    timestamp: Date.now()
                };
                io.to(roomName).emit('chat_received', chatMessage);
                console.log(`${participant.name} sent message in ${roomName}: ${message}`);
            }
        }
    });

    socket.on('draw_object', ({ roomName, drawing }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Store drawing for sync with new joiners
            room.drawings.push(drawing);

            // Broadcast drawing to all users in room (including sender for confirmation)
            io.to(roomName).emit('drawing_received', drawing);
            console.log(`📍 Drawing received in ${roomName}: ${drawing.odrawType} by ${drawing.userName}`);
        }
    });

    // Room sync request - send all room state to the requester
    socket.on('request_room_sync', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room) {
            const syncData = {
                participants: room.participants,
                rules: room.rules,
                drawings: room.drawings,
                gameMode: room.gameMode,
                status: room.status,
                hostId: room.hostId,
                gameResults: room.gameResults,
                roomType: room.roomType,
                bettingState: room.bettingState
            };
            socket.emit('room_sync', syncData);
            console.log(`🔄 Room sync sent to ${socket.id} for room ${roomName} (status: ${room.status}, results: ${room.gameResults.length}, roomType: ${room.roomType})`);
        }
    });

    // Report game result from client (host reports results)
    socket.on('report_result', ({ roomName, result }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Only accept results during playing or from host
            if (room.status === 'playing' || socket.id === room.hostId) {
                // Check if this participant already has a result
                const existingIndex = room.gameResults.findIndex(r => r.participantId === result.participantId);
                if (existingIndex === -1) {
                    room.gameResults.push(result);
                    console.log(`📊 Result recorded: ${result.participantName} (order: ${result.order}) -> ${result.ruleLabel}`);
                }
            }
        }
    });

    // Clear results when starting new game
    socket.on('clear_results', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room && socket.id === room.hostId) {
            room.gameResults = [];
            room.drawings = []; // Also clear drawings for fresh game
            room.status = 'waiting';
            // Notify all clients to reset their game state
            io.to(roomName).emit('game_reset');
            console.log(`🗑️ Results and drawings cleared for room ${roomName}`);
        }
    });

    // Mark game as finished
    socket.on('game_finished', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room && socket.id === room.hostId) {
            room.status = 'finished';
            console.log(`🏁 Game finished in room ${roomName}`);
        }
    });

    socket.on('kick_user', ({ roomName, userId }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Only host can kick users
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 사용자를 강제 퇴장시킬 수 있습니다.' });
                return;
            }

            // Cannot kick yourself
            if (userId === socket.id) {
                socket.emit('error_message', { message: '자기 자신을 강제 퇴장시킬 수 없습니다.' });
                return;
            }

            const participantIndex = room.participants.findIndex(p => p.id === userId);
            if (participantIndex !== -1) {
                const kickedUser = room.participants[participantIndex];
                room.participants.splice(participantIndex, 1);

                // Notify the kicked user
                io.to(userId).emit('kicked');

                // Update participant list for remaining users
                io.to(roomName).emit('participant_list', room.participants);

                // Send notification
                const leaveNotification: UserNotification = {
                    userName: kickedUser.name,
                    type: 'leave',
                    timestamp: Date.now()
                };
                io.to(roomName).emit('user_notification', leaveNotification);

                console.log(`${kickedUser.name} was kicked from ${roomName} by host`);
            }
        }
    });

    socket.on('destroy_room', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room) {
            // Only host can destroy room
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 방을 파괴할 수 있습니다.' });
                return;
            }

            // Notify all users in the room that it's being destroyed
            io.to(roomName).emit('room_destroyed');

            // Remove the room
            rooms.delete(roomName);

            console.log(`Room ${roomName} was destroyed by host`);
        }
    });

    // ==================== BETTING MODE EVENTS ====================

    // Set betting title (host only)
    socket.on('set_betting_title', ({ roomName, title }) => {
        const room = rooms.get(roomName);
        if (room && room.roomType === 'betting' && room.bettingState) {
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 내기 제목을 설정할 수 있습니다.' });
                return;
            }
            room.bettingState.bettingTitle = title;
            io.to(roomName).emit('betting_state_updated', room.bettingState);
            console.log(`🎲 Betting title set to "${title}" in ${roomName}`);
        }
    });

    // Place a bet (any participant)
    socket.on('place_bet', ({ roomName, ruleId }) => {
        const room = rooms.get(roomName);
        if (room && room.roomType === 'betting' && room.bettingState) {
            if (!room.bettingState.bettingOpen) {
                socket.emit('error_message', { message: '베팅이 마감되었습니다.' });
                return;
            }

            const participant = room.participants.find(p => p.id === socket.id);
            if (!participant) {
                socket.emit('error_message', { message: '참가자만 베팅할 수 있습니다.' });
                return;
            }

            // Remove previous bet from this user if exists
            room.bettingState.bets = room.bettingState.bets.filter(b => b.odrederId !== socket.id);

            // Add new bet
            const newBet: Bet = {
                odrederId: socket.id,
                odrerName: participant.name,
                ruleId,
                timestamp: Date.now()
            };
            room.bettingState.bets.push(newBet);

            io.to(roomName).emit('betting_state_updated', room.bettingState);
            console.log(`🎲 ${participant.name} bet on rule ${ruleId} in ${roomName}`);
        }
    });

    // Close betting (host only)
    socket.on('close_betting', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room && room.roomType === 'betting' && room.bettingState) {
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 베팅을 마감할 수 있습니다.' });
                return;
            }
            room.bettingState.bettingOpen = false;
            io.to(roomName).emit('betting_state_updated', room.bettingState);
            console.log(`🎲 Betting closed in ${roomName}`);
        }
    });

    // Select winner (host only)
    socket.on('select_winner', ({ roomName, ruleId }) => {
        const room = rooms.get(roomName);
        if (room && room.roomType === 'betting' && room.bettingState) {
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 당첨 결과를 선택할 수 있습니다.' });
                return;
            }

            room.bettingState.winningRuleId = ruleId;

            // Calculate winners and losers
            const winners: Participant[] = [];
            const losers: Participant[] = [];

            room.bettingState.bets.forEach(bet => {
                const participant = room.participants.find(p => p.id === bet.odrederId);
                if (participant) {
                    if (bet.ruleId === ruleId) {
                        winners.push(participant);
                    } else {
                        losers.push(participant);
                    }
                }
            });

            io.to(roomName).emit('betting_state_updated', room.bettingState);
            io.to(roomName).emit('betting_result', { winningRuleId: ruleId, winners, losers });
            console.log(`🎲 Winner selected in ${roomName}: rule ${ruleId}, winners: ${winners.length}, losers: ${losers.length}`);
        }
    });

    // Reset betting (host only)
    socket.on('reset_betting', ({ roomName }) => {
        const room = rooms.get(roomName);
        if (room && room.roomType === 'betting' && room.bettingState) {
            if (socket.id !== room.hostId) {
                socket.emit('error_message', { message: '방장만 내기를 초기화할 수 있습니다.' });
                return;
            }
            room.bettingState = {
                bets: [],
                bettingOpen: true,
                bettingTitle: room.bettingState.bettingTitle,
            };
            io.to(roomName).emit('betting_state_updated', room.bettingState);
            console.log(`🎲 Betting reset in ${roomName}`);
        }
    });

    // ==================== END BETTING MODE EVENTS ====================

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove user/handle cleanup
        rooms.forEach((room, roomName) => {
            const index = room.participants.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                const userName = room.participants[index].name;
                const wasHost = socket.id === room.hostId;

                // If host disconnected, destroy the room
                if (wasHost) {
                    console.log(`🏠 Host ${userName} disconnected - destroying room ${roomName}`);
                    io.to(roomName).emit('room_destroyed');
                    rooms.delete(roomName);
                    return; // Skip further processing for this room
                }

                // Regular participant left
                room.participants.splice(index, 1);
                io.to(roomName).emit('participant_list', room.participants);

                // Send user leave notification
                const leaveNotification: UserNotification = {
                    userName,
                    type: 'leave',
                    timestamp: Date.now()
                };
                io.to(roomName).emit('user_notification', leaveNotification);

                // If the room is empty, delete it
                if (room.participants.length === 0) {
                    rooms.delete(roomName);
                    console.log(`Room ${roomName} deleted (empty)`);
                }
            }
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://10.145.164.94:${PORT}`);
});
