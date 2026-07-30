document.addEventListener("DOMContentLoaded", () => {
    const pageName = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".site-nav a").forEach(link => {
        if (link.getAttribute("href") === pageName) {
            link.classList.add("active");
        }
    });

    const menuButton = document.querySelector(".menu-button");
    const siteNav = document.querySelector(".site-nav");

    if (menuButton && siteNav) {
        menuButton.addEventListener("click", () => {
            const open = siteNav.classList.toggle("open");
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.textContent = open ? "Close" : "Menu";
        });

        siteNav.addEventListener("click", () => {
            siteNav.classList.remove("open");
            menuButton.setAttribute("aria-expanded", "false");
            menuButton.textContent = "Menu";
        });
    }

    const revealItems = document.querySelectorAll(".reveal");

    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        revealItems.forEach(item => revealObserver.observe(item));
    } else {
        revealItems.forEach(item => item.classList.add("visible"));
    }

    let soundsEnabled = localStorage.getItem("brownieSounds") !== "off";
    let audioContext;
    const soundButton = document.querySelector(".sound-button");

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
        if (!soundsEnabled) {
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
            localStorage.setItem("brownieSounds", soundsEnabled ? "on" : "off");
            updateSoundButton();

            if (soundsEnabled) {
                playTone(620, 0.12, 0.045);
            }
        });
    }

    document.addEventListener("click", event => {
        if (event.target.closest("button:not(.sound-button), .button, .site-nav a")) {
            playTone(380, 0.045, 0.018);
        }
    });

    const servingCount = document.querySelector("#servingCount");

    if (servingCount) {
        const batchCount = document.querySelector("#batchCount");
        const batchWord = document.querySelector("#batchWord");
        const traySize = document.querySelector("#traySize");
        const decreaseButton = document.querySelector("#decreaseServings");
        const increaseButton = document.querySelector("#increaseServings");
        const ingredientBatchLabel = document.querySelector("#ingredientBatchLabel");
        const ingredientAmounts = document.querySelectorAll(".ingredient-amount");
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

    document.querySelectorAll(".flavor-card").forEach(card => {
        card.addEventListener("click", () => {
            const open = !card.classList.contains("open");

            document.querySelectorAll(".flavor-card.open").forEach(otherCard => {
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

    const timerDisplay = document.querySelector("#timerDisplay");

    if (timerDisplay) {
        const timerTexture = document.querySelector("#timerTexture");
        const timerStart = document.querySelector("#timerStart");
        const timerReset = document.querySelector("#timerReset");
        const timerStatus = document.querySelector("#timerStatus");
        const timerOptions = document.querySelectorAll(".timer-option");
        let selectedSeconds = 1380;
        let remainingSeconds = selectedSeconds;
        let timerInterval = null;
        let running = false;

        function formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const leftoverSeconds = seconds % 60;
            return `${String(minutes).padStart(2, "0")}:${String(leftoverSeconds).padStart(2, "0")}`;
        }

        function updateTimerDisplay() {
            timerDisplay.textContent = formatTime(remainingSeconds);
            document.title = running ? `${formatTime(remainingSeconds)} | Brownie Club` : "Bake Timer | Brownie Club";
        }

        function stopTimer(statusText) {
            clearInterval(timerInterval);
            timerInterval = null;
            running = false;
            timerStart.textContent = remainingSeconds === 0 ? "Start again" : "Start";
            timerStatus.textContent = statusText;
            updateTimerDisplay();
        }

        function startTimer() {
            if (remainingSeconds === 0) {
                remainingSeconds = selectedSeconds;
            }

            running = true;
            timerStart.textContent = "Pause";
            timerStatus.textContent = "The brownies are baking.";
            updateTimerDisplay();

            timerInterval = setInterval(() => {
                remainingSeconds -= 1;
                updateTimerDisplay();

                if (remainingSeconds <= 0) {
                    remainingSeconds = 0;
                    stopTimer("Time to check the brownies.");
                    playChime();

                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Brownie timer", { body: "Time to check the brownies." });
                    }
                }
            }, 1000);
        }

        timerStart.addEventListener("click", () => {
            if (running) {
                stopTimer("Paused. The oven is still running.");
            } else {
                startTimer();
            }
        });

        timerReset.addEventListener("click", () => {
            clearInterval(timerInterval);
            timerInterval = null;
            running = false;
            remainingSeconds = selectedSeconds;
            timerStart.textContent = "Start";
            timerStatus.textContent = "Ready when you are.";
            updateTimerDisplay();
        });

        timerOptions.forEach(option => {
            option.addEventListener("click", () => {
                clearInterval(timerInterval);
                timerInterval = null;
                running = false;
                selectedSeconds = Number(option.dataset.seconds);
                remainingSeconds = selectedSeconds;
                timerTexture.textContent = option.dataset.texture;
                timerStart.textContent = "Start";
                timerStatus.textContent = `${option.dataset.texture} timer selected.`;

                timerOptions.forEach(item => item.classList.remove("active"));
                option.classList.add("active");
                updateTimerDisplay();
            });
        });

        updateTimerDisplay();
    }

    const canvas = document.querySelector("#stackerCanvas");

    if (canvas) {
        const context = canvas.getContext("2d");
        const scoreElement = document.querySelector("#gameScore");
        const bestElement = document.querySelector("#gameBest");
        const overlay = document.querySelector("#gameOverlay");
        const message = document.querySelector("#gameMessage");
        const startButton = document.querySelector("#gameStart");
        const dropButton = document.querySelector("#gameDrop");
        const worldWidth = canvas.width;
        const worldHeight = canvas.height;
        const blockHeight = 34;
        const baseY = worldHeight - 62;
        let blocks = [];
        let movingBlock = null;
        let running = false;
        let score = 0;
        let best = Number(localStorage.getItem("brownieStackerBest")) || 0;
        let lastTime = performance.now();

        bestElement.textContent = best;

        function makeBlock(x, y, width, direction = 1) {
            return {
                x,
                y,
                width,
                height: blockHeight,
                direction,
                speed: 190 + score * 12
            };
        }

        function startGame() {
            score = 0;
            scoreElement.textContent = score;
            blocks = [makeBlock((worldWidth - 270) / 2, baseY, 270)];
            movingBlock = makeBlock(0, baseY - blockHeight, 270, 1);
            running = true;
            overlay.classList.add("hidden");
            dropButton.disabled = false;
            lastTime = performance.now();
        }

        function endGame() {
            running = false;
            dropButton.disabled = true;
            overlay.classList.remove("hidden");

            if (score > best) {
                best = score;
                localStorage.setItem("brownieStackerBest", String(best));
                bestElement.textContent = best;
                message.textContent = `New best: ${score}. The tower has fallen.`;
            } else {
                message.textContent = `Tower down. You stacked ${score} ${score === 1 ? "brownie" : "brownies"}.`;
            }

            startButton.textContent = "Play Again";
            playTone(150, 0.38, 0.05);
        }

        function dropCurrentBlock() {
            if (!running || !movingBlock) {
                return;
            }

            const previous = blocks[blocks.length - 1];
            const overlapLeft = Math.max(movingBlock.x, previous.x);
            const overlapRight = Math.min(movingBlock.x + movingBlock.width, previous.x + previous.width);
            const overlap = overlapRight - overlapLeft;

            if (overlap <= 0) {
                endGame();
                return;
            }

            const perfect = Math.abs(movingBlock.x - previous.x) < 7;
            const placedWidth = perfect ? previous.width : overlap;
            const placedX = perfect ? previous.x : overlapLeft;
            const placed = makeBlock(placedX, movingBlock.y, placedWidth);

            blocks.push(placed);
            score += 1;
            scoreElement.textContent = score;
            playTone(perfect ? 720 : 500, perfect ? 0.11 : 0.07, 0.035);

            if (placedWidth < 18) {
                endGame();
                return;
            }

            const nextY = placed.y - blockHeight;
            const fromLeft = score % 2 === 0;
            movingBlock = makeBlock(fromLeft ? 0 : worldWidth - placedWidth, nextY, placedWidth, fromLeft ? 1 : -1);
        }

        function drawBrownie(block, offsetY, moving = false) {
            const x = block.x;
            const y = block.y + offsetY;
            const gradient = context.createLinearGradient(x, y, x, y + block.height);
            gradient.addColorStop(0, moving ? "#8c5035" : "#75402d");
            gradient.addColorStop(1, moving ? "#4e281d" : "#3f2118");

            context.fillStyle = gradient;
            context.beginPath();
            context.roundRect(x, y, block.width, block.height, 7);
            context.fill();

            context.strokeStyle = "rgba(255, 232, 196, 0.15)";
            context.lineWidth = 2;
            context.stroke();

            const chipCount = Math.max(1, Math.floor(block.width / 62));
            context.fillStyle = moving ? "#e8b86e" : "#c98b52";

            for (let index = 0; index < chipCount; index += 1) {
                const chipX = x + ((index + 1) * block.width) / (chipCount + 1);
                const chipY = y + 11 + (index % 2) * 8;
                context.beginPath();
                context.arc(chipX, chipY, 3, 0, Math.PI * 2);
                context.fill();
            }
        }

        function drawBackground(offsetY) {
            context.clearRect(0, 0, worldWidth, worldHeight);

            const background = context.createLinearGradient(0, 0, 0, worldHeight);
            background.addColorStop(0, "#1f100c");
            background.addColorStop(1, "#351b13");
            context.fillStyle = background;
            context.fillRect(0, 0, worldWidth, worldHeight);

            context.fillStyle = "rgba(231, 185, 111, 0.06)";

            for (let x = 30; x < worldWidth; x += 70) {
                for (let y = 25; y < worldHeight; y += 70) {
                    context.beginPath();
                    context.arc(x + ((y / 70) % 2) * 16, y, 2, 0, Math.PI * 2);
                    context.fill();
                }
            }

            const floorY = baseY + blockHeight + offsetY + 6;
            context.fillStyle = "rgba(244, 234, 219, 0.1)";
            context.fillRect(0, floorY, worldWidth, worldHeight - floorY);
        }

        function draw(time) {
            const delta = Math.min((time - lastTime) / 1000, 0.05);
            lastTime = time;

            if (running && movingBlock) {
                movingBlock.x += movingBlock.speed * movingBlock.direction * delta;

                if (movingBlock.x <= 0) {
                    movingBlock.x = 0;
                    movingBlock.direction = 1;
                }

                if (movingBlock.x + movingBlock.width >= worldWidth) {
                    movingBlock.x = worldWidth - movingBlock.width;
                    movingBlock.direction = -1;
                }
            }

            const topY = movingBlock ? movingBlock.y : baseY;
            const offsetY = Math.max(0, 125 - topY);
            drawBackground(offsetY);
            blocks.forEach(block => drawBrownie(block, offsetY));

            if (movingBlock) {
                drawBrownie(movingBlock, offsetY, true);
            }

            requestAnimationFrame(draw);
        }

        startButton.addEventListener("click", startGame);
        dropButton.addEventListener("click", dropCurrentBlock);
        canvas.addEventListener("pointerdown", dropCurrentBlock);

        document.addEventListener("keydown", event => {
            if (event.target.matches("input, textarea, select")) {
                return;
            }

            if (event.code === "Space") {
                event.preventDefault();
                dropCurrentBlock();
            }

            if (event.key.toLowerCase() === "r") {
                startGame();
            }
        });

        blocks = [makeBlock((worldWidth - 270) / 2, baseY, 270)];
        requestAnimationFrame(draw);
    }
});
