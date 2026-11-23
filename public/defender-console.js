/* ==================================================
   AI DEFENDER — STRIX SCAN CONSOLE
   ==================================================
   Talks to /strix-api on this same origin (the Express proxy),
   which forwards to the scanner container. That keeps the CSP
   and the Origin guard exactly as they are.

   app.js owns the protection switch and the incident log; this
   file only collapses/expands that strip and never rebinds those
   elements.
   ================================================== */

(() => {
  "use strict";

  const API = "/strix-api";
  const REMEMBER_KEY = "sx.console.v1";

  const TARGETS = {
    bank: { apps: ["bank"], label: "bank app" },
    school: { apps: ["acadia"], label: "school app" },
    both: { apps: ["bank", "acadia"], label: "bank + school" },
    url: { apps: [], label: "url" },
    github: { apps: [], label: "github" },
    "api-spec": { apps: [], label: "api spec" },
    source: { apps: [], label: "source" }
  };

  const DEFAULT_BASE = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com",
    openrouter: "https://openrouter.ai/api/v1",
    groq: "https://api.groq.com/openai/v1",
    // Native Gemini routing needs no base URL; the scanner clears it anyway.
    google: "",
    ollama: "http://host.docker.internal:11434",
    custom: ""
  };

  // A suggested starting model per provider. The field stays free text, so any
  // model the provider offers can still be typed in.
  const DEFAULT_MODEL = {
    openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
    // Verified live against this project's key. gemini-3.8-flash does not
    // exist. gemini-3.5-flash works but refuses security work outright
    // ("I cannot perform security scans"), which wastes a whole scan.
    // Flash-Lite complies and emits tool calls, so it is the default.
    google: "gemini-3.5-flash-lite",
    ollama: "qwen3:4b"
  };

  const state = {
    target: "bank",
    scanId: null,
    streaming: null,
    chatHistory: [],
    timer: null,
    startedAt: 0,
    finished: false,
    streamErrors: 0
  };

  const $ = id => document.getElementById(id);

  function clear(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  // --------------------------------------------------
  // Remembered settings (never the API key)
  // --------------------------------------------------

  function loadMemory() {
    try {
      return JSON.parse(sessionStorage.getItem(REMEMBER_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveMemory(patch) {
    try {
      sessionStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({ ...loadMemory(), ...patch })
      );
    } catch {
      /* storage disabled; the form simply will not persist */
    }
  }

  // --------------------------------------------------
  // Small helpers
  // --------------------------------------------------

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const mins = String(Math.floor(total / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function formatTook(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    if (total < 60) return `${total}s`;

    const mins = Math.floor(total / 60);
    const secs = total % 60;

    if (mins < 60) {
      return secs ? `${mins}m ${secs}s` : `${mins}m`;
    }

    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      credentials: "same-origin",
      ...options
    });

    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    if (!response.ok) {
      const raw = body && (body.error || body.detail);
      const message =
        typeof raw === "string"
          ? raw
          : raw
            ? JSON.stringify(raw)
            : `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return body;
  }

  function showError(message) {
    const box = $("sx-run-error");
    if (!box) return;

    if (!message) {
      box.hidden = true;
      box.textContent = "";
      return;
    }

    box.hidden = false;
    box.textContent = message;
  }

  function setStatus(text) {
    const node = $("sx-status-line");
    if (node) node.textContent = text;
  }

  // --------------------------------------------------
  // Collapsible protection strip
  // --------------------------------------------------

  function initStrip() {
    const button = $("sx-strip-toggle");
    const strip = $("sx-strip");

    if (!button || !strip) return;

    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", open ? "false" : "true");
      strip.hidden = open;
    });
  }

  // --------------------------------------------------
  // Model section
  // --------------------------------------------------

  function initModel() {
    const provider = $("sx-provider");
    const model = $("sx-model");
    const key = $("sx-key");
    const base = $("sx-baseurl");

    if (!provider) return;

    const memory = loadMemory();

    if (memory.provider) provider.value = memory.provider;
    if (memory.model) model.value = memory.model;
    if (memory.baseUrl) base.value = memory.baseUrl;

    // A first visit should land on a provider with a real zero-cost tier
    // rather than a paid default the user has to notice and change.
    if (!memory.provider && !provider.value) provider.value = "openrouter";

    // A placeholder is never submitted, so an untouched model field would
    // post an empty string and the scan would be rejected. Fill the field
    // itself, but never overwrite a model the user typed in.
    function suggestModel(force) {
      const next = DEFAULT_MODEL[provider.value];

      // On load, only fill an empty field. On an explicit provider change,
      // always take that provider's default: a model left over from another
      // provider (or a mistyped one) is the fastest way to a failed scan.
      if (!next) return;
      if (!force && model.value.trim()) return;

      model.value = next;
      saveMemory({ model: next });
    }

    base.placeholder = DEFAULT_BASE[provider.value] || "";
    model.placeholder = DEFAULT_MODEL[provider.value] || "gpt-4o-mini";
    suggestModel(false);

    provider.addEventListener("change", () => {
      base.placeholder = DEFAULT_BASE[provider.value] || "";
      model.placeholder = DEFAULT_MODEL[provider.value] || "gpt-4o-mini";
      suggestModel(true);
      saveMemory({ provider: provider.value });
    });

    model.addEventListener("change", () =>
      saveMemory({ model: model.value.trim() })
    );

    base.addEventListener("change", () =>
      saveMemory({ baseUrl: base.value.trim() })
    );

    // The key is intentionally never persisted.
    key.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        void startScan();
      }
    });
  }

  function modelSettings() {
    const provider = $("sx-provider");
    const model = $("sx-model");
    const key = $("sx-key");
    const base = $("sx-baseurl");

    return {
      provider: provider ? provider.value : "openai",
      model: model ? model.value.trim() : "",
      llm_api_key: key ? key.value.trim() : "",
      base_url: base ? base.value.trim() : ""
    };
  }

  // --------------------------------------------------
  // Target section
  // --------------------------------------------------

  function initTargets() {
    const buttons = Array.from(document.querySelectorAll("#defender .sx-target"));

    buttons.forEach(button => {
      button.setAttribute(
        "aria-pressed",
        button.dataset.target === state.target ? "true" : "false"
      );

      button.addEventListener("click", () => {
        state.target = button.dataset.target;
        buttons.forEach(other =>
          other.setAttribute(
            "aria-pressed",
            other === button ? "true" : "false"
          )
        );
        renderTargetFields();
      });
    });

    renderTargetFields();
  }

  function field(label, control, hint) {
    const wrapper = el("label", "sx-field");
    wrapper.appendChild(el("span", null, label));
    wrapper.appendChild(control);

    if (hint) {
      wrapper.appendChild(el("span", "sx-hint", hint));
    }

    return wrapper;
  }

  function credentialBlock(appName, title) {
    const memory = loadMemory();
    const saved = (memory.credentials || {})[appName] || {};

    const wrapper = el("div");

    wrapper.appendChild(el("p", "sx-label", title));

    const username = el("input");
    username.type = "text";
    username.autocomplete = "off";
    username.spellcheck = false;
    username.placeholder = appName === "bank" ? "scan-bank" : "scan-student";
    username.value = saved.username || "";

    const password = el("input");
    password.type = "password";
    password.autocomplete = "new-password";
    password.placeholder = "ScanLab!2026pass";
    password.value = saved.password || "";

    const totp = el("input");
    totp.type = "password";
    totp.autocomplete = "new-password";
    totp.spellcheck = false;
    totp.placeholder = "base32 secret";
    totp.value = saved.totp_secret || "";

    wrapper.appendChild(field("USERNAME", username));
    wrapper.appendChild(field("PASSWORD", password));
    wrapper.appendChild(
      field(
        "TOTP SECRET",
        totp,
        "Printed by: node create-scan-account.js --app " +
          appName +
          " --username " +
          username.placeholder
      )
    );

    wrapper.appendChild(
      el(
        "span",
        "sx-hint",
        "These three fields are remembered in this tab only, never on the server."
      )
    );

    function snapshot() {
      return {
        username: username.value.trim(),
        password: password.value,
        totp_secret: totp.value.trim(),
        role: appName === "bank" ? "bank_user" : "student"
      };
    }

    function remember() {
      const memory = loadMemory();
      const credentials = memory.credentials || {};
      credentials[appName] = snapshot();
      saveMemory({ credentials });
    }

    [username, password, totp].forEach(input =>
      input.addEventListener("change", remember)
    );

    return { wrapper, snapshot };
  }

  function renderTargetFields() {
    const host = $("sx-target-fields");
    if (!host) return;

    clear(host);

    const target = TARGETS[state.target];
    state.credentials = state.credentials || {};

    target.apps.forEach(appName => {
      const block = credentialBlock(
        appName,
        appName === "bank" ? "BANK ACCOUNT" : "SCHOOL ACCOUNT"
      );
      host.appendChild(block.wrapper);
      state.credentials[appName] = block;
    });

    if (state.target === "url" || state.target === "github") {
      const input = el("input");
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder =
        state.target === "github"
          ? "https://github.com/owner/repo"
          : "https://example.com";

      host.appendChild(
        field(
          state.target === "github" ? "REPOSITORY URL" : "TARGET URL",
          input,
          state.target === "github"
            ? "Public repositories need no login."
            : "Include http:// or https://"
        )
      );

      state.targetInput = input;
      return;
    }

    if (state.target === "api-spec" || state.target === "source") {
      const input = el("input");
      input.type = "file";
      input.accept =
        state.target === "source"
          ? ".zip,.tar,.gz,.tgz"
          : ".json,.yaml,.yml";

      host.appendChild(
        field(
          state.target === "source" ? "PROJECT ARCHIVE (.ZIP)" : "API SPEC FILE",
          input,
          state.target === "source"
            ? "Zip the VS Code folder first: right-click > Send to > Compressed (zipped) folder."
            : "OpenAPI / Swagger document"
        )
      );

      state.targetInput = input;
      return;
    }

    state.targetInput = null;
  }

  // --------------------------------------------------
  // Run section
  // --------------------------------------------------

  function initRun() {
    const start = $("sx-start");
    const cancel = $("sx-cancel");

    if (start) start.addEventListener("click", () => void startScan());
    if (cancel) cancel.addEventListener("click", () => void cancelScan());
  }

  function startTimer() {
    stopTimer();
    state.startedAt = Date.now();
    state.finished = false;

    const tick = () => {
      const timer = $("sx-timer");
      if (timer) {
        timer.textContent = formatClock((Date.now() - state.startedAt) / 1000);
      }
    };

    tick();
    state.timer = setInterval(tick, 500);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function setRunning(running) {
    const start = $("sx-start");
    const cancel = $("sx-cancel");

    if (start) start.disabled = running;
    if (cancel) cancel.disabled = !running;
  }

  function appendLog(line) {
    const log = $("sx-log");
    if (!log) return;

    const node = el("div", null, line);
    const lower = line.toLowerCase();

    if (lower.includes("error") || lower.includes("failed") || lower.includes("traceback")) {
      node.classList.add("is-error");
    } else if (lower.includes("warn")) {
      node.classList.add("is-warn");
    }

    log.appendChild(node);
    log.scrollTop = log.scrollHeight;
  }

  function resetOutput() {
    const log = $("sx-log");
    if (log) clear(log);

    const report = $("sx-report");
    if (report) report.textContent = "Scan running...";

    const took = $("sx-took");
    if (took) took.textContent = "scan in progress";

    document.querySelectorAll("#sx-counts b").forEach(node => {
      node.textContent = "0";
    });

    document.querySelectorAll("#defender .sx-downloads button").forEach(button => {
      button.disabled = true;
    });
  }

  async function startScan() {
    showError("");

    const target = TARGETS[state.target];
    const settings = modelSettings();

    // A local Ollama ignores the key entirely, so do not demand one for it.
    const keyRequired = settings.provider !== "ollama";

    if (keyRequired && !settings.llm_api_key) {
      showError(
        "No API key. Paste it into the API KEY field in section 01 — it is " +
          "cleared whenever the page reloads."
      );

      // Take the user to the field instead of leaving them to find it.
      const keyField = $("sx-key");
      if (keyField) {
        keyField.scrollIntoView({ behavior: "smooth", block: "center" });
        keyField.focus({ preventScroll: true });
      }

      return;
    }

    if (!settings.model) {
      showError("Add a model name in section 01, for example gpt-4o-mini.");
      return;
    }

    const credentials = {};
    for (const appName of target.apps) {
      const block = state.credentials && state.credentials[appName];
      if (!block) continue;

      const values = block.snapshot();

      if (!values.username || !values.password) {
        showError(
          `Enter the ${appName} username and password in section 02.`
        );
        return;
      }

      if (!values.totp_secret) {
        showError(
          `Enter the ${appName} TOTP secret in section 02. Run ` +
            "node create-scan-account.js to get one."
        );
        return;
      }

      credentials[appName] = values;
    }

    const mode = $("sx-mode") ? $("sx-mode").value : "quick";
    const budget = $("sx-budget") ? $("sx-budget").value.trim() : "";

    const payload = {
      target_kind: state.target,
      apps: target.apps,
      mode,
      model: settings.model,
      provider: settings.provider,
      base_url: settings.base_url,
      llm_api_key: settings.llm_api_key,
      max_budget: budget,
      credentials
    };

    if (state.target === "url" || state.target === "github") {
      const value = state.targetInput ? state.targetInput.value.trim() : "";
      if (!value) {
        showError("Enter the URL in section 02.");
        return;
      }
      payload.target_url = value;
    }

    let body;
    const options = { method: "POST" };

    if (state.target === "api-spec" || state.target === "source") {
      const input = state.targetInput;
      if (!input || !input.files || !input.files.length) {
        showError("Choose a file to upload in section 02.");
        return;
      }

      body = new FormData();
      Object.entries(payload).forEach(([name, value]) => {
        body.append(
          name,
          typeof value === "object" ? JSON.stringify(value) : String(value)
        );
      });
      body.append("file", input.files[0]);
      options.body = body;
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(payload);
    }

    resetOutput();
    setRunning(true);
    setStatus("starting");
    startTimer();

    try {
      const created = await request("/api/scans", options);

      state.scanId = created.scan_id;
      state.chatHistory = [];

      const chatLog = $("sx-chat-log");
      if (chatLog) clear(chatLog);

      setStatus("running");
      follow(created.scan_id);
    } catch (error) {
      showError(error.message);
      setStatus("failed");
      setRunning(false);
      stopTimer();
    }
  }

  function follow(scanId) {
    if (state.streaming) {
      state.streaming.close();
      state.streaming = null;
    }

    const source = new EventSource(`${API}/api/scans/${scanId}/stream`, {
      withCredentials: true
    });

    state.streaming = source;
    state.streamErrors = 0;

    source.onmessage = event => {
      state.streamErrors = 0;
      try {
        appendLog(JSON.parse(event.data));
      } catch {
        appendLog(event.data);
      }
    };

    source.addEventListener("done", () => {
      source.close();
      state.streaming = null;
      void finishScan(scanId);
    });

    source.onerror = () => {
      // CLOSED means the browser has given up for good (the scan is gone, or
      // the stream was rejected). CONNECTING means it will retry by itself,
      // so let it - a live scan must not be abandoned on a brief blip.
      if (source.readyState === EventSource.CLOSED) {
        if (state.streaming === source) state.streaming = null;
        void finishScan(scanId);
        return;
      }

      state.streamErrors = (state.streamErrors || 0) + 1;

      if (state.streamErrors >= 6) {
        source.close();
        if (state.streaming === source) state.streaming = null;
        void finishScan(scanId);
      }
    };
  }

  async function cancelScan() {
    if (!state.scanId) return;

    setRunning(false);

    try {
      await request(`/api/scans/${state.scanId}/cancel`, { method: "POST" });
      setStatus("cancelled");
      stopTimer();
    } catch (error) {
      showError(error.message);
    }
  }

  async function finishScan(scanId) {
    stopTimer();
    setRunning(false);
    state.finished = true;

    try {
      const scan = await request(`/api/scans/${scanId}`);

      setStatus(scan.status);

      const elapsed = scan.duration_seconds
        ? scan.duration_seconds
        : (Date.now() - state.startedAt) / 1000;

      const timer = $("sx-timer");
      if (timer) timer.textContent = formatClock(elapsed);

      const took = $("sx-took");
      if (took) {
        took.textContent =
          scan.status === "completed" || scan.status === "failed"
            ? `finished in ${formatTook(elapsed)}`
            : scan.status;
      }

      renderCounts(scan.counts || {});
      enableDownloads(scan.artifacts || {});

      if (scan.status === "failed" && scan.error) {
        showError(scan.error);
      }

      await loadReport(scanId);
    } catch (error) {
      // Never leave the console sitting on RUNNING: if the scan cannot be
      // read back, say so and reset the controls.
      if (error.status === 404) {
        setStatus("scan lost");
        showError(
          "The scanner restarted and no longer has this scan. Start a new scan."
        );
      } else {
        setStatus("error");
        showError(error.message);
      }

      const took = $("sx-took");
      if (took) took.textContent = "no report - scan ended early";

      renderCounts({});
      enableDownloads({});
    }
  }

  function renderCounts(counts) {
    document.querySelectorAll("#sx-counts span").forEach(span => {
      const value = counts[span.dataset.sev] || 0;
      const bold = span.querySelector("b");
      if (bold) bold.textContent = String(value);
    });
  }

  function enableDownloads(artifacts) {
    const finished = Object.keys(artifacts || {}).length > 0;

    document.querySelectorAll("#defender .sx-downloads button").forEach(button => {
      const kind = button.dataset.kind;

      // The PDF is rendered on demand from the report, so it never appears in
      // the artifact list. Disabling it made a working download look broken.
      const ready = kind === "pdf" ? finished : Boolean(artifacts[kind]);

      button.disabled = !ready;
    });
  }

  async function loadReport(scanId) {
    const target = $("sx-report");
    if (!target) return;

    try {
      const response = await fetch(`${API}/api/scans/${scanId}/report/md`, {
        credentials: "same-origin"
      });

      if (!response.ok) {
        target.textContent =
          "Strix did not write a Markdown report for this run. " +
          "The log in section 04 shows what happened.";
        return;
      }

      target.textContent = await response.text();
    } catch {
      target.textContent = "Report unavailable.";
    }
  }

  function initDownloads() {
    document.querySelectorAll("#defender .sx-downloads button").forEach(button => {
      button.addEventListener("click", () => void download(button));
    });
  }

  async function download(button) {
    if (!state.scanId) return;

    const kind = button.dataset.kind;
    const previous = button.textContent;

    button.disabled = true;
    button.textContent = "...";

    try {
      const response = await fetch(
        `${API}/api/scans/${state.scanId}/report/${kind}`,
        { credentials: "same-origin" }
      );

      if (!response.ok) {
        let message = `Download failed (${response.status})`;

        try {
          const body = await response.json();
          if (body.error) message = body.error;
        } catch {
          /* keep the status message */
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `strix-${state.scanId}.${kind}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      showError(error.message);
    } finally {
      button.textContent = previous;
      button.disabled = false;
    }
  }

  // --------------------------------------------------
  // Chat with the report
  // --------------------------------------------------

  function addMessage(role, text) {
    const log = $("sx-chat-log");
    if (!log) return null;

    const bubble = el(
      "div",
      "sx-msg " + (role === "user" ? "sx-msg-user" : "sx-msg-ai"),
      text
    );

    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;

    return bubble;
  }

  function initChat() {
    const send = $("sx-chat-send");
    const input = $("sx-chat-q");

    if (send) send.addEventListener("click", () => void sendChat());

    if (input) {
      input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void sendChat();
        }
      });
    }
  }

  async function sendChat() {
    const input = $("sx-chat-q");
    const send = $("sx-chat-send");

    if (!input || !send) return;

    const question = input.value.trim();

    if (!question) return;

    if (!state.scanId) {
      addMessage("assistant", "Run a scan first — then you can ask about its report.")
        .classList.add("sx-msg-err");
      return;
    }

    const settings = modelSettings();

    if (!settings.llm_api_key || !settings.model) {
      const bubble = addMessage(
        "assistant",
        "Add your API key and model in section 01 so the assistant can answer."
      );
      bubble.classList.add("sx-msg-err");
      return;
    }

    input.value = "";
    addMessage("user", question);

    const answer = addMessage("assistant", "");
    send.disabled = true;

    let received = "";

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: state.scanId,
          question,
          provider: settings.provider,
          model: settings.model,
          llm_api_key: settings.llm_api_key,
          base_url: settings.base_url,
          history: state.chatHistory
        })
      });

      if (!response.ok) {
        let message = `Chat failed (${response.status})`;

        try {
          const body = await response.json();
          if (body.error || body.detail) message = body.error || body.detail;
        } catch {
          /* keep status message */
        }

        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const log = $("sx-chat-log");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        received += decoder.decode(value, { stream: true });
        answer.textContent = received;

        if (log) log.scrollTop = log.scrollHeight;
      }

      state.chatHistory.push(
        { role: "user", content: question },
        { role: "assistant", content: received }
      );
    } catch (error) {
      answer.textContent = error.message;
      answer.classList.add("sx-msg-err");
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  // --------------------------------------------------
  // Start
  // --------------------------------------------------

  function init() {
    initStrip();
    initModel();
    initTargets();
    initRun();
    initDownloads();
    initChat();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
