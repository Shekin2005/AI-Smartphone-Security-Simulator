
// ==================================================
// AI SMARTPHONE SECURITY SIMULATOR
// COMPLETE FRONTEND JAVASCRIPT
// ==================================================

// --------------------------------------------------
// 1. HELPERS
// --------------------------------------------------

const $ = id => document.getElementById(id);

function formatMoney(amountCents) {
    const amount = Number(amountCents) / 100;

    if (!Number.isFinite(amount)) {
        return "Invalid amount";
    }

    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD"
    }).format(amount);
}

function isAuthenticationError(error) {
    const status = Number(
        error?.status ??
        error?.statusCode ??
        error?.response?.status
    );

    return status === 401 || status === 403;
}

function createElement(tag, text, className) {
    const node = document.createElement(tag);

    if (text !== undefined) {
        node.textContent = String(text);
    }

    if (className) {
        node.className = className;
    }

    return node;
}

function appendLine(parent, text, tag = "p") {
    const node = createElement(tag, text);
    parent.appendChild(node);
    return node;
}

function readSavedData(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn("Local storage unavailable:", error);
    }
}

// --------------------------------------------------
// 2. NODE.JS API CONNECTION
// --------------------------------------------------

async function apiRequest(endpoint, method = "GET", body) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 15000);

    try {
        const response = await fetch("/api" + endpoint, {
            method: method,
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: body === undefined
                ? undefined
                : JSON.stringify(body),
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({
            error: "The server returned an invalid response."
        }));

        if (!response.ok) {
            const error = new Error(
                data.error || "Backend request failed."
            );

            error.status = response.status;
            throw error;
        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {
            throw new Error(
                "The server did not respond within 15 seconds."
            );
        }

        if (error instanceof TypeError) {
            throw new Error(
                "Failed to connect to the backend. " +
                "Check that the Node.js server is running."
            );
        }

        throw error;

    } finally {
        clearTimeout(timeout);
    }
}
// --------------------------------------------------
// 3. PHONE STATE
// --------------------------------------------------

let phoneOn = false;
let phoneLocked = true;

const correctPasscode = "1234";
let enteredPasscode = "";

let currentScreen = "off";
let screenBeforeLock = "home";

let screenHistory = [];
let recentApps = [];

const appNames = {
    banking: "🏦 Banking",
    university: "🎓 Acadia Student",
    defender: "🛡️ AI Defender",
    "phone-app": "📞 Phone",
    "browser-app": "🌐 Browser",
    "messages-app": "💬 Messages",
    "camera-app": "📷 Camera"
};

const phoneElement = $("phone");
const powerButton = $("power-button");

// --------------------------------------------------
// 4. SCREEN NAVIGATION
// --------------------------------------------------

function showScreen(screenId) {
    const target = $(screenId);

    if (!target) return;

    if (
        currentScreen === "camera-app" &&
        screenId !== "camera-app"
    ) {
        stopCamera();
    }

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.toggle(
            "active",
            screen.id === screenId
        );
    });

    currentScreen = screenId;
    target.scrollTop = 0;

    if (screenId === "banking") {
        target.classList.add("session-checking");
        void refreshSecureApp("bank").finally(() => {
            target.classList.remove("session-checking");
        });
    }

    if (screenId === "university") {
        void refreshSecureApp("acadia");
    }

    
if (screenId === "defender") {
    void loadSecurityFromBackend();
    void refreshDefenderStatus();
}


}

function openApp(appId) {
    if (!phoneOn || phoneLocked || !appNames[appId]) {
        return;
    }

    if (currentScreen !== appId) {
        screenHistory.push(currentScreen);
    }

    recentApps = [
        appId,
        ...recentApps.filter(id => id !== appId)
    ];

    showScreen(appId);
}

function goHome() {
    if (!phoneOn) return;

    if (phoneLocked) {
        showScreen("lock");
        return;
    }

    if (currentScreen !== "home") {
        screenHistory.push(currentScreen);
    }

    showScreen("home");
}

function goBack() {
    if (!phoneOn) return;

    if (phoneLocked) {
        showScreen("lock");
        return;
    }

    while (screenHistory.length) {
        const previous = screenHistory.pop();

        if (
            !["off", "lock", "password"].includes(previous) &&
            $(previous)
        ) {
            showScreen(previous);
            return;
        }
    }

    showScreen("home");
}

function showRecentApps() {
    if (!phoneOn || phoneLocked) return;

    const list = $("recent-app-list");
    list.replaceChildren();

    if (!recentApps.length) {
        appendLine(list, "No recent applications.");
    }

    recentApps.forEach(id => {
        const button = createElement(
            "button",
            appNames[id],
            "primary-button"
        );

        button.addEventListener("click", () => openApp(id));
        list.appendChild(button);
    });

    if (currentScreen !== "recent-apps") {
        screenHistory.push(currentScreen);
    }

    showScreen("recent-apps");
}

document.querySelectorAll("[data-open]").forEach(button => {
    button.addEventListener("click", () => {
        openApp(button.dataset.open);
    });
});

$("home-button").addEventListener("click", goHome);
$("back-button").addEventListener("click", goBack);
$("recent-button").addEventListener(
    "click",
    showRecentApps
);

// --------------------------------------------------
// 5. PHONE POWER
// --------------------------------------------------

let powerTimer = null;
let powerLongPress = false;
let powerPointer = null;

powerButton.addEventListener("pointerdown", event => {
    event.stopPropagation();

    powerPointer = event.pointerId;
    powerLongPress = false;

    clearTimeout(powerTimer);

    powerTimer = setTimeout(() => {
        if (phoneOn) {
            powerLongPress = true;
            $("power-menu").classList.remove("hidden");
        }
    }, 1500);
});

powerButton.addEventListener("pointerup", event => {
    if (powerPointer !== event.pointerId) return;

    clearTimeout(powerTimer);
    powerPointer = null;

    if (!powerLongPress) {
        togglePower();
    }
});

powerButton.addEventListener("pointercancel", () => {
    clearTimeout(powerTimer);
    powerPointer = null;
});

powerButton.addEventListener("click", event => {
    if (event.detail === 0) {
        togglePower();
    }
});

