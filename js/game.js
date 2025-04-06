// Game variables
let canvas, ctx;
let player;
let hemorrhoids = [];
let projectiles = [];
let particles = [];
let keys = {};
let gameActive = false;
let score = 0;
let lives = 3;
let level = 1;
let lastTime = 0;
let spawnInterval = 2000; // Time between hemorrhoids spawns in ms
let lastSpawnTime = 0;
let enemiesPerLevel = 3; // Base number of hemorrhoids per level
let enemiesRemaining = 0; // Track remaining enemies for level completion
let levelTransition = false; // Flag to track level transitions
let nextLevelTimeout = null; // Timer for level transitions

// Object pools for better performance
const POOL_SIZE = {
    PARTICLES: 200,
    PROJECTILES: 50
};

// Object pools
const particlePool = [];
const projectilePool = [];

// Initialize object pools
function initObjectPools() {
    // Initialize particle pool
    for (let i = 0; i < POOL_SIZE.PARTICLES; i++) {
        particlePool.push(new Particle(0, 0));
    }
    
    // Initialize projectile pool
    for (let i = 0; i < POOL_SIZE.PROJECTILES; i++) {
        projectilePool.push(new Projectile(0, 0, 0));
    }
}

// Constants
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 0.2; // Reduced from 0.3 for slower movement
const PLAYER_ROTATION_SPEED = 0.08; // Reduced from 0.1 for slower rotation
const FRICTION = 0.98;
const PROJECTILE_SPEED = 5;
const HEMORRHOID_COLORS = ['#ff4d4d', '#ff8080', '#ffb3b3'];
const PARTICLE_COLORS = ['#ff4d4d', '#ff8080', '#ffb3b3', '#ffffff'];
const DIFFICULTY_SCALING = {
    SPAWN_RATE: 0.9,  // Multiply spawn interval by this each level
    SPEED_INCREASE: 0.1,  // Reduced from 0.15 for gentler difficulty progression
    MIN_SPAWN_TIME: 800,   // Increased from 500 for slower enemy spawns at higher levels
    BASE_SPAWN_TIME: 3000, // Increased from 2000 for slower initial enemy spawn rate
    SIZE_SCALE: 1.08,      // Reduced from 1.1 for more gradual enemy size increase
};

// Career progression system
const CAREER_RANKS = [
    { level: 1, title: "Medical Volunteer", description: "Just a helpful person with a syringe" },
    { level: 2, title: "Nursing Assistant", description: "Learning the basics of hemorrhoid treatment" },
    { level: 3, title: "Registered Nurse", description: "Skilled in basic procedures" },
    { level: 4, title: "Physician Assistant", description: "Able to handle most hemorrhoid cases" },
    { level: 5, title: "General Practitioner", description: "A qualified doctor with some proctology knowledge" },
    { level: 7, title: "Proctology Resident", description: "Specializing in treating hemorrhoids" },
    { level: 9, title: "Proctologist", description: "An expert in the field" },
    { level: 12, title: "Chief of Proctology", description: "Leading the department" },
    { level: 15, title: "Hemorrhoid Research Fellow", description: "Studying advanced treatments" },
    { level: 18, title: "Master Proctologist", description: "Recognized authority in the field" },
    { level: 20, title: "Legendary Hemorrhoid Hunter", description: "Your name is known worldwide" }
];

// Helper functions
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function getParticleFromPool(x, y) {
    if (particlePool.length > 0) {
        const particle = particlePool.pop();
        particle.reset(x, y);
        return particle;
    }
    return new Particle(x, y);
}

function getProjectileFromPool(x, y, angle) {
    if (projectilePool.length > 0) {
        const projectile = projectilePool.pop();
        projectile.reset(x, y, angle);
        return projectile;
    }
    return new Projectile(x, y, angle);
}

function returnParticleToPool(particle) {
    if (particlePool.length < POOL_SIZE.PARTICLES) {
        particlePool.push(particle);
    }
}

function returnProjectileToPool(projectile) {
    if (projectilePool.length < POOL_SIZE.PROJECTILES) {
        projectilePool.push(projectile);
    }
}

