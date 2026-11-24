// ==================================================
// ATTACK LAB - INTERACTIVE TERMINAL
// ==================================================
// A real prompt in front of real tools. You type a command, the server splits
// it into argv and runs it with shell:false, and the tool's own output streams
// back over Server-Sent Events.
//
// It is not a shell: binaries are allowlisted, targets must be this lab, and
// shell metacharacters are rejected. That is what keeps a publicly reachable
// screen from becoming an open command endpoint.
// ==================================================

(function () {
  "use strict";

  const input = document.getElementById("lab-term-input");
  const output = document.getElementById("lab-pentest-output");
  const statusLine = document.getElementById("lab-pentest-status");
  const badge = document.getElementById("lab-badge");

  if (!input || !output) {
    return;
  }

  const PROMPT = "lab@attack:~$";
  const BANNER = [
    "Attack Lab terminal - real tools, real output.",
    "Type `help` for commands, `pentest` for the 12-check suite.",
    ""
  ];

  const history = [];
  let historyIndex = 0;
  let stream = null;
  let busy = false;
  let welcomed = false;

  function setStatus(text) {
    if (statusLine) {
      statusLine.textContent = text;
    }
  }

  function setBadge(text, state) {
    if (!badge) return;
    badge.textContent = text;
    badge.dataset.state = state;
  }

  function append(line) {
    const atBottom =
      output.scrollTop + output.clientHeight >= output.scrollHeight - 40;

    output.textContent += line + "\n";

    if (atBottom) {
      output.scrollTop = output.scrollHeight;
    }
  }

  function reset() {
    output.textContent = "";
  }

  // Greet once, the first time the screen is opened, so the transcript is not
  // an empty box on arrival.
  function welcome() {
    if (welcomed) return;
    welcomed = true;

    if (output.textContent.trim() === "[idle] waiting for a run...") {
      reset();
    }

    for (const line of BANNER) {
      append(line);
    }
  }

  function focusInput() {
    try {
      input.focus({ preventScroll: true });
    } catch {
      /* older browsers */
    }
  }

  function endStream() {
    if (stream) {
      stream.close();
      stream = null;
    }
  }

  function setBusy(next) {
    busy = next;
    input.disabled = next;
    input.style.opacity = next ? "0.55" : "1";

    if (!next) {
      focusInput();
    }
  }

  function run(command) {
    const line = command.trim();

    if (!line || busy) {
      return;
    }

    if (line === "clear") {
      reset();

      if (output.textContent === "") {
        // Nudge the browser to treat it as a fresh screen.
        output.textContent = "";
      }

      setStatus("Cleared.");
      input.value = "";
      return;
    }

    history.push(line);
    historyIndex = history.length;

    append(`${PROMPT} ${line}`);
    input.value = "";
    setBusy(true);
    setStatus(`running: ${line}`);
    setBadge("RUNNING", "running");

    let finished = false;

    stream = new EventSource(
      `/api/lab/terminal/exec?cmd=${encodeURIComponent(line)}`
    );

    stream.addEventListener("log", event => {
      let data = {};

      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (typeof data.line === "string") {
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

      finished = true;
      endStream();
      setBusy(false);

      const code = typeof data.code === "number" ? data.code : 0;

      append("");
      setStatus(
        data.ok === false || code !== 0
          ? `finished with exit code ${code}`
          : "finished"
      );
      setBadge("IDLE", "idle");
      focusInput();
    });

    // EventSource reports a dropped connection here. Only treat it as an error
    // if the server never sent `done` - otherwise this fires on normal close.
    stream.onerror = () => {
      if (finished) {
        return;
      }

      finished = true;
      endStream();
      setBusy(false);

      append("[!] connection to the server closed before the command finished");
      setStatus("connection closed");
      setBadge("ERROR", "error");
      focusInput();
    };
  }

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      run(input.value);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!history.length) return;

      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? "";
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!history.length) return;

      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = historyIndex >= history.length ? "" : history[historyIndex];
    }
  });

  // Keep the caret in the prompt: clicking the transcript should not steal it.
  output.addEventListener("click", focusInput);

  // Focus the prompt whenever the Attack Lab screen becomes active.
  const screen = document.getElementById("attack");

  if (screen && "MutationObserver" in window) {
    const observer = new MutationObserver(() => {
      if (screen.classList.contains("active")) {
        welcome();
        window.setTimeout(focusInput, 120);
      }
    });

    observer.observe(screen, { attributes: true, attributeFilter: ["class"] });

    if (screen.classList.contains("active")) {
      welcome();
      window.setTimeout(focusInput, 200);
    }
  }
})();
