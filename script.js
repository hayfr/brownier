const TIMER_STORAGE_KEY = "brownieTimerStateV2";
const DEFAULT_TIMER_STATE = {
    selectedSeconds: 1380,
    remainingSeconds: 1380,
    texture: "Chewy",
    running: false,
    endsAt: null,
    status: "Ready when you are.",
    alerted: false
};

let soundsEnabled = readStorage("brownieSounds") !== "off";
let audioContext;
let revealObserver;
let navigationBusy = false;
let basePageTitle = document.title;
let renderedPath = location.pathname;
let lastRenderedSecond = null;
const pageCache = new Map();

function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        return;
    }
}

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    return audioContext;
}

function playTone(frequency = 440, duration = 0.08, volume = 0.035, delay = 0) {
    if (!soundsEnabled || !(window.AudioContext || window.webkitAudioContext)) {
        return;
    }

    const context = getAudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
}

function playChime() {
    playTone(523.25, 0.45, 0.06, 0);
    playTone(659.25, 0.45, 0.06, 0.18);
    playTone(783.99, 0.65, 0.07, 0.36);
}

function getRawTimerState() {
    const saved = readStorage(TIMER_STORAGE_KEY);

    if (!saved) {
        return { ...DEFAULT_TIMER_STATE };
    }

    try {
        return { ...DEFAULT_TIMER_STATE, ...JSON.parse(saved) };
    } catch {
        return { ...DEFAULT_TIMER_STATE };
    }
}

function saveTimerState(state) {
    writeStorage(TIMER_STORAGE_KEY, JSON.stringify(state));
}

function getTimerState() {
    const state = getRawTimerState();

    if (state.running && state.endsAt) {
        state.remainingSeconds = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));

        if (state.remainingSeconds === 0) {
            state.running = false;
            state.endsAt = null;
            state.status = "Time to check the brownies.";
            saveTimerState(state);
        }
    }

    return state;
}