// Game objects
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = PLAYER_SIZE / 2;
        this.angle = 0;
        this.velocity = { x: 0, y: 0 };
        this.thrusting = false;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.blinkTime = 0;
        this.visible = true;
        
        // Add gradient patterns for the player
        this.patterns = {
            glass: null,
            medicine: null,
            metal: null
        };
        
        this.createPatterns();
        this.sprayParticles = [];
        
        // Animation variables
        this.pulsePhase = 0;

        // Optimized hand animation properties
        this.handPosition = 0;
        this.handAnimationSpeed = 0.15; // Slightly faster for snappier feel
        this.isPressingPlunger = false;
        this.handCache = {
            angles: [], // Pre-calculated finger angles
            positions: [] // Pre-calculated positions
        };
        
        // Pre-calculate hand angles and positions
        for (let i = 0; i < 3; i++) {
            this.handCache.angles.push(-0.3 + (i * 0.3));
        }
        this.handCache.thumbAngle = Math.PI * 0.7;
    }
    
    createPatterns() {
        // Create patterns for syringe rendering
        if (ctx) {
            // Glass pattern for syringe body
            const glassGradient = ctx.createLinearGradient(-PLAYER_SIZE, 0, PLAYER_SIZE*1.5, 0);
            glassGradient.addColorStop(0, '#f0f0f0');
            glassGradient.addColorStop(0.2, '#ffffff');
            glassGradient.addColorStop(0.5, '#e0e0e0');
            glassGradient.addColorStop(0.8, '#ffffff');
            glassGradient.addColorStop(1, '#e0e0e0');
            this.patterns.glass = glassGradient;
            
            // Medicine pattern
            const medicineGradient = ctx.createLinearGradient(-PLAYER_SIZE*0.9, 0, PLAYER_SIZE*0.4, 0);
            medicineGradient.addColorStop(0, '#87ceeb');
            medicineGradient.addColorStop(0.3, '#5f9ea0');
            medicineGradient.addColorStop(0.7, '#87ceeb');
            medicineGradient.addColorStop(1, '#b0e0e6');
            this.patterns.medicine = medicineGradient;
            
            // Metal pattern for needle
            const metalGradient = ctx.createLinearGradient(PLAYER_SIZE/2, 0, PLAYER_SIZE*2, 0);
            metalGradient.addColorStop(0, '#c0c0c0');
            metalGradient.addColorStop(0.3, '#e0e0e0');
            metalGradient.addColorStop(0.6, '#a0a0a0');
            metalGradient.addColorStop(1, '#d0d0d0');
            this.patterns.metal = metalGradient;
        }
    }

    update(deltaTime) {
        // Rotate player
        if (keys['ArrowLeft'] || keys['a']) {
            this.angle -= PLAYER_ROTATION_SPEED;
        }
        if (keys['ArrowRight'] || keys['d']) {
            this.angle += PLAYER_ROTATION_SPEED;
        }

        // Thrust
        this.thrusting = keys['ArrowUp'] || keys['w'];
        if (this.thrusting) {
            this.velocity.x += Math.cos(this.angle) * PLAYER_SPEED;
            this.velocity.y += Math.sin(this.angle) * PLAYER_SPEED;
        }

        // Apply friction
        this.velocity.x *= FRICTION;
        this.velocity.y *= FRICTION;

        // Move player
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Wrap around screen
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        // Handle invulnerability (after getting hit)
        if (this.invulnerable) {
            this.invulnerableTime += deltaTime;
            this.blinkTime += deltaTime;
            
            if (this.blinkTime > 100) {
                this.visible = !this.visible;
                this.blinkTime = 0;
            }
            
            if (this.invulnerableTime > 3000) { // 3 seconds of invulnerability
                this.invulnerable = false;
                this.visible = true;
            }
        }
        
        // Update pulse animation
        this.pulsePhase += deltaTime * 0.002;
        if (this.pulsePhase > Math.PI * 2) {
            this.pulsePhase -= Math.PI * 2;
        }
        
        // Update spray particles
        if (this.thrusting || keys[' ']) {
            // Add new spray particles
            if (Math.random() > 0.7) {
                const angle = this.angle + randomBetween(-0.2, 0.2);
                const speed = randomBetween(1, 3);
                const distance = PLAYER_SIZE * 2;
                
                this.sprayParticles.push({
                    x: this.x + Math.cos(this.angle) * distance,
                    y: this.y + Math.sin(this.angle) * distance,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: randomBetween(20, 40),
                    size: randomBetween(1, 3),
                    color: `rgba(135, 206, 235, ${randomBetween(0.5, 0.9)})`
                });
            }
        }
        
        // Update existing spray particles
        for (let i = this.sprayParticles.length - 1; i >= 0; i--) {
            const particle = this.sprayParticles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            if (particle.life <= 0) {
                this.sprayParticles.splice(i, 1);
            }
        }

        // Improved hand animation with smoother easing
        const targetPosition = this.isPressingPlunger ? 1 : 0;
        const delta = targetPosition - this.handPosition;
        
        // Apply easing for smoother animation
        let easingFactor = this.handAnimationSpeed;
        if (Math.abs(delta) < 0.3) {
            easingFactor *= 0.7; // Slow down as it approaches target
        }
        
        this.handPosition += delta * easingFactor;
        
        // Clamp hand position to avoid floating point errors
        if (Math.abs(delta) < 0.01) {
            this.handPosition = targetPosition;
        }
        
        this.isPressingPlunger = keys[' '];
    }

    draw() {
        if (!this.visible) return;
        
        // Create patterns if not already created
        if (!this.patterns.glass) {
            this.createPatterns();
        }
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw spray particles
        for (let i = 0; i < this.sprayParticles.length; i++) {
            const particle = this.sprayParticles[i];
            
            // Convert particle world coords to local
            const dx = particle.x - this.x;
            const dy = particle.y - this.y;
            const angle = Math.atan2(dy, dx);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Rotate point to match player orientation
            const localX = dist * Math.cos(angle - this.angle);
            const localY = dist * Math.sin(angle - this.angle);
            
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(localX, localY, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Calculate pulse effect (subtle size variation)
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.03;
        
        // Draw syringe body with glass gradient
        ctx.fillStyle = this.patterns.glass;
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        
        // Main syringe barrel with rounded ends
        ctx.beginPath();
        const barrelWidth = PLAYER_SIZE * 1.5;
        const barrelHeight = PLAYER_SIZE * 2/3;
        
        // Draw rounded rectangle for syringe barrel
        const radius = barrelHeight / 3;
        ctx.moveTo(-PLAYER_SIZE + radius, -barrelHeight/2);
        ctx.lineTo(barrelWidth - PLAYER_SIZE - radius, -barrelHeight/2);
        ctx.quadraticCurveTo(barrelWidth - PLAYER_SIZE, -barrelHeight/2, barrelWidth - PLAYER_SIZE, -barrelHeight/2 + radius);
        ctx.lineTo(barrelWidth - PLAYER_SIZE, barrelHeight/2 - radius);
        ctx.quadraticCurveTo(barrelWidth - PLAYER_SIZE, barrelHeight/2, barrelWidth - PLAYER_SIZE - radius, barrelHeight/2);
        ctx.lineTo(-PLAYER_SIZE + radius, barrelHeight/2);
        ctx.quadraticCurveTo(-PLAYER_SIZE, barrelHeight/2, -PLAYER_SIZE, barrelHeight/2 - radius);
        ctx.lineTo(-PLAYER_SIZE, -barrelHeight/2 + radius);
        ctx.quadraticCurveTo(-PLAYER_SIZE, -barrelHeight/2, -PLAYER_SIZE + radius, -barrelHeight/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Plunger end with detailed grip
        ctx.fillStyle = '#cccccc';
        ctx.beginPath();
        ctx.rect(-PLAYER_SIZE*1.2, -PLAYER_SIZE/2, PLAYER_SIZE/5, PLAYER_SIZE);
        ctx.fill();
        ctx.stroke();
        
        // Add grip details to plunger
        ctx.fillStyle = '#aaaaaa';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.rect(-PLAYER_SIZE*1.18, -PLAYER_SIZE/2 + i * PLAYER_SIZE/4, PLAYER_SIZE/5 - 4, PLAYER_SIZE/6);
            ctx.fill();
        }
        
        // Calibration marks on barrel
        ctx.strokeStyle = 'rgba(150,150,150,0.6)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 6; i++) {
            const x = -PLAYER_SIZE + i * PLAYER_SIZE * 0.25;
            ctx.beginPath();
            ctx.moveTo(x, -PLAYER_SIZE/3 + 2);
            ctx.lineTo(x, PLAYER_SIZE/3 - 2);
            ctx.stroke();
            
            // Small ticks
            if (i < 5) {
                const midX = x + PLAYER_SIZE * 0.125;
                ctx.beginPath();
                ctx.moveTo(midX, -PLAYER_SIZE/3 + 4);
                ctx.lineTo(midX, PLAYER_SIZE/3 - 4);
                ctx.stroke();
            }
        }
        
        // Medicine in the syringe with animated appearance
        ctx.fillStyle = this.patterns.medicine;
        ctx.beginPath();
        ctx.rect(-PLAYER_SIZE*0.9, -PLAYER_SIZE/4 * pulseScale, PLAYER_SIZE*1.3, PLAYER_SIZE/2 * pulseScale);
        ctx.fill();
        
        // Add bubbles in the medicine
        for (let i = 0; i < 5; i++) {
            const bubbleX = -PLAYER_SIZE*0.7 + i * PLAYER_SIZE*0.3;
            const bubbleY = (Math.sin(this.pulsePhase + i) * 0.15) * (PLAYER_SIZE/4);
            const bubbleSize = ((i % 3) + 1) * 1.2;
            
            ctx.beginPath();
            ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
        }
        
        // Connection between barrel and needle
        ctx.fillStyle = '#b0b0b0';
        ctx.beginPath();
        ctx.arc(PLAYER_SIZE/2, 0, PLAYER_SIZE/6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Needle part with metallic gradient
        ctx.fillStyle = this.patterns.metal;
        ctx.beginPath();
        ctx.moveTo(PLAYER_SIZE/2 + PLAYER_SIZE/6, -PLAYER_SIZE/10);
        ctx.lineTo(PLAYER_SIZE*1.8, -PLAYER_SIZE/20);
        ctx.lineTo(PLAYER_SIZE*2, 0);
        ctx.lineTo(PLAYER_SIZE*1.8, PLAYER_SIZE/20);
        ctx.lineTo(PLAYER_SIZE/2 + PLAYER_SIZE/6, PLAYER_SIZE/10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Add highlight to needle
        ctx.beginPath();
        ctx.moveTo(PLAYER_SIZE/2 + PLAYER_SIZE/6, -PLAYER_SIZE/15);
        ctx.lineTo(PLAYER_SIZE*1.7, -PLAYER_SIZE/40);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        
        // Draw spray effect when thrusting/shooting with more detail
        if (this.thrusting || keys[' ']) {
            // Create a spray cone
            const sprayStart = PLAYER_SIZE*2;
            const sprayLength = randomBetween(10, 20);
            const sprayWidth = randomBetween(5, 10);
            
            // Create gradient for spray
            const sprayGradient = ctx.createLinearGradient(
                sprayStart, 0, 
                sprayStart + sprayLength, 0
            );
            sprayGradient.addColorStop(0, 'rgba(135, 206, 235, 0.8)');
            sprayGradient.addColorStop(1, 'rgba(135, 206, 235, 0)');
            
            // Draw spray cone
            ctx.beginPath();
            ctx.moveTo(sprayStart, 0);
            ctx.lineTo(sprayStart + sprayLength, -sprayWidth);
            ctx.lineTo(sprayStart + sprayLength + randomBetween(5, 10), 0);
            ctx.lineTo(sprayStart + sprayLength, sprayWidth);
            ctx.closePath();
            ctx.fillStyle = sprayGradient;
            ctx.fill();
            
            // Add individual spray lines for detail
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const angle = randomBetween(-0.4, 0.4);
                const length = randomBetween(sprayLength * 0.7, sprayLength * 1.3);
                ctx.moveTo(sprayStart, 0);
                ctx.lineTo(
                    sprayStart + Math.cos(angle) * length, 
                    Math.sin(angle) * length
                );
            }
            ctx.strokeStyle = 'rgba(135, 206, 235, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Optimized hand drawing with cached values - with bigger hand
        const handX = -PLAYER_SIZE * 1.5; // Moved slightly further left
        const handY = 0;
        const pressDistance = PLAYER_SIZE * 0.25 * this.handPosition; // Increased press distance
        
        ctx.save();
        ctx.translate(pressDistance, 0);
        
        // Draw palm with single operation - increased size by 25%
        ctx.beginPath();
        ctx.ellipse(handX, handY, PLAYER_SIZE * 0.31, PLAYER_SIZE * 0.44, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd5c2';
        ctx.fill();
        
        // Batch finger drawing - longer fingers
        ctx.beginPath();
        const fingerLength = PLAYER_SIZE * 0.5; // Increased from 0.4
        
        for (let i = 0; i < 3; i++) {
            const angle = this.handCache.angles[i];
            const fx = handX + Math.cos(angle) * fingerLength;
            const fy = handY + Math.sin(angle) * fingerLength;
            
            ctx.moveTo(handX, handY);
            ctx.quadraticCurveTo(
                handX + fingerLength * 0.6 * Math.cos(angle), // Adjusted curve
                handY + fingerLength * 0.6 * Math.sin(angle),
                fx, fy
            );
        }
        
        ctx.lineWidth = PLAYER_SIZE * 0.18; // Thicker fingers
        ctx.strokeStyle = '#ffd5c2';
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw thumb with pre-calculated angle - bigger thumb
        const thumbLength = PLAYER_SIZE * 0.38; // Increased from 0.3
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        ctx.quadraticCurveTo(
            handX + thumbLength * 0.6 * Math.cos(this.handCache.thumbAngle),
            handY + thumbLength * 0.6 * Math.sin(this.handCache.thumbAngle),
            handX + Math.cos(this.handCache.thumbAngle) * thumbLength,
            handY + Math.sin(this.handCache.thumbAngle) * thumbLength
        );
        ctx.lineWidth = PLAYER_SIZE * 0.24; // Thicker thumb
        ctx.stroke();
        
        ctx.restore();
        
        ctx.restore();
    }

    shoot() {
        const projectileX = this.x + Math.cos(this.angle) * (PLAYER_SIZE*2);
        const projectileY = this.y + Math.sin(this.angle) * (PLAYER_SIZE*2);
        
        // Create multiple medicine droplet projectiles in a spray pattern
        const SPRAY_COUNT = 3;
        for (let i = 0; i < SPRAY_COUNT; i++) {
            const spreadAngle = this.angle + randomBetween(-0.15, 0.15);
            projectiles.push(getProjectileFromPool(
                projectileX, 
                projectileY, 
                spreadAngle
            ));
        }

        this.isPressingPlunger = true;
    }

    hit() {
        if (this.invulnerable) return;
        
        lives--;
        
        // Use gameCache for DOM operations
        if (gameCache.hudElements && gameCache.hudElements.livesEl) {
            gameCache.hudElements.livesEl.textContent = "LIVES: " + lives;
        } else {
            document.getElementById('lives').textContent = "LIVES: " + lives;
        }
        
        if (lives <= 0) {
            gameOver();
            return;
        }
        
        // Create explosion particles more efficiently
        const particleBurst = Math.min(20, POOL_SIZE.PARTICLES - particles.length);
        for (let i = 0; i < particleBurst; i++) {
            // Add some variation to explosionicles
            const offsetX = randomBetween(-10, 10);
            const offsetY = randomBetween(-10, 10);
            particles.push(getParticleFromPool(this.x + offsetX, this.y + offsetY));
        }
        
        // Reset position and make invulnerable
        this.invulnerable = true;
        this.invulnerableTime = 0;
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.angle = 0;
    }
}

class Hemorrhoid {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius || randomBetween(20, 50);
        // Optimize velocity initialization - reduced speed range for slower movement
        const speed = randomBetween(0.3, 1.0); // Reduced from 0.5-1.5 range
        const angle = Math.random() * Math.PI * 2;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        // Cache color for better performance
        const colorIndex = Math.floor(Math.random() * HEMORRHOID_COLORS.length);
        this.color = HEMORRHOID_COLORS[colorIndex];
        this.innerColor = colorIndex === 0 ? '#cc0000' : HEMORRHOID_COLORS[Math.max(0, colorIndex - 1)];
        this.rotation = 0;
        this.rotationSpeed = randomBetween(-0.02, 0.02);
        // Optimize shape generation
        this.vertices = Math.floor(randomBetween(6, 12));
        this.offsets = [];
        for (let i = 0; i < this.vertices; i++) {
            this.offsets.push(randomBetween(0.7, 1.3));
        }
        // Pre-calculate shape points for better performance
        this.shapePoints = [];
        for (let i = 0; i < this.vertices; i++) {
            const angle = (i / this.vertices) * Math.PI * 2;
            const radius = this.radius * this.offsets[i];
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            this.shapePoints.push({ x, y });
        }
        // Pre-calculate veins
        this.veins = [];
        for (let i = 0; i < this.vertices / 2; i++) {
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI * 2;
            const radius1 = this.radius * 0.8;
            const radius2 = this.radius * 0.2;
            this.veins.push({
                x1: Math.cos(angle1) * radius1,
                y1: Math.sin(angle1) * radius1,
                x2: Math.cos(angle2) * radius2,
                y2: Math.sin(angle2) * radius2
            });
        }
        // Enhanced appearance properties
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = randomBetween(0.01, 0.03);
        // Additional detail parameters
        this.bumps = [];
        this.generateBumps();
        // Surface texture
        this.texturePoints = [];
        this.generateTexturePoints();
        // Glow effect
        this.glowIntensity = randomBetween(0.2, 0.5);
        this.glowSize = this.radius * randomBetween(1.2, 1.5);
        // Pulsating animation effect
        this.pulseAmplitude = randomBetween(0.04, 0.08);
        // Vein animation
        this.veinPhases = [];
        for (let i = 0; i < this.veins.length; i++) {
            this.veinPhases.push(Math.random() * Math.PI * 2);
        }
    }
    generateInnerColor() {
        // Create a slightly darker or redder version of the main color
        const colorIndex = HEMORRHOID_COLORS.indexOf(this.color);
        if (colorIndex === 0) {  // If already the darkest red
            return '#cc0000';
        } else {
            return HEMORRHOID_COLORS[Math.max(0, colorIndex - 1)];
        }
    }
    generateBumps() {
        const bumpCount = Math.floor(this.vertices * 1.5);
        for (let i = 0; i < bumpCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = randomBetween(this.radius * 0.6, this.radius * 0.9);
            const size = randomBetween(this.radius * 0.1, this.radius * 0.25);
            this.bumps.push({
                angle: angle,
                distance: distance,
                size: size,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
    }
    generateTexturePoints() {
        const pointCount = Math.floor(this.radius * 0.7);
        for (let i = 0; i < pointCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = randomBetween(this.radius * 0.3, this.radius * 0.9);
            this.texturePoints.push({
                angle: angle,
                distance: distance,
                size: randomBetween(0.5, 2)
            });
        }
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.rotation += this.rotationSpeed;
        // Wrap around screen
        if (this.x < -this.radius) this.x = canvas.width + this.radius;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = canvas.height + this.radius;
        if (this.y > canvas.height + this.radius) this.y = -this.radius;
        // Update pulse animation
        this.pulsePhase += this.pulseSpeed;
        if (this.pulsePhase > Math.PI * 2) this.pulsePhase -= Math.PI * 2;
        // Update vein animations
        for (let i = 0; i < this.veins.length; i++) {
            this.veinPhases[i] += 0.02;
            if (this.veinPhases[i] > Math.PI * 2) this.veinPhases[i] -= Math.PI * 2;
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        // Calculate current pulse effect
        const pulseFactor = 1 + Math.sin(this.pulsePhase) * this.pulseAmplitude;
        // Draw glow
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.glowSize);
        glowGradient.addColorStop(0, this.color.replace(')', ', ' + this.glowIntensity + ')').replace('rgb', 'rgba'));
        glowGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, this.glowSize, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();
        // Create gradient for main body
        const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * pulseFactor);
        bodyGradient.addColorStop(0, this.innerColor);
        bodyGradient.addColorStop(0.7, this.color);
        bodyGradient.addColorStop(1, this.color);
        // Draw irregular polygon shape with pulsating effect
        ctx.beginPath();
        for (let i = 0; i < this.vertices; i++) {
            const point = this.shapePoints[i];
            // Apply pulse effect to each point
            const radius = Math.hypot(point.x, point.y) * pulseFactor;
            const angle = Math.atan2(point.y, point.x);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                // Use bezier curves for smoother shape
                const prevPoint = this.shapePoints[(i - 1) % this.vertices];
                const prevRadius = Math.hypot(prevPoint.x, prevPoint.y) * pulseFactor;
                const prevAngle = Math.atan2(prevPoint.y, prevPoint.x);
                const prevX = Math.cos(prevAngle) * prevRadius;
                const prevY = Math.sin(prevAngle) * prevRadius;
                // Control point calculation for smooth curve
                const cpX = (prevX + x) / 2 - (y - prevY) * 0.2;
                const cpY = (prevY + y) / 2 + (x - prevX) * 0.2;
                ctx.quadraticCurveTo(cpX, cpY, x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = bodyGradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Draw bumps on surface
        for (let i = 0; i < this.bumps.length; i++) {
            const bump = this.bumps[i];
            // Apply pulsing effect to bumps
            const bumpPulse = 1 + Math.sin(this.pulsePhase + bump.pulseOffset) * 0.2;
            const x = Math.cos(bump.angle) * bump.distance * pulseFactor;
            const y = Math.sin(bump.angle) * bump.distance * pulseFactor;
            const bumpGradient = ctx.createRadialGradient(x, y, 0, x, y, bump.size * bumpPulse);
            bumpGradient.addColorStop(0, this.color);
            bumpGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.beginPath();
            ctx.arc(x, y, bump.size * bumpPulse, 0, Math.PI * 2);
            ctx.fillStyle = bumpGradient;
            ctx.fill();
        }
        // Draw texture points
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        for (let i = 0; i < this.texturePoints.length; i++) {
            const point = this.texturePoints[i];
            const x = Math.cos(point.angle) * point.distance * pulseFactor;
            const y = Math.sin(point.angle) * point.distance * pulseFactor;
            ctx.beginPath();
            ctx.arc(x, y, point.size, 0, Math.PI * 2);
            ctx.fill();
        }
        // Draw vein-like lines inside using pre-calculated veins with animation
        for (let i = 0; i < this.veins.length; i++) {
            const vein = this.veins[i];
            const pulsation = Math.sin(this.veinPhases[i]) * 0.2 + 0.8;
            // Create a pulsating path for the vein
            const controlX = (vein.x1 + vein.x2) / 2 + randomBetween(-5, 5) * pulsation;
            const controlY = (vein.y1 + vein.y2) / 2 + randomBetween(-5, 5) * pulsation;
            // Draw pulsating vein with variable width
            ctx.beginPath();
            ctx.moveTo(vein.x1 * pulseFactor, vein.y1 * pulseFactor);
            ctx.quadraticCurveTo(
                controlX * pulseFactor, 
                controlY * pulseFactor, 
                vein.x2 * pulseFactor, 
                vein.y2 * pulseFactor
            );
            // Variable vein width
            ctx.lineWidth = 0.5 + pulsation * 0.5;
            // Create gradient for vein
            const veinGradient = ctx.createLinearGradient(
                vein.x1 * pulseFactor, vein.y1 * pulseFactor,
                vein.x2 * pulseFactor, vein.y2 * pulseFactor
            );
            veinGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
            veinGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
            veinGradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
            ctx.strokeStyle = veinGradient;
            ctx.stroke();
        }
        ctx.restore();
    }
    split() {
        // Create smaller hemorrhoids if big enough
        if (this.radius > 15) {
            // Track if this is an original hemorrhoid (not already a fragment)
            const isOriginalHemorrhoid = this.isOriginal === true;
            
            // Create two new fragments
            for (let i = 0; i < 2; i++) {
                const newHemorrhoid = new Hemorrhoid(this.x, this.y, this.radius / 2);
                // Mark as NOT an original hemorrhoid
                newHemorrhoid.isOriginal = false;
                // Link back to the original parent (for tracking)
                newHemorrhoid.originalParent = isOriginalHemorrhoid ? this : this.originalParent;
                hemorrhoids.push(newHemorrhoid);
            }
            
            // If this was an original hemorrhoid, track that it has split
            if (isOriginalHemorrhoid) {
                // Store reference to self to track fragments
                this.fragmentsRemaining = 2;
                // We'll keep this in memory but remove from active array
                hemorrhoids.splice(hemorrhoids.indexOf(this), 1);
                return; // Exit early - don't decrement counter yet
            }
            
            // If this was a fragment, update the original parent's counter
            if (this.originalParent && this.originalParent.fragmentsRemaining) {
                // This fragment is gone, but created 2 new ones (net +1)
                this.originalParent.fragmentsRemaining += 1;
            }
        } else {
            // Small fragment destroyed completely
            
            // Update the original parent's counter if this was a fragment
            if (!this.isOriginal && this.originalParent && this.originalParent.fragmentsRemaining) {
                this.originalParent.fragmentsRemaining--;
                
                // If all fragments are now destroyed, decrement level counter
                if (this.originalParent.fragmentsRemaining <= 0) {
                    enemiesRemaining = Math.max(0, enemiesRemaining - 1);
                    updateRemainingCounter();
                }
            } else if (this.isOriginal) {
                // This was an original hemorrhoid destroyed directly
                // (no splitting occurred)
                enemiesRemaining = Math.max(0, enemiesRemaining - 1);
                updateRemainingCounter();
            }
        }
        
        // Create explosion particles
        for (let i = 0; i < 10; i++) {
            particles.push(getParticleFromPool(this.x, this.y));
        }
        
        // Update score
        score += Math.floor(this.radius);
        document.getElementById('score').textContent = "SCORE: " + score.toString().padStart(6, '0');
    }
}

class Projectile {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.velocity = {
            x: Math.cos(angle) * PROJECTILE_SPEED,
            y: Math.sin(angle) * PROJECTILE_SPEED
        };
        this.angle = angle;
        this.radius = 3;
        this.lifespan = 60; // Frames before disappearing
        // Enhanced visual properties
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.2;
        this.trailParticles = [];
        this.lastTrailTime = 0;
        // Color variations for different projectiles
        const colorTypes = [
            { base: '#87ceeb', glow: 'rgba(135, 206, 235, 0.5)' }, // Default blue
            { base: '#80c6ff', glow: 'rgba(128, 198, 255, 0.5)' }, // Light blue
            { base: '#60afff', glow: 'rgba(96, 175, 255, 0.5)' }   // Deeper blue
        ];
        const colorType = colorTypes[Math.floor(Math.random() * colorTypes.length)];
        this.color = colorType.base;
        this.glowColor = colorType.glow;
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.lifespan--;   
        // Update pulse animation
        this.pulsePhase += this.pulseSpeed;
        if (this.pulsePhase > Math.PI * 2) this.pulsePhase -= Math.PI * 2;
        // Create trail particles
        if (this.lastTrailTime++ > 2) { // Create trail every 2 frames
            this.lastTrailTime = 0;
            this.trailParticles.push({
                x: this.x,
                y: this.y,
                size: this.radius * 0.7 * (Math.random() * 0.5 + 0.5),
                alpha: 0.7,
                decay: 0.05 + Math.random() * 0.05
            });
        }
        // Update trail particles
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const trail = this.trailParticles[i];
            trail.alpha -= trail.decay;
            if (trail.alpha <= 0) {
                this.trailParticles.splice(i, 1);
            }
        }
        // Wrap around screen
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }
    draw() {
        // Draw trail particles first (behind the projectile)
        for (const trail of this.trailParticles) {
            ctx.save();
            ctx.globalAlpha = trail.alpha;
            // Draw trail particle with glow
            ctx.beginPath();
            ctx.arc(trail.x, trail.y, trail.size, 0, Math.PI * 2);
            ctx.fillStyle = this.glowColor;
            ctx.fill();
            ctx.restore();
        }
        // Now draw the actual projectile
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        // Pulse effect
        const pulseFactor = Math.sin(this.pulsePhase) * 0.1 + 1;
        // Draw medicine droplet with teardrop shape
        ctx.beginPath();
        ctx.moveTo(0, -3 * pulseFactor);
        ctx.bezierCurveTo(
            4 * pulseFactor, -3 * pulseFactor, 
            4 * pulseFactor, 3 * pulseFactor, 
            0, 3 * pulseFactor
        );
        ctx.bezierCurveTo(
            -4 * pulseFactor, 3 * pulseFactor, 
            -4 * pulseFactor, -3 * pulseFactor, 
            0, -3 * pulseFactor
        );
        // Create gradient fill for droplet
        const dropGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 4 * pulseFactor);
        dropGradient.addColorStop(0, '#ffffff');
        dropGradient.addColorStop(0.3, this.color);
        dropGradient.addColorStop(1, this.color);
        ctx.fillStyle = dropGradient;
        ctx.fill();
        // Add inner highlights
        ctx.beginPath();
        ctx.arc(-1, -1, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
        // Add glow effect
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 8 * pulseFactor);
        glow.addColorStop(0, this.glowColor);
        glow.addColorStop(1, 'rgba(135, 206, 235, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, 8 * pulseFactor, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.restore();
    }
    reset(x, y, angle) {
        this.x = x;
        this.y = y;
        this.velocity = {
            x: Math.cos(angle) * PROJECTILE_SPEED,
            y: Math.sin(angle) * PROJECTILE_SPEED
        };
        this.angle = angle;
        this.lifespan = 60;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.trailParticles = [];
        this.lastTrailTime = 0;
        // Randomize color again for variety
        const colorTypes = [
            { base: '#87ceeb', glow: 'rgba(135, 206, 235, 0.5)' },
            { base: '#80c6ff', glow: 'rgba(128, 198, 255, 0.5)' },
            { base: '#60afff', glow: 'rgba(96, 175, 255, 0.5)' }
        ];
        const colorType = colorTypes[Math.floor(Math.random() * colorTypes.length)];
        this.color = colorType.base;
        this.glowColor = colorType.glow;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocity = {
            x: randomBetween(-3, 3),
            y: randomBetween(-3, 3)
        };
        this.radius = randomBetween(1, 3);
        this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        this.lifespan = 60; // Frames before disappearing
        this.alpha = 1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = randomBetween(-0.1, 0.1);
        // Enhanced visual properties
        this.shape = Math.random() > 0.7 ? 'circle' : 'spark';
        this.trail = [];
        this.maxTrailLength = Math.floor(randomBetween(3, 8));
        this.glow = Math.random() > 0.5;
        this.hasPulse = Math.random() > 0.7;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = randomBetween(0.1, 0.2);
    }
    update() {
        // Store current position for trail
        if (this.trail.length >= this.maxTrailLength) {
            this.trail.shift();
        }
        this.trail.push({ x: this.x, y: this.y, alpha: this.alpha * 0.7 });
        // Update position with velocity
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        // Apply drag and gravity effect for more realistic movement
        this.velocity.x *= 0.97;
        this.velocity.y *= 0.97;
        this.velocity.y += 0.02; // Slight gravity
        // Update rotation
        this.rotation += this.rotationSpeed;
        // Update pulse if applicable
        if (this.hasPulse) {
            this.pulsePhase += this.pulseSpeed;
            if (this.pulsePhase > Math.PI * 2) this.pulsePhase -= Math.PI * 2;
        }
        // Update lifespan and alpha
        this.lifespan--;
        this.alpha = this.lifespan / 60;
        // Shrink particle as it ages
        if (this.lifespan < 30) {
            this.radius *= 0.99;
        }
    }
    draw() {
        ctx.save();
        // Draw trail first (underneath particle)
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            ctx.globalAlpha = t.alpha * 0.5;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.radius * (i / this.trail.length), 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        // Draw particle
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        // Apply pulse effect if applicable
        let scaleFactor = 1;
        if (this.hasPulse) {
            scaleFactor = 1 + Math.sin(this.pulsePhase) * 0.2;
        }
        // Draw different particle shapes
        if (this.shape === 'circle') {
            // Draw circular particle with gradient
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * scaleFactor);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, this.color);
            gradient.addColorStop(1, this.color.replace('rgb', 'rgba').replace(')', ', 0)'));
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * scaleFactor, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            // Add glow for more visual impact
            if (this.glow) {
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 2 * scaleFactor, 0, Math.PI * 2);
                ctx.fillStyle = this.color.replace('rgb', 'rgba').replace(')', ', 0.2)');
                ctx.fill();
            }
        } else {
            // Draw star/spark shape
            ctx.beginPath();
            const spikes = 4;
            const outerRadius = this.radius * 1.5 * scaleFactor;
            const innerRadius = this.radius * 0.5 * scaleFactor;
            for (let i = 0; i < spikes * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i / (spikes * 2)) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
            // Add inner highlight
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = this.alpha * 0.8;
            ctx.fill();
        }
        ctx.restore();
    }
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.velocity = {
            x: randomBetween(-3, 3),
            y: randomBetween(-3, 3)
        };
        this.radius = randomBetween(1, 3);
        this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        this.lifespan = 60;
        this.alpha = 1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = randomBetween(-0.1, 0.1);
        // Reset enhanced visual properties
        this.shape = Math.random() > 0.7 ? 'circle' : 'spark';
        this.trail = [];
        this.maxTrailLength = Math.floor(randomBetween(3, 8));
        this.glow = Math.random() > 0.5;
        this.hasPulse = Math.random() > 0.7;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }
}

