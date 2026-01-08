import Matter from 'matter-js';
import seedrandom from 'seedrandom';
import type { Participant, Rule } from '../types';

export class PhysicsWorld {
    private engine: Matter.Engine;
    private render: Matter.Render;
    private runner: Matter.Runner;
    private rng: seedrandom.PRNG;

    constructor(canvas: HTMLCanvasElement, seed: number | string, onGameOver: (winner: Participant) => void) {
        this.rng = seedrandom(String(seed));

        // Create engine
        this.engine = Matter.Engine.create();

        // Adjust gravity for better feel
        this.engine.gravity.y = 1;

        // Create renderer
        this.render = Matter.Render.create({
            element: canvas.parentElement!,
            canvas: canvas,
            engine: this.engine,
            options: {
                width: 500,
                height: 800,
                wireframes: false,
                background: '#1a1a1a'
            }
        });

        this.runner = Matter.Runner.create();

        // Add custom rendering for names
        Matter.Events.on(this.render, 'afterRender', () => {
            const context = this.render.context;
            const bodies = Matter.Composite.allBodies(this.engine.world);

            context.font = "12px Arial";
            context.fillStyle = "white";
            context.textAlign = "center";

            bodies.forEach(body => {
                if (body.label && body.label !== 'Rectangle Body' && body.label !== 'Circle Body' && !body.isStatic) {
                    context.fillText(body.label, body.position.x, body.position.y - 15);
                }
            });
        });

        // Collision detection for winner (simple bottom sensor)
        // Note: For a real race, we might want a sensor at the bottom line.
    }

    public initLevel() {
        // Simple Plinko board
        const width = 500;
        const height = 800;
        const wallThickness = 20;

        const World = Matter.World;
        const Bodies = Matter.Bodies;

        // Walls
        const walls = [
            Bodies.rectangle(width / 2, height + 50, width, 100, { isStatic: true, render: { fillStyle: '#333' } }), // Ground (below view)
            Bodies.rectangle(-10, height / 2, wallThickness, height, { isStatic: true, label: 'Wall' }),
            Bodies.rectangle(width + 10, height / 2, wallThickness, height, { isStatic: true, label: 'Wall' })
        ];

        World.add(this.engine.world, walls);

        // Pegs
        const rows = 15;
        const cols = 9;
        const startY = 200;
        const spacingX = width / cols;
        const spacingY = 40;

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                // Offset every other row
                const xOffset = (i % 2 === 0) ? 0 : spacingX / 2;
                const x = j * spacingX + xOffset + 25; // centerish
                const y = i * spacingY + startY;

                if (x > 10 && x < width - 10) {
                    // Randomly skip some pegs for variety
                    if (this.rng() > 0.1) {
                        const peg = Bodies.circle(x, y, 5, {
                            isStatic: true,
                            render: { fillStyle: '#4ecdc4' },
                            restitution: 0.5
                        });
                        World.add(this.engine.world, peg);
                    }
                }
            }
        }
    }

    public addParticipants(participants: Participant[]) {
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const width = 500;

        participants.forEach((p, index) => {
            // Randomize start position slightly but keep near top
            const x = width / 2 + (this.rng() - 0.5) * 200;
            const y = 50 + (index * -30) - (this.rng() * 50); // Stack them upwards

            const ball = Bodies.circle(x, y, 12, {
                label: p.name,
                restitution: 0.9,
                friction: 0.005,
                render: { fillStyle: this.getRandomColor() }
            });

            World.add(this.engine.world, ball);
        });
    }

    private getRandomColor() {
        const colors = ['#ff6b6b', '#feca57', '#54a0ff', '#5f27cd', '#48dbfb'];
        return colors[Math.floor(this.rng() * colors.length)];
    }

    public addRules(rules: Rule[]) {
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const width = 500;
        const height = 800;

        if (rules.length === 0) return;

        const slotWidth = (width - 40) / rules.length;
        const dividers: Matter.Body[] = [];

        // Create dividers
        for (let i = 1; i < rules.length; i++) {
            const x = 20 + i * slotWidth;
            const divider = Bodies.rectangle(x, height - 50, 5, 120, {
                isStatic: true,
                render: { fillStyle: '#555' },
                label: 'Divider'
            });
            dividers.push(divider);
        }

        World.add(this.engine.world, dividers);
    }

    public start() {
        Matter.Render.run(this.render);
        Matter.Runner.run(this.runner, this.engine);
    }

    public stop() {
        Matter.Render.stop(this.render);
        Matter.Runner.stop(this.runner);
        Matter.Engine.clear(this.engine);
        this.render.canvas.remove();
        this.render.canvas = null as any;
        this.render.context = null as any;
        this.render.textures = {};
    }
}
