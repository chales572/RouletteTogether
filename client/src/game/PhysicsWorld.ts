import Matter from 'matter-js';
import seedrandom from 'seedrandom';
import type { Participant, Rule, GameMode } from '../types';

export type ThemeType = 'basket' | 'winner' | 'loser';

export class PhysicsWorld {
    private engine: Matter.Engine;
    private render: Matter.Render;
    private runner: Matter.Runner;
    private rng: seedrandom.PRNG;
    private onWinner: (participant: Participant, rule: Rule) => void;
    private rules: Rule[] = [];
    private detectedWinners: Set<string> = new Set();
    private stuckCheckInterval: NodeJS.Timeout | null = null;
    private theme: ThemeType = 'basket';
    private animationFrame: number = 0;
    private waterWaves: { x: number; phase: number }[] = [];
    private fireParticles: { x: number; y: number; life: number; vx: number; vy: number }[] = [];
    private oscillatingPegs: { body: Matter.Body; baseX: number; phase: number }[] = [];
    private pegOscillationInterval: NodeJS.Timeout | null = null;

    // Larger canvas size
    private readonly WIDTH = 850;
    private readonly HEIGHT = 1000;

    constructor(
        canvas: HTMLCanvasElement,
        seed: number | string,
        onWinner: (participant: Participant, rule: Rule) => void,
        gameMode: GameMode = 'all_results'
    ) {
        console.log('PhysicsWorld: Constructor called with seed:', seed, 'mode:', gameMode);
        this.rng = seedrandom(String(seed));
        this.onWinner = onWinner;

        // Set theme based on game mode
        if (gameMode === 'winner_only') {
            this.theme = 'winner';
        } else if (gameMode === 'loser_only') {
            this.theme = 'loser';
        } else {
            this.theme = 'basket';
        }

        // Create engine
        this.engine = Matter.Engine.create();
        this.engine.gravity.y = 0.5;

        // Create renderer with transparent background (we draw our own)
        this.render = Matter.Render.create({
            canvas: canvas,
            engine: this.engine,
            options: {
                width: this.WIDTH,
                height: this.HEIGHT,
                wireframes: false,
                background: 'transparent'
            }
        });

        this.runner = Matter.Runner.create();

        // Initialize water waves for loser theme
        if (this.theme === 'loser') {
            for (let i = 0; i < 20; i++) {
                this.waterWaves.push({ x: i * (this.WIDTH / 20), phase: this.rng() * Math.PI * 2 });
            }
        }

        // Custom rendering: background -> bodies -> labels
        Matter.Events.on(this.render, 'afterRender', () => {
            this.animationFrame++;
            const context = this.render.context;
            const bodies = Matter.Composite.allBodies(this.engine.world);

            // 1. Clear and draw background first
            context.clearRect(0, 0, this.WIDTH, this.HEIGHT);
            this.drawThemeBackground(context);

            // 2. Re-draw all bodies on top of background
            bodies.forEach(body => {
                if (body.render.visible === false) return;

                const vertices = body.vertices;
                const fillStyle = body.render.fillStyle || '#ffffff';
                const strokeStyle = body.render.strokeStyle;
                const lineWidth = body.render.lineWidth || 0;

                context.beginPath();

                // Check if it's a circle (has circleRadius)
                if ((body as any).circleRadius) {
                    const radius = (body as any).circleRadius;
                    context.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
                } else {
                    // Polygon/Rectangle
                    context.moveTo(vertices[0].x, vertices[0].y);
                    for (let j = 1; j < vertices.length; j++) {
                        context.lineTo(vertices[j].x, vertices[j].y);
                    }
                    context.closePath();
                }

                context.fillStyle = fillStyle;
                context.fill();

                if (strokeStyle && lineWidth > 0) {
                    context.strokeStyle = strokeStyle;
                    context.lineWidth = lineWidth;
                    context.stroke();
                }
            });

            // 3. Draw labels on top
            context.textAlign = "center";

            bodies.forEach(body => {
                // Render participant names above balls
                if (body.label && body.label !== 'Rectangle Body' && body.label !== 'Circle Body' && !body.isStatic && !body.label.startsWith('Slot_')) {
                    context.font = "bold 16px Arial";
                    context.fillStyle = "white";
                    context.strokeStyle = "rgba(0,0,0,0.5)";
                    context.lineWidth = 3;
                    context.strokeText(body.label, body.position.x, body.position.y - 25);
                    context.fillText(body.label, body.position.x, body.position.y - 25);
                }

                // Render slot labels with theme styling
                if (body.label && body.label.startsWith('Slot_')) {
                    const slotId = body.label.replace('Slot_', '');
                    const rule = this.rules.find(r => r.id === slotId);
                    if (rule) {
                        context.font = "bold 18px Arial";
                        context.fillStyle = this.getSlotLabelColor();
                        context.strokeStyle = "rgba(0,0,0,0.5)";
                        context.lineWidth = 2;
                        context.strokeText(rule.label, body.position.x, body.position.y + 8);
                        context.fillText(rule.label, body.position.x, body.position.y + 8);
                    }
                }
            });

            // 4. Draw theme-specific foreground elements
            this.drawThemeForeground(context);
        });

        console.log('PhysicsWorld: Initialized successfully with theme:', this.theme);
    }

