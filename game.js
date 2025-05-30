console.log("[5] game.js executing");
if (typeof Phaser === 'undefined') {
    console.error("PHASER FAIL: Phaser not loaded before game.js");
}

// Constants
const DEMON_COUNT = 10;
const DEMONS_FOR_ULTRA = 100;
const NOTCOIN_SCALE = 0.3;
const DEMON_SCALE = 0.2;
const CAPTURE_ZONE = 30;
const DRAG_SPEED_THRESHOLD = 2;
const ULTRA_DEMON_SCALE = 0.1;
const GAME_DURATION = 60;

// Asset Manifest
const assets = {
    images: {
        notcoin: 'assets/notcoin.png',
        notcoin_ultra: 'assets/notcoin ultra.png',
        demon: 'assets/demon.png',
        demon1: 'assets/demon1.png',
        background: 'assets/background.png',
        restartButton: 'assets/restartButton.png'
    },
    audio: {
        win: 'assets/sounds/win.wav'
    }
};

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#0A0A12',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 400 },
            debug: false
        }
    },
    audio: {
        disableWebAudio: false
    },
    render: {
        antialias: false,
        pixelArt: false,
        roundPixels: true,
        mipmapFilter: 'NEAREST_MIPMAP_NEAREST'
    }
};

const game = new Phaser.Game(config);

// Game state
const gameState = {
    draggedDemon: null,
    demons: [],
    lightSphere: null,
    captureZone: CAPTURE_ZONE,
    notcoin: null,
    demonsConsumed: 0,
    DEMONS_FOR_ULTRA: DEMONS_FOR_ULTRA,
    ultraActivated: false,
    lastPointerY: 0,
    dragSpeedThreshold: DRAG_SPEED_THRESHOLD,
    timerActive: false,
    timeLeft: GAME_DURATION,
    timerEvent: null,
    restartButton: null,
    gameOver: false,
    introShown: false,
    introText: null,
    enterPrompt: null,
    enterKey: null,
    playCount: 0,
    ultraMessage: null,
    ultraEnterPrompt: null,
    gameComplete: false,
    achievementShown: false,
    darkOverlay: null,
    achievementText: null,
    achievementParticles: null,
    uiElements: {
        demonCounter: null,
        timeCounter: null
    },
    winSound: null
};

// Knowledge messages
const KNOWLEDGE_MESSAGES = [
    "Demons are scared now. You have captured many of them!\n\nNotcoin reveals its first piece of knowledge:\n\nDid you know that Notcoin is the final future of crypto?\n\nNow you know, little demons",
    "Demons are terrified! You've captured even more!\n\nNotcoin is revealing second piece of its knowledge:\n\nDid you know that there is Nothing stopping Notcoin from succeeding in the future?\n\nNow you know",
    "Demons are in awe! You've captured them all!\n\nNotcoin is revealing third and final piece of its knowledge:\n\nDid you know that Notcoin is Everything and Everything is Nothing?\n\nThis coin is definitely NOT playing around! Now you know.\n\nLittle demons are impressed and give up to this knowledge. You won!"
];

function preload() {
    // Load images
    for (const [key, path] of Object.entries(assets.images)) {
        this.load.image(key, path);
    }
    
    // Load audio
    this.load.audio('win', assets.audio.win, {
        instances: 1
    });
    
    this.load.on('loaderror', () => console.error('Failed to load asset'));
}

function create() {
    // Initialize audio
    gameState.winSound = this.sound.add('win');
    
    // Enable audio on user interaction
    this.input.on('pointerdown', () => {
        if (this.sound.context.state === 'suspended') {
            this.sound.context.resume();
        }
    });

    // Setup enter key listener
    setupEnterKeyListener(this);
    
    showIntro(this);
}

function setupEnterKeyListener(scene) {
    // Clear any existing enter key listeners
    if (gameState.enterKey) {
        gameState.enterKey.off('down');
    }
    
    // Create new enter key listener
    gameState.enterKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    gameState.enterKey.on('down', () => handleEnterKey(scene), scene);
}

function handleEnterKey(scene) {
    if (!gameState.introShown) {
        startGame(scene);
    } else if (gameState.ultraMessage && gameState.ultraMessage.active) {
        hideUltraMessage(scene);
    } else if (gameState.achievementShown) {
        hideAchievementScreen(scene);
    }
}

