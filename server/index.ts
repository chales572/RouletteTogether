import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Participant, Rule, GameState, ClientToServerEvents, ServerToClientEvents } from './types';

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
}

const rooms = new Map<string, RoomData>();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomName, userName }) => {
        socket.join(roomName);

        if (!rooms.has(roomName)) {
            rooms.set(roomName, {
                participants: [],
                rules: [
                    { id: '1', label: '치킨', weight: 1 },
                    { id: '2', label: '피자', weight: 1 },
                ], // Default rules
                status: 'waiting',
            });
        }

        const room = rooms.get(roomName)!;

        // Add participant if not already present (updated socket id if same name? No, simple name check or just add)
        // For MVP, just add.
        const newParticipant: Participant = { id: socket.id, name: userName };
        room.participants.push(newParticipant);

        // Broadcast update
        io.to(roomName).emit('participant_list', room.participants);
        io.to(roomName).emit('rule_list', room.rules);

        console.log(`${userName} joined ${roomName}`);
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
            room.status = 'playing';
            const seed = Math.random();
            io.to(roomName).emit('game_started', { simulationId: Date.now().toString(), seed });
            console.log(`Game started in ${roomName} with seed ${seed}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove user/handle cleanup
        rooms.forEach((room, roomName) => {
            const index = room.participants.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.participants.splice(index, 1);
                io.to(roomName).emit('participant_list', room.participants);
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
