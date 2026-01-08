import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://10.145.164.94:3000';

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

    useEffect(() => {
        console.log('Connecting to socket server:', SOCKET_URL);
        const newSocket = io(SOCKET_URL);

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    return socket;
};