// Spatial partitioning for efficient collision detection
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.grid = {};
    }
    // Reset grid
    clear() {
        this.grid = {};
    }
    // Get cell ID from position
    getCellId(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }
    // Insert object into grid
    insert(object) {
        const cellId = this.getCellId(object.x, object.y);
        if (!this.grid[cellId]) {
            this.grid[cellId] = [];
        }
        this.grid[cellId].push(object);
    }
    // Get potential collision candidates for an object
    getPotentialCollisions(object) {
        const cellId = this.getCellId(object.x, object.y);
        return this.grid[cellId] || [];
    }
    // Update the grid size (for window resizing)
    updateSize(width, height) {
        this.width = width;
        this.height = height;
    }
}

class Background {
    constructor() {
        this.microbes = []; // Was "stars"
        this.tissueStructures = []; // Was "nebulae"
        this.microbesCanvas = document.createElement('canvas');
        this.microbesContext = this.microbesCanvas.getContext('2d');
        this.initMicrobes(300);
        this.initTissueStructures(0); // Changed from 3 to 0 to remove tissue structures
        this.renderMicrobesToCanvas(); // Pre-render for better performance
    }
    // Initialize canvas for microbes
    initCanvas() {
        this.microbesCanvas.width = canvas.width;
        this.microbesCanvas.height = canvas.height;
    }
    // Initialize microbes (bacteria, viruses, etc.) - replacing stars
    initMicrobes(count) {
        this.microbes = [];
        const MICROBE_TYPES = ['bacteria', 'virus', 'bloodCell', 'whiteCell', 'platelet'];
        this.microbes = [];
        for (let i = 0; i < count; i++) {
            const type = MICROBE_TYPES[Math.floor(Math.random() * MICROBE_TYPES.length)];
            const redBloodColor = `rgba(${200 + Math.floor(Math.random() * 55)}, ${Math.floor(Math.random() * 40)}, ${Math.floor(Math.random() * 40)}, ${Math.random() * 0.3 + 0.7})`;
            const whiteBloodColor = `rgba(${220 + Math.floor(Math.random() * 35)}, ${220 + Math.floor(Math.random() * 35)}, ${225 + Math.floor(Math.random() * 30)}, ${Math.random() * 0.3 + 0.7})`;
            const bacteriaColor = `rgba(${100 + Math.floor(Math.random() * 50)}, ${170 + Math.floor(Math.random() * 60)}, ${100 + Math.floor(Math.random() * 50)}, ${Math.random() * 0.5 + 0.5})`;
            this.microbes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 0.8,
                speed: Math.random() * 0.3 + 0.1,
                type: type,
                color: type === 'bloodCell' ? redBloodColor : 
                       type === 'whiteCell' ? whiteBloodColor : 
                       type === 'platelet' ? 'rgba(255, 246, 185, 0.8)' : 
                       bacteriaColor,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() * 0.02) - 0.01
            });
        }
    }
    // Initialize tissue structures - replacing nebulae
    initTissueStructures(count) {
        this.tissueStructures = [];
        const TISSUE_TYPES = ['membrane', 'vessel', 'tissue'];
        this.tissueStructures = [];
        for (let i = 0; i < count; i++) {
            const tissueType = TISSUE_TYPES[Math.floor(Math.random() * TISSUE_TYPES.length)];
            const centerX = Math.random() * canvas.width;
            const centerY = Math.random() * canvas.height;
            const size = Math.random() * 600 + 400;
            const opacity = Math.random() * 0.1 + 0.05;
            // Colors based on tissue types with more vibrant gradients
            let color, secondaryColor;
            if (tissueType === 'membrane') {
                // Pink/flesh membrane colors with more saturation
                color = `hsla(${10 + Math.floor(Math.random() * 20)}, 80%, 80%, ${opacity + 0.05})`;
                secondaryColor = `hsla(${5 + Math.floor(Math.random() * 10)}, 85%, 75%, ${opacity * 1.5})`;
            } else if (tissueType === 'vessel') {
                // Blood vessel colors with deeper reds
                color = `hsla(${350 + Math.floor(Math.random() * 20)}, 95%, 40%, ${opacity + 0.05})`;
                secondaryColor = `hsla(${340 + Math.floor(Math.random() * 15)}, 100%, 30%, ${opacity * 1.5})`;
            } else {
                // Generic tissue colors with warmer tones
                color = `hsla(${15 + Math.floor(Math.random() * 15)}, 90%, 70%, ${opacity + 0.03})`;
                secondaryColor = `hsla(${20 + Math.floor(Math.random() * 10)}, 85%, 65%, ${opacity * 1.3})`;
            }
            // Add pulsation and animation parameters
            this.tissueStructures.push({
                x: centerX,
                y: centerY,
                size: size,
                color: color,
                secondaryColor: secondaryColor,
                type: tissueType,
                points: this.generateTissuePoints(tissueType === 'vessel' ? 8 : 12, 0.4),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() * 0.0002) - 0.0001,
                pulsePhase: Math.random() * Math.PI * 2,
                pulseSpeed: Math.random() * 0.005 + 0.002,
                pulseAmplitude: Math.random() * 0.05 + 0.02,
                detailPoints: this.generateDetailPoints(tissueType, size)
            });
        }
    }
    // Add the missing generateTissuePoints method
    generateTissuePoints(count, irregularity) {
        const points = [];
        const angleStep = (Math.PI * 2) / count;
        for (let i = 0; i < count; i++) {
            // Base angle plus some randomness
            const angle = i * angleStep + randomBetween(-angleStep/4, angleStep/4);
            // Distance from center with some irregularity
            const distance = 1.0 - (irregularity * randomBetween(0, 0.5));
            points.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance
            });
        }
        return points;
    }
    // Generate detail points for different tissue types
    generateDetailPoints(tissueType, size) {
        const points = [];
        const count = tissueType === 'vessel' ? 
            Math.floor(size / 50) : 
            Math.floor(size / 40);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 0.7 + 0.1; // Between 0.1 and 0.8 of radius
            points.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: Math.random() * 0.1 + 0.05,
                type: Math.random() > 0.7 ? 'cell' : 'fiber',
                angle: Math.random() * Math.PI * 2,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
        return points;
    }
    // Pre-render microbes to a separate canvas for performance
    renderMicrobesToCanvas() {
        this.initCanvas();
        const ctx = this.microbesContext;
        ctx.clearRect(0, 0, this.microbesCanvas.width, this.microbesCanvas.height);
        for (let i = 0; i < this.microbes.length; i++) {
            const microbe = this.microbes[i];
            // Store original position for movement calculations
            microbe.originalY = microbe.y;
            ctx.save();
            ctx.translate(microbe.x, microbe.y);
            ctx.rotate(microbe.rotation);
            switch (microbe.type) {
                case 'bloodCell':
                    // Red blood cell - concave disc shape
                    this.drawBloodCell(ctx, microbe);
                    break;
                case 'whiteCell':
                    // White blood cell - larger with nucleus
                    this.drawWhiteCell(ctx, microbe);
                    break;
                case 'platelet':
                    // Platelet - small irregular shape
                    this.drawPlatelet(ctx, microbe);
                    break;
                case 'bacteria':
                    // Bacteria - rod shape
                    this.drawBacteria(ctx, microbe);
                    break;
                case 'virus':
                    // Virus - small with spikes
                    this.drawVirus(ctx, microbe);
                    break;
                default:
                    // Generic circle as fallback
                    ctx.beginPath();
                    ctx.arc(0, 0, microbe.size, 0, Math.PI * 2);
                    ctx.fillStyle = microbe.color;
                    ctx.fill();
            }
            ctx.restore();
        }
    }
    // Helper method to draw a red blood cell
    drawBloodCell(ctx, microbe) {
        const size = microbe.size * 3; // Red blood cells are larger
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = microbe.color;
        ctx.fill();
        // Draw the characteristic concave center
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 0, 0, 0.4)`;
        ctx.fill();
    }
    // Helper method to draw a white blood cell
    drawWhiteCell(ctx, microbe) {
        const size = microbe.size * 4; // White blood cells are larger
        // Draw cell body
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = microbe.color;
        ctx.fill();
        // Draw nucleus
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 200, 240, 0.8)';
        ctx.fill();
    }
    // Helper method to draw a platelet
    drawPlatelet(ctx, microbe) {
        const size = microbe.size * 1.5; 
        // Draw irregular platelet shape
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 2, size, 0, 0, Math.PI * 2);
        ctx.fillStyle = microbe.color;
        ctx.fill();
    }
    // Helper method to draw a bacteria
    drawBacteria(ctx, microbe) {
        const size = microbe.size * 2;
        // Draw rod-shaped bacteria
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 2, size, 0, 0, Math.PI * 2);
        ctx.fillStyle = microbe.color;
        ctx.fill();
        // Add details
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc((i-1) * size * 0.7, 0, size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fill();
        }
    }
    // Helper method to draw a virus
    drawVirus(ctx, microbe) {
        const size = microbe.size * 1.8;
        // Draw central body
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 100, 140, 0.7)';
        ctx.fill();
        // Draw spikes
        const spikeCount = 8;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * size, Math.sin(angle) * size);
            ctx.lineTo(Math.cos(angle) * size * 1.5, Math.sin(angle) * size * 1.5);
            ctx.lineWidth = size * 0.3;
            ctx.strokeStyle = 'rgba(100, 100, 140, 0.5)';
            ctx.stroke();
        }
    }
    update() {
        // Check if canvas size changed
        if (this.microbesCanvas.width !== canvas.width || this.microbesCanvas.height !== canvas.height) {
            this.renderMicrobesToCanvas(); // Re-render if canvas resized
        }
        // Update microbe positions
        for (let i = 0; i < this.microbes.length; i++) {
            const microbe = this.microbes[i];
            microbe.y += microbe.speed;
            microbe.rotation += microbe.rotationSpeed;
            // Reset microbes that go off-screen
            if (microbe.y > canvas.height) {
                microbe.y = 0;
                microbe.x = Math.random() * canvas.width;
                // Update microbe in the pre-rendered canvas
                this.updateMicrobePosition(i);
            }
        }
        // Update tissue structures
        for (let i = 0; i < this.tissueStructures.length; i++) {
            this.tissueStructures[i].rotation += this.tissueStructures[i].rotationSpeed;
        }
    }
    // Update a single microbe's position
    updateMicrobePosition(index) {
        const microbe = this.microbes[index];
        const ctx = this.microbesContext;
        // Clear the old position (with some margin)
        ctx.clearRect(
            microbe.x - microbe.size * 5, 
            microbe.originalY - microbe.size * 5, 
            microbe.size * 10, 
            microbe.size * 10
        );
        // Draw at the new position
        ctx.save();
        ctx.translate(microbe.x, microbe.y);
        ctx.rotate(microbe.rotation);
        switch (microbe.type) {
            case 'bloodCell': 
                this.drawBloodCell(ctx, microbe);
                break;
            case 'whiteCell':
                this.drawWhiteCell(ctx, microbe);
                break;
            case 'platelet':
                this.drawPlatelet(ctx, microbe);
                break;
            case 'bacteria':
                this.drawBacteria(ctx, microbe);
                break;
            case 'virus':
                this.drawVirus(ctx, microbe);
                break;
            default:
                ctx.beginPath();
                ctx.arc(0, 0, microbe.size, 0, Math.PI * 2);
                ctx.fillStyle = microbe.color;
                ctx.fill();
        }
        ctx.restore();
        
        // Update the original position
        microbe.originalY = microbe.y;
    }
    draw() {
        // Draw the pre-rendered microbes
        ctx.drawImage(this.microbesCanvas, 0, 0);
        // Draw tissue structures
        for (let i = 0; i < this.tissueStructures.length; i++) {
            const tissue = this.tissueStructures[i];
            ctx.save();
            ctx.translate(tissue.x, tissue.y);
            ctx.rotate(tissue.rotation);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, tissue.size / 2);
            gradient.addColorStop(0, tissue.color);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            // Draw tissue structure
            ctx.beginPath();
            ctx.moveTo(
                tissue.points[0].x * tissue.size / 2,
                tissue.points[0].y * tissue.size / 2
            );
            // Draw points based on tissue type
            if (tissue.type === 'vessel') {
                // Draw more tube-like structure for vessels
                this.drawVesselStructure(ctx, tissue, gradient);
            } else {
                // Draw more irregular structure for membranes/tissues
                this.drawMembraneTissue(ctx, tissue, gradient);
            }
            ctx.restore();
        }
    }
    // Helper method to draw vessel structure
    drawVesselStructure(ctx, tissue, gradient) {
        // Calculate pulse factor for animation
        const pulseFactor = 1 + Math.sin(tissue.pulsePhase) * tissue.pulseAmplitude;
        tissue.pulsePhase += tissue.pulseSpeed; // Update pulse
        // Create tube-like structure for blood vessels
        const pointCount = tissue.points.length;
        const innerRadius = tissue.size * 0.25; // Inner lumen of vessel
        // Create curved path for the vessel wall
        ctx.beginPath();
        // Draw the outer wall path with smooth curves
        for (let i = 0; i < pointCount; i++) {
            const point = tissue.points[i];
            const nextPoint = tissue.points[(i + 1) % pointCount];
            // Calculate pulsing points
            const x1 = point.x * tissue.size * 0.5 * pulseFactor;
            const y1 = point.y * tissue.size * 0.5 * pulseFactor;
            const x2 = nextPoint.x * tissue.size * 0.5 * pulseFactor;
            const y2 = nextPoint.y * tissue.size * 0.5 * pulseFactor;
            // Create control points for bezier curve
            const cpX = (x1 + x2) / 2 - (y2 - y1) * 0.3;
            const cpY = (y1 + y2) / 2 + (x2 - x1) * 0.3;
            if (i === 0) {
                ctx.moveTo(x1, y1);
            } else {
                ctx.quadraticCurveTo(cpX, cpY, x2, y2);
            }
        }
        ctx.closePath();
        // Create vibrant gradient for vessel wall
        const wallGradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, tissue.size * 0.5);
        wallGradient.addColorStop(0, tissue.color);
        wallGradient.addColorStop(0.7, tissue.secondaryColor);
        wallGradient.addColorStop(1, 'rgba(120, 0, 0, 0.1)');
        ctx.fillStyle = wallGradient;
        ctx.fill();
        // Add a subtle glow effect
        ctx.shadowColor = tissue.secondaryColor.replace('hsla', 'rgba').replace(/[\d.]+\)$/g, '0.4)');
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Draw blood vessel inner lumen with different color
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * pulseFactor, 0, Math.PI * 2);
        // Inner lumen gradient
        const lumenGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius * pulseFactor);
        lumenGradient.addColorStop(0, 'rgba(180, 0, 0, 0.4)');
        lumenGradient.addColorStop(0.7, 'rgba(120, 0, 0, 0.25)');
        lumenGradient.addColorStop(1, 'rgba(100, 0, 0, 0.1)');
        ctx.fillStyle = lumenGradient;
        ctx.fill();
        // Draw "blood cells" in the vessel
        this.drawVesselDetails(ctx, tissue, innerRadius * pulseFactor);
    }
    // Draw details inside vessels like blood cells
    drawVesselDetails(ctx, tissue, radius) {
        // Draw flowing blood cells effect
        const cellCount = Math.floor(radius / 3);
        const time = Date.now() / 1000;
        for (let i = 0; i < cellCount; i++) {
            // Position cells to move in circular pattern within vessel
            const angle = (time * 0.5 + i * Math.PI * 2 / cellCount) % (Math.PI * 2);
            const distance = Math.random() * radius * 0.7; // Between 0.1 and 0.8 of radius
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const size = radius * 0.15;
            // Draw different cell types
            if (i % 3 === 0) {
                // Red blood cell
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 0, 0, 0.7)';
                ctx.fill();
                // Add concave center to red blood cell
                ctx.beginPath();
                ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(150, 0, 0, 0.7)';
                ctx.fill();
            } else {
                // White blood cell or platelet
                ctx.beginPath();
                ctx.arc(x, y, i % 2 === 0 ? size * 1.2 : size * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 240, 0.5)' : 'rgba(255, 230, 150, 0.6)';
                ctx.fill();
            }
        }
    }
    // Helper method to draw membrane or tissue
    drawMembraneTissue(ctx, tissue, gradient) {
        // Calculate pulse factor for animation
        const pulseFactor = 1 + Math.sin(tissue.pulsePhase) * tissue.pulseAmplitude;
        tissue.pulsePhase += tissue.pulseSpeed; // Update pulse
        // Draw organic tissue structure with detailed edges
        const points = tissue.points;
        const pointCount = points.length;
        // Create main tissue shape path
        ctx.beginPath();
        // Draw the outer edge with smooth curves
        for (let i = 0; i < pointCount; i++) {
            const point = points[i];
            const nextPoint = points[(i + 1) % pointCount];
            // Calculate pulsing points
            const x1 = point.x * tissue.size * 0.5 * pulseFactor;
            const y1 = point.y * tissue.size * 0.5 * pulseFactor;
            const x2 = nextPoint.x * tissue.size * 0.5 * pulseFactor;
            const y2 = nextPoint.y * tissue.size * 0.5 * pulseFactor;
            // Create control points for bezier curve with more variation
            const controlVar = tissue.type === 'membrane' ? 0.4 : 0.2;
            const cpX = (x1 + x2) / 2 - (y2 - y1) * controlVar * (Math.sin(tissue.pulsePhase + i) * 0.3 + 0.7);
            const cpY = (y1 + y2) / 2 + (x2 - x1) * controlVar * (Math.cos(tissue.pulsePhase + i * 0.7) * 0.3 + 0.7);
            if (i === 0) {
                ctx.moveTo(x1, y1);
            } else {
                ctx.quadraticCurveTo(cpX, cpY, x2, y2);
            }
        }
        ctx.closePath();
        
        // Create enhanced gradient for tissue
        const tissueGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, tissue.size * 0.5);
        tissueGradient.addColorStop(0, tissue.color);
        tissueGradient.addColorStop(0.5, tissue.secondaryColor);
        tissueGradient.addColorStop(1, 'rgba(255, 230, 230, 0.05)');
        // Apply gradient with subtle glow
        ctx.fillStyle = tissueGradient;
        ctx.shadowColor = tissue.color.replace('hsla', 'rgba').replace(/[\d.]+\)$/g, '0.3)');
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Draw tissue texture details
        this.drawTissueTexture(ctx, tissue, pulseFactor);
    }
    // Draw detailed texture patterns for tissues
    drawTissueTexture(ctx, tissue, pulseFactor) {
        const detailPoints = tissue.detailPoints;
        const time = Date.now() / 1000;
        // Different visual styles based on tissue type
        if (tissue.type === 'membrane') {
            // For membranes - draw "pores" and tissue fibers
            // Draw pores
            for (let i = 0; i < detailPoints.length; i++) {
                const point = detailPoints[i];
                if (point.type === 'cell') {
                    const x = point.x * tissue.size * 0.5 * pulseFactor;
                    const y = point.y * tissue.size * 0.5 * pulseFactor;
                    const size = point.size * tissue.size * 0.05 * (Math.sin(time + point.pulseOffset) * 0.2 + 0.8);
                    // Pore
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(240, 220, 220, 0.2)';
                    ctx.fill();
                    // Pore rim
                    ctx.beginPath();
                    ctx.arc(x, y, size * 1.3, 0, Math.PI * 2);
                    ctx.lineWidth = size * 0.5;
                    ctx.strokeStyle = 'rgba(180, 150, 150, 0.15)';
                    ctx.stroke();
                }
            }
            // Draw membrane fibers
            ctx.beginPath();
            for (let i = 0; i < detailPoints.length; i++) {
                const point = detailPoints[i];
                if (point.type === 'fiber') {
                    // Create curved fibers
                    const x = point.x * tissue.size * 0.5 * pulseFactor;
                    const y = point.y * tissue.size * 0.5 * pulseFactor;
                    const angle = point.angle;
                    const length = point.size * tissue.size * 0.15;
                    const x2 = x + Math.cos(angle) * length;
                    const y2 = y + Math.sin(angle) * length;
                    const cpX = x + Math.cos(angle + Math.PI/4) * length * 0.6;
                    const cpY = y + Math.sin(angle + Math.PI/4) * length * 0.6;
                    ctx.moveTo(x, y);
                    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
                }
            }
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 240, 240, 0.1)';
            ctx.stroke();
        } else {
            // For general tissue - draw cells and connective structure
            // Draw tissue cells
            for (let i = 0; i < detailPoints.length; i++) {
                const point = detailPoints[i];
                const x = point.x * tissue.size * 0.5 * pulseFactor;
                const y = point.y * tissue.size * 0.5 * pulseFactor;
                const size = point.size * tissue.size * 0.03 * (Math.sin(time + point.pulseOffset) * 0.2 + 0.8);
                // Cell
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                // Alternate between different cell types
                if (i % 3 === 0) {
                    // Lighter cell
                    ctx.fillStyle = 'rgba(255, 230, 230, 0.15)';
                } else if (i % 3 === 1) {
                    // Darker cell
                    ctx.fillStyle = 'rgba(160, 120, 120, 0.1)';
                } else {
                    // Medium cell
                    ctx.fillStyle = 'rgba(200, 180, 180, 0.12)';
                }
                ctx.fill();
                // Occasional "nucleus" in larger cells
                if (size > tissue.size * 0.02 && i % 4 === 0) {
                    ctx.beginPath();
                    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(120, 100, 100, 0.15)';
                    ctx.fill();
                }
            }
            // Draw connective tissue fibers
            ctx.beginPath();
            const fiberCount = Math.floor(detailPoints.length / 2);
            for (let i = 0; i < fiberCount; i++) {
                const idx1 = Math.floor(Math.random() * detailPoints.length);
                const idx2 = Math.floor(Math.random() * detailPoints.length);
                if (idx1 !== idx2) {
                    const p1 = detailPoints[idx1];
                    const p2 = detailPoints[idx2];
                    const x1 = p1.x * tissue.size * 0.5 * pulseFactor;
                    const y1 = p1.y * tissue.size * 0.5 * pulseFactor;
                    const x2 = p2.x * tissue.size * 0.5 * pulseFactor;
                    const y2 = p2.y * tissue.size * 0.5 * pulseFactor;
                    // Don't connect points that are too far apart
                    const dist = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
                    if (dist < tissue.size * 0.3) {
                        const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * dist * 0.3;
                        const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * dist * 0.3;
                        ctx.moveTo(x1, y1);
                        ctx.quadraticCurveTo(midX, midY, x2, y2);
                    }
                }
            }
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'rgba(180, 160, 160, 0.07)';
            ctx.stroke();
        }
    }
}

// Game initialization cache to avoid re-allocating objects
const gameCache = {
    hudElements: null
};

// Game functions
function startGame() {
    // Cache DOM elements for better performance
    if (!gameCache.hudElements) {
        gameCache.hudElements = {
            menuScreen: document.getElementById('menu-screen'),
            gameScreen: document.getElementById('game-screen'),
            gameOver: document.getElementById('game-over'),
            scoreEl: document.getElementById('score'),
            livesEl: document.getElementById('lives'),
            levelEl: document.getElementById('level'),
        };
    }
    // Hide menu screen and show game screen
    gameCache.hudElements.menuScreen.style.display = 'none';
    gameCache.hudElements.gameScreen.style.display = 'block';
    gameCache.hudElements.gameOver.style.display = 'none';
    
    // Reset game variables using object destructuring for cleaner code
    hemorrhoids = [];
    projectiles = [];
    particles = [];
    
    // Set initial game state
    Object.assign(window, {
        score: 0,
        lives: 3,
        level: 1,
        lastSpawnTime: 0,
        spawnInterval: DIFFICULTY_SCALING.BASE_SPAWN_TIME,
        enemiesPerLevel: 3,
        enemiesRemaining: 0,
        levelTransition: false,
        nextLevelTimeout: null
    });
    
    // Create player at center of screen
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    player = new Player(centerX, centerY);
    
    // Lazy initialization of object pools only when needed
    initObjectPools();
    
    // Create optimized spatial grid based on screen size
    const cellSize = Math.max(50, Math.min(canvas.width, canvas.height) / 20);
    spatialGrid = new SpatialGrid(canvas.width, canvas.height, cellSize);
    
    // Initialize background with optimizations
    background = new Background();
    
    // Start first level
    startLevel(level);
    
    // Start game loop with performance optimizations
    gameActive = true;
    updateHUD();
    
    // Use high-performance timestamp for game loop
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    
    // Hide game screen
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) gameScreen.style.display = 'none';
    
    // Show game over screen
    const gameOverScreen = document.getElementById('game-over');
    if (gameOverScreen) {
        gameOverScreen.style.display = 'block';
        
        // Update final score
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) {
            finalScoreEl.textContent = score.toString().padStart(6, '0');
        }
    }
}

function spawnHemorrhoid() {
    // Spawn hemorrhoids outside the player's immediate vicinity
    let x, y;
    const safeDist = 100;
    do {
        if (Math.random() > 0.5) {
            x = Math.random() > 0.5 ? 0 - 50 : canvas.width + 50;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() > 0.5 ? 0 - 50 : canvas.height + 50;
        }
    } while (
        Math.hypot(player.x - x, player.y - y) < safeDist
    );
    
    const hemorrhoid = new Hemorrhoid(x, y);
    
    // Apply level-based difficulty scaling
    const speedScale = 1 + (DIFFICULTY_SCALING.SPEED_INCREASE * (level - 1));
    hemorrhoid.velocity.x *= speedScale;
    hemorrhoid.velocity.y *= speedScale;
    
    // Scale size with level (max 50% larger)
    const sizeScale = Math.min(Math.pow(DIFFICULTY_SCALING.SIZE_SCALE, level - 1), 1.5);
    hemorrhoid.radius *= sizeScale;
    
    // Flag this as an original hemorrhoid (not a split one)
    hemorrhoid.isOriginal = true;
    
    // Initialize tracking fields
    hemorrhoid.fragmentsRemaining = 0; // Will be set when it splits
    
    hemorrhoids.push(hemorrhoid);
}

function checkCollisions() {
    // Clear and rebuild spatial grid
    spatialGrid.clear();
    
    // Insert hemorrhoids into grid
    for (let i = 0; i < hemorrhoids.length; i++) {
        spatialGrid.insert(hemorrhoids[i]);
    }
    
    // Check projectile-hemorrhoid collisions using spatial partitioning
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        const potentialCollisions = spatialGrid.getPotentialCollisions(projectile);
        
        for (let j = 0; j < potentialCollisions.length; j++) {
            const hemorrhoid = potentialCollisions[j];
            // Skip if this isn't a hemorrhoid object
            if (!hemorrhoid.radius) continue;
            
            if (Math.hypot(
                projectile.x - hemorrhoid.x,
                projectile.y - hemorrhoid.y
            ) < hemorrhoid.radius + projectile.radius) {
                // Remove projectile
                returnProjectileToPool(projectiles.splice(i, 1)[0]);
                // Split hemorrhoid
                const idx = hemorrhoids.indexOf(hemorrhoid);
                if (idx !== -1) {
                    hemorrhoid.split();
                    hemorrhoids.splice(idx, 1);
                }
                // Break to avoid checking this projectile against other hemorrhoids
                break;
            }
        }
    }
    
    // Check player-hemorrhoid collisions
    if (!player.invulnerable) {
        const potentialCollisions = spatialGrid.getPotentialCollisions(player);
        for (let i = 0; i < potentialCollisions.length; i++) {
            const hemorrhoid = potentialCollisions[i];
            // Skip if this isn't a hemorrhoid object
            if (!hemorrhoid.radius) continue;
            
            if (Math.hypot(
                player.x - hemorrhoid.x,
                player.y - hemorrhoid.y
            ) < player.radius + hemorrhoid.radius * 0.7) {
                player.hit();
                // Only break if player is dead
                if (lives <= 0) break;
            }
        }
    }
}

function levelUp() {
    level++;
    // Instead of directly updating HUD and spawning, use startLevel for consistency
    startLevel(level);
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    if (!gameActive) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw background
    background.update();
    background.draw();
    
    // Spawn new hemorrhoids periodically, but only if we haven't reached the enemies per level limit
    if (timestamp - lastSpawnTime > spawnInterval && hemorrhoids.length < enemiesPerLevel && !levelTransition) {
        spawnHemorrhoid();
        lastSpawnTime = timestamp;
    }
    
    // Update and draw player
    player.update(deltaTime);
    player.draw();
    
    // Update and draw hemorrhoids
    for (let i = hemorrhoids.length - 1; i >= 0; i--) {
        hemorrhoids[i].update();
        hemorrhoids[i].draw();
    }
    
    // Update and draw projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].update();
        // Remove expired projectiles
        if (projectiles[i].lifespan <= 0) {
            returnProjectileToPool(projectiles.splice(i, 1)[0]);
        } else {
            projectiles[i].draw();
        }
    }
    
    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        // Remove expired particles
        if (particles[i].lifespan <= 0) {
            returnParticleToPool(particles.splice(i, 1)[0]);
        } else {
            particles[i].draw();
        }
    }
    
    // Check for collisions
    checkCollisions();
    
    // Level up when all original hemorrhoids are destroyed
    if (gameActive && !levelTransition && enemiesRemaining <= 0) {
        // Make sure we don't check this condition again until next level
        levelTransition = true;
        
        // Add a small delay before showing level complete
        setTimeout(() => {
            levelUp();
        }, 1000);
    }
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Initialize game
window.addEventListener('load', function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match window
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Event listeners
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', startGame);
    
    // Keyboard input
    window.addEventListener('keydown', function(e) {
        keys[e.key] = true;
        
        // Spacebar to shoot
        if (e.key === ' ' && gameActive) {
            player.shoot();
            e.preventDefault();
        }
    });
    
    window.addEventListener('keyup', function(e) {
        keys[e.key] = false;
    });
    
    // Touch controls for mobile devices
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoveX = 0;
    let touchMoveY = 0;
    let isTouching = false;
    
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchMoveX = touchStartX;
        touchMoveY = touchStartY;
        isTouching = true;
    }, { passive: false });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        touchMoveX = touch.clientX;
        touchMoveY = touch.clientY;
    }, { passive: false });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        isTouching = false;
        
        // Shoot on touch release
        if (gameActive) {
            player.shoot();
        }
    }, { passive: false });
    
    // Add touch processing to game loop
    const originalGameLoop = gameLoop;
    gameLoop = function(timestamp) {
        // Process touch input
        if (isTouching && gameActive) {
            // Calculate direction from touch start to current touch position
            const dx = touchMoveX - touchStartX;
            const dy = touchMoveY - touchStartY;
            
            // Determine the angle based on touch movement
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                player.angle = Math.atan2(dy, dx);
            }
            
            // Apply thrust if the touch distance is significant
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 30) {
                keys['ArrowUp'] = true;
            } else {
                keys['ArrowUp'] = false;
            }
        }
        
        // Call the original game loop
        originalGameLoop(timestamp);
    };
});

function updateHUD() {
    const hudContainer = document.getElementById('hud-container');
    if (!hudContainer) {
        const hudContainer = document.createElement('div');
        hudContainer.id = 'hud-container';
        hudContainer.style.position = 'absolute';
        hudContainer.style.top = '0';
        hudContainer.style.left = '0';
        hudContainer.style.width = '100%';
        hudContainer.style.display = 'flex';
        hudContainer.style.justifyContent = 'space-between';
        hudContainer.style.padding = '0 20px';
        hudContainer.style.boxSizing = 'border-box';
        hudContainer.style.fontFamily = 'Arial, sans-serif';
        hudContainer.style.fontSize = '24px';
        hudContainer.style.fontWeight = 'bold';
        hudContainer.style.color = '#ffffff';
        hudContainer.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.7)';
        hudContainer.style.zIndex = '1000';
        
        // Create the elements if they don't exist
        const scoreEl = document.createElement('div');
        scoreEl.id = 'score';
        
        const levelEl = document.createElement('div');
        levelEl.id = 'level';
        
        const livesEl = document.createElement('div');
        livesEl.id = 'lives';
        
        // Add elements to container
        hudContainer.appendChild(scoreEl);
        hudContainer.appendChild(levelEl);
        hudContainer.appendChild(livesEl);
        
        // Add container to document
        document.body.appendChild(hudContainer);
        
        // Update gameCache with new elements
        if (gameCache.hudElements) {
            gameCache.hudElements.scoreEl = scoreEl;
            gameCache.hudElements.levelEl = levelEl;
            gameCache.hudElements.livesEl = livesEl;
        }
    }
    
    // Update the element content
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesEl = document.getElementById('lives');
    
    scoreEl.textContent = "SCORE: " + score.toString().padStart(6, '0');
    levelEl.textContent = "LEVEL: " + level;
    livesEl.textContent = "LIVES: " + lives;
    
    // Flash level element when it changes
    levelEl.classList.remove('level-up');
    void levelEl.offsetWidth; // Trigger reflow
    
    // Define the animation inline if not already defined in CSS
    if (!document.getElementById('level-up-animation')) {
        const style = document.createElement('style');
        style.id = 'level-up-animation';
        style.textContent = `
            @keyframes levelPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.3); color: yellow; }
                100% { transform: scale(1); }
            }
            .level-up {
                animation: levelPulse 0.5s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }
    
    levelEl.classList.add('level-up');
}

