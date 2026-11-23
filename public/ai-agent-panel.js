// ==================================================
// AI PENTEST AGENT PANEL
// ==================================================
// Runs the same thin agent that `npm run ai` exposes on the command line,
// but from the AI Defender screen. The server spawns the agent and streams
// its output back as Server-Sent Events, so the panel shows the model
// choosing requests in real time.
// ==================================================

(function () {
  "use strict";

  const runButton = document.getElementById("ai-agent-run");
  const logBox = document.getElementById("ai-agent-log");
  const statusLine = document.getElementById("ai-agent-status");

  if (!runButton || !logBox) {
    return;
  }

  let stream = null;

  function append(line) {
    const atBottom =
      logBox.scrollTop + logBox.clientHeight >=
      logBox.scrollHeight - 40;

    logBox.textContent += line + "\n";

    if (atBottom) {
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  function setBusy(busy, text) {
    runButton.disabled = busy;
    runButton.textContent = busy ? "Running…" : "▶ Run AI Agent";

    if (text && statusLine) {
      statusLine.textContent = text;
    }
  }

  function stop() {
    if (stream) {
      stream.close();
      stream = null;
    }
  }

  runButton.addEventListener("click", () => {
    stop();

    logBox.textContent = "";
    setBusy(true, "Starting…");

    // Five decisions is enough to reach the tuition endpoint, walk the seeded
    // id wordlist and record what it saw. On the free hosted model each
    // decision takes roughly a minute, so this keeps a live demonstration
    // near five minutes instead of ten.
    const steps = 5;

    stream = new EventSource(
      `/api/ai-agent/run?steps=${steps}`
    );

    stream.addEventListener("start", event => {
      let data = {};

      try {
        data = JSON.parse(event.data);
      } catch {
        /* ignore a malformed frame */
      }

      setBusy(
        true,
        `Running against ${data.target || "the lab"} — up to ${data.steps || steps} decisions`
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

      setBusy(
        false,
        failed
          ? `Finished with an error${data.error ? ": " + data.error : ""}`
          : "Finished — see the report in tools/out"
      );

      append("");
      append("— run complete —");
    });

    // EventSource reports a 401 or a dropped connection here. Distinguish
    // "never started" from "finished", because the first almost always means
    // the caller is not signed in.
    stream.onerror = () => {
      const producedOutput = logBox.textContent.trim().length > 0;

      stop();

      if (producedOutput) {
        setBusy(false, "Finished");
        append("");
        append("— run complete —");
        return;
      }

      setBusy(
        false,
        "Could not start — sign in to the bank or school app first"
      );

      append(
        "The agent needs a signed-in, MFA-verified session."
      );
      append(
        "Sign in, then press Run again."
      );
    };
  });
})();
