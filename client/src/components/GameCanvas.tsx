import React, { useEffect, useRef } from 'react';
import type { Participant, Rule } from '../types';
import { PhysicsWorld } from '../game/PhysicsWorld';

interface GameCanvasProps {
    participants: Participant[];
    rules: Rule[];
    isPlaying: boolean;
    gameSeed?: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ participants, rules, isPlaying, gameSeed }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const worldRef = useRef<PhysicsWorld | null>(null);

    useEffect(() => {
        if (!isPlaying || !canvasRef.current || gameSeed === undefined) return;

        // Cleanup previous world if any
        if (worldRef.current) {
            worldRef.current.stop();
        }

        const world = new PhysicsWorld(canvasRef.current, gameSeed, (winner) => {
            console.log('Winner:', winner);
        });

        world.initLevel();
        world.addRules(rules);
        world.addParticipants(participants);
        world.start();

        worldRef.current = world;

        return () => {
            if (worldRef.current) {
                worldRef.current.stop();
                worldRef.current = null;
            }
        };
    }, [isPlaying, gameSeed, participants, rules]);

    return (
        <div className="game-canvas-wrapper" style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
            <canvas ref={canvasRef} width={500} height={800} />
        </div>
    );
};

export default GameCanvas;