function showIntro(scene) {
    // Reset game state for new game
    resetGameState();
    
    // Clear any existing UI elements
    if (gameState.introText) gameState.introText.destroy();
    if (gameState.enterPrompt) gameState.enterPrompt.destroy();
    
    const style = { 
        font: '24px Arial', 
        fill: '#ffffff',
        wordWrap: { width: 600 },
        align: 'center'
    };
    
    gameState.introText = scene.add.text(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY - 50,
        "Little demons want to know Notcoin's secrets.\n\nDrag demons upwards by clicking on them & moving them simultaneously towards Notcoin!\n\nPlay Game 3 times to uncover all Notcoin knowledge",
        style
    ).setOrigin(0.5).setDepth(1001);
    
    gameState.enterPrompt = scene.add.text(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY + 70,
        "PRESS ENTER",
        { font: '32px Arial', fill: '#ffff00' }
    ).setOrigin(0.5).setDepth(1001);
    
    scene.tweens.add({
        targets: gameState.enterPrompt,
        alpha: 0.3,
        duration: 800,
        yoyo: true,
        repeat: -1
    });
}

function startGame(scene) {
    gameState.introText.destroy();
    gameState.enterPrompt.destroy();
    
    setupBackground(scene);
    setupPhysics(scene);
    setupNotcoin(scene);
    setupDemons(scene);
    setupUI(scene);
    gameState.introShown = true;
}

function setupBackground(scene) {
    scene.add.image(scene.cameras.main.centerX, scene.cameras.main.centerY, 'background')
        .setDisplaySize(scene.cameras.main.width, scene.cameras.main.height)
        .setDepth(-1000);
}

function setupPhysics(scene) {
    scene.physics.world.on('worldbounds', (body) => {
        if (body.gameObject?.originalY !== undefined) {
            const demon = body.gameObject;
            if (body.blocked.down) {
                demon.body.setAllowGravity(false);
                demon.y = demon.originalY;
                if (!gameState.ultraActivated) startDanceAnimation(scene, demon);
            }
        }
    });
}