    private getSlotLabelColor(): string {
        switch (this.theme) {
            case 'winner':
                return '#ffd700'; // Gold
            case 'loser':
                return '#ff4444'; // Red
            case 'basket':
            default:
                return '#ffffff'; // White for basket labels
        }
    }

    private drawThemeBackground(context: CanvasRenderingContext2D) {
        const width = this.WIDTH;
        const height = this.HEIGHT;

        switch (this.theme) {
            case 'basket':
                this.drawBasketBackground(context, width, height);
                break;
            case 'winner':
                this.drawWinnerBackground(context, width, height);
                break;
            case 'loser':
                this.drawLoserBackground(context, width, height);
                break;
        }
    }

    private drawBasketBackground(context: CanvasRenderingContext2D, width: number, height: number) {
        // Warm gradient background (carnival/festival feel)
        const bgGradient = context.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(0.3, '#16213e');
        bgGradient.addColorStop(0.7, '#1a1a2e');
        bgGradient.addColorStop(1, '#0f0f1a');
        context.fillStyle = bgGradient;
        context.fillRect(0, 0, width, height);

        // Decorative lights at top (carnival style)
        const lightColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];
        for (let i = 0; i < 20; i++) {
            const x = (i * 45) + 20;
            const glow = Math.sin(this.animationFrame * 0.1 + i * 0.5) * 0.3 + 0.7;

            // Light glow
            const glowGradient = context.createRadialGradient(x, 40, 0, x, 40, 20);
            glowGradient.addColorStop(0, lightColors[i % lightColors.length]);
            glowGradient.addColorStop(0.5, `rgba(255, 255, 255, ${glow * 0.3})`);
            glowGradient.addColorStop(1, 'transparent');
            context.fillStyle = glowGradient;
            context.beginPath();
            context.arc(x, 40, 20, 0, Math.PI * 2);
            context.fill();

            // Light bulb
            context.fillStyle = lightColors[i % lightColors.length];
            context.beginPath();
            context.arc(x, 40, 8, 0, Math.PI * 2);
            context.fill();
        }