function togglePower() {
    if (!phoneOn) {
        phoneOn = true;
        phoneLocked = true;
        showScreen("lock");
        return;
    }

    if (phoneLocked) {
        showScreen("lock");
        return;
    }

    screenBeforeLock = currentScreen;
    phoneLocked = true;

    clearPasscode();
    showScreen("lock");
}

async function logoutServerSession() {
    try {
        await apiRequest("/auth/logout", "POST", {});
    } catch (error) {
        console.warn("Server logout:", error.message);
    }

    resetSecureScreens();
}

async function powerOffPhone() {
    await logoutServerSession();

    phoneOn = false;
    phoneLocked = true;
    screenHistory = [];
    recentApps = [];

    clearPasscode();
    closePowerMenu();
    showScreen("off");
}

async function restartPhone() {
    await logoutServerSession();

    phoneOn = true;
    phoneLocked = true;
    screenHistory = [];
    recentApps = [];

    clearPasscode();
    closePowerMenu();
    showScreen("lock");
}

function closePowerMenu() {
    $("power-menu").classList.add("hidden");
}

$("power-off-option").addEventListener(
    "click",
    powerOffPhone
);

$("restart-option").addEventListener(
    "click",
    restartPhone
);

$("cancel-power").addEventListener(
    "click",
    closePowerMenu
);

// --------------------------------------------------
// 6. PHONE PASSCODE
// --------------------------------------------------

$("unlock-button").addEventListener("click", () => {
    if (phoneOn && phoneLocked) {
        $("password-message").textContent = "";
        showScreen("password");
    }
});

function updatePasscodeDots() {
    document.querySelectorAll(".dot").forEach(
        (dot, index) => {
            dot.classList.toggle(
                "filled",
                index < enteredPasscode.length
            );
        }
    );
}

function clearPasscode() {
    enteredPasscode = "";
    updatePasscodeDots();
}

function deleteDigit() {
    enteredPasscode = enteredPasscode.slice(0, -1);
    updatePasscodeDots();
}

function enterDigit(digit) {
    if (
        !phoneOn ||
        !phoneLocked ||
        currentScreen !== "password"
    ) {
        return;
    }

    if (enteredPasscode.length >= 4) return;

    enteredPasscode += digit;
    updatePasscodeDots();

    if (enteredPasscode.length !== 4) return;

    if (enteredPasscode === correctPasscode) {
        phoneLocked = false;
        clearPasscode();

        const destination =
            appNames[screenBeforeLock]
                ? screenBeforeLock
                : "home";

        showScreen(destination);
    } else {
        clearPasscode();

        $("password-message").textContent =
            "Incorrect phone passcode.";
    }
}

document.querySelectorAll("[data-digit]").forEach(button => {
    button.addEventListener("click", () => {
        enterDigit(button.dataset.digit);
    });
});

$("clear-pin").addEventListener(
    "click",
    clearPasscode
);

$("delete-pin").addEventListener(
    "click",
    deleteDigit
);

document.addEventListener("keydown", event => {
    if (currentScreen !== "password") return;

    if (/^[0-9]$/.test(event.key)) {
        enterDigit(event.key);
    }

    if (event.key === "Backspace") {
        deleteDigit();
    }

    if (event.key === "Escape") {
        clearPasscode();
    }
});

// --------------------------------------------------
// 7. 3D PHONE ROTATION
// --------------------------------------------------


// ==========================================
// 7. FREE 3D SMARTPHONE ROTATION
// ==========================================

let dragging = false;

// Initial phone viewing angle
let rotateX = 4;
let rotateY = -12;

let lastX = 0;
let lastY = 0;

// Users can drag the phone from its outer frame.
phoneElement.addEventListener("pointerdown", event => {

    // Keep buttons and phone apps working normally.
    if (event.target.closest(
        ".display, .side-button, button, input, select, a"
    )) {
        return;
    }

    dragging = true;

    lastX = event.clientX;
    lastY = event.clientY;

    phoneElement.classList.add("dragging");

    phoneElement.setPointerCapture(event.pointerId);
});

// Rotate in any direction while dragging.
phoneElement.addEventListener("pointermove", event => {

    if (!dragging) return;

    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;

    // Horizontal movement rotates left/right.
    rotateY += deltaX * 0.6;

    // Vertical movement rotates up/down.
    rotateX -= deltaY * 0.6;

    // Apply angles without changing phone size.
    phoneElement.style.setProperty(
        "--rotate-x",
        rotateX + "deg"
    );

    phoneElement.style.setProperty(
        "--rotate-y",
        rotateY + "deg"
    );

    lastX = event.clientX;
    lastY = event.clientY;
});

// Stop rotation when mouse or touch is released.
function stopDragging() {
    dragging = false;
    phoneElement.classList.remove("dragging");
}

phoneElement.addEventListener(
    "pointerup",
    stopDragging
);

phoneElement.addEventListener(
    "pointercancel",
    stopDragging
);


// --------------------------------------------------
// 8. VOLUME
// --------------------------------------------------

let volume = 50;
let volumeTimer = null;

function changeVolume(amount) {
    volume = Math.max(
        0,
        Math.min(100, volume + amount)
    );

    $("volume-fill").style.width = volume + "%";
    $("volume-percent").textContent = volume + "%";

    $("volume-overlay").classList.add("visible");

    clearTimeout(volumeTimer);

    volumeTimer = setTimeout(() => {
        $("volume-overlay").classList.remove("visible");
    }, 1500);
}

$("volume-up").addEventListener("click", () => {
    changeVolume(10);
});

$("volume-down").addEventListener("click", () => {
    changeVolume(-10);
});

// --------------------------------------------------
// 9. CLOCK
// --------------------------------------------------

function updateClock() {
    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    $("clock").textContent = time;
    $("lock-time").textContent = time;

    $("lock-date").textContent =
        now.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric"
        });
}

updateClock();
setInterval(updateClock, 60000);

// --------------------------------------------------
// 10. AUTHENTICATION PANELS
// --------------------------------------------------

const authPanels = [
    "login",
    "register",
    "enroll",
    "otp",
    "dashboard"
];

const authStage = {
    bank: "login",
    acadia: "login"
};

function showAuthPanel(app, panel) {
    if (
        !["bank", "acadia"].includes(app) ||
        !authPanels.includes(panel)
    ) {
        return;
    }

    authStage[app] = panel;

    authPanels.forEach(name => {
        $(`${app}-${name}`).hidden = name !== panel;
    });
}

