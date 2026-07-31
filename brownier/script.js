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

function initializePage(root = document, duringNavigation = false) {
    initializeRevealAnimations(root, duringNavigation);
    initializeRecipe(root);
    initializeFlavorCards(root);
    initializeTimerControls(root);
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
        currentY += (targetY - currentY) * 0.105;

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
        targetY = clamp(targetY + event.deltaY * unit * 0.92);
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
    const order = ["index.html", "recipe.html", "flavors.html", "timer.html", "game.html", "about.html"];
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