// Function to update the remaining hemorrhoids counter
function updateRemainingCounter() {
    const remainingEl = document.getElementById('remaining');
    if (remainingEl) {
        remainingEl.textContent = "REMAINING: " + enemiesRemaining;
    }
}

function startLevel(currentLevel) {
    // Clear any existing hemorrhoids
    hemorrhoids = [];
    
    // Calculate number of hemorrhoids for this level - increases with level
    enemiesPerLevel = 3 + Math.min(currentLevel - 1, 7); // Cap at 10 total enemies
    enemiesRemaining = enemiesPerLevel;
    
    // Update HUD level display
    document.getElementById('level').textContent = "LEVEL: " + currentLevel;
    
    // Update remaining hemorrhoids counter
    updateRemainingCounter();
    
    // Get career rank for this level
    const currentRank = getCurrentRank(currentLevel);
    
    // Create a "level start" message
    const levelMessage = document.createElement('div');
    levelMessage.id = 'level-message';
    levelMessage.style.position = 'absolute';
    levelMessage.style.top = '35%';
    levelMessage.style.left = '0';
    levelMessage.style.width = '100%';
    levelMessage.style.textAlign = 'center';
    levelMessage.style.fontSize = '36px';
    levelMessage.style.fontWeight = 'bold';
    levelMessage.style.color = '#ffffff';
    levelMessage.style.textShadow = '0 0 10px red, 2px 2px 4px rgba(0, 0, 0, 0.7)';
    levelMessage.style.opacity = '0';
    levelMessage.style.transition = 'opacity 0.5s';
    levelMessage.textContent = `LEVEL ${currentLevel}`;
    
    // Add career rank title
    const rankTitle = document.createElement('div');
    rankTitle.style.fontSize = '28px';
    rankTitle.style.marginTop = '10px';
    rankTitle.style.color = '#ffdd88';
    rankTitle.style.fontWeight = 'bold';
    rankTitle.textContent = currentRank.title;
    levelMessage.appendChild(rankTitle);
    
    // Add rank description
    const rankDesc = document.createElement('div');
    rankDesc.style.fontSize = '18px';
    rankDesc.style.marginTop = '5px';
    rankDesc.style.fontStyle = 'italic';
    rankDesc.style.color = '#ffcc99';
    rankDesc.textContent = currentRank.description;
    levelMessage.appendChild(rankDesc);
    
    // Add a subtitle message with number of hemorrhoids
    const subtitle = document.createElement('div');
    subtitle.style.fontSize = '22px';
    subtitle.style.marginTop = '15px';
    subtitle.style.fontWeight = 'normal';
    subtitle.style.color = '#ffcccc';
    subtitle.textContent = `${enemiesPerLevel} Hemorrhoids to Treat`;
    levelMessage.appendChild(subtitle);
    
    // Add to document
    document.body.appendChild(levelMessage);
    
    // Start transition
    levelTransition = true;
    
    // Fade in level message
    setTimeout(() => {
        levelMessage.style.opacity = '1';
    }, 100);
    
    // Show level message longer for new ranks
    const displayTime = isNewRank(currentLevel) ? 3500 : 2000;
    
    // Show level message briefly, then start spawning enemies
    setTimeout(() => {
        levelMessage.style.opacity = '0';
        
        // Remove message after fade out
        setTimeout(() => {
            if (levelMessage.parentNode) {
                levelMessage.parentNode.removeChild(levelMessage);
            }
            
            // Start spawning enemies gradually
            spawnEnemiesForLevel(currentLevel);
            
            // End transition
            levelTransition = false;
        }, 600);
    }, displayTime);
}