function resetSecureScreens() {
    showAuthPanel("bank", "login");
    showAuthPanel("acadia", "login");

    ["bank", "acadia"].forEach(app => {
        const password = $(`${app}-password`);
        const otp = $(`${app}-otp-input`);
        const qr = $(`${app}-qr`);

        if (password) password.value = "";
        if (otp) otp.value = "";
        if (qr) qr.removeAttribute("src");

        $(`${app}-manual-key`).textContent = "";
    });

    $("balance").textContent = "—";
    $("savings-balance").textContent = "—";
    $("transactions").replaceChildren();
    // These two panels are optional: the Account Numbers / link-code UI is not
    // present in every build. Guard them so a missing panel cannot abort the
    // reset that runs on every sign-out.
    $("bank-account-numbers")?.replaceChildren();
    $("bank-link-output")?.replaceChildren();
    showBankPanel("transfer");

    [
        "acadia-courses",
        "acadia-grades",
        "acadia-finance",
        "acadia-profile"
    ].forEach(id => $(id).replaceChildren());
}

function togglePassword(inputId) {
    const input = $(inputId);

    input.type = input.type === "password"
        ? "text"
        : "password";
}

document.querySelectorAll(
    "[data-toggle-password]"
).forEach(button => {
    button.addEventListener("click", () => {
        togglePassword(button.dataset.togglePassword);
    });
});

document.querySelectorAll(
    "[data-auth-panel]"
).forEach(button => {
    button.addEventListener("click", () => {
        const [app, panel] =
            button.dataset.authPanel.split(":");

        showAuthPanel(app, panel);
    });
});

// --------------------------------------------------
// 11. ACCOUNT REGISTRATION
// --------------------------------------------------

async function registerAccount(app) {
    const username = $(
        `${app}-register-username`
    ).value.trim();

    const passwordInput = $(
        `${app}-register-password`
    );

    const message = $(
        `${app}-register-message`
    );

    const password = passwordInput.value;

    message.textContent = "";

    if (password.length < 12) {
        message.textContent =
            "Password must have at least 12 characters.";
        return;
    }

    try {
        const result = await apiRequest(
            "/auth/register",
            "POST",
            {
                app,
                username,
                password
            }
        );

        passwordInput.value = "";

        showAuthPanel(app, "login");

        $(`${app}-login-message`).textContent =
            result.message ||
            "Account created. Please sign in.";

    } catch (error) {
        passwordInput.value = "";
        message.textContent = error.message;
    }
}

document.querySelectorAll("[data-register]").forEach(
    button => {
        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await registerAccount(
                    button.dataset.register
                );
            } finally {
                button.disabled = false;
            }
        });
    }
);

// --------------------------------------------------
// 12. PASSWORD LOGIN
// --------------------------------------------------

async function loginApp(app) {

    const usernameInput = $(`${app}-username`);
    const passwordInput = $(`${app}-password`);
    const message = $(`${app}-login-message`);

    if (!usernameInput || !passwordInput || !message) {
        console.error(
            "Missing login HTML elements for:", app
        );
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    message.textContent = "";

    if (!username) {
        message.textContent = "Please enter your username.";
        return;
    }

    if (!password) {
        message.textContent = "Please enter your password.";
        return;
    }

    message.textContent = "Checking login credentials...";

    try {

        const result = await apiRequest(
  "/auth/login",
  "POST",
  {
    app: app,
    username: username,
    password: password,
    role: app === "acadia"
      ? "student"
      : "bank_user"
  }
);

        passwordInput.value = "";

        if (result.next === "enroll") {

            message.textContent =
                "Password verified. Setting up MFA...";

            const setup = await apiRequest(
                "/auth/enroll",
                "POST",
                {}
            );

            $(`${app}-qr`).src = setup.qr;

            $(`${app}-manual-key`).textContent =
                "Manual key: " + setup.manualKey;

            showAuthPanel(app, "enroll");

        } else if (
            result.next === "otp" ||
            result.next === "verify"
        ) {

            message.textContent = "";

            showAuthPanel(app, "otp");

        } else {

            message.textContent =
                "The server returned an unexpected login step.";
        }

    } catch (error) {

        console.error(
            "Authentication failed:",
            error.message,
            error.status
        );

        if (error.status === 401) {

            message.textContent =
                "Incorrect username or password, " +
                "or the login was not authorized.";

            passwordInput.value = "";

        } else if (error.status === 429) {

            message.textContent =
                "Too many login attempts. Please try again later.";

        } else {

            message.textContent =
                "Login error: " + error.message;
        }
    }
}

document.querySelectorAll("[data-login]").forEach(button => {

    button.addEventListener("click", async () => {

        button.disabled = true;

        try {
            await loginApp(button.dataset.login);
        } finally {
            button.disabled = false;
        }

    });
});

// --------------------------------------------------
// 13. AUTHENTICATOR VERIFICATION
// --------------------------------------------------


async function verifyApp(app) {

    const input = $(`${app}-otp-input`);
    const message = $(`${app}-otp-message`);

    message.textContent = "";

    try {

        // Send the six-digit authenticator code to the backend.
        const verified = await apiRequest(
            "/auth/verify",
            "POST",
            {
                code: input.value.trim()
            }
        );

        console.log("BANKING MFA DEBUG:", {
  requestedApp: app,
  verifiedApp: verified.app,
  verifiedRole: verified.role
});

        console.log("MFA verification response:", {
  app: verified.app,
  role: verified.role
});

        // Confirm the correct application was authenticated.
        if (verified.app !== app) {
            throw new Error(
                "The authenticated application does not match."
            );
        }

        // Only students can open the Acadia Student Dashboard.
        if (
            app === "acadia" &&
            verified.role !== "student"
        ) {
            throw new Error(
                "This account is not authorized for the Student Dashboard."
            );
        }

        // Only banking users can open the Banking Dashboard.
        if (
            app === "bank" &&
            verified.role !== "bank_user"
        ) {
            throw new Error(
                "This account is not authorized for Banking."
            );
        }

        // Clear the authenticator input.
        input.value = "";

        // Remove the QR code and manual secret.
        $(`${app}-qr`).removeAttribute("src");
        $(`${app}-manual-key`).textContent = "";

        // Open the correct dashboard.
        showAuthPanel(app, "dashboard");

        if (app === "bank") {
            await loadBankFromBackend();
        } else {
            await loadAcadiaFromBackend();
        }

    } catch (error) {

        console.error("MFA error:", error.status, error.message);

        message.textContent = error.message;

        if (error.status === 429) {

            showAuthPanel(app, "login");

            $(`${app}-login-message`).textContent =
                error.message;
        }
    }
}


document.querySelectorAll("[data-verify]").forEach(
    button => {
        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await verifyApp(button.dataset.verify);
            } finally {
                button.disabled = false;
            }
        });
    }
);

