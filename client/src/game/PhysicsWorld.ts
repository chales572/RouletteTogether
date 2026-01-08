import Matter from 'matter-js';
import seedrandom from 'seedrandom';
import type { Participant, Rule } from '../types';

export class PhysicsWorld {
    private engine: Matter.Engine;
    private render: Matter.Render;
    private runner: Matter.Runner;
    private rng: seedrandom.PRNG;
    private onWinner: (participant: Participant, rule: Rule) => void;
    private rules: Rule[] = [];
    private detectedWinners: Set<string> = new Set();
    private stuckCheckInterval: NodeJS.Timeout | null = null;

    constructor(canvas: HTMLCanvasElement, seed: number | string, onWinner: (participant: Participant, rule: Rule) => void) {
        console.log('PhysicsWorld: Constructor called with seed:', seed);
        this.rng = seedrandom(String(seed));
        this.onWinner = onWinner;

        // Create engine
        this.engine = Matter.Engine.create();

        // Adjust gravity for better feel and prevent sticking
        this.engine.gravity.y = 1.2;

        // Create renderer
        this.render = Matter.Render.create({
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
        console.log('PhysicsWorld: Initialized successfully');

        // Add custom rendering for names and slot labels
        Matter.Events.on(this.render, 'afterRender', () => {
            const context = this.render.context;
            const bodies = Matter.Composite.allBodies(this.engine.world);

            context.textAlign = "center";

            bodies.forEach(body => {
                // Render participant names above balls
                if (body.label && body.label !== 'Rectangle Body' && body.label !== 'Circle Body' && !body.isStatic && !body.label.startsWith('Slot_')) {
                    context.font = "bold 12px Arial";
                    context.fillStyle = "white";
                    context.fillText(body.label, body.position.x, body.position.y - 15);
                }

                // Render slot labels
                if (body.label && body.label.startsWith('Slot_')) {
                    const slotId = body.label.replace('Slot_', '');
                    const rule = this.rules.find(r => r.id === slotId);
                    if (rule) {
                        context.font = "bold 14px Arial";
                        context.fillStyle = "#4cd137";
                        context.fillText(rule.label, body.position.x, body.position.y + 5);
                    }
                }
            });
        });

        // Collision detection for winner (simple bottom sensor)
        // Note: For a real race, we might want a sensor at the bottom line.
    }

    public initLevel() {
        console.log('PhysicsWorld: Initializing level');
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
                            restitution: 0.6,
                            friction: 0.001,
                            frictionStatic: 0.001
                        });
                        World.add(this.engine.world, peg);
                    }
                }
            }
        }
    }

    public addParticipants(participants: Participant[]) {
        console.log('PhysicsWorld: Adding participants:', participants);
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const width = 500;

        participants.forEach((p, index) => {
            // Randomize start position slightly but keep near top
            const x = width / 2 + (this.rng() - 0.5) * 200;
            const y = 50 + (index * -30) - (this.rng() * 50); // Stack them upwards

            const ball = Bodies.circle(x, y, 12, {
                label: p.name,
                restitution: 0.8,
                friction: 0.001,
                frictionAir: 0.001,
                density: 0.001,
                slop: 0.05,
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
        console.log('PhysicsWorld: Adding rules:', rules);
        this.rules = rules;
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const width = 500;
        const height = 800;

        if (rules.length === 0) {
            console.warn('PhysicsWorld: No rules to add');
            return;
        }

        const slotWidth = (width - 40) / rules.length;
        const dividers: Matter.Body[] = [];
        const slots: Matter.Body[] = [];

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

        // Create slot sensors at the bottom for each rule
        for (let i = 0; i < rules.length; i++) {
            const x = 20 + (i * slotWidth) + (slotWidth / 2);
            const slot = Bodies.rectangle(x, height - 10, slotWidth - 10, 20, {
                isStatic: true,
                isSensor: true,
                render: {
                    fillStyle: 'rgba(76, 209, 55, 0.3)',
                    strokeStyle: '#4cd137',
                    lineWidth: 2
                },
                label: `Slot_${rules[i].id}`
            });
            slots.push(slot);
        }

        World.add(this.engine.world, [...dividers, ...slots]);

        // Add collision detection for slots
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const { bodyA, bodyB } = pair;

                // Check if collision is between a participant ball and a slot
                const slot = bodyA.label.startsWith('Slot_') ? bodyA : bodyB.label.startsWith('Slot_') ? bodyB : null;
                const ball = bodyA.label.startsWith('Slot_') ? bodyB : bodyA;

                if (slot && ball && !ball.isStatic && ball.label !== 'Circle Body') {
                    const slotId = slot.label.replace('Slot_', '');
                    const participantName = ball.label;
                    const winnerKey = `${participantName}_${slotId}`;

                    // Only trigger once per participant-slot combination
                    if (!this.detectedWinners.has(winnerKey)) {
                        this.detectedWinners.add(winnerKey);
                        const rule = this.rules.find(r => r.id === slotId);
                        if (rule) {
                            console.log(`Winner detected: ${participantName} won ${rule.label}`);
                            this.onWinner({ id: ball.id.toString(), name: participantName }, rule);
                        }
                    }
                }
            });
        });
    }

    public start() {
        console.log('PhysicsWorld: Starting simulation');
        Matter.Render.run(this.render);
        Matter.Runner.run(this.runner, this.engine);

        // Add stuck ball detection and nudging
        this.stuckCheckInterval = setInterval(() => {
            const bodies = Matter.Composite.allBodies(this.engine.world);
            bodies.forEach(body => {
                // Only check participant balls (non-static, non-peg bodies)
                if (!body.isStatic && body.label !== 'Circle Body' && body.label !== 'Rectangle Body') {
                    // If ball is moving very slowly and not at the bottom, give it a nudge
                    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
                    if (speed < 0.1 && body.position.y < 750) {
                        // Apply small random force to unstick it
                        Matter.Body.applyForce(body, body.position, {
                            x: (this.rng() - 0.5) * 0.002,
                            y: 0.001
                        });
                    }
                }
            });
        }, 1000); // Check every second

        console.log('PhysicsWorld: Simulation started');
    }

    public stop() {
        console.log('PhysicsWorld: Stopping simulation');

        // Clear stuck check interval
        if (this.stuckCheckInterval) {
            clearInterval(this.stuckCheckInterval);
            this.stuckCheckInterval = null;
        }

        Matter.Render.stop(this.render);
        Matter.Runner.stop(this.runner);
        Matter.World.clear(this.engine.world, false);
        Matter.Engine.clear(this.engine);

        // Don't remove the canvas, just clear it
        const context = this.render.canvas.getContext('2d');
        if (context) {
            context.clearRect(0, 0, this.render.canvas.width, this.render.canvas.height);
        }
    }
}