function setupNotcoin(scene) {
    const { width, height } = scene.cameras.main;
    gameState.notcoin = scene.add.image(width/2, height*0.15, 'notcoin')
        .setScale(NOTCOIN_SCALE)
        .setInteractive();
    
    scene.tweens.add({
        targets: gameState.notcoin,
        y: { from: gameState.notcoin.y-25, to: gameState.notcoin.y+25 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    gameState.lightSphere = scene.add.circle(gameState.notcoin.x, gameState.notcoin.y, 0, 0xFFFFFF)
        .setAlpha(0).setDepth(-0.5).setBlendMode(Phaser.BlendModes.ADD);
}

function setupDemons(scene) {
    const { width, height } = scene.cameras.main;
    gameState.demons = [];
    
    for (let i = 0; i < DEMON_COUNT; i++) {
        const demon = scene.physics.add.image(
            width * (0.15 + i * 0.08),
            height - 5,
            i % 2 ? 'demon1' : 'demon'
        )
        .setScale(DEMON_SCALE)
        .setOrigin(0.5, 1)
        .setInteractive()
        .setCollideWorldBounds(true);

        demon.originalY = height - 5;
        demon.originalX = width * (0.15 + i * 0.08);
        demon.isBeingCaptured = false;
        
        startDanceAnimation(scene, demon);
        
        demon.on('pointerdown', (pointer) => {
            if (!gameState.ultraActivated && !gameState.gameOver) {
                if (!gameState.timerActive) {
                    startTimer(scene);
                    gameState.timerActive = true;
                }
                onDemonDragStart(scene, demon, pointer);
            }
        });

        gameState.demons.push(demon);
    }

    scene.input.on('pointermove', (pointer) => {
        if (gameState.draggedDemon && !gameState.ultraActivated) {
            onDemonDragMove(pointer);
        }
    });

    scene.input.on('pointerup', (pointer) => {
        if (gameState.draggedDemon && !gameState.ultraActivated) {
            onDemonDragEnd(scene, pointer);
        }
    });
}

function startTimer(scene) {
    if (gameState.timerEvent) {
        gameState.timerEvent.remove();
    }
    gameState.timeLeft = GAME_DURATION;
    gameState.timerEvent = scene.time.addEvent({
        delay: 1000,
        callback: updateTimer,
        callbackScope: scene,
        loop: true
    });
}

function updateTimer() {
    gameState.timeLeft--;
    gameState.uiElements.timeCounter.setText(`Time Left: ${Math.max(0, gameState.timeLeft)}s`);
    
    if (gameState.timeLeft <= 0 && !gameState.ultraActivated) {
        gameState.timerEvent.remove();
        activateUltraMode(this);
    }
}

function setupUI(scene) {
    const style = { font: '18px Arial', fill: '#ffffff' };
    
    // Create UI elements only if they don't exist
    if (!gameState.uiElements.demonCounter) {
        gameState.uiElements.demonCounter = scene.add.text(20, 20, `Demons: ${gameState.demonsConsumed}/${DEMONS_FOR_ULTRA}`, style);
    } else {
        gameState.uiElements.demonCounter.setText(`Demons: ${gameState.demonsConsumed}/${DEMONS_FOR_ULTRA}`);
    }
    
    if (!gameState.uiElements.timeCounter) {
        gameState.uiElements.timeCounter = scene.add.text(scene.cameras.main.width - 20, 20, `Time: ${gameState.timeLeft}s`, style)
            .setOrigin(1, 0);
    } else {
        gameState.uiElements.timeCounter.setText(`Time: ${gameState.timeLeft}s`);
    }
    
    const buttonScale = 400 / 630;
    gameState.restartButton = scene.add.image(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY,
        'restartButton'
    )
    .setScale(buttonScale)
    .setInteractive()
    .setVisible(false)
    .setDepth(1000);

    gameState.restartButton.on('pointerover', () => {
        scene.tweens.add({
            targets: gameState.restartButton,
            scale: buttonScale * 1.1,
            duration: 100,
            ease: 'Sine.easeOut'
        });
    });

    gameState.restartButton.on('pointerout', () => {
        scene.tweens.add({
            targets: gameState.restartButton,
            scale: buttonScale,
            duration: 100,
            ease: 'Sine.easeOut'
        });
    });

    gameState.restartButton.on('pointerdown', () => {
        scene.tweens.add({
            targets: gameState.restartButton,
            scale: buttonScale * 0.9,
            duration: 80,
            ease: 'Back.easeIn',
            onComplete: () => {
                scene.tweens.add({
                    targets: gameState.restartButton,
                    scale: buttonScale * 1.1,
                    duration: 120,
                    ease: 'Elastic.easeOut',
                    onComplete: () => {
                        restartGame(scene);
                    }
                });
            }
        });
    });
}

function showUltraMessage(scene) {
    const style = { 
        font: '24px Arial', 
        fill: '#ffffff',
        wordWrap: { width: 600 },
        align: 'center'
    };
    
    const messageIndex = gameState.playCount;
    gameState.ultraMessage = scene.add.text(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY - 50,
        KNOWLEDGE_MESSAGES[messageIndex],
        style
    ).setOrigin(0.5).setDepth(1001);
    
    let enterPromptY = scene.cameras.main.centerY + 100;
    if (messageIndex === 1) enterPromptY = scene.cameras.main.centerY + 120;
    if (messageIndex === 2) enterPromptY = scene.cameras.main.centerY + 180;
    
    gameState.ultraEnterPrompt = scene.add.text(
        scene.cameras.main.centerX,
        enterPromptY,
        "PRESS ENTER",
        { font: '32px Arial', fill: '#ffff00' }
    ).setOrigin(0.5).setDepth(1001);
    
    scene.tweens.add({
        targets: gameState.ultraEnterPrompt,
        alpha: 0.3,
        duration: 800,
        yoyo: true,
        repeat: -1
    });
}

function hideUltraMessage(scene) {
    gameState.ultraMessage.destroy();
    gameState.ultraEnterPrompt.destroy();
    
    if (gameState.playCount >= 2) {
        showAchievementScreen(scene);
    } else {
        showRestartButton(scene);
    }
}

function showAchievementScreen(scene) {
    gameState.achievementShown = true;
    gameState.gameComplete = true;
    
    gameState.darkOverlay = scene.add.rectangle(
        0, 0,
        scene.cameras.main.width * 2,
        scene.cameras.main.height * 2,
        0x000000, 0.8
    ).setOrigin(0).setDepth(1000);
    
    gameState.achievementText = scene.add.text(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY - 50,
        "Achievement unlocked!\nYou have played this game 3 times",
        { 
            font: '32px Arial',
            fill: '#FFFF00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        }
    ).setOrigin(0.5).setDepth(1001);
    
    // Play win sound for achievement
    if (gameState.winSound) {
        gameState.winSound.play();
    }
    
    gameState.achievementParticles = scene.add.particles('notcoin');
    const emitterConfig = {
        x: { min: 100, max: 700 },
        y: scene.cameras.main.height + 50,
        speedY: { min: -800, max: -400 },
        speedX: { min: -100, max: 100 },
        scale: { start: 0.5, end: 0 },
        gravityY: 200,
        lifespan: 2000,
        quantity: 5,
        frequency: 300,
        blendMode: 'ADD'
    };
    gameState.achievementParticles.createEmitter(emitterConfig).setDepth(1000);
    
    gameState.ultraEnterPrompt = scene.add.text(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY + 100,
        "PRESS ENTER",
        { font: '32px Arial', fill: '#ffff00' }
    ).setOrigin(0.5).setDepth(1001);
    
    scene.tweens.add({
        targets: gameState.ultraEnterPrompt,
        alpha: 0.3,
        duration: 800,
        yoyo: true,
        repeat: -1
    });
}

function hideAchievementScreen(scene) {
    gameState.darkOverlay.destroy();
    gameState.achievementText.destroy();
    gameState.achievementParticles.destroy();
    gameState.ultraEnterPrompt.destroy();
    
    // Reset game state completely
    resetGameState();
    
    // Reset play count and setup new enter key listener
    gameState.playCount = 0;
    setupEnterKeyListener(scene);
    
    showIntro(scene);
}

function resetGameState() {
    // Clear all game objects
    if (gameState.notcoin) gameState.notcoin.destroy();
    if (gameState.lightSphere) gameState.lightSphere.destroy();
    if (gameState.restartButton) gameState.restartButton.destroy();
    if (gameState.ultraMessage) gameState.ultraMessage.destroy();
    if (gameState.ultraEnterPrompt) gameState.ultraEnterPrompt.destroy();
    if (gameState.uiElements.demonCounter) gameState.uiElements.demonCounter.destroy();
    if (gameState.uiElements.timeCounter) gameState.uiElements.timeCounter.destroy();
    if (gameState.introText) gameState.introText.destroy();
    if (gameState.enterPrompt) gameState.enterPrompt.destroy();
    if (gameState.darkOverlay) gameState.darkOverlay.destroy();
    if (gameState.achievementText) gameState.achievementText.destroy();
    if (gameState.achievementParticles) gameState.achievementParticles.destroy();
    
    // Clear all demons
    gameState.demons.forEach(demon => {
        if (demon) demon.destroy();
    });
    gameState.demons = [];
    
    // Reset game state variables
    gameState.draggedDemon = null;
    gameState.demonsConsumed = 0;
    gameState.ultraActivated = false;
    gameState.timerActive = false;
    gameState.timeLeft = GAME_DURATION;
    gameState.gameOver = false;
    gameState.introShown = false;
    gameState.gameComplete = false;
    gameState.achievementShown = false;
    gameState.uiElements.demonCounter = null;
    gameState.uiElements.timeCounter = null;
}

function showRestartButton(scene) {
    gameState.gameOver = true;
    gameState.restartButton.setVisible(true);
    scene.children.bringToTop(gameState.restartButton);
    
    scene.tweens.add({
        targets: gameState.restartButton,
        scale: { from: 0, to: 400/630 },
        duration: 600,
        ease: 'Elastic.easeOut'
    });
}

function restartGame(scene) {
    // Clear existing game objects
    gameState.demons.forEach(demon => demon.destroy());
    if (gameState.notcoin) gameState.notcoin.destroy();
    if (gameState.lightSphere) gameState.lightSphere.destroy();
    if (gameState.ultraMessage) gameState.ultraMessage.destroy();
    if (gameState.ultraEnterPrompt) gameState.ultraEnterPrompt.destroy();
    if (gameState.restartButton) gameState.restartButton.setVisible(false);
    
    // Reset game state
    gameState.draggedDemon = null;
    gameState.demonsConsumed = 0;
    gameState.ultraActivated = false;
    gameState.timerActive = false;
    gameState.timeLeft = GAME_DURATION;
    gameState.gameOver = false;
    
    // Increment play count if not showing achievement
    if (!gameState.achievementShown) {
        gameState.playCount = Math.min(gameState.playCount + 1, 3);
    }
    
    // Setup new game
    setupNotcoin(scene);
    setupDemons(scene);
    setupUI(scene);
}

function onDemonDragStart(scene, demon, pointer) {
    gameState.lastPointerY = pointer.y;
    scene.tweens.killTweensOf(demon);
    gameState.draggedDemon = demon;
    
    scene.tweens.add({
        targets: demon,
        angle: { from: -25, to: 25 },
        duration: 100,
        yoyo: true,
        repeat: -1
    });
}

function onDemonDragMove(pointer) {
    const demon = gameState.draggedDemon;
    demon.y = Phaser.Math.Clamp(pointer.y, 50, demon.originalY);
}

function onDemonDragEnd(scene, pointer) {
    const demon = gameState.draggedDemon;
    const distance = Math.abs(demon.y - gameState.notcoin.y);
    
    if (distance < gameState.captureZone * 1.5 || demon.y < demon.originalY - 30) {
        captureDemon(scene, demon, gameState.notcoin);
    } else {
        releaseDemon(scene, demon);
    }
    gameState.draggedDemon = null;
}

function activateUltraMode(scene) {
    gameState.ultraActivated = true;
    gameState.notcoin.setTexture('notcoin_ultra');
    
    // Play win sound for ultra mode
    if (gameState.winSound) {
        gameState.winSound.play();
    }
    
    gameState.demons.forEach(demon => {
        scene.tweens.killTweensOf(demon);
        demon.setScale(ULTRA_DEMON_SCALE).disableInteractive();
        
        demon.isRunning = true;
        demon.runDirection = Phaser.Math.Between(0, 1) ? 1 : -1;
        demon.runSpeed = Phaser.Math.Between(100, 200);
        demon.wobbleOffset = Math.random() * Math.PI * 2;
        
        scene.tweens.add({
            targets: demon,
            angle: { from: -20, to: 20 },
            duration: 300,
            yoyo: true,
            repeat: -1
        });
    });

    scene.time.delayedCall(1500, () => {
        showUltraMessage(scene);
    });
}

function captureDemon(scene, demon, notcoin) {
    demon.isBeingCaptured = true;
    scene.tweens.killTweensOf(demon);
    demon.disableInteractive();

    scene.tweens.add({
        targets: gameState.lightSphere,
        radius: 100, alpha: 0.6, duration: 300,
        onComplete: () => {
            scene.tweens.add({
                targets: gameState.lightSphere,
                radius: 0, alpha: 0, duration: 500
            });
        }
    });

    scene.add.particles('demon', {
        x: demon.x, y: demon.y,
        speed: { min: -60, max: 60 },
        scale: { start: 0.15, end: 0 },
        blendMode: 'ADD',
        quantity: 5,
        lifespan: 500
    });
    
    scene.tweens.add({
        targets: demon,
        x: notcoin.x, y: notcoin.y,
        scaleX: 0.05, scaleY: 0.05, alpha: 0,
        angle: Phaser.Math.Between(0, 360),
        duration: 800,
        onComplete: () => {
            gameState.demonsConsumed++;
            gameState.uiElements.demonCounter.setText(`Demons: ${gameState.demonsConsumed}/${DEMONS_FOR_ULTRA}`);
            
            if ((gameState.demonsConsumed >= DEMONS_FOR_ULTRA || gameState.timeLeft <= 0) && !gameState.ultraActivated) {
                activateUltraMode(scene);
            }
            
            if (!gameState.ultraActivated) {
                demon.setPosition(demon.originalX, demon.originalY)
                    .setScale(DEMON_SCALE).setAlpha(0);
                
                scene.time.delayedCall(2000, () => {
                    if (demon.isBeingCaptured) {
                        demon.setAlpha(1).setInteractive();
                        startDanceAnimation(scene, demon);
                    }
                });
            }
        }
    });
}

function releaseDemon(scene, demon) {
    const boundsCallback = (body) => {
        if (body.gameObject === demon && body.blocked.down) {
            demon.body.setAllowGravity(false);
            demon.y = demon.originalY;
            if (!gameState.ultraActivated) startDanceAnimation(scene, demon);
            scene.physics.world.off('worldbounds', boundsCallback);
        }
    };

    scene.tweens.killTweensOf(demon);
    demon.setAngle(0);
    demon.body.setAllowGravity(true);
    scene.physics.world.on('worldbounds', boundsCallback);
}

function startDanceAnimation(scene, demon) {
    if (gameState.ultraActivated) return;
    
    scene.tweens.add({
        targets: demon,
        angle: { from: -10, to: 10 },
        duration: 800 + Math.random() * 400,
        yoyo: true, repeat: -1
    });

    scene.tweens.add({
        targets: demon,
        x: { from: demon.originalX - 8, to: demon.originalX + 8 },
        duration: 1000 + Math.random() * 600,
        yoyo: true, repeat: -1
    });
}

function update() {
    if (gameState.introShown) {
        gameState.lightSphere.setPosition(gameState.notcoin.x, gameState.notcoin.y);
        
        if (gameState.ultraActivated) {
            const { width } = game.config;
            gameState.demons.forEach(demon => {
                if (!demon.isRunning) return;
                
                demon.x += demon.runDirection * (demon.runSpeed * game.loop.delta) / 1000;
                demon.y = demon.originalY + Math.sin((demon.x * 0.02) + demon.wobbleOffset) * 30;
                
                if (demon.x < 50) demon.runDirection = 1;
                if (demon.x > width - 50) demon.runDirection = -1;
            });
        }
    }
}