// --------------------------------------------------
// 14. CANCEL AND LOGOUT
// --------------------------------------------------

async function cancelVerification(app) {
    try {
        await apiRequest("/auth/logout", "POST", {});
    } catch (error) {
        console.warn(error.message);
    }

    resetSecureScreens();
}

async function logoutApp() {
    try {
        await apiRequest("/auth/logout", "POST", {});
    } catch (error) {
        console.warn(error.message);
    }

    resetSecureScreens();
}

document.querySelectorAll("[data-cancel]").forEach(
    button => {
        button.addEventListener("click", () => {
            void cancelVerification(
                button.dataset.cancel
            );
        });
    }
);

document.querySelectorAll("[data-logout]").forEach(
    button => {
        button.addEventListener("click", () => {
            void logoutApp();
        });
    }
);

// --------------------------------------------------
// 15. RESTORE SERVER SESSION
// --------------------------------------------------

async function refreshSecureApp(app) {
    const expectedScreen = app === "bank"
        ? "banking"
        : "university";

    if (currentScreen !== expectedScreen) return;

    try {
        const session = await apiRequest("/auth/me");

        if (
            session.authenticated &&
            session.app === app
        ) {
            showAuthPanel(app, "dashboard");

            if (app === "bank") {
                await loadBankFromBackend();
            } else {
                await loadAcadiaFromBackend();
            }

            return;
        }

        // Do not erase an in-progress MFA flow.
        if (
            authStage[app] === "enroll" ||
            authStage[app] === "otp"
        ) {
            return;
        }

        showAuthPanel(app, "login");

    } catch (error) {
        console.error("Session check:", error.message);

        if (
            authStage[app] !== "enroll" &&
            authStage[app] !== "otp"
        ) {
            showAuthPanel(app, "login");
        }
    }
}

// --------------------------------------------------
// 16. BANKING BALANCES
// --------------------------------------------------

async function loadBankFromBackend() {
    const message = $('bank-message');
    try {
        const accounts = await apiRequest('/bank/accounts');
        for (const account of accounts.accounts || []) {
            const balance=(Number(account.balance_cents)/100).toFixed(2);
            if(account.kind==='chequing') $('balance').textContent=balance;
            if(account.kind==='savings') $('savings-balance').textContent=balance;
        }
        // Each history endpoint is independent: one unavailable feature
        // must not hide successful account transfers or balances.
        const [internal,person,payments,scholarships]=await Promise.allSettled([
            apiRequest('/bank/transfers'),
            apiRequest('/bank/person-transfers'),
            apiRequest('/bank/payments'),
            apiRequest('/bank/scholarship-credits')
        ]);
        const rows=[];
        if(internal.status==='fulfilled') for(const t of internal.value.transfers||[]) {
            rows.push({date:t.created_at,text:`${t.from_kind} → ${t.to_kind}: ${formatMoney(t.amount_cents)}`});
        }
        if(person.status==='fulfilled') for(const t of person.value.transfers||[]) {
            const description=t.direction==='outgoing'
                ? `Sent to ${t.recipient_username} (${t.from_kind})`
                : `Received from ${t.sender_username} (Chequing)`;
            rows.push({date:t.created_at,text:`${description}: ${formatMoney(t.amount_cents)}`});
        }
        if(payments.status==='fulfilled') for(const p of payments.value.payments||[]) {
            rows.push({date:p.created_at,text:`Acadia tuition AC${String(p.student_user_id).padStart(8,'0')}: ${formatMoney(p.amount_cents)}`});
        }
        if(scholarships.status==='fulfilled') for(const a of scholarships.value.credits||[]) {
            rows.push({date:a.created_at,text:`Scholarship credit · ${a.description}: ${formatMoney(a.amount_cents)}`});
        }
        rows.sort((x,y)=>new Date(y.date)-new Date(x.date));
        const list=$('transactions');
        if(!list) throw new Error('Activity list is missing from index.html.');
        list.replaceChildren();
        if(!rows.length) appendLine(list,'No transactions yet.','li');
        for(const row of rows) appendLine(list,`${new Date(row.date).toLocaleString()} — ${row.text}`,'li');
        for(const result of [internal,person,payments,scholarships]) {
            if(result.status==='rejected') console.warn('History endpoint unavailable:',result.reason);
        }
        if(message) message.textContent='';
    } catch(error) {
        console.error('Banking dashboard error:',error);
        if(message) message.textContent=error.message;
        if(isAuthenticationError(error)) showAuthPanel('bank','login');
    }
}

// --------------------------------------------------
// 17. BANKING PANELS
// --------------------------------------------------

function showBankPanel(panel) {
    const panels={transfer:'bank-transfer-panel',transactions:'bank-transactions-panel',
        tuition:'bank-tuition-panel',recipients:'bank-recipients-panel',details:'bank-details-panel'};
    if(!Object.hasOwn(panels,panel)) return;
    for(const [name,id] of Object.entries(panels)) {
        const element=$(id);
        if(element) element.hidden=name!==panel;
    }
}

document.querySelectorAll('[data-bank-panel]').forEach(button=>{
    button.addEventListener('click',async()=>{
        const panel=button.dataset.bankPanel;
        showBankPanel(panel);
        if(panel==='transactions') await loadBankFromBackend();
        if(panel==='recipients') await loadBankRecipients();
        if(panel==='details') await loadBankAccountNumbers();
        const bankScreen=$('banking');
        if(bankScreen) bankScreen.scrollTop=0;
    });
});