function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const leftoverSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(leftoverSeconds).padStart(2, "0")}`;
}

function renderTimer() {
    const state = getTimerState();
    const display = document.querySelector("#timerDisplay");
    const texture = document.querySelector("#timerTexture");
    const startButton = document.querySelector("#timerStart");
    const status = document.querySelector("#timerStatus");

    if (display) {
        display.textContent = formatTime(state.remainingSeconds);
    }

    if (texture) {
        texture.textContent = state.texture;
    }

    if (startButton) {
        startButton.textContent = state.running ? "Pause" : state.remainingSeconds === 0 ? "Start again" : "Start";
    }

    if (status) {
        status.textContent = state.status;
    }

    document.querySelectorAll(".timer-option").forEach(option => {
        option.classList.toggle("active", Number(option.dataset.seconds) === state.selectedSeconds);
    });

    const second = state.remainingSeconds;

    if (second !== lastRenderedSecond) {
        document.title = state.running ? `${formatTime(second)} • ${basePageTitle}` : basePageTitle;
        lastRenderedSecond = second;
    }

    return state;
}

function tickTimer() {
    const rawState = getRawTimerState();
    const state = renderTimer();

    if (rawState.running && !state.running && state.remainingSeconds === 0 && !state.alerted) {
        state.alerted = true;
        saveTimerState(state);
        playChime();
    }
}

function updateActiveNavigation() {
    const pageName = location.pathname.split("/").pop() || "index.html";

    document.querySelectorAll(".site-nav a").forEach(link => {
        const linkName = new URL(link.href, location.href).pathname.split("/").pop() || "index.html";
        const active = linkName === pageName;
        link.classList.toggle("active", active);

        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

function closeNavigationMenu() {
    const menuButton = document.querySelector(".menu-button");
    const siteNav = document.querySelector(".site-nav");

    if (!menuButton || !siteNav) {
        return;
    }

    siteNav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "Menu";
}

function initializeHeader() {
    const menuButton = document.querySelector(".menu-button");
    const siteNav = document.querySelector(".site-nav");
    const soundButton = document.querySelector(".sound-button");

    if (menuButton && siteNav) {
        menuButton.addEventListener("click", () => {
            const open = siteNav.classList.toggle("open");
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.textContent = open ? "Close" : "Menu";
        });
    }

    function updateSoundButton() {
        if (!soundButton) {
            return;
        }

        soundButton.textContent = soundsEnabled ? "🔊" : "🔇";
        soundButton.setAttribute("aria-label", soundsEnabled ? "Turn sounds off" : "Turn sounds on");
        soundButton.title = soundsEnabled ? "Turn sounds off" : "Turn sounds on";
    }

    if (soundButton) {
        updateSoundButton();
        soundButton.addEventListener("click", () => {
            soundsEnabled = !soundsEnabled;
            writeStorage("brownieSounds", soundsEnabled ? "on" : "off");
            updateSoundButton();

            if (soundsEnabled) {
                playTone(620, 0.12, 0.045);
            }
        });
    }

    updateActiveNavigation();
}

function initializeRevealAnimations(root = document, revealVisibleArea = false) {
    if (revealObserver) {
        revealObserver.disconnect();
    }

    const revealItems = [...root.querySelectorAll(".reveal")];

    revealItems.forEach((item, index) => {
        item.classList.remove("visible");
        item.style.setProperty("--reveal-delay", `${Math.min(index * 55, 330)}ms`);

        if (revealVisibleArea && item.getBoundingClientRect().top < window.innerHeight * 1.08) {
            item.classList.add("visible");
        }
    });

    if (!("IntersectionObserver" in window)) {
        revealItems.forEach(item => item.classList.add("visible"));
        return;
    }

    revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: "0px 0px -7% 0px"
    });

    revealItems.filter(item => !item.classList.contains("visible")).forEach(item => revealObserver.observe(item));
}

function initializeRecipe(root = document) {
    const servingCount = root.querySelector("#servingCount");

    if (!servingCount) {
        return;
    }

    const batchCount = root.querySelector("#batchCount");
    const batchWord = root.querySelector("#batchWord");
    const traySize = root.querySelector("#traySize");
    const decreaseButton = root.querySelector("#decreaseServings");
    const increaseButton = root.querySelector("#increaseServings");
    const ingredientBatchLabel = root.querySelector("#ingredientBatchLabel");
    const ingredientAmounts = root.querySelectorAll(".ingredient-amount");
    const trays = {
        1: "8 × 8-inch square pan",
        2: "9 × 13-inch pan",
        3: "one 9 × 13-inch pan and one 8 × 8-inch pan",
        4: "two 9 × 13-inch pans"
    };
    let batches = 1;

    function formatNumber(value) {
        const fractions = [
            [0.125, "1/8"],
            [0.25, "1/4"],
            [0.333333, "1/3"],
            [0.375, "3/8"],
            [0.5, "1/2"],
            [0.625, "5/8"],
            [0.666667, "2/3"],
            [0.75, "3/4"],
            [0.875, "7/8"]
        ];
        const whole = Math.floor(value + 0.0001);
        const decimal = value - whole;
        let fraction = "";

        for (const [number, label] of fractions) {
            if (Math.abs(decimal - number) < 0.015) {
                fraction = label;
                break;
            }
        }

        if (fraction && whole > 0) {
            return `${whole} ${fraction}`;
        }

        if (fraction) {
            return fraction;
        }

        return String(Math.round(value));
    }

    function unitLabel(unit, value) {
        if (!unit) {
            return "";
        }

        return value > 1.0001 ? `${unit}s` : unit;
    }

    function updateRecipe() {
        const servings = batches * 9;
        const batchLabel = batches === 1 ? "batch" : "batches";

        servingCount.textContent = servings;
        batchCount.textContent = batches;
        batchWord.textContent = batchLabel;
        traySize.textContent = trays[batches];
        ingredientBatchLabel.textContent = `${batches} ${batchLabel}`;

        ingredientAmounts.forEach(cell => {
            const value = Number(cell.dataset.value) * batches;
            const unit = unitLabel(cell.dataset.unit, value);
            cell.textContent = `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
        });

        decreaseButton.disabled = batches === 1;
        increaseButton.disabled = batches === 4;
    }

    decreaseButton.addEventListener("click", () => {
        if (batches > 1) {
            batches -= 1;
            updateRecipe();
        }
    });

    increaseButton.addEventListener("click", () => {
        if (batches < 4) {
            batches += 1;
            updateRecipe();
        }
    });

    updateRecipe();
}

