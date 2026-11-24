# Presentation

`AI-Smartphone-Security-Simulator.pptx` — 10 slides, 16:9, built by
`build-deck.mjs`. Speaker notes are attached to every slide in PowerPoint
(View → Notes Page).

## Rebuild

```bash
cd slides
npm i pptxgenjs adm-zip
node build-deck.mjs      # writes ../AI-Smartphone-Security-Simulator.pptx
node verify-deck.mjs     # layout check
```

`verify-deck.mjs` fails the build if any shape sits outside the canvas, any text
is too big for its box, or a table overlaps the content beneath it. Tables are
`p:graphicFrame`, not `p:sp`, so they need the separate pass it performs — a
checker that only walks shapes will miss a table spilling over a heading.

## Slide outline

| # | Slide | The one thing it says |
| --- | --- | --- |
| 1 | Title | A lab that attacks itself: 2 apps, 3 engines, everything measured |
| 2 | How a request reaches the application | One published port, TLS at the edge, the database not in Docker |
| 3 | Two applications, one deliberately defended | The bank is vulnerable, Acadia is the control that catches false positives |
| 4 | Engine 1 — the deterministic suite | 12 checks, 9 passed / 3 vulnerable / 0 inconclusive, 63 s |
| 5 | Engine 2 — the AI agent | 3 tools; a real 404→200 self-correction; 0 claimed vs 1 detected |
| 6 | Engine 3 — Shannon | It needs Docker, so it runs in WSL2 behind a token-gated bridge |
| 7 | The Attack Lab is a real terminal | nikto's own output, 7,970 requests, 0 errors — and why it is not a shell |
| 8 | **The actual question: do they agree?** | Manual 3/3, AI 1/3, zero false positives: the difference is patience |
| 9 | Every claim has a measurement | The numbers, and how each was obtained |
| 10 | A lab that teaches vulnerabilities must not be one | Platform controls, and what is still unfinished |

## Where the numbers come from

Every figure on the slides was measured against the running deployment. Sources:

- `../PROJECT-REFERENCE.md` — full technical reference
- `../TERMINAL-COMMANDS.md` — command timings, demo run sheet
- `../SHANNON.md` — Shannon feasibility measurements
- `../RECORDING-SCRIPT.md` — the same walkthrough live
- `tools/out/COMPARISON-REPORT.md` — the ground-truth matrix on slide 8

Slide 8's AI column was measured with `moonshotai/kimi-k3.1-pro` over 7
requests, and is labelled as such on the slide. Later runs used
`nvidia/nemotron-3.5-lightning-30b-a3b`; the recall figure belongs to the run it
came from, so the model is named rather than generalised.