async function loadBankAccountNumbers() {
    const output = $("bank-account-numbers");

    if (!output) return;

    const status = document.createElement("li");
    status.textContent = "Loading account numbers...";
    output.replaceChildren(status);

    try {
        const { accounts } = await apiRequest("/bank/account-details");
        if (status.parentNode !== output) return;
        if (!accounts.length) {
            status.textContent = "No accounts found.";
            return;
        }
        output.replaceChildren(...accounts.map(account => {
            const row = document.createElement("li");
            const kind = account.kind === "chequing" ? "Chequing" : "Savings";
            row.textContent = kind + " " + account.account_number;
            return row;
        }));
    } catch (error) {
        if (status.parentNode === output) status.textContent = error.message;
    }
}

// Optional panel. Without this guard the whole file stopped executing here
// and every binding below it - transfers, tuition lookup, contacts, messages,
// camera and initializeSimulator() - was never registered.
$("bank-generate-link")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    const output = $("bank-link-output");
    const status = document.createTextNode("Generating verification code...");
    button.disabled = true;
    output.replaceChildren(status);

    try {
        const result = await apiRequest("/bank/link-code", "POST", {});
        if (status.parentNode === output) {
            output.textContent =
                "Chequing " + result.account_number + ". Code " + result.verification_code +
                ". Enter both in Acadia Student under Banking Information within " +
                result.expires_in_minutes + " minutes.";
        }
    } catch (error) {
        if (status.parentNode === output) output.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

// --------------------------------------------------
// 18. BANKING TRANSFERS
// --------------------------------------------------

async function transferMoney() {
    const from = $("bank-from").value;
    const to = $("bank-to").value;
    const amount = $("amount").value.trim();
    const message = $("bank-message");

    message.textContent = "";

    // Accept only amounts with at most two decimals.
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
        message.textContent =
            "Enter a valid amount, such as 25.50.";
        return;
    }

    const amountCents = Math.round(
        Number(amount) * 100
    );

    if (
        !Number.isSafeInteger(amountCents) ||
        amountCents < 1 ||
        from === to
    ) {
        message.textContent = "Invalid transfer.";
        return;
    }

    const button = $("transfer-button");
    button.disabled = true;

    try {
        const result = await apiRequest(
            "/bank/transfer",
            "POST",
            {
                from,
                to,
                amountCents,
                requestId: crypto.randomUUID()
            }
        );

        message.textContent = result.message;

        $("amount").value = "";

        await loadBankFromBackend();

    } catch (error) {
        message.textContent = error.message;

        if (isAuthenticationError(error)) {
            showAuthPanel("bank", "login");
        }
    } finally {
        button.disabled = false;
    }
}

$("transfer-button").addEventListener(
    "click",
    transferMoney
);

// --------------------------------------------------
// FICTIONAL ACADIA TUITION PAYMENT
// --------------------------------------------------
let confirmedTuitionStudentId = null;
$("tuition-lookup").addEventListener("click", async () => {
    const id=$("tuition-student-id").value.trim().toUpperCase();
    confirmedTuitionStudentId=null;
    $("tuition-student-info").textContent="Looking up student...";
    try {
        const result=await apiRequest("/bank/tuition/student/"+encodeURIComponent(id));
        confirmedTuitionStudentId=result.student.studentId;
        $("tuition-student-info").textContent=
            `${result.student.name} | Tuition owing: ${formatMoney(result.student.tuitionCents)}`;
    } catch(error) {$("tuition-student-info").textContent=error.message;}
});
$("tuition-student-id").addEventListener("input",()=>{confirmedTuitionStudentId=null;$("tuition-student-info").textContent="Find the student again.";});
$("tuition-pay").addEventListener("click",async () => {
    const button=$("tuition-pay"), message=$("tuition-message");
    const amount=$("tuition-amount").value.trim();
    if(!confirmedTuitionStudentId) {message.textContent="Find and verify the student first.";return;}
    if(!/^\d+(\.\d{1,2})?$/.test(amount)) {message.textContent="Enter a valid CAD amount.";return;}
    const amountCents=Math.round(Number(amount)*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<1) {message.textContent="Invalid amount.";return;}
    if(!confirm(`Pay ${formatMoney(amountCents)} to Acadia student ${confirmedTuitionStudentId}? (Fictional funds only)`)) return;
    button.disabled=true;
    try {
        const result=await apiRequest("/bank/pay-tuition","POST",{
            studentId:confirmedTuitionStudentId,from:$("tuition-from").value,
            amountCents,requestId:crypto.randomUUID()
        });
        message.textContent=`${result.message}. Receipt #${result.receiptId}`;
        $("tuition-amount").value="";
        await loadBankFromBackend();
        $("tuition-lookup").click();
    } catch(error) {message.textContent=error.message;}
    finally {button.disabled=false;}
});


// --------------------------------------------------
// BANKING RECIPIENTS AND PERSON-TO-PERSON TRANSFERS
// --------------------------------------------------
async function loadBankRecipients() {
    const list=$('recipient-list'), select=$('person-recipient');
    if(!list || !select) return;
    try {
        const result=await apiRequest('/bank/recipients');
        list.replaceChildren();select.replaceChildren();
        for(const recipient of result.recipients||[]) {
            const item=document.createElement('li');
            const label=document.createElement('span');label.textContent=recipient.username+' ';
            const remove=document.createElement('button');remove.type='button';
            remove.textContent='Remove';
            remove.addEventListener('click',async()=>{
                if(!confirm(`Remove ${recipient.username} from saved recipients?`)) return;
                try {
                    await apiRequest('/bank/recipients/'+encodeURIComponent(recipient.id),'DELETE');
                    await loadBankRecipients();
                } catch(error) {$('recipient-message').textContent=error.message;}
            });
            item.append(label,remove);list.appendChild(item);
            const option=document.createElement('option');
            option.value=String(recipient.id);option.textContent=recipient.username;
            select.appendChild(option);
        }
        if(!result.recipients.length) appendLine(list,'No saved recipients.','li');
    } catch(error) {
        console.error('Recipients could not load:',error.status,error.message);
        $('recipient-message').textContent='Could not load recipients: '+error.message;
    }
}