        // Connecting wire for lights
        context.strokeStyle = '#444';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, 40);
        for (let i = 0; i < 20; i++) {
            const x = (i * 45) + 20;
            context.lineTo(x, 35 + Math.sin(i * 0.3) * 5);
        }
        context.lineTo(width, 40);
        context.stroke();

        // "룰렛 바구니" title
        context.font = "bold 32px Arial";
        context.textAlign = "center";
        const titleGradient = context.createLinearGradient(width / 2 - 100, 0, width / 2 + 100, 0);
        titleGradient.addColorStop(0, '#ff6b6b');
        titleGradient.addColorStop(0.5, '#feca57');
        titleGradient.addColorStop(1, '#4cd137');
        context.fillStyle = titleGradient;
        context.strokeStyle = 'rgba(0,0,0,0.5)';
        context.lineWidth = 3;
        context.strokeText("🎪 룰렛 바구니 🎪", width / 2, 80);
        context.fillText("🎪 룰렛 바구니 🎪", width / 2, 80);

        // Draw baskets at bottom
        this.drawBaskets(context, width, height);

        // Falling confetti effect
        const confettiColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6'];
        for (let i = 0; i < 15; i++) {
            const x = ((i * 60 + this.animationFrame * 0.5) % (width + 40)) - 20;
            const y = ((this.animationFrame * 1.5 + i * 70) % (height - 200)) + 100;
            const rotation = (this.animationFrame * 2 + i * 30) % 360;

            context.save();
            context.translate(x, y);
            context.rotate(rotation * Math.PI / 180);
            context.fillStyle = confettiColors[i % confettiColors.length];
            context.fillRect(-4, -6, 8, 12);
            context.restore();
        }

        // Side decorative stripes
        const stripeColors = ['#ff6b6b', '#feca57', '#4cd137'];
        for (let i = 0; i < 3; i++) {
            context.fillStyle = stripeColors[i];
            context.globalAlpha = 0.3;
            context.fillRect(5 + i * 8, 100, 5, height - 250);
            context.fillRect(width - 10 - i * 8, 100, 5, height - 250);
        }
        context.globalAlpha = 1;
    }

    private drawBaskets(context: CanvasRenderingContext2D, width: number, height: number) {
        const basketY = height - 130;
        const basketHeight = 110;
        const numBaskets = this.rules.length || 3;
        const basketWidth = (width - 80) / numBaskets;
        const basketColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];

        for (let i = 0; i < numBaskets; i++) {
            const centerX = 40 + i * basketWidth + basketWidth / 2;
            const color = basketColors[i % basketColors.length];
            const leftX = 40 + i * basketWidth + 15;
            const rightX = 40 + (i + 1) * basketWidth - 15;

            // Basket interior glow/fill (behind the walls)
            const interiorGradient = context.createLinearGradient(leftX, basketY, rightX, basketY);
            interiorGradient.addColorStop(0, this.lightenColor(color, -30));
            interiorGradient.addColorStop(0.5, this.lightenColor(color, -10));
            interiorGradient.addColorStop(1, this.lightenColor(color, -30));
            context.fillStyle = interiorGradient;
            context.globalAlpha = 0.4;
            context.fillRect(leftX, basketY, rightX - leftX, basketHeight);
            context.globalAlpha = 1;

            // Basket weave pattern (horizontal lines)
            context.strokeStyle = 'rgba(255,255,255,0.15)';
            context.lineWidth = 1;
            for (let j = 0; j < 6; j++) {
                const y = basketY + 15 + j * 16;
                context.beginPath();
                context.moveTo(leftX + 5, y);
                context.lineTo(rightX - 5, y);
                context.stroke();
            }

            // Basket rim/opening at top (decorative)
            context.fillStyle = this.lightenColor(color, 20);
            context.fillRect(leftX - 5, basketY - 5, rightX - leftX + 10, 8);
            context.strokeStyle = '#ffffff';
            context.lineWidth = 2;
            context.strokeRect(leftX - 5, basketY - 5, rightX - leftX + 10, 8);

            // Basket label with rule name
            if (this.rules[i]) {
                context.font = "bold 14px Arial";
                context.fillStyle = '#ffffff';
                context.textAlign = "center";
                context.strokeStyle = 'rgba(0,0,0,0.7)';
                context.lineWidth = 3;
                const label = this.rules[i].label.length > 10
                    ? this.rules[i].label.substring(0, 10) + '...'
                    : this.rules[i].label;
                context.strokeText(label, centerX, basketY + basketHeight / 2);
                context.fillText(label, centerX, basketY + basketHeight / 2);
            }

            // Basket number/icon at bottom
            context.font = "bold 20px Arial";
            context.fillStyle = '#ffffff';
            context.textAlign = "center";
            context.strokeStyle = 'rgba(0,0,0,0.5)';
            context.lineWidth = 2;
            const basketIcon = ['🧺', '🎁', '🎀', '🎯', '🌟', '💎'][i % 6];
            context.strokeText(basketIcon, centerX, basketY + basketHeight - 15);
            context.fillText(basketIcon, centerX, basketY + basketHeight - 15);
        }

        // "바구니에 들어가세요!" text with animation
        context.font = "bold 18px Arial";
        context.textAlign = "center";
        const hintAlpha = 0.5 + Math.sin(this.animationFrame * 0.08) * 0.3;
        context.fillStyle = `rgba(255, 255, 255, ${hintAlpha})`;
        context.fillText("⬇️ 바구니에 들어가세요! ⬇️", width / 2, basketY - 20);
    }

    private lightenColor(hex: string, percent: number): string {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, Math.min(255, (num >> 16) + amt));
        const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
        const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    private drawWinnerBackground(context: CanvasRenderingContext2D, width: number, height: number) {
        // Rich golden gradient background
        const bgGradient = context.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(0.4, '#2d2040');
        bgGradient.addColorStop(1, '#1a1020');
        context.fillStyle = bgGradient;
        context.fillRect(0, 0, width, height);

        // Golden gradient rays from bottom - more vibrant
        const centerX = width / 2;
        const bottomY = height;
        const rayCount = 16;

        for (let i = 0; i < rayCount; i++) {
            const angle = (Math.PI / rayCount) * i - Math.PI / 2;
            const nextAngle = (Math.PI / rayCount) * (i + 1) - Math.PI / 2;

            context.beginPath();
            context.moveTo(centerX, bottomY);
            context.lineTo(centerX + Math.cos(angle) * height * 1.5, bottomY + Math.sin(angle) * height * 1.5);
            context.lineTo(centerX + Math.cos(nextAngle) * height * 1.5, bottomY + Math.sin(nextAngle) * height * 1.5);
            context.closePath();

            // Alternating gold and orange rays for more color
            context.fillStyle = i % 2 === 0 ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 165, 0, 0.08)';
            context.fill();
        }

        // Colorful ribbon banners on sides (instead of sparkles)
        const ribbonColors = ['#ffd700', '#ff6b6b', '#54a0ff', '#4cd137', '#f472b6'];
        for (let i = 0; i < 5; i++) {
            // Left ribbons
            context.fillStyle = ribbonColors[i];
            context.fillRect(20 + i * 8, 100 + i * 60, 6, 150);
            // Right ribbons
            context.fillRect(width - 20 - i * 8 - 6, 100 + i * 60, 6, 150);
        }

        // Trophy podium area at bottom - more colorful
        const podiumY = height - 130;

        // Podium base with gradient
        const podiumGradient = context.createLinearGradient(width / 2 - 100, podiumY, width / 2 + 100, podiumY + 50);
        podiumGradient.addColorStop(0, '#ffd700');
        podiumGradient.addColorStop(0.5, '#ffed4e');
        podiumGradient.addColorStop(1, '#daa520');
        context.fillStyle = podiumGradient;
        context.fillRect(width / 2 - 100, podiumY, 200, 50);

        // Podium shadow
        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(width / 2 - 100, podiumY + 50, 200, 10);

        // Trophy icon with glow effect (solid color ring instead of sparkle)
        context.beginPath();
        context.arc(width / 2, podiumY - 50, 50, 0, Math.PI * 2);
        const trophyGlow = context.createRadialGradient(width / 2, podiumY - 50, 20, width / 2, podiumY - 50, 50);
        trophyGlow.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
        trophyGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
        context.fillStyle = trophyGlow;
        context.fill();

        context.font = "70px Arial";
        context.textAlign = "center";
        context.fillText("🏆", width / 2, podiumY - 25);

        // "1ST PLACE" text with color gradient effect
        context.font = "bold 36px Arial";
        context.fillStyle = '#ffd700';
        context.strokeStyle = '#b8860b';
        context.lineWidth = 2;
        context.strokeText("1ST PLACE", width / 2, podiumY + 35);
        context.fillText("1ST PLACE", width / 2, podiumY + 35);

        // Crown decorations on sides with pulse effect (size-based, not sparkle)
        const crownScale = 1 + Math.sin(this.animationFrame * 0.05) * 0.1;
        context.font = `${30 * crownScale}px Arial`;
        context.fillText("👑", 60, height - 80);
        context.fillText("👑", width - 60, height - 80);

        // Colorful confetti strips at top (static colored squares, not animated sparkles)
        const confettiColors = ['#ff6b6b', '#ffd700', '#54a0ff', '#4cd137', '#f472b6', '#feca57'];
        for (let i = 0; i < 30; i++) {
            const x = (i * 30 + this.animationFrame * 0.3) % (width + 20) - 10;
            const y = 30 + Math.sin(i * 0.5) * 20;
            context.fillStyle = confettiColors[i % confettiColors.length];
            context.fillRect(x, y, 8, 12);
        }
    }

    private drawLoserBackground(context: CanvasRenderingContext2D, width: number, height: number) {
        // Dark ominous gradient
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#1a0a0a');
        gradient.addColorStop(0.6, '#2a1010');
        gradient.addColorStop(1, '#0a0505');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);

        // Water/lava pool at bottom
        const waterY = height - 130;

        // Animated waves
        context.beginPath();
        context.moveTo(0, waterY);

        for (let x = 0; x <= width; x += 10) {
            const waveOffset = Math.sin(x * 0.02 + this.animationFrame * 0.05) * 15 +
                Math.sin(x * 0.01 + this.animationFrame * 0.03) * 10;
            context.lineTo(x, waterY + waveOffset);
        }

        context.lineTo(width, height);
        context.lineTo(0, height);
        context.closePath();

        // Water/lava gradient
        const waterGradient = context.createLinearGradient(0, waterY, 0, height);
        waterGradient.addColorStop(0, 'rgba(255, 100, 50, 0.9)');
        waterGradient.addColorStop(0.3, 'rgba(255, 50, 0, 0.8)');
        waterGradient.addColorStop(0.7, 'rgba(200, 30, 0, 0.9)');
        waterGradient.addColorStop(1, 'rgba(100, 10, 0, 1)');
        context.fillStyle = waterGradient;
        context.fill();

        // Fire/steam particles
        if (this.animationFrame % 5 === 0) {
            for (let i = 0; i < 3; i++) {
                this.fireParticles.push({
                    x: this.rng() * width,
                    y: waterY + 20,
                    life: 60,
                    vx: (this.rng() - 0.5) * 2,
                    vy: -2 - this.rng() * 3
                });
            }
        }

        // Update and draw fire particles
        this.fireParticles = this.fireParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.02;
            p.life--;

            const alpha = p.life / 60;
            const size = 5 + (60 - p.life) * 0.3;

            const fireGradient = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
            fireGradient.addColorStop(0, `rgba(255, 255, 100, ${alpha})`);
            fireGradient.addColorStop(0.4, `rgba(255, 150, 50, ${alpha * 0.8})`);
            fireGradient.addColorStop(1, `rgba(255, 50, 0, 0)`);

            context.beginPath();
            context.arc(p.x, p.y, size, 0, Math.PI * 2);
            context.fillStyle = fireGradient;
            context.fill();

            return p.life > 0;
        });

        // "DANGER ZONE" warning
        context.font = "bold 28px Arial";
        context.textAlign = "center";
        const warningAlpha = 0.5 + Math.sin(this.animationFrame * 0.1) * 0.5;
        context.fillStyle = `rgba(255, 50, 50, ${warningAlpha})`;
        context.fillText("⚠️ DANGER ZONE ⚠️", width / 2, waterY - 20);

        // Skull icons
        context.font = "40px Arial";
        context.fillText("💀", 60, height - 60);
        context.fillText("💀", width - 60, height - 60);
        context.fillText("🔥", width / 2, height - 50);

        // Warning stripes on sides
        context.fillStyle = '#ff0000';
        for (let y = 0; y < height; y += 40) {
            if ((y / 40) % 2 === 0) {
                context.fillRect(0, y, 15, 20);
                context.fillRect(width - 15, y, 15, 20);
            }
        }
        context.fillStyle = '#ffff00';
        for (let y = 20; y < height; y += 40) {
            if ((y / 40) % 2 === 0) {
                context.fillRect(0, y, 15, 20);
                context.fillRect(width - 15, y, 15, 20);
            }
        }
    }

    private drawThemeForeground(_context: CanvasRenderingContext2D) {
        // Additional foreground effects can be added here
    }

    public initLevel() {
        console.log('PhysicsWorld: Initializing level with theme:', this.theme);
        const width = this.WIDTH;
        const height = this.HEIGHT;
        const wallThickness = 25;

        const World = Matter.World;
        const Bodies = Matter.Bodies;

        // Theme-colored walls
        const wallColor = this.theme === 'winner' ? '#8b7500' :
            this.theme === 'loser' ? '#4a0000' : '#2d3436';

        // Walls
        const walls = [
            Bodies.rectangle(width / 2, height + 50, width, 100, { isStatic: true, render: { fillStyle: '#222' } }),
            Bodies.rectangle(-12, height / 2, wallThickness, height, { isStatic: true, label: 'Wall', render: { fillStyle: wallColor } }),
            Bodies.rectangle(width + 12, height / 2, wallThickness, height, { isStatic: true, label: 'Wall', render: { fillStyle: wallColor } })
        ];

        World.add(this.engine.world, walls);

        // Pegs with theme colors
        const rows = 8;
        const cols = 11;
        const startY = 180;
        const spacingX = width / (cols + 1);
        const spacingY = 85;

        const pegColors = this.getPegColors();

        // Clear any existing oscillating pegs
        this.oscillatingPegs = [];

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const xOffset = (i % 2 === 0) ? 0 : spacingX / 2;
                const x = j * spacingX + xOffset + spacingX;
                const y = i * spacingY + startY;

                if (x > 50 && x < width - 50) {
                    if (this.rng() > 0.2) {
                        const colorIndex = Math.floor(this.rng() * pegColors.length);
                        const peg = Bodies.circle(x, y, 10, {
                            isStatic: true,
                            render: {
                                fillStyle: pegColors[colorIndex],
                                strokeStyle: '#ffffff',
                                lineWidth: 2
                            },
                            restitution: 0.8,
                            friction: 0.0001,
                            frictionStatic: 0.0001,
                            label: 'Peg'
                        });
                        World.add(this.engine.world, peg);

                        // Last 2 rows of pegs will oscillate
                        if (i >= rows - 2) {
                            this.oscillatingPegs.push({
                                body: peg,
                                baseX: x,
                                phase: this.rng() * Math.PI * 2 // Random starting phase
                            });
                        }
                    }
                }
            }
        }
    }

    private getPegColors(): string[] {
        switch (this.theme) {
            case 'winner':
                return ['#ffd700', '#ffed4e', '#f0c000', '#daa520', '#ffc107'];
            case 'loser':
                return ['#ff4444', '#ff6b6b', '#cc0000', '#ff8800', '#ff5500'];
            case 'basket':
            default:
                return ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6'];
        }
    }

    public addParticipants(participants: Participant[]) {
        console.log('PhysicsWorld: Adding participants:', participants);
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const width = this.WIDTH;

        const participantCategory = 0x0002;
        const participantColors = ['#ff6b6b', '#feca57', '#54a0ff', '#5f27cd', '#48dbfb', '#ff9f43', '#00d2d3', '#f368e0'];

        participants.forEach((p, index) => {
            const x = width / 2 + (this.rng() - 0.5) * 350;
            const y = 60 + (index * -40) - (this.rng() * 70);

            const ball = Bodies.circle(x, y, 18, {
                label: p.name,
                restitution: 0.7,
                friction: 0.01,
                frictionAir: 0.008,
                density: 0.001,
                slop: 0.05,
                collisionFilter: {
                    category: participantCategory,
                    mask: 0xFFFFFFFF
                },
                render: { fillStyle: participantColors[index % participantColors.length] }
            });

            World.add(this.engine.world, ball);
        });
    }

    public addRules(rules: Rule[]) {
        console.log('PhysicsWorld: Adding rules:', rules);
        this.rules = rules;
        const World = Matter.World;
        const Bodies = Matter.Bodies;
        const width = this.WIDTH;
        const height = this.HEIGHT;

        if (rules.length === 0) {
            console.warn('PhysicsWorld: No rules to add');
            return;
        }

        const slotWidth = (width - 80) / rules.length;
        const dividers: Matter.Body[] = [];
        const slots: Matter.Body[] = [];
        const funnelWalls: Matter.Body[] = [];

        // Theme-based slot area
        const funnelStartY = height - 250;
        const funnelEndY = height - 130;
        const funnelTopWidth = width - 120;
        const funnelBottomWidth = width - 80;

        const funnelColor = this.theme === 'winner' ? '#8b7500' :
            this.theme === 'loser' ? '#4a0000' : '#444';

        // Left funnel wall
        const leftFunnelAngle = Math.atan2(
            funnelEndY - funnelStartY,
            (width - funnelBottomWidth) / 2 - (width - funnelTopWidth) / 2
        );
        const leftFunnelLength = Math.sqrt(
            Math.pow(funnelEndY - funnelStartY, 2) +
            Math.pow((width - funnelBottomWidth) / 2 - (width - funnelTopWidth) / 2, 2)
        );
        const leftFunnelWall = Bodies.rectangle(
            (width - funnelTopWidth) / 2 + ((width - funnelBottomWidth) / 2 - (width - funnelTopWidth) / 2) / 2,
            (funnelStartY + funnelEndY) / 2,
            leftFunnelLength,
            14,
            {
                isStatic: true,
                angle: leftFunnelAngle,
                render: { fillStyle: funnelColor },
                label: 'FunnelWall'
            }
        );
        funnelWalls.push(leftFunnelWall);

        // Right funnel wall
        const rightFunnelAngle = Math.atan2(
            funnelEndY - funnelStartY,
            width - (width - funnelBottomWidth) / 2 - (width - (width - funnelTopWidth) / 2)
        );
        const rightFunnelLength = leftFunnelLength;
        const rightFunnelWall = Bodies.rectangle(
            width - ((width - funnelTopWidth) / 2 + ((width - funnelBottomWidth) / 2 - (width - funnelTopWidth) / 2) / 2),
            (funnelStartY + funnelEndY) / 2,
            rightFunnelLength,
            14,
            {
                isStatic: true,
                angle: -rightFunnelAngle,
                render: { fillStyle: funnelColor },
                label: 'FunnelWall'
            }
        );
        funnelWalls.push(rightFunnelWall);

        // Dividers with theme colors
        const dividerColor = this.theme === 'winner' ? '#b8860b' :
            this.theme === 'loser' ? '#660000' : '#666';

        // Basket mode: create physical basket walls
        if (this.theme === 'basket') {
            const basketY = height - 130;
            const basketHeight = 110;
            const basketColors = ['#ff6b6b', '#feca57', '#4cd137', '#54a0ff', '#f472b6', '#48dbfb'];

            for (let i = 0; i < rules.length; i++) {
                const centerX = 40 + i * slotWidth + slotWidth / 2;
                const color = basketColors[i % basketColors.length];

                // Left wall of basket (angled inward at top)
                const leftWallX = 40 + i * slotWidth + 10;
                const leftWall = Bodies.rectangle(leftWallX + 5, basketY + basketHeight / 2, 10, basketHeight, {
                    isStatic: true,
                    render: { fillStyle: color, strokeStyle: '#ffffff', lineWidth: 2 },
                    label: 'BasketWall'
                });
                dividers.push(leftWall);

                // Right wall of basket (angled inward at top) - only for last basket
                if (i === rules.length - 1) {
                    const rightWallX = 40 + (i + 1) * slotWidth - 10;
                    const rightWall = Bodies.rectangle(rightWallX - 5, basketY + basketHeight / 2, 10, basketHeight, {
                        isStatic: true,
                        render: { fillStyle: color, strokeStyle: '#ffffff', lineWidth: 2 },
                        label: 'BasketWall'
                    });
                    dividers.push(rightWall);
                }

                // Bottom of basket (floor) - make it solid so balls stay
                const basketFloor = Bodies.rectangle(centerX, height - 15, slotWidth - 24, 15, {
                    isStatic: true,
                    render: { fillStyle: color },
                    label: 'BasketFloor'
                });
                dividers.push(basketFloor);
            }
        } else {
            // Original divider logic for winner/loser modes
            for (let i = 1; i < rules.length; i++) {
                const x = 40 + i * slotWidth;
                const divider = Bodies.rectangle(x, height - 65, 8, 100, {
                    isStatic: true,
                    render: { fillStyle: dividerColor },
                    label: 'Divider'
                });
                dividers.push(divider);
            }
        }

        // Slot sensors with theme styling
        const slotColor = this.theme === 'winner' ? 'rgba(255, 215, 0, 0.5)' :
            this.theme === 'loser' ? 'rgba(255, 50, 50, 0.5)' : 'rgba(76, 209, 55, 0.2)';
        const slotStroke = this.theme === 'winner' ? '#ffd700' :
            this.theme === 'loser' ? '#ff4444' : 'transparent';

        for (let i = 0; i < rules.length; i++) {
            const x = 40 + (i * slotWidth) + (slotWidth / 2);
            // For basket mode, place sensor higher so it triggers when ball enters basket
            const sensorY = this.theme === 'basket' ? height - 100 : height - 20;
            const slot = Bodies.rectangle(x, sensorY, slotWidth - 20, 15, {
                isStatic: true,
                isSensor: true,
                render: {
                    fillStyle: slotColor,
                    strokeStyle: slotStroke,
                    lineWidth: this.theme === 'basket' ? 0 : 3
                },
                label: `Slot_${rules[i].id}`
            });
            slots.push(slot);
        }

        World.add(this.engine.world, [...funnelWalls, ...dividers, ...slots]);

        // Collision detection for slots
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const { bodyA, bodyB } = pair;

                const slot = bodyA.label.startsWith('Slot_') ? bodyA : bodyB.label.startsWith('Slot_') ? bodyB : null;
                const ball = bodyA.label.startsWith('Slot_') ? bodyB : bodyA;

                if (slot && ball && !ball.isStatic && ball.label !== 'Circle Body') {
                    const slotId = slot.label.replace('Slot_', '');
                    const participantName = ball.label;
                    const winnerKey = `${participantName}_${slotId}`;

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

        // Rotate bottom pegs clockwise/counter-clockwise alternately to prevent balls from getting stuck
        let oscillationTime = 0;
        this.pegOscillationInterval = setInterval(() => {
            oscillationTime += 0.1;
            this.oscillatingPegs.forEach((pegData, index) => {
                const rotationAmount = Math.PI / 6; // Maximum rotation angle (30 degrees)
                const speed = 2; // oscillation speed
                // Alternate direction: even index = clockwise first, odd index = counter-clockwise first
                const direction = index % 2 === 0 ? 1 : -1;
                const newAngle = Math.sin(oscillationTime * speed + pegData.phase) * rotationAmount * direction;
                Matter.Body.setAngle(pegData.body, newAngle);
            });
        }, 50);

        // Stuck ball detection
        this.stuckCheckInterval = setInterval(() => {
            const bodies = Matter.Composite.allBodies(this.engine.world);
            bodies.forEach(body => {
                if (!body.isStatic && body.label !== 'Circle Body' && body.label !== 'Rectangle Body' && !body.label.startsWith('Slot_')) {
                    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
                    if (speed < 0.5 && body.position.y < this.HEIGHT - 150) {
                        const forceX = (this.rng() - 0.5) * 0.005;
                        const forceY = 0.003 + this.rng() * 0.002;
                        Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });

                        if (speed < 0.1) {
                            Matter.Body.setPosition(body, {
                                x: body.position.x + (this.rng() - 0.5) * 3,
                                y: body.position.y + 2
                            });
                        }
                    }
                }
            });
        }, 500);

        console.log('PhysicsWorld: Simulation started');
    }

    public addDrawnPin(x: number, y: number) {
        const Bodies = Matter.Bodies;
        const World = Matter.World;

        const pinColor = this.theme === 'winner' ? '#ffd700' :
            this.theme === 'loser' ? '#ff4444' : '#ff6b6b';

        const pin = Bodies.circle(x, y, 8, {
            isStatic: true,
            restitution: 0.8,
            friction: 0.0001,
            render: {
                fillStyle: pinColor,
                strokeStyle: '#ffffff',
                lineWidth: 2
            },
            label: 'DrawnPin'
        });

        World.add(this.engine.world, pin);
    }

    public addDrawnLine(x1: number, y1: number, x2: number, y2: number) {
        const Bodies = Matter.Bodies;
        const World = Matter.World;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        const lineColor = this.theme === 'winner' ? '#ffd700' :
            this.theme === 'loser' ? '#ff4444' : '#ff6b6b';

        const line = Bodies.rectangle(centerX, centerY, distance, 8, {
            isStatic: true,
            angle: angle,
            restitution: 0.8,
            friction: 0.0001,
            render: {
                fillStyle: lineColor,
                strokeStyle: '#ffffff',
                lineWidth: 2
            },
            label: 'DrawnLine'
        });

        World.add(this.engine.world, line);
    }

    public removeParticipant(participantName: string) {
        console.log('PhysicsWorld: Removing participant ball:', participantName);
        const bodies = Matter.Composite.allBodies(this.engine.world);

        bodies.forEach(body => {
            if (!body.isStatic && body.label === participantName) {
                Matter.World.remove(this.engine.world, body);
                console.log(`PhysicsWorld: Removed ball for ${participantName}`);
            }
        });
    }

    public stop() {
        console.log('PhysicsWorld: Stopping simulation');

        if (this.stuckCheckInterval) {
            clearInterval(this.stuckCheckInterval);
            this.stuckCheckInterval = null;
        }

        if (this.pegOscillationInterval) {
            clearInterval(this.pegOscillationInterval);
            this.pegOscillationInterval = null;
        }

        Matter.Render.stop(this.render);
        Matter.Runner.stop(this.runner);
        Matter.World.clear(this.engine.world, false);
        Matter.Engine.clear(this.engine);

        const context = this.render.canvas.getContext('2d');
        if (context) {
            context.clearRect(0, 0, this.render.canvas.width, this.render.canvas.height);
        }
    }
}
