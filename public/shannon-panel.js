// ==================================================
// SHANNON PANEL - the engine switch on AI Pentest
// ==================================================
// Two engines share this screen:
//
//   In-container agent  tools/ai-agent.mjs, streams over SSE, seconds
//   Shannon (WSL2)      runs on the host; this script drives it through
//                       /api/shannon/* and polls, because a scan can run an hour
//
// Shannon cannot run in the container: it needs Docker for its worker, and the
// app has no Docker socket by design. So it runs in WSL2 behind a loopback
// bridge and the app proxies to it.
// ==================================================

(function () {
  "use strict";

  const screen = document.getElementById("defender");
  const runButton = document.getElementById("ai-agent-run");
  const logBox = document.getElementById("ai-agent-log");
  const statusLine = document.getElementById("ai-agent-status");
  const badge = document.getElementById("ai-agent-badge");
  const reportLink = document.getElementById("ai-agent-report");
  const stepsWrap = document.getElementById("ai-steps-wrap");
  const profileSelect = document.getElementById("shannon-profile");
  const profileWrap = document.getElementById("shannon-profile-wrap");
  const validateButton = document.getElementById("shannon-validate");
  const engineButtons = Array.from(document.querySelectorAll("[data-ai-engine]"));

  if (!runButton || !logBox || !engineButtons.length) {
    return;
  }

  const REPORT_HREF = "/api/shannon/report?download=1";
  const POLL_MS = 3000;

  let engine = "agent";
  let pollTimer = null;
  let logOffset = 0;
  let pollFailures = 0;
  let running = false;

  // The in-container panel reads this before starting its own run.
  window.__pentestEngine = engine;

  function setBadge(text, state) {
    if (!badge) return;
    badge.textContent = text;
    badge.dataset.state = state;
  }

  function setStatus(text) {
    if (statusLine) {
      statusLine.textContent = text;
    }
  }

  function append(line) {
    const atBottom =
      logBox.scrollTop + logBox.clientHeight >= logBox.scrollHeight - 40;

    logBox.textContent += line + "\n";

    if (atBottom) {
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  function armReport(ready) {
    if (!reportLink) return;

    if (ready) {
      reportLink.setAttribute("href", REPORT_HREF);
      reportLink.removeAttribute("aria-disabled");
      reportLink.style.opacity = "1";
    } else {
      reportLink.setAttribute("href", "#");
      reportLink.setAttribute("aria-disabled", "true");
      reportLink.style.opacity = "0.45";
    }
  }

  function setBusy(next) {
    running = next;
    runButton.disabled = next;
    runButton.textContent = next ? "Running…" : "▶ Run AI Pentest";

    if (profileSelect) profileSelect.disabled = next;
    if (validateButton) validateButton.disabled = next;
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ---- health -------------------------------------------------------------

  async function checkHealth({ quiet = false } = {}) {
    let health;

    try {
      const response = await fetch("/api/shannon/health", {
        headers: { Accept: "application/json" }
      });
      health = await response.json();
    } catch (error) {
      health = { ok: false, error: error.message };
    }

    const checks = health.checks || {};

    if (health.configured === false) {
      return {
        ready: false,
        text:
          "Bridge not configured: SHANNON_BRIDGE_TOKEN is empty on the app. " +
          "Start tools/shannon-bridge.mjs and restart sim-app."
      };
    }

    if (!health.ok) {
      return {
        ready: false,
        text:
          health.error ||
          "Bridge unreachable. Start it on the host: node tools/shannon-bridge.mjs",
        hint: health.hint
      };
    }

    if (!checks.wsl) {
      return { ready: false, text: "WSL2 not available on this host." };
    }

    if (!checks.node) {
      return {
        ready: false,
        text: "Node 22+ not found in WSL (/tmp/node22). Install it, then reload."
      };
    }

    if (!checks.docker) {
      return { ready: false, text: "Docker not reachable inside WSL." };
    }

    if (!checks.keyConfigured) {
      return { ready: false, text: "SHANNON_AI_API_KEY is not set on the bridge." };
    }

    return {
      ready: true,
      text: `Ready — WSL2, Node ${checks.node}, Docker ${checks.docker}. Model: ${checks.model}`
    };
  }

  async function refreshHealth() {
    if (engine !== "shannon") return;

    const result = await checkHealth();

    setStatus(result.text);
    setBadge(result.ready ? "READY" : "OFFLINE", result.ready ? "idle" : "error");

    if (!result.ready) {
      append("[!] " + result.text);

      if (result.hint) {
        append("    " + result.hint);
      }
    }
  }

  // ---- polling ------------------------------------------------------------

  async function poll() {
    let state;

    try {
      const response = await fetch("/api/shannon/status", {
        headers: { Accept: "application/json" }
      });
      state = await response.json();
      pollFailures = 0;
    } catch (error) {
      pollFailures += 1;

      if (pollFailures >= 3) {
        stopPolling();
        setBusy(false);
        setBadge("ERROR", "error");
        setStatus("Lost contact with the bridge: " + error.message);
      }

      return;
    }

    // Pull whatever new lines the bridge has buffered.
    try {
      const response = await fetch(`/api/shannon/logs?offset=${logOffset}`, {
        headers: { Accept: "application/json" }
      });
      const chunk = await response.json();

      if (Array.isArray(chunk.lines) && chunk.lines.length) {
        for (const line of chunk.lines) {
          append(line);
        }

        logOffset = chunk.next ?? logOffset + chunk.lines.length;
      }
    } catch {
      /* a missed poll is harmless; the next one catches up */
    }

    const phase = state.phase && state.phase !== "none" ? ` · ${state.phase}` : "";
    const minutes = Math.floor((state.elapsedSec || 0) / 60);
    const seconds = String((state.elapsedSec || 0) % 60).padStart(2, "0");

    setStatus(
      `${state.state}${phase} — ${minutes}:${seconds} elapsed` +
        (state.error ? ` — ${state.error}` : "")
    );

    if (!state.running) {
      stopPolling();
      setBusy(false);

      if (state.state === "completed") {
        append("");
        append("— Shannon run complete —");
        setBadge("DONE", "idle");
        setStatus("Finished. Download the report above.");
        armReport(true);
      } else if (state.state === "stopped") {
        append("");
        append("[stopped] run cancelled.");
        setBadge("STOPPED", "idle");
        setStatus("Stopped.");
      } else {
        append("");
        append("— Shannon run failed —");
        setBadge("ERROR", "error");
        setStatus(state.error || "The run failed. See the transcript above.");
      }
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(poll, POLL_MS);
    poll().catch(() => {});
  }

  // ---- actions ------------------------------------------------------------

  async function startRun(profile) {
    logBox.textContent = "";
    logOffset = 0;
    armReport(false);
    setBusy(true);
    setBadge("STARTING", "running");
    setStatus("Starting Shannon in WSL2 — staging the source tree first…");

    append(`[ui] engine Shannon (WSL2), profile: ${profile}`);

    let result;

    try {
      const response = await fetch("/api/shannon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ profile })
      });
      result = await response.json();
    } catch (error) {
      setBusy(false);
      setBadge("ERROR", "error");
      setStatus("Could not reach the app: " + error.message);
      return;
    }

    if (!response_ok(result)) {
      setBusy(false);
      setBadge("ERROR", "error");
      setStatus(result.error || "Shannon did not start.");
      append("[!] " + (result.error || "Shannon did not start."));
      return;
    }

    setBadge("RUNNING", "running");
    startPolling();
  }

  // The bridge returns { ok: true } on success and { ok: false, error } when it
  // refuses, so a missing `ok` is treated as success only when a scanId came back.
  function response_ok(result) {
    return Boolean(result && (result.ok === true || result.scanId));
  }

  async function stopRun() {
    setStatus("Stopping…");

    try {
      await fetch("/api/shannon/stop", {
        method: "POST",
        headers: { Accept: "application/json" }
      });
    } catch {
      /* the next poll will report reality */
    }

    // Give the bridge a moment, then refresh once.
    setTimeout(() => poll().catch(() => {}), 2500);
  }

  // ---- wiring -------------------------------------------------------------

  engineButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (running) {
        setStatus("Stop the current run before switching engines.");
        return;
      }

      engine = button.dataset.aiEngine === "shannon" ? "shannon" : "agent";
      window.__pentestEngine = engine;

      engineButtons.forEach(other => {
        other.classList.toggle("active", other === button);
      });

      const isShannon = engine === "shannon";

      // One Run button serves both engines; only the options beside it change.
      if (stepsWrap) stepsWrap.hidden = isShannon;
      if (profileWrap) profileWrap.hidden = !isShannon;
      if (validateButton) validateButton.hidden = !isShannon;

      armReport(false);
      setBadge("IDLE", "idle");

      if (isShannon) {
        logBox.textContent = "";
        setStatus("Checking the Shannon bridge…");
        append("[ui] engine Shannon (WSL2) selected");
        append("     Runs on the host, not in this container: it needs Docker.");
        append("");
        refreshHealth();
      } else {
        setStatus("In-container agent selected. Pick a scope, then Run.");
        armReport(true);
      }
    });
  });

  if (validateButton) {
    validateButton.addEventListener("click", () => startRun("validate"));
  }

  if (profileSelect) {
    profileSelect.addEventListener("change", () => {
      setStatus(`Profile set to ${profileSelect.value}. Press Run.`);
    });
  }

  // The shared Run and Stop buttons belong to the agent; take them over when
  // Shannon is the active engine. Capturing on the button runs before the
  // agent's own handler, so its SSE run never starts.
  const runWrapper = document.getElementById("ai-run-wrap");

  if (runWrapper) {
    runWrapper.addEventListener(
      "click",
      event => {
        if (engine !== "shannon") return;

        const target = event.target.closest("button");

        if (!target) return;

        event.stopPropagation();
        event.preventDefault();

        startRun(profileSelect ? profileSelect.value : "validate");
      },
      true
    );
  }

  // Stop must reach the bridge, not just close an EventSource.
  document.addEventListener(
    "click",
    event => {
      if (engine !== "shannon") return;

      const target = event.target.closest("#ai-agent-stop");

      if (!target) return;

      event.stopPropagation();
      event.preventDefault();
      stopRun();
    },
    true
  );

  // Coming back to the screen refreshes readiness without losing a run.
  if (screen && "MutationObserver" in window) {
    const observer = new MutationObserver(() => {
      if (screen.classList.contains("active") && engine === "shannon" && !running) {
        refreshHealth();
      }
    });

    observer.observe(screen, { attributes: true, attributeFilter: ["class"] });
  }
})();
