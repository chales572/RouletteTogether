import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Participant, Rule, GameState, ClientToServerEvents, ServerToClientEvents, GameMode, EmoticonMessage, UserNotification } from './types';

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

    socket.on('join_room', ({ roomName, userName }) => {
        socket.join(roomName);

        let isHost = false;
        if (!rooms.has(roomName)) {
            // First person creates the room and becomes host
            rooms.set(roomName, {
                participants: [],
                rules: [], // Empty rules - host will define them
                status: 'waiting',
                hostId: socket.id,
                gameMode: 'all_results', // Default game mode
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
        socket.emit('host_status', { isHost: socket.id === room.hostId, hostId: room.hostId });

        // Notify about current game mode
        socket.emit('game_mode_updated', { mode: room.gameMode });

        // Send user join notification to all users in the room
        const joinNotification: UserNotification = {
            userName,
            type: 'join',
            timestamp: Date.now()
        };
        io.to(roomName).emit('user_notification', joinNotification);

        console.log(`${userName} joined ${roomName}${isHost ? ' (HOST)' : ''}`);
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

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove user/handle cleanup
        rooms.forEach((room, roomName) => {
            const index = room.participants.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                const userName = room.participants[index].name;
                room.participants.splice(index, 1);
                io.to(roomName).emit('participant_list', room.participants);

                // Send user leave notification
                const leaveNotification: UserNotification = {
                    userName,
                    type: 'leave',
                    timestamp: Date.now()
                };
                io.to(roomName).emit('user_notification', leaveNotification);
            }
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://10.145.164.94:${PORT}`);
});