function initializeFlavorCards(root = document) {
    root.querySelectorAll(".flavor-card").forEach(card => {
        card.addEventListener("click", () => {
            const open = !card.classList.contains("open");

            root.querySelectorAll(".flavor-card.open").forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove("open");
                    otherCard.setAttribute("aria-expanded", "false");
                    const action = otherCard.querySelector(".flavor-action");

                    if (action) {
                        action.textContent = "View change +";
                    }
                }
            });

            card.classList.toggle("open", open);
            card.setAttribute("aria-expanded", String(open));
            const action = card.querySelector(".flavor-action");

            if (action) {
                action.textContent = open ? "Hide change −" : "View change +";
            }
        });
    });
}

function initializeTimerControls(root = document) {
    const timerDisplay = root.querySelector("#timerDisplay");

    if (!timerDisplay) {
        renderTimer();
        return;
    }

    const startButton = root.querySelector("#timerStart");
    const resetButton = root.querySelector("#timerReset");
    const timerOptions = root.querySelectorAll(".timer-option");

    startButton.addEventListener("click", () => {
        const state = getTimerState();

        if (state.running) {
            state.running = false;
            state.endsAt = null;
            state.status = "Paused. The oven is still running.";
        } else {
            if (state.remainingSeconds === 0) {
                state.remainingSeconds = state.selectedSeconds;
            }

            state.running = true;
            state.endsAt = Date.now() + state.remainingSeconds * 1000;
            state.status = "The brownies are baking.";
            state.alerted = false;
        }

        saveTimerState(state);
        lastRenderedSecond = null;
        renderTimer();
    });

    resetButton.addEventListener("click", () => {
        const state = getTimerState();
        state.running = false;
        state.endsAt = null;
        state.remainingSeconds = state.selectedSeconds;
        state.status = "Ready when you are.";
        state.alerted = false;
        saveTimerState(state);
        lastRenderedSecond = null;
        renderTimer();
    });

    timerOptions.forEach(option => {
        option.addEventListener("click", () => {
            const selectedSeconds = Number(option.dataset.seconds);
            const texture = option.dataset.texture;
            const state = {
                selectedSeconds,
                remainingSeconds: selectedSeconds,
                texture,
                running: false,
                endsAt: null,
                status: `${texture} timer selected.`,
                alerted: false
            };

            saveTimerState(state);
            lastRenderedSecond = null;
            renderTimer();
        });
    });

    renderTimer();
}


