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
        }, {
            threshold: 0.12
        });

        revealItems.forEach(item => {
            revealObserver.observe(item);
        });
    } else {
        revealItems.forEach(item => {
            item.classList.add("visible");
        });
    }

    let soundsEnabled = localStorage.getItem("brownieSounds") !== "off";
    let audioContext;

    const soundButton = document.querySelector(".sound-button");

    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        return audioContext;
    }

    function playTone(
        frequency = 440,
        duration = 0.08,
        volume = 0.035,
        delay = 0
    ) {
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
        gain.gain.exponentialRampToValueAtTime(
            volume,
            start + 0.01
        );
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start + duration
        );

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

        soundButton.setAttribute(
            "aria-label",
            soundsEnabled
                ? "Turn sounds off"
                : "Turn sounds on"
        );

        soundButton.title = soundsEnabled
            ? "Turn sounds off"
            : "Turn sounds on";
    }

    if (soundButton) {
        updateSoundButton();

        soundButton.addEventListener("click", () => {
            soundsEnabled = !soundsEnabled;

            localStorage.setItem(
                "brownieSounds",
                soundsEnabled ? "on" : "off"
            );

            updateSoundButton();

            if (soundsEnabled) {
                playTone(620, 0.12, 0.045);
            }
        });
    }

    document.addEventListener("click", event => {
        const clickableItem = event.target.closest(
            "button:not(.sound-button), .button, .site-nav a"
        );

        if (clickableItem) {
            playTone(380, 0.045, 0.018);
        }
    });

    const servingCount = document.querySelector("#servingCount");

    if (servingCount) {
        const batchCount = document.querySelector("#batchCount");
        const batchWord = document.querySelector("#batchWord");
        const traySize = document.querySelector("#traySize");
        const decreaseButton =
            document.querySelector("#decreaseServings");
        const increaseButton =
            document.querySelector("#increaseServings");
        const ingredientBatchLabel =
            document.querySelector("#ingredientBatchLabel");
        const ingredientAmounts =
            document.querySelectorAll(".ingredient-amount");

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

            return value > 1.0001
                ? `${unit}s`
                : unit;
        }

        function updateRecipe() {
            const servings = batches * 9;
            const batchLabel =
                batches === 1 ? "batch" : "batches";

            servingCount.textContent = servings;
            batchCount.textContent = batches;
            batchWord.textContent = batchLabel;
            traySize.textContent = trays[batches];

            ingredientBatchLabel.textContent =
                `${batches} ${batchLabel}`;

            ingredientAmounts.forEach(cell => {
                const value =
                    Number(cell.dataset.value) * batches;

                const unit =
                    unitLabel(cell.dataset.unit, value);

                cell.textContent =
                    `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
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

    const flavorCards =
        document.querySelectorAll(".flavor-card");

    flavorCards.forEach(card => {
        card.addEventListener("click", () => {
            const open =
                !card.classList.contains("open");

            document
                .querySelectorAll(".flavor-card.open")
                .forEach(otherCard => {
                    if (otherCard !== card) {
                        otherCard.classList.remove("open");

                        otherCard.setAttribute(
                            "aria-expanded",
                            "false"
                        );

                        const action =
                            otherCard.querySelector(
                                ".flavor-action"
                            );

                        if (action) {
                            action.textContent =
                                "View change +";
                        }
                    }
                });

            card.classList.toggle("open", open);

            card.setAttribute(
                "aria-expanded",
                String(open)
            );

            const action =
                card.querySelector(".flavor-action");

            if (action) {
                action.textContent = open
                    ? "Hide change −"
                    : "View change +";
            }
        });
    });

    const timerDisplay =
        document.querySelector("#timerDisplay");

    if (timerDisplay) {
        const timerTexture =
            document.querySelector("#timerTexture");
        const timerStart =
            document.querySelector("#timerStart");
        const timerReset =
            document.querySelector("#timerReset");
        const timerStatus =
            document.querySelector("#timerStatus");
        const timerOptions =
            document.querySelectorAll(".timer-option");

        let selectedSeconds = 1380;
        let remainingSeconds = selectedSeconds;
        let timerInterval = null;
        let running = false;

        function formatTime(seconds) {
            const minutes =
                Math.floor(seconds / 60);

            const leftoverSeconds =
                seconds % 60;

            return (
                `${String(minutes).padStart(2, "0")}:` +
                `${String(leftoverSeconds).padStart(2, "0")}`
            );
        }

        function updateTimerDisplay() {
            timerDisplay.textContent =
                formatTime(remainingSeconds);

            document.title = running
                ? `${formatTime(remainingSeconds)} | Brownie Club`
                : "Bake Timer | Brownie Club";
        }

        function stopTimer(statusText) {
            clearInterval(timerInterval);

            timerInterval = null;
            running = false;

            timerStart.textContent =
                remainingSeconds === 0
                    ? "Start again"
                    : "Start";

            timerStatus.textContent = statusText;

            updateTimerDisplay();
        }

        function startTimer() {
            if (remainingSeconds === 0) {
                remainingSeconds = selectedSeconds;
            }

            running = true;
            timerStart.textContent = "Pause";
            timerStatus.textContent =
                "The brownies are baking.";

            updateTimerDisplay();

            timerInterval = setInterval(() => {
                remainingSeconds -= 1;

                updateTimerDisplay();

                if (remainingSeconds <= 0) {
                    remainingSeconds = 0;

                    stopTimer(
                        "Time to check the brownies."
                    );

                    playChime();

                    if (
                        "Notification" in window &&
                        Notification.permission === "granted"
                    ) {
                        new Notification(
                            "Brownie timer",
                            {
                                body:
                                    "Time to check the brownies."
                            }
                        );
                    }
                }
            }, 1000);
        }

        timerStart.addEventListener("click", () => {
            if (running) {
                stopTimer(
                    "Paused. The oven is still running."
                );
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
            timerStatus.textContent =
                "Ready when you are.";

            updateTimerDisplay();
        });

        timerOptions.forEach(option => {
            option.addEventListener("click", () => {
                clearInterval(timerInterval);

                timerInterval = null;
                running = false;

                selectedSeconds =
                    Number(option.dataset.seconds);

                remainingSeconds = selectedSeconds;

                timerTexture.textContent =
                    option.dataset.texture;

                timerStart.textContent = "Start";

                timerStatus.textContent =
                    `${option.dataset.texture} timer selected.`;

                timerOptions.forEach(item => {
                    item.classList.remove("active");
                });

                option.classList.add("active");

                updateTimerDisplay();
            });
        });

        updateTimerDisplay();
    }
});

