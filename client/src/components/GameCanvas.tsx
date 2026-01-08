import React, { useEffect, useRef } from 'react';
import type { Participant, Rule } from '../types';
import { PhysicsWorld } from '../game/PhysicsWorld';

interface GameCanvasProps {
    participants: Participant[];
    rules: Rule[];
    isPlaying: boolean;
    gameSeed?: number;
    onWinner?: (participant: Participant, rule: Rule) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ participants, rules, isPlaying, gameSeed, onWinner }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const worldRef = useRef<PhysicsWorld | null>(null);

    useEffect(() => {
        console.log('GameCanvas effect triggered:', { isPlaying, gameSeed, participants, rules, hasCanvas: !!canvasRef.current });

        if (!isPlaying || !canvasRef.current || gameSeed === undefined) {
            console.log('GameCanvas: not starting game', { isPlaying, hasCanvas: !!canvasRef.current, gameSeed });
            return;
        }

        console.log('GameCanvas: Starting game with participants:', participants, 'and rules:', rules);

        // Cleanup previous world if any
        if (worldRef.current) {
            console.log('GameCanvas: Cleaning up previous world');
            worldRef.current.stop();
        }

        const world = new PhysicsWorld(canvasRef.current, gameSeed, (participant, rule) => {
            console.log('Winner:', participant, 'Rule:', rule);
            if (onWinner) {
                onWinner(participant, rule);
            }
        });

        world.initLevel();
        world.addRules(rules);
        world.addParticipants(participants);
        world.start();

        worldRef.current = world;
        console.log('GameCanvas: Game started successfully');

        return () => {
            console.log('GameCanvas: Cleanup effect running');
            if (worldRef.current) {
                worldRef.current.stop();
                worldRef.current = null;
            }
        };
    }, [isPlaying, gameSeed, participants, rules]);

    return (
        <div className="game-canvas-wrapper" style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <canvas ref={canvasRef} width={500} height={800} style={{ border: '1px solid rgba(255,255,255,0.2)' }} />
        </div>
    );
};

export default GameCanvas;