function initializePanGame(root = document) {
    const canvas = root.querySelector("#panGameCanvas");

    if (!canvas) {
        return;
    }

    const context = canvas.getContext("2d");
    const startButton = root.querySelector("#gameStart");
    const leftButton = root.querySelector("#gameLeft");
    const rightButton = root.querySelector("#gameRight");
    const overlay = root.querySelector("#gameOverlay");
    const message = root.querySelector("#gameMessage");
    const scoreElement = root.querySelector("#gameScore");
    const bestElement = root.querySelector("#gameBest");
    const statusElement = root.querySelector("#gameStatus");
    const width = 900;
    const height = 560;
    const bestKey = "brownieRushBest";
    const keys = { left: false, right: false };
    const pan = { x: width / 2, targetX: width / 2, y: 500, width: 126, height: 38 };
    let state = "idle";
    let score = 0;
    let best = Number(readStorage(bestKey)) || 0;
    let objects = [];
    let particles = [];
    let spawnClock = 0;
    let nextSpawn = 0.75;
    let elapsed = 0;
    let lastTime = performance.now();
    let frame;

    bestElement.textContent = best;

    function resizeCanvas() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function roundedRectangle(x, y, rectangleWidth, rectangleHeight, radius) {
        const r = Math.min(radius, rectangleWidth / 2, rectangleHeight / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.arcTo(x + rectangleWidth, y, x + rectangleWidth, y + rectangleHeight, r);
        context.arcTo(x + rectangleWidth, y + rectangleHeight, x, y + rectangleHeight, r);
        context.arcTo(x, y + rectangleHeight, x, y, r);
        context.arcTo(x, y, x + rectangleWidth, y, r);
        context.closePath();
    }

    function updateScore() {
        scoreElement.textContent = score;
        bestElement.textContent = best;
    }

    function setOverlay(visible) {
        overlay.classList.toggle("hidden", !visible);
    }

    function startGame() {
        state = "playing";
        score = 0;
        objects = [];
        particles = [];
        spawnClock = 0;
        nextSpawn = 0.7;
        elapsed = 0;
        pan.x = width / 2;
        pan.targetX = width / 2;
        updateScore();
        statusElement.textContent = "Catch brownies. Avoid cookies.";
        message.textContent = "Catch brownies. Dodge cookies.";
        startButton.textContent = "Play Again";
        setOverlay(false);
        playTone(520, 0.08, 0.035);
        playTone(690, 0.1, 0.035, 0.08);
    }

    function endGame() {
        state = "over";

        if (score > best) {
            best = score;
            writeStorage(bestKey, String(best));
        }

        updateScore();
        statusElement.textContent = score === best && score > 0 ? "New best score." : "A cookie hit the pan.";
        message.textContent = `Cookie collision — score ${score}`;
        startButton.textContent = "Play Again";
        setOverlay(true);
        playTone(220, 0.18, 0.055);
        playTone(150, 0.3, 0.05, 0.14);
    }

    function spawnObject() {
        const cookieChance = Math.min(0.42, 0.24 + score * 0.006);
        const type = Math.random() < cookieChance ? "cookie" : "brownie";
        const size = type === "cookie" ? 48 : 46;
        const margin = size + 18;

        objects.push({
            type,
            x: margin + Math.random() * (width - margin * 2),
            y: -size,
            size,
            speed: 185 + Math.min(score * 7, 210) + Math.random() * 52,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 2.4,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: 1.5 + Math.random() * 1.8
        });
    }

    function burst(x, y, type) {
        const amount = type === "cookie" ? 20 : 12;

        for (let index = 0; index < amount; index += 1) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * (type === "cookie" ? 260 : 180),
                vy: -60 - Math.random() * 170,
                life: 0.55 + Math.random() * 0.35,
                age: 0,
                size: 3 + Math.random() * 5,
                color: type === "cookie" ? (Math.random() > 0.45 ? "#c98b4b" : "#4b2518") : (Math.random() > 0.4 ? "#5a2417" : "#d5a56d")
            });
        }
    }

    function collides(object) {
        const objectBottom = object.y + object.size * 0.48;
        const objectTop = object.y - object.size * 0.48;
        const panTop = pan.y - pan.height * 0.55;
        const panBottom = pan.y + pan.height * 0.45;
        const horizontalReach = pan.width * 0.48 + object.size * 0.3;

        return objectBottom >= panTop && objectTop <= panBottom && Math.abs(object.x - pan.x) <= horizontalReach;
    }

    function update(delta) {
        if (state !== "playing") {
            particles.forEach(particle => {
                particle.age += delta;
                particle.x += particle.vx * delta;
                particle.y += particle.vy * delta;
                particle.vy += 420 * delta;
            });
            particles = particles.filter(particle => particle.age < particle.life);
            return;
        }

        elapsed += delta;
        const direction = Number(keys.right) - Number(keys.left);

        if (direction) {
            pan.targetX += direction * 620 * delta;
        }

        pan.targetX = Math.max(76, Math.min(width - 105, pan.targetX));
        pan.x += (pan.targetX - pan.x) * Math.min(1, delta * 15);
        spawnClock += delta;

        if (spawnClock >= nextSpawn) {
            spawnClock = 0;
            spawnObject();
            nextSpawn = Math.max(0.34, 0.76 - score * 0.012) * (0.84 + Math.random() * 0.32);
        }

        for (let index = objects.length - 1; index >= 0; index -= 1) {
            const object = objects[index];
            object.y += object.speed * delta;
            object.rotation += object.spin * delta;
            object.x += Math.sin(elapsed * object.swaySpeed + object.sway) * 9 * delta;

            if (collides(object)) {
                objects.splice(index, 1);
                burst(object.x, pan.y - 16, object.type);

                if (object.type === "cookie") {
                    endGame();
                    break;
                }

                score += 1;

                if (score > best) {
                    best = score;
                }

                updateScore();
                statusElement.textContent = score % 5 === 0 ? `Nice catch — ${score} brownies.` : "Brownie caught.";
                playTone(560 + Math.min(score, 12) * 18, 0.07, 0.025);
            } else if (object.y - object.size > height) {
                objects.splice(index, 1);
            }
        }

        particles.forEach(particle => {
            particle.age += delta;
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;
            particle.vy += 420 * delta;
        });
        particles = particles.filter(particle => particle.age < particle.life);
    }

    function drawBackground() {
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, "#f8e9d3");
        gradient.addColorStop(0.62, "#ead2b5");
        gradient.addColorStop(1, "#c99d72");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);

        context.save();
        context.globalAlpha = 0.13;
        context.strokeStyle = "#6f3d28";
        context.lineWidth = 1;

        for (let y = 46; y < height; y += 46) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(width, y);
            context.stroke();
        }

        context.globalAlpha = 0.055;
        context.fillStyle = "#ffffff";

        for (let x = 30; x < width; x += 90) {
            context.beginPath();
            context.arc(x, 42 + Math.sin(x * 0.03) * 18, 22, 0, Math.PI * 2);
            context.fill();
        }

        context.restore();

        const counter = context.createLinearGradient(0, 470, 0, height);
        counter.addColorStop(0, "rgba(78,43,28,0)");
        counter.addColorStop(1, "rgba(78,43,28,0.2)");
        context.fillStyle = counter;
        context.fillRect(0, 440, width, 120);
    }

    function drawBrownie(object) {
        context.save();
        context.translate(object.x, object.y);
        context.rotate(object.rotation);
        context.shadowColor = "rgba(42,18,10,0.25)";
        context.shadowBlur = 14;
        context.shadowOffsetY = 8;
        roundedRectangle(-object.size / 2, -object.size * 0.42, object.size, object.size * 0.84, 7);
        context.fillStyle = "#3d160f";
        context.fill();
        context.shadowColor = "transparent";
        roundedRectangle(-object.size / 2 + 3, -object.size * 0.42 + 3, object.size - 6, object.size * 0.48, 5);
        context.fillStyle = "#6f2d1e";
        context.fill();
        context.strokeStyle = "#b7754f";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-13, -7);
        context.lineTo(-5, -12);
        context.lineTo(2, -7);
        context.lineTo(11, -12);
        context.stroke();
        context.fillStyle = "#d4a06c";
        context.beginPath();
        context.arc(-12, 7, 2.5, 0, Math.PI * 2);
        context.arc(10, 4, 2, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function drawCookie(object) {
        context.save();
        context.translate(object.x, object.y);
        context.rotate(object.rotation);
        context.shadowColor = "rgba(42,18,10,0.22)";
        context.shadowBlur = 14;
        context.shadowOffsetY = 8;
        context.fillStyle = "#ca8849";
        context.beginPath();
        context.arc(0, 0, object.size * 0.48, 0, Math.PI * 2);
        context.fill();
        context.shadowColor = "transparent";
        context.strokeStyle = "#9c5d31";
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = "#47251a";
        const chips = [[-11, -10, 4], [10, -13, 3], [13, 8, 4], [-9, 12, 3], [1, 1, 3.5]];

        chips.forEach(([x, y, radius]) => {
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
        });

        context.restore();
    }

    function drawPan() {
        context.save();
        context.translate(pan.x, pan.y);
        context.shadowColor = "rgba(43,24,17,0.28)";
        context.shadowBlur = 16;
        context.shadowOffsetY = 9;
        roundedRectangle(46, -9, 72, 18, 9);
        context.fillStyle = "#4b433e";
        context.fill();
        roundedRectangle(96, -6, 31, 12, 6);
        context.fillStyle = "#292725";
        context.fill();
        context.shadowColor = "transparent";
        context.beginPath();
        context.moveTo(-66, -18);
        context.quadraticCurveTo(-60, 22, 0, 24);
        context.quadraticCurveTo(60, 22, 66, -18);
        context.closePath();
        const panGradient = context.createLinearGradient(0, -20, 0, 25);
        panGradient.addColorStop(0, "#786f68");
        panGradient.addColorStop(0.5, "#403b38");
        panGradient.addColorStop(1, "#252321");
        context.fillStyle = panGradient;
        context.fill();
        context.strokeStyle = "#1f1c1a";
        context.lineWidth = 4;
        context.stroke();
        context.beginPath();
        context.ellipse(0, -17, 66, 13, 0, 0, Math.PI * 2);
        context.fillStyle = "#272421";
        context.fill();
        context.strokeStyle = "#948a82";
        context.lineWidth = 3;
        context.stroke();
        context.beginPath();
        context.ellipse(0, -17, 55, 8, 0, 0, Math.PI * 2);
        context.fillStyle = "#151413";
        context.fill();
        context.restore();
    }

    function drawParticles() {
        particles.forEach(particle => {
            const opacity = Math.max(0, 1 - particle.age / particle.life);
            context.globalAlpha = opacity;
            context.fillStyle = particle.color;
            context.beginPath();
            context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            context.fill();
        });
        context.globalAlpha = 1;
    }

    function draw() {
        drawBackground();
        objects.forEach(object => {
            if (object.type === "cookie") {
                drawCookie(object);
            } else {
                drawBrownie(object);
            }
        });
        drawParticles();
        drawPan();
    }

    function loop(now) {
        if (!canvas.isConnected) {
            cleanup();
            return;
        }

        const delta = Math.min((now - lastTime) / 1000, 0.035);
        lastTime = now;
        update(delta);
        draw();
        frame = requestAnimationFrame(loop);
    }

    function setPointerPosition(event) {
        const bounds = canvas.getBoundingClientRect();
        pan.targetX = (event.clientX - bounds.left) / bounds.width * width;
        pan.targetX = Math.max(76, Math.min(width - 105, pan.targetX));
    }

    function handleKeyDown(event) {
        if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(event.code)) {
            event.preventDefault();
        }

        if (event.code === "ArrowLeft" || event.code === "KeyA") {
            keys.left = true;
        }

        if (event.code === "ArrowRight" || event.code === "KeyD") {
            keys.right = true;
        }

        if (event.code === "Space" && state !== "playing") {
            startGame();
        }
    }

    function handleKeyUp(event) {
        if (event.code === "ArrowLeft" || event.code === "KeyA") {
            keys.left = false;
        }

        if (event.code === "ArrowRight" || event.code === "KeyD") {
            keys.right = false;
        }
    }

    function bindHold(button, direction) {
        if (!button) {
            return;
        }

        button.addEventListener("pointerdown", event => {
            event.preventDefault();
            button.setPointerCapture(event.pointerId);
            keys[direction] = true;
        });
        button.addEventListener("pointerup", () => {
            keys[direction] = false;
        });
        button.addEventListener("pointercancel", () => {
            keys[direction] = false;
        });
        button.addEventListener("lostpointercapture", () => {
            keys[direction] = false;
        });
    }

    function cleanup() {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resizeCanvas);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    }

    resizeCanvas();
    startButton.addEventListener("click", startGame);
    canvas.addEventListener("pointerdown", event => {
        setPointerPosition(event);

        if (state !== "playing") {
            startGame();
        }
    });
    canvas.addEventListener("pointermove", event => {
        if (event.pointerType === "mouse" || event.buttons > 0) {
            setPointerPosition(event);
        }
    });
    bindHold(leftButton, "left");
    bindHold(rightButton, "right");
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    updateScore();
    draw();
    frame = requestAnimationFrame(loop);
}