$('recipient-add')?.addEventListener('click',async()=>{
    const button=$('recipient-add'), message=$('recipient-message');
    const username=$('recipient-username').value.trim();
    button.disabled=true;message.textContent='';
    try {
        const result=await apiRequest('/bank/recipients','POST',{username});
        message.textContent=result.message;
        $('recipient-username').value='';
        await loadBankRecipients();
    } catch(error) {
        console.error('Recipient save failed:',error.status,error.message);
        message.textContent='Recipient not saved: '+error.message;
    }
    finally {button.disabled=false;}
});

$('person-send')?.addEventListener('click',async()=>{
    const button=$('person-send'),message=$('person-message');
    const recipientId=$('person-recipient').value;
    const from=$('person-from').value;
    const amount=$('person-amount').value.trim();
    if(!recipientId) {message.textContent='Add and select a recipient first.';return;}
    if(!/^\d+(\.\d{1,2})?$/.test(amount)) {message.textContent='Enter a valid amount, such as 25.50.';return;}
    const amountCents=Math.round(Number(amount)*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<1||amountCents>100000000) {
        message.textContent='Invalid amount.';return;
    }
    const name=$('person-recipient').selectedOptions[0]?.textContent||'recipient';
    if(!confirm(`Send ${formatMoney(amountCents)} of fictional funds to ${name}?`)) return;
    button.disabled=true;message.textContent='Processing...';
    // Keep the same request ID if an uncertain network outcome needs manual investigation.
    const requestId=crypto.randomUUID();
    try {
        const result=await apiRequest('/bank/send-money','POST',{
            recipientId,from,amountCents,requestId
        });
        message.textContent=result.message+' Receipt #'+result.receiptId;
        $('person-amount').value='';
        await loadBankFromBackend();
    } catch(error) {
        message.textContent=error.message+' Check Activity before retrying.';
    } finally {button.disabled=false;}
});

// --------------------------------------------------
// 19. ACADIA STUDENT RECORDS
// --------------------------------------------------

async function loadAcadiaFromBackend() {
    try {
        const [profileData, courseData] =
            await Promise.all([
                apiRequest("/acadia/profile"),
                apiRequest("/acadia/courses")
            ]);

        const student = profileData.profile;

        const profile = $("acadia-profile");
        const courses = $("acadia-courses");
        const grades = $("acadia-grades");
        const finance = $("acadia-finance");

        const saved_profile = document.getElementById("school-profile-requests");
        profile.replaceChildren();
        if (saved_profile) profile.appendChild(saved_profile);
        const saved_courses = document.getElementById("school-catalog");
        courses.replaceChildren();
        if (saved_courses) courses.appendChild(saved_courses);
        const saved_grades = document.getElementById("school-grades");
        grades.replaceChildren();
        if (saved_grades) grades.appendChild(saved_grades);
        const saved_finance = document.getElementById("school-finance");
        finance.replaceChildren();
        if (saved_finance) finance.appendChild(saved_finance);

        appendLine(profile, "Student Profile", "h3");
        appendLine(courses, "Registered Courses", "h3");
        appendLine(finance, "Student Account", "h3");
        if(student) appendLine(finance, "Simulator Student ID: AC" + String(student.user_id).padStart(8,"0"));

        if (student) {
            appendLine(
                profile,
                "Name: " + student.display_name
            );

            appendLine(
                profile,
                "Program: " + student.program
            );

            appendLine(
                profile,
                "Year: " + student.year_of_study
            );

            appendLine(
                finance,
                "Fictional tuition balance:"
            );

            appendLine(
                finance,
                formatMoney(student.tuition_cents),
                "h2"
            );
        }

        try {
            const payments=await apiRequest("/acadia/payments");
            appendLine(finance,"Tuition Payment History","h3");
            if(!payments.payments.length) appendLine(finance,"No payments yet.");
            payments.payments.forEach(p=>appendLine(finance,
                `${new Date(p.created_at).toLocaleString()} — ${formatMoney(p.amount_cents)} — Receipt #${p.id}`));
        } catch(error) {appendLine(finance,"Could not load payments: "+error.message);}

        if (!courseData.courses.length) {
            appendLine(courses, "No registered courses.");
        }

        for (const course of courseData.courses) {
            const card = createElement(
                "div",
                undefined,
                "course-card"
            );

            appendLine(card, course.code, "strong");
            appendLine(card, course.title);
            appendLine(card, course.term);

            courses.appendChild(card);
        }

        const previousGrades = courseData.courses.filter(
            course => course.grade != null && course.grade !== ""
        );
        if (previousGrades.length) {
            appendLine(grades, "Previously recorded course grades", "h3");
            for (const course of previousGrades) {
                appendLine(grades, course.code + ": " + course.grade);
            }
        }

        if (typeof window.refreshAcademicEnhancements === "function") {
            await window.refreshAcademicEnhancements();
        }

    } catch (error) {
        $("acadia-profile").textContent =
            error.message;

        if (isAuthenticationError(error)) {
            showAuthPanel("acadia", "login");
        }
    }
}

window.loadAcadiaFromBackend = loadAcadiaFromBackend;

// --------------------------------------------------
// 20. ACADIA TABS
// --------------------------------------------------

function showAcadiaTab(tab) {
    const allowed = [
    "courses",
    "grades",
    "schedule",
    "finance",
    "profile",
    "graduation",
    "degree",
    "planning", "catalog", "banking", "verification", "transcripts", "attendance"
];

    if (!allowed.includes(tab)) return;

    allowed.forEach(name => {

    const panel = $(`acadia-${name}`);

    if (panel) {
        panel.hidden = name !== tab;
    }

});

    document.querySelectorAll("[data-tab]").forEach(
        button => {
            button.classList.toggle(
                "active",
                button.dataset.tab === tab
            );
        }
    );
}

document.querySelectorAll("[data-tab]").forEach(
    button => {
        button.addEventListener("click", () => {
            showAcadiaTab(button.dataset.tab);
        });
    }
);

// --------------------------------------------------
// 21. AI SECURITY DEFENDER
// --------------------------------------------------


// ==========================================
// AI DEFENDER - LOAD ATTACK HISTORY
// ==========================================

