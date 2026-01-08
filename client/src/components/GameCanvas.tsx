import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import type { Participant, Rule } from '../types';

interface GameCanvasProps {
    participants: Participant[];
    rules: Rule[];
    isPlaying: boolean;
    gameSeed?: number; // Not strictly used for deterministic physics in this simple MVP, but good for triggering
}

const GameCanvas: React.FC<GameCanvasProps> = ({ participants, rules, isPlaying, gameSeed }) => {
    const sceneRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<Matter.Engine | null>(null);
    const renderRef = useRef<Matter.Render | null>(null);
    const runnerRef = useRef<Matter.Runner | null>(null);

    // Initialize Engine
    useEffect(() => {
        if (!sceneRef.current) return;

        // Create module aliases
        const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            Bodies = Matter.Bodies,
            Composite = Matter.Composite,
            Common = Matter.Common;

        // Create an engine
        const engine = Engine.create();
        engineRef.current = engine;

        // Create a renderer
        const width = 600;
        const height = 800;

        // Adjust visual style
        const render = Render.create({
            element: sceneRef.current,
            engine: engine,
            options: {
                width,
                height,
                wireframes: false,
                background: 'transparent',
            },
        });
        renderRef.current = render;

        // Create walls
        const wallOptions = { isStatic: true, render: { fillStyle: '#475569' } };
        const leftWall = Bodies.rectangle(10, height / 2, 20, height, wallOptions);
        const rightWall = Bodies.rectangle(width - 10, height / 2, 20, height, wallOptions);
        const ground = Bodies.rectangle(width / 2, height + 10, width, 20, wallOptions); // Below screen

        // Create pegs (Plinko style)
        const pegs: Matter.Body[] = [];
        const rows = 10;
        const cols = 9;
        const startY = 200;
        const spacing = 50;

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (i % 2 === 0 && j === cols - 1) continue; // Offset rows

                const xOffset = i % 2 === 0 ? 0 : 25;
                const x = j * spacing + 100 + xOffset;
                const y = i * spacing + startY;

                const peg = Bodies.circle(x, y, 5, {
                    isStatic: true,
                    render: { fillStyle: '#94a3b8' },
                    restitution: 0.5
                });
                pegs.push(peg);
            }
        }

        // Create Logic for Slots (Buckets) at the bottom
        // We need to divide the width by rules.length
        const slotWidth = (width - 40) / (rules.length || 1);
        const dividers: Matter.Body[] = [];

        // Create dividers between slots
        for (let i = 1; i < rules.length; i++) {
            const x = 20 + i * slotWidth;
            const divider = Bodies.rectangle(x, height - 50, 5, 100, wallOptions);
            dividers.push(divider);
        }

        Composite.add(engine.world, [leftWall, rightWall, ground, ...pegs, ...dividers]);

        // Run the renderer
        Render.run(render);

        // Create runner
        const runner = Runner.create();
        runnerRef.current = runner;
        Runner.run(runner, engine);

        return () => {
            Render.stop(render);
            Runner.stop(runner);
            if (render.canvas) render.canvas.remove();
        };
    }, [rules]); // Re-create board if rules change (simple approach)

    // Handle Game Start / Marble Drop
    useEffect(() => {
        if (isPlaying && engineRef.current) {
            const Bodies = Matter.Bodies;
            const Composite = Matter.Composite;
            const engine = engineRef.current;

            // Clear existing marbles (if any from previous run? For now just add)
            // Actually we probably want to clear old "marbles" logic if we restart- but for now just spawn.

            const width = 600;
            // Spawn marbles for each participant
            participants.forEach((p, index) => {
                // Randomize x slightly or distribute?
                // Let's distribute them at the top
                // Pseudo-random based on index to allow "stacking" if many
                const startX = width / 2 + (Math.random() - 0.5) * 40;
                const startY = 50 - index * 30; // Stack vertically so they don't collide instantly

                const marble = Bodies.circle(startX, startY, 10, {
                    restitution: 0.9,
                    friction: 0.005,
                    render: {
                        fillStyle: getRandomColor(p.name),
                        strokeStyle: '#fff',
                        lineWidth: 2
                    },
                    label: p.name
                });

                Composite.add(engine.world, marble);
            });
        }
    }, [isPlaying, gameSeed, participants]);

    return <div ref={sceneRef} className="game-canvas" />;
};

// Helper for consistent colors
const getRandomColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

export default GameCanvas;