function initializePage(root = document, duringNavigation = false) {
    initializeRevealAnimations(root, duringNavigation);
    initializeRecipe(root);
    initializeFlavorCards(root);
    initializeTimerControls(root);
    initializePanGame(root);
}

function setupGlideScroll() {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(pointer: fine)").matches;

    if (reducedMotion || !finePointer) {
        return {
            jumpTo(top) {
                window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
            },
            setPosition(top) {
                window.scrollTo(0, top);
            }
        };
    }

    let currentY = window.scrollY;
    let targetY = window.scrollY;
    let frame = null;

    function maximumScroll() {
        return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function clamp(value) {
        return Math.min(maximumScroll(), Math.max(0, value));
    }

    function canElementScroll(element, deltaY) {
        let current = element;

        while (current && current !== document.body) {
            const style = getComputedStyle(current);
            const scrollable = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;

            if (scrollable) {
                const canScrollUp = deltaY < 0 && current.scrollTop > 0;
                const canScrollDown = deltaY > 0 && current.scrollTop + current.clientHeight < current.scrollHeight - 1;

                if (canScrollUp || canScrollDown) {
                    return true;
                }
            }

            current = current.parentElement;
        }

        return false;
    }

    function glide() {
        currentY += (targetY - currentY) * 0.078;

        if (Math.abs(targetY - currentY) < 0.35) {
            currentY = targetY;
            window.scrollTo(0, currentY);
            frame = null;
            return;
        }

        window.scrollTo(0, currentY);
        frame = requestAnimationFrame(glide);
    }

    function startGlide() {
        if (!frame) {
            currentY = window.scrollY;
            frame = requestAnimationFrame(glide);
        }
    }

    window.addEventListener("wheel", event => {
        if (event.ctrlKey || event.metaKey || canElementScroll(event.target, event.deltaY)) {
            return;
        }

        event.preventDefault();
        const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? window.innerHeight : 1;
        targetY = clamp(targetY + event.deltaY * unit * 1.08);
        startGlide();
    }, { passive: false });

    window.addEventListener("scroll", () => {
        if (!frame) {
            currentY = window.scrollY;
            targetY = window.scrollY;
        }
    }, { passive: true });

    window.addEventListener("resize", () => {
        targetY = clamp(targetY);
        currentY = clamp(currentY);
    });

    return {
        jumpTo(top) {
            targetY = clamp(top);
            startGlide();
        },
        setPosition(top) {
            if (frame) {
                cancelAnimationFrame(frame);
                frame = null;
            }

            currentY = clamp(top);
            targetY = currentY;
            window.scrollTo(0, currentY);
        }
    };
}

function pageOrder(pathname) {
    const name = pathname.split("/").pop() || "index.html";
    const order = ["index.html", "recipe.html", "flavors.html", "timer.html", "game.html"];
    const index = order.indexOf(name);
    return index === -1 ? 0 : index;
}

async function preloadImages(main, destination) {
    const sources = [...main.querySelectorAll("img[src]")].map(image => new URL(image.getAttribute("src"), destination).href);

    if (!sources.length) {
        return;
    }

    const jobs = sources.map(source => new Promise(resolve => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = resolve;
        image.src = source;

        if (image.complete) {
            resolve();
        }
    }));

    await Promise.race([
        Promise.all(jobs),
        new Promise(resolve => setTimeout(resolve, 1200))
    ]);
}