async function loadSecurityFromBackend() {

    const list = $("security-logs");

    // Clear previously displayed attack cards.
    list.replaceChildren();

    // Update one dashboard statistic.
    function setCount(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = String(value);
        }
    }

    // Add a labeled detail to an attack card.
    function addField(parent, label, value) {

        const box = createElement("div");

        box.appendChild(
            createElement("small", label)
        );

        box.appendChild(
            createElement(
                "span",
                value == null || value === ""
                    ? "—"
                    : String(value)
            )
        );

        parent.appendChild(box);
    }

    try {

        // Retrieve recorded incidents from PostgreSQL
        // through the existing Node.js backend.
        const response = await apiRequest("/security/defender/events");

        const events = Array.isArray(response.events)
            ? response.events
            : [];

        // Count attacks.
        const total = events.length;

        const blocked = events.filter(event =>
            String(event.outcome).toLowerCase() === "blocked"
        ).length;

        const succeeded = events.filter(event =>
            String(event.outcome).toLowerCase() === "succeeded"
        ).length;

        // Update the three dashboard statistics.
        setCount("attack-count", total);
        setCount("blocked-count", blocked);
        setCount("succeeded-count", succeeded);

        $("security-status").textContent =
            "Recorded training incidents";

        // Show a message if there are no incidents.
        if (events.length === 0) {

            appendLine(
                list,
                "No recorded attacks for this account yet."
            );

            return;
        }

        // Create one card for each recorded attack.
        events.forEach(event => {

            const outcome = String(
                event.outcome || "Unknown"
            );

            const outcomeClass = outcome.toLowerCase();

            const card = createElement(
                "article",
                undefined,
                "defender-incident " + outcomeClass
            );

            // Attack type and result.
            const header = createElement(
                "div",
                undefined,
                "defender-incident-header"
            );

            const attackType = String(
                event.scenario || "Security event"
            )
                .replaceAll("_", " ")
                .replace(/\b\w/g, letter => letter.toUpperCase());

            header.appendChild(
                createElement("strong", attackType)
            );

            header.appendChild(
                createElement(
                    "span",
                    outcome,
                    "defender-outcome " + outcomeClass
                )
            );

            card.appendChild(header);

            // Details grid.
            const grid = createElement(
                "div",
                undefined,
                "defender-incident-grid"
            );

            // The attacker username comes from the backend.
            addField(
                grid,
                "Attacker",
                event.actor_username || "Unknown"
            );

            // Translate internal target names.
            let targetName = event.target;

            if (event.target === "school") {
                targetName = "Acadia Student";
            } else if (event.target === "bank") {
                targetName = "Banking";
            }

            addField(grid, "Target", targetName);

            // The affected fictional record.
            addField(
                grid,
                "Record",
                event.record_id
            );

            // What the attacker attempted.
            addField(
                grid,
                "Attempted change",
                event.attempted_value
            );

            // Attack date and time.
            const detectedAt = event.created_at
                ? new Date(
                    event.created_at
                ).toLocaleString()
                : "Unknown";

            addField(
                grid,
                "Detected",
                detectedAt
            );

            // Vulnerable or protected mode.
            addField(
                grid,
                "Mode",
                event.mode
            );

            // Defender status at the time of the attack,
            // if that information was saved by the backend.
            const defenderAtAttack =
                event.defender_enabled == null
                    ? "Not recorded"
                    : event.defender_enabled
                        ? "ON"
                        : "OFF";

            addField(
                grid,
                "Defender",
                defenderAtAttack
            );

            card.appendChild(grid);

            // Explanation from the backend.
            if (event.detail) {

                card.appendChild(
                    createElement(
                        "p",
                        event.detail,
                        "defender-explanation"
                    )
                );
            }

            list.appendChild(card);

        });

    } catch (error) {

        // Show a useful message when the backend fails.
        $("security-status").textContent =
            isAuthenticationError(error)
                ? "Sign in to Banking or Acadia"
                : "Unable to load attack history";

        setCount("attack-count", "—");
        setCount("blocked-count", "—");
        setCount("succeeded-count", "—");

        appendLine(list, error.message);
    }
}

$("refresh-security").addEventListener(
    "click",
    loadSecurityFromBackend
);


// --------------------------------------------------
// 21A. AI DEFENDER ON/OFF SWITCH
// --------------------------------------------------

async function refreshDefenderStatus() {

    const toggle = $("defender-toggle");
    const message = $("defender-toggle-message");

    try {
        const result = await apiRequest("/security/defender");

        toggle.checked = result.enabled;
        
// Update the ON/OFF badge in the AI Defender dashboard.
const badge = $("defender-status-badge");

if (badge) {

    badge.textContent = result.enabled
        ? "ON"
        : "OFF";

    badge.className =
        "defender-badge " +
        (result.enabled ? "on" : "off");
}

        toggle.disabled = false;

        message.textContent = result.enabled
            ? "🟢 Defender protection setting is on."
            : "🔴 Defender protection setting is off.";

    } catch (error) {

        toggle.disabled = true;

        message.textContent = error.status === 401
            ? "Sign in to Banking or Acadia first."
            : error.message;
    }
}

// Save Defender ON/OFF to PostgreSQL.
$("defender-toggle").addEventListener(
    "change",
    async event => {

        const toggle = event.currentTarget;
        toggle.disabled = true;

        try {
            await apiRequest(
                "/security/defender",
                "POST",
                {
                    enabled: toggle.checked
                }
            );

        } catch (error) {
            $("defender-toggle-message").textContent =
                error.message;
        }

        await refreshDefenderStatus();
    }
);


// --------------------------------------------------
// 23. CONTACTS
// --------------------------------------------------

let contacts = readSavedData(
    "smartphone_contacts_v4",
    []
);

function saveContacts() {
    saveData(
        "smartphone_contacts_v4",
        contacts
    );
}

function saveContact() {
    const name = $("contact-name").value.trim();
    const number = $("contact-number").value.trim();

    if (!name || !number) {
        $("contact-message").textContent =
            "Enter a name and phone number.";
        return;
    }

    contacts.push({
        id: crypto.randomUUID(),
        name,
        number
    });

    saveContacts();

    $("contact-name").value = "";
    $("contact-number").value = "";

    $("contact-message").textContent =
        "Contact saved.";

    displayContacts();
}

