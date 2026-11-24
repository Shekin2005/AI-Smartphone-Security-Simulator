// ==================================================
// AI PENTEST TERMINAL
// ==================================================
// Runs tools/ai-agent.mjs from the phone, scoped to the application the user
// picks (bank, school, or both). The server spawns the agent and streams its
// stdout back as Server-Sent Events, so the terminal shows exactly what the
// model decided and which requests it sent.
//
// The report link downloads the Markdown the agent wrote.
// ==================================================

(function () {
  "use strict";

  const runButton = document.getElementById("ai-agent-run");
  const stopButton = document.getElementById("ai-agent-stop");
  const logBox = document.getElementById("ai-agent-log");
  const statusLine = document.getElementById("ai-agent-status");
  const badge = document.getElementById("ai-agent-badge");
  const reportLink = document.getElementById("ai-agent-report");
  const stepsSelect = document.getElementById("ai-agent-steps");
  const scopeButtons = Array.from(
    document.querySelectorAll("[data-ai-target]")
  );

  if (!runButton || !logBox) {
    return;
  }

  // Banking is the default: the tuition lookup is the finding most worth
  // demonstrating live, and it only exists in the bank application.
  let scope = "bank";
  let stream = null;

  const REPORT_HREF = "/api/ai-agent/report?download=1";

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

  function setBusy(busy, text) {
    runButton.disabled = busy;
    runButton.textContent = busy ? "Running…" : "▶ Run AI Pentest";

    if (stopButton) {
      stopButton.disabled = !busy;
    }

    if (text) {
      setStatus(text);
    }
  }

  function stop() {
    if (stream) {
      stream.close();
      stream = null;
    }

    if (stopButton) {
      stopButton.disabled = true;
    }
  }

  // The report only exists after a run, so the link stays inert until then.
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

  scopeButtons.forEach(button => {
    button.addEventListener("click", () => {
      scope = button.dataset.aiTarget;

      scopeButtons.forEach(other => {
        other.classList.toggle("active", other === button);
      });

      setStatus(`Scope set to ${button.textContent.trim()}. Press Run.`);
    });
  });

  if (reportLink) {
    reportLink.addEventListener("click", event => {
      if (reportLink.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        setStatus("No report yet — run the agent first.");
      }
    });
  }

  if (stopButton) {
    stopButton.disabled = true;

    stopButton.addEventListener("click", () => {
      stop();
      setBusy(false, "Stopped.");
      setBadge("STOPPED", "idle");
      append("");
      append("[stopped] run cancelled.");
    });
  }

  runButton.addEventListener("click", () => {
    stop();

    const steps = Number(stepsSelect?.value) || 5;

    logBox.textContent = "";
    armReport(false);
    setBusy(true, "Starting…");
    setBadge("RUNNING", "running");

    stream = new EventSource(
      `/api/ai-agent/run?steps=${steps}&target=${encodeURIComponent(scope)}`
    );

    stream.addEventListener("start", event => {
      let data = {};

      try {
        data = JSON.parse(event.data);
      } catch {
        /* ignore a malformed frame */
      }

      const label = data.scope === "both" ? "both applications" : `${data.scope} application`;

      setStatus(
        `Running against ${label} — up to ${data.steps || steps} decisions`
      );
    });

    stream.addEventListener("log", event => {
      let data = {};

      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.line) {
        append(data.line);
      }
    });

    stream.addEventListener("done", event => {
      let data = {};

      try {
        data = JSON.parse(event.data);
      } catch {
        /* ignore */
      }

      stop();

      const failed = data.ok === false;

      append("");
      append(failed ? "— run failed —" : "— run complete —");

      if (failed) {
        setBusy(false, `Finished with an error${data.error ? ": " + data.error : ""}`);
        setBadge("ERROR", "error");
        return;
      }

      setBusy(false, "Finished — the report is ready to download.");
      setBadge("DONE", "idle");
      armReport(true);
    });

    // EventSource reports a 401 or a dropped connection here. Distinguish
    // "never started" from "finished", because the first almost always means
    // the caller is not signed in.
    stream.onerror = () => {
      const producedOutput = logBox.textContent.trim().length > 0;

      stop();

      if (producedOutput) {
        setBusy(false, "Finished");
        setBadge("DONE", "idle");
        armReport(true);
        append("");
        append("— run complete —");
        return;
      }

      setBusy(false, "Could not start — sign in to the bank or Acadia app first.");
      setBadge("ERROR", "error");
      append("[!] The agent needs a signed-in, MFA-verified session.");
      append("    Sign in, then press Run.");
    };
  });

  armReport(true);
})();