async function loadPage(destination) {
    const key = destination.href.split("#")[0];

    if (pageCache.has(key)) {
        return pageCache.get(key);
    }

    const response = await fetch(key, { headers: { "X-Requested-With": "BrownieNavigation" } });

    if (!response.ok) {
        throw new Error(`Could not load ${destination.pathname}`);
    }

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const main = parsed.querySelector("main");

    if (!main) {
        throw new Error("The destination page has no main element.");
    }

    const page = {
        title: parsed.title || "Brownie Club",
        mainHTML: main.outerHTML,
        ready: preloadImages(main, destination)
    };

    pageCache.set(key, page);
    return page;
}

function createMain(mainHTML) {
    const template = document.createElement("template");
    template.innerHTML = mainHTML.trim();
    return template.content.firstElementChild;
}

function fallbackSwap(updatePage) {
    return new Promise(resolve => {
        const currentMain = document.querySelector("main");
        currentMain.classList.add("page-fallback-out");

        setTimeout(() => {
            const newMain = updatePage();
            newMain.classList.add("page-fallback-in");

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newMain.classList.remove("page-fallback-in");
                    resolve();
                });
            });
        }, 260);
    });
}

async function navigateTo(destination, options = {}) {
    if (navigationBusy) {
        return;
    }

    const url = new URL(destination, location.href);

    if (url.pathname === renderedPath && url.search === location.search) {
        glideScroller.jumpTo(0);
        closeNavigationMenu();
        return;
    }

    navigationBusy = true;
    document.body.setAttribute("aria-busy", "true");

    try {
        const page = await loadPage(url);
        await page.ready;
        const previousScrollY = window.scrollY;
        const oldOrder = pageOrder(renderedPath);
        const newOrder = pageOrder(url.pathname);
        document.documentElement.dataset.pageDirection = newOrder < oldOrder ? "back" : "forward";

        const updatePage = () => {
            const currentMain = document.querySelector("main");
            const newMain = createMain(page.mainHTML);
            currentMain.replaceWith(newMain);
            basePageTitle = page.title;
            renderedPath = url.pathname;
            lastRenderedSecond = null;

            if (options.push !== false) {
                history.replaceState({ ...(history.state || {}), scrollY: previousScrollY }, "", location.href);
                history.pushState({ scrollY: 0 }, "", url.href);
            }

            updateActiveNavigation();
            closeNavigationMenu();
            glideScroller.setPosition(options.scrollY || 0);
            initializePage(newMain, true);
            renderTimer();
            return newMain;
        };

        if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const transition = document.startViewTransition(updatePage);
            await transition.finished.catch(() => {});
        } else {
            await fallbackSwap(updatePage);
        }
    } catch {
        location.href = url.href;
    } finally {
        navigationBusy = false;
        document.body.removeAttribute("aria-busy");
        delete document.documentElement.dataset.pageDirection;
    }
}