function displayContacts() {
    const list = $("contacts-list");
    const recipient = $("message-recipient");
    const selected = recipient.value;

    list.replaceChildren();
    recipient.replaceChildren();

    if (!contacts.length) {
        appendLine(
            list,
            "No contacts saved."
        );
    }

    contacts.forEach(contact => {
        const card = createElement(
            "div",
            undefined,
            "contact-card"
        );

        appendLine(card, contact.name, "strong");
        appendLine(card, contact.number);

        const actions = createElement(
            "div",
            undefined,
            "contact-actions"
        );

        const callButton = createElement(
            "button",
            "Call"
        );

        callButton.addEventListener("click", () => {
            callNumber(contact.number);
        });

        const editButton = createElement(
            "button",
            "Edit"
        );

        editButton.addEventListener("click", () => {
            editContact(contact.id);
        });

        const deleteButton = createElement(
            "button",
            "Delete"
        );

        deleteButton.addEventListener("click", () => {
            deleteContact(contact.id);
        });

        actions.append(
            callButton,
            editButton,
            deleteButton
        );

        card.appendChild(actions);
        list.appendChild(card);

        const option = createElement(
            "option",
            contact.name
        );

        option.value = contact.id;
        recipient.appendChild(option);
    });

    if (contacts.some(c => c.id === selected)) {
        recipient.value = selected;
    }

    displayConversation();
}

function editContact(id) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    const name = prompt(
        "Edit contact name:",
        contact.name
    );

    if (name === null) return;

    const number = prompt(
        "Edit phone number:",
        contact.number
    );

    if (number === null) return;

    if (!name.trim() || !number.trim()) return;

    contact.name = name.trim();
    contact.number = number.trim();

    saveContacts();
    displayContacts();
}

function deleteContact(id) {
    if (!confirm("Delete this contact?")) return;

    contacts = contacts.filter(c => c.id !== id);

    saveContacts();
    displayContacts();
}

$("save-contact").addEventListener(
    "click",
    saveContact
);

// --------------------------------------------------
// 24. PHONE CALLS
// --------------------------------------------------

function callNumber(number) {
    if (!number.trim()) {
        $("call-status").textContent =
            "Enter a phone number.";
        return;
    }

    $("call-status").textContent =
        "Calling " + number + "... (simulation)";
}

function endCall() {
    $("call-status").textContent =
        "Call ended.";
}

$("dial-button").addEventListener("click", () => {
    callNumber($("dial-number").value);
});

$("end-call").addEventListener(
    "click",
    endCall
);

// --------------------------------------------------
// 25. MESSAGES
// --------------------------------------------------

let messages = readSavedData(
    "smartphone_messages_v4",
    []
);

function saveMessages() {
    saveData(
        "smartphone_messages_v4",
        messages
    );
}

function displayConversation() {
    const recipient = $("message-recipient").value;
    const box = $("message-conversation");

    box.replaceChildren();

    messages
        .filter(m => m.recipient === recipient)
        .forEach(message => {
            const bubble = createElement(
                "div",
                message.text,
                "message-bubble message-" +
                message.direction
            );

            const time = createElement(
                "span",
                message.time,
                "message-time"
            );

            bubble.appendChild(time);
            box.appendChild(bubble);
        });

    box.scrollTop = box.scrollHeight;
}

function sendMessage() {
    const recipient = $("message-recipient").value;
    const text = $("message-input").value.trim();

    if (!recipient || !text) {
        $("message-status").textContent =
            "Select a contact and type a message.";
        return;
    }

    messages.push({
        recipient,
        text,
        direction: "sent",
        time: new Date().toLocaleTimeString()
    });

    $("message-input").value = "";
    $("message-status").textContent =
        "Message sent (simulation).";

    saveMessages();
    displayConversation();

    setTimeout(() => {
        messages.push({
            recipient,
            text: "Thanks! This is a simulated reply.",
            direction: "received",
            time: new Date().toLocaleTimeString()
        });

        saveMessages();
        displayConversation();
    }, 1200);
}

$("message-recipient").addEventListener(
    "change",
    displayConversation
);

$("send-message").addEventListener(
    "click",
    sendMessage
);

// --------------------------------------------------
// 26. BROWSER
// --------------------------------------------------

function openWebsite() {
    let address = $("browser-address").value.trim();

    if (!address) {
        $("browser-message").textContent =
            "Enter a website address.";
        return;
    }

    if (!/^https?:\/\//i.test(address)) {
        address = "https://" + address;
    }

    try {
        const url = new URL(address);

        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            throw new Error("Unsupported protocol");
        }

        window.open(
            url.href,
            "_blank",
            "noopener,noreferrer"
        );

        $("browser-message").textContent =
            "Website opened in a new tab.";

    } catch {
        $("browser-message").textContent =
            "Invalid website address.";
    }
}

$("open-website").addEventListener(
    "click",
    openWebsite
);

// --------------------------------------------------
// 27. CAMERA
// --------------------------------------------------

let cameraStream = null;

async function startCamera() {
    stopCamera();

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

        if (currentScreen !== "camera-app") {
            stream.getTracks().forEach(
                track => track.stop()
            );
            return;
        }

        cameraStream = stream;

        const video = $("camera-preview");
        video.srcObject = stream;

        await video.play();

        $("camera-message").textContent =
            "Camera is ready.";

    } catch (error) {
        $("camera-message").textContent =
            "Camera unavailable or permission denied.";
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(
            track => track.stop()
        );

        cameraStream = null;
    }

    $("camera-preview").srcObject = null;
}

function takePhoto() {
    const video = $("camera-preview");

    if (!cameraStream || !video.videoWidth) {
        $("camera-message").textContent =
            "Start the camera first.";
        return;
    }

    const canvas = $("camera-canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const image = canvas.toDataURL("image/png");

    $("captured-photo").src = image;
    $("captured-photo").hidden = false;

    $("download-photo").href = image;
    $("download-photo").hidden = false;

    $("camera-message").textContent =
        "Photo captured.";
}

$("start-camera").addEventListener(
    "click",
    startCamera
);

$("stop-camera").addEventListener(
    "click",
    stopCamera
);

$("take-photo").addEventListener(
    "click",
    takePhoto
);

// --------------------------------------------------
// 28. INITIALIZATION
// --------------------------------------------------

function initializeSimulator() {
    showAuthPanel("bank", "login");
    showAuthPanel("acadia", "login");

    showBankPanel("transfer");
    showAcadiaTab("courses");

    displayContacts();
    updateClock();

    showScreen("off");
}

initializeSimulator();