// Function to get the current career rank based on level
function getCurrentRank(level) {
    // Find the highest rank available for this level
    for (let i = CAREER_RANKS.length - 1; i >= 0; i--) {
        if (level >= CAREER_RANKS[i].level) {
            return CAREER_RANKS[i];
        }
    }
    // Fallback to first rank
    return CAREER_RANKS[0];
}

// Check if player just reached a new rank
function isNewRank(level) {
    for (let i = 0; i < CAREER_RANKS.length; i++) {
        if (CAREER_RANKS[i].level === level) {
            return true;
        }
    }
    return false;
}

function spawnEnemiesForLevel(currentLevel) {
    // Clear any existing timeout
    if (nextLevelTimeout) {
        clearTimeout(nextLevelTimeout);
    }
    
    // Calculate spawn count for this batch
    const initialBatch = Math.min(2 + Math.floor(currentLevel / 3), 5); // 2 for level 1, up to 5
    
    // Spawn initial batch
    for (let i = 0; i < initialBatch; i++) {
        spawnHemorrhoid();
    }
    
    // Update the HUD to show current level
    document.getElementById('level').textContent = "LEVEL: " + level;
    
    // Schedule additional spawns if needed
    if (enemiesPerLevel - initialBatch > 0) {
        scheduleNextWave(currentLevel);
    }
}

function scheduleNextWave(currentLevel) {
    // Calculate delay between waves based on level
    // Higher levels have faster spawn waves
    const delayBetweenWaves = Math.max(8000 - (currentLevel * 500), 3000);
    
    nextLevelTimeout = setTimeout(() => {
        // Only continue if game is active
        if (!gameActive || levelTransition) return;
        
        // Calculate how many hemorrhoids to spawn in this wave
        const waveSize = Math.min(1 + Math.floor(currentLevel / 2), enemiesPerLevel - hemorrhoids.length);
        
        // Only spawn if we haven't reached the total enemies for this level
        if (waveSize > 0) {
            // Spawn the wave
            for (let i = 0; i < waveSize; i++) {
                spawnHemorrhoid();
            }
        }
        
        // Schedule more waves only if we haven't spawned all enemies for this level yet
        if (hemorrhoids.length < enemiesPerLevel) {
            scheduleNextWave(currentLevel);
        }
    }, delayBetweenWaves);
}