function setupClientNavigation() {
    if (!/^https?:$/.test(location.protocol)) {
        return;
    }

    document.addEventListener("click", event => {
        const link = event.target.closest("a[href]");

        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) {
            return;
        }

        const destination = new URL(link.href, location.href);
        const htmlPage = destination.pathname.endsWith(".html") || destination.pathname.endsWith("/");
        const samePageAnchor = destination.pathname === location.pathname && destination.search === location.search && destination.hash;

        if (destination.origin !== location.origin || !htmlPage || samePageAnchor) {
            return;
        }

        event.preventDefault();
        navigateTo(destination);
    });

    document.addEventListener("pointerover", event => {
        const link = event.target.closest("a[href]");

        if (!link) {
            return;
        }

        const destination = new URL(link.href, location.href);

        if (destination.origin === location.origin && (destination.pathname.endsWith(".html") || destination.pathname.endsWith("/"))) {
            loadPage(destination).catch(() => {});
        }
    }, { passive: true });

    window.addEventListener("popstate", event => {
        navigateTo(location.href, {
            push: false,
            scrollY: event.state?.scrollY || 0
        });
    });

    history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, "", location.href);

    setTimeout(() => {
        document.querySelectorAll(".site-nav a[href]").forEach(link => {
            const destination = new URL(link.href, location.href);
            loadPage(destination).catch(() => {});
        });
    }, 500);
}

const glideScroller = setupGlideScroll();

document.addEventListener("click", event => {
    if (event.target.closest("button:not(.sound-button), .button, .site-nav a")) {
        playTone(380, 0.045, 0.018);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    initializePage(document);
    setupClientNavigation();
    renderTimer();
    setInterval(tickTimer, 250);
});
