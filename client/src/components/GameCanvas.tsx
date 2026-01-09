import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Participant, Rule, DrawingData, GameMode } from '../types';
import { PhysicsWorld } from '../game/PhysicsWorld';
import Matter from 'matter-js';

interface GameCanvasProps {
    participants: Participant[];
    rules: Rule[];
    isPlaying: boolean;
    gameSeed?: number;
    onWinner?: (participant: Participant, rule: Rule) => void;
    allowDrawing?: boolean;
    drawingsLeft?: number;
    onDrawingUsed?: () => void;
    drawMode?: 'pin'; // Only pin mode supported
    onLocalDrawing?: (drawing: Omit<DrawingData, 'userId' | 'userName'>) => void;
    gameMode?: GameMode;
}

export interface GameCanvasHandle {
    addRemoteDrawing: (drawing: DrawingData) => void;
}

// Canvas dimensions - must match PhysicsWorld
const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 1000;

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>((props, ref) => {
    const {
        participants,
        rules,
        isPlaying,
        gameSeed,
        onWinner,
        allowDrawing = false,
        drawingsLeft = 0,
        onDrawingUsed,
        onLocalDrawing,
        gameMode = 'all_results'
    } = props;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const worldRef = useRef<PhysicsWorld | null>(null);
    const appliedDrawingsRef = useRef<Set<string>>(new Set());
    const lastGameModeRef = useRef<GameMode>(gameMode);
    const lastRulesCountRef = useRef<number>(rules.length);
    const lastParticipantsRef = useRef<Set<string>>(new Set());

    // Expose method to add remote drawings
    useImperativeHandle(ref, () => ({
        addRemoteDrawing: (drawing: DrawingData) => {
            // Skip if already applied (prevents duplicate from own drawing)
            if (appliedDrawingsRef.current.has(drawing.odrawId)) {
                return;
            }
            appliedDrawingsRef.current.add(drawing.odrawId);

            if (worldRef.current) {
                if (drawing.odrawType === 'pin') {
                    worldRef.current.addDrawnPin(drawing.x, drawing.y);
                } else if (drawing.odrawType === 'line' && drawing.x2 !== undefined && drawing.y2 !== undefined) {
                    worldRef.current.addDrawnLine(drawing.x, drawing.y, drawing.x2, drawing.y2);
                }
                console.log(`🎨 Applied remote drawing: ${drawing.odrawType} by ${drawing.userName}`);
            }
        }
    }));

    // Initialize world for preview (before game starts)
    useEffect(() => {
        console.log('GameCanvas preview effect triggered:', { rules, hasCanvas: !!canvasRef.current, gameMode });

        if (!canvasRef.current) {
            return;
        }

        // Check if gameMode changed
        const gameModeChanged = lastGameModeRef.current !== gameMode;
        if (gameModeChanged) {
            console.log('GameCanvas: Game mode changed from', lastGameModeRef.current, 'to', gameMode);
            lastGameModeRef.current = gameMode;
        }

        // Check if rules count changed (for dynamic basket creation)
        const rulesChanged = lastRulesCountRef.current !== rules.length;
        if (rulesChanged) {
            console.log('GameCanvas: Rules count changed from', lastRulesCountRef.current, 'to', rules.length);
            lastRulesCountRef.current = rules.length;
        }

        // Recreate world if: doesn't exist, game is starting, gameMode changed, or rules changed
        // This ensures baskets update when rules are added/removed
        const shouldRecreate = !worldRef.current || isPlaying || gameModeChanged || rulesChanged;

        if (shouldRecreate) {
            // Cleanup if exists
            if (worldRef.current) {
                worldRef.current.stop();
                worldRef.current = null;
            }

            const world = new PhysicsWorld(
                canvasRef.current,
                Date.now(),
                (participant, rule) => {
                    console.log('Winner:', participant, 'Rule:', rule);
                    if (onWinner) {
                        onWinner(participant, rule);
                    }
                },
                gameMode
            );

            world.initLevel();

            // Add rules if available
            if (rules.length > 0) {
                world.addRules(rules);
            }

            // Only start simulation if playing
            if (isPlaying && gameSeed !== undefined) {
                world.addParticipants(participants);
                world.start();
            } else {
                // Just render static view
                Matter.Render.run(world['render']);
            }

            worldRef.current = world;
        }

        return () => {
            // Don't cleanup on every render, only when component unmounts
        };
    }, [rules, gameMode]);

    // Track if game has started (to avoid re-adding participants)
    const gameStartedRef = useRef<boolean>(false);

    // Start game effect - only runs once when game starts
    useEffect(() => {
        if (!isPlaying || !worldRef.current || gameSeed === undefined) {
            // Reset when game stops
            if (!isPlaying) {
                gameStartedRef.current = false;
            }
            return;
        }

        // Only add participants once when game starts
        if (gameStartedRef.current) {
            return;
        }

        console.log('GameCanvas: Starting game with seed:', gameSeed);

        // Add participants and start
        worldRef.current.addParticipants(participants);
        worldRef.current.start();

        // Initialize participant tracking and mark game as started
        lastParticipantsRef.current = new Set(participants.map(p => p.name));
        gameStartedRef.current = true;

    }, [isPlaying, gameSeed, participants]);

    // Remove balls for participants who left during game
    useEffect(() => {
        // Only process if game is running and was started
        if (!isPlaying || !worldRef.current || !gameStartedRef.current) {
            return;
        }

        const currentParticipantNames = new Set(participants.map(p => p.name));
        const previousParticipantNames = lastParticipantsRef.current;

        // Skip if this is the first run (no previous participants to compare)
        if (previousParticipantNames.size === 0) {
            lastParticipantsRef.current = currentParticipantNames;
            return;
        }

        // Find participants who left
        previousParticipantNames.forEach(name => {
            if (!currentParticipantNames.has(name)) {
                console.log(`GameCanvas: Participant left, removing ball: ${name}`);
                worldRef.current?.removeParticipant(name);
            }
        });

        // Update tracking ref
        lastParticipantsRef.current = currentParticipantNames;
    }, [participants, isPlaying]);

    // Pin drawing handler (click to place pin)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !allowDrawing || drawingsLeft <= 0 || isPlaying) return;

        const handleClick = (e: MouseEvent) => {
            if (drawingsLeft <= 0 || !worldRef.current) return;

            const rect = canvas.getBoundingClientRect();
            // Scale coordinates to match canvas internal resolution
            const scaleX = CANVAS_WIDTH / rect.width;
            const scaleY = CANVAS_HEIGHT / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            // Add pin at click position
            const drawId = `pin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            appliedDrawingsRef.current.add(drawId);
            worldRef.current.addDrawnPin(x, y);

            // Emit to server
            if (onLocalDrawing) {
                onLocalDrawing({
                    odrawId: drawId,
                    odrawType: 'pin',
                    x,
                    y
                });
            }

            if (onDrawingUsed) {
                onDrawingUsed();
            }
        };

        canvas.addEventListener('click', handleClick);

        return () => {
            canvas.removeEventListener('click', handleClick);
        };
    }, [allowDrawing, drawingsLeft, isPlaying, onDrawingUsed, onLocalDrawing]);

    return (
        <div className="game-canvas-wrapper" style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    cursor: allowDrawing && drawingsLeft > 0 && !isPlaying ? 'crosshair' : 'default',
                    boxShadow: '0 0 30px rgba(0, 0, 0, 0.3)',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                }}
            />
        </div>
    );
});

export default GameCanvas;
