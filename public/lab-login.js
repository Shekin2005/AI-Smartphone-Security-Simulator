// ==================================================
// SCANNER LOGIN PAGE
// ==================================================
// The page itself is static HTML; this file is the behaviour. It lives outside
// lab-login.html because Helmet's policy is `script-src 'self'` - an inline
// <script> block is silently blocked, and the form then falls back to a native
// GET submit that looks exactly like "the login did nothing". Measured in the
// first Shannon auth validation: the page loaded, Playwright filled the fields,
// clicked, and nothing happened.
//
// The calls are the same ones the phone UI makes:
//   POST /api/auth/login  {app, username, password, role}
//   POST /api/auth/verify {code}
//   GET  /api/auth/me

const params = new URLSearchParams(location.search);

const form = document.getElementById("login-form");
const appSelect = document.getElementById("app");
const statusEl = document.getElementById("status");
const button = document.getElementById("submit");

if (params.get("app") === "acadia") {
  appSelect.value = "acadia";
}

function roleFor(app) {
  return app === "acadia" ? "student" : "bank_user";
}

async function call(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data.error || "HTTP " + response.status);
  }

  return data;
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const app = appSelect.value;
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const totp = document.getElementById("totp").value.trim();

  statusEl.textContent = "Signing in...";
  button.disabled = true;

  try {
    const step = await call("/api/auth/login", {
      app,
      username,
      password,
      role: roleFor(app)
    });

    if (step.next === "enroll") {
      throw new Error("This account still needs MFA enrolment; use a provisioned scan account.");
    }

    if (step.next !== "done") {
      await call("/api/auth/verify", { code: totp });
    }

    const me = await fetch("/api/auth/me", { credentials: "same-origin" })
      .then(response => response.json());

    if (!me.authenticated) {
      throw new Error("The session did not persist after verification.");
    }

    statusEl.textContent = "";
    location.hash = "signed-in";

    const box = document.createElement("div");
    box.id = "signed-in";
    box.textContent = "Signed in as " + username +
      " (app " + me.app + ", role " + me.role + ")";

    statusEl.after(box);
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
