#!/usr/bin/env node
// ==================================================
// VERIFIES THE 9-SLIDE DECK
// ==================================================
//   cd slides && node verify-deck9.mjs
//
// Checks the defects that are easy to ship and hard to see:
//   1. any shape outside the 10 x 5.625 inch canvas
//   2. text too large for the box that holds it
//   3. a table overlapping content beneath its top edge
//   4. slide count, and whether every slide carries speaker notes
// ==================================================

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, "..", "AI-Security-9-Slides.pptx");

const W = 10;
const H = 5.625;
const EMU = 914400;

// Read into a buffer rather than passing the path: adm-zip rejects an absolute
// path containing a space, and this checkout lives under "Project 2".
const zip = new AdmZip(fs.readFileSync(FILE));

const slides = zip
  .getEntries()
  .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
  .sort((a, b) => +a.entryName.match(/(\d+)/)[1] - +b.entryName.match(/(\d+)/)[1]);

if (!slides.length) {
  console.error("No slides found in", FILE);
  process.exit(1);
}

const notesEntries = zip
  .getEntries()
  .filter(e => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.entryName));

const shapeBox = block => {
  const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(block);
  const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(block);
  if (!off || !ext) return null;
  return {
    x: Number(off[1]) / EMU,
    y: Number(off[2]) / EMU,
    w: Number(ext[1]) / EMU,
    h: Number(ext[2]) / EMU
  };
};

const shapeText = block =>
  [...block.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map(m => m[1])
    .join("")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

let problems = 0;

for (const entry of slides) {
  const xml = entry.getData().toString("utf8");
  const n = entry.entryName.match(/slide(\d+)/)[1];
  const issues = [];
  const shapes = [];

  for (const m of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const box = shapeBox(m[0]);
    if (!box) continue;

    const text = shapeText(m[0]);
    const sizes = [...m[0].matchAll(/sz="(\d+)"/g)].map(x => Number(x[1]) / 100);
    const size = sizes.length ? Math.max(...sizes) : 12;

    shapes.push({ ...box, text, size });

    if (box.x < -0.01 || box.y < -0.01 ||
        box.x + box.w > W + 0.01 || box.y + box.h > H + 0.01) {
      issues.push(
        `OUT OF BOUNDS x=${box.x.toFixed(2)} y=${box.y.toFixed(2)} ` +
        `w=${box.w.toFixed(2)} h=${box.h.toFixed(2)} "${text.slice(0, 42)}"`
      );
    }

    // Rough text fit. Glyph ~0.52 em, line ~1.28 em for Segoe UI / Consolas.
    if (text.length > 2) {
      const fontInch = size / 72;
      const perLine = Math.max(1, Math.floor(box.w / (fontInch * 0.52)));
      const lines = text
        .split("\n")
        .reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / perLine)), 0);
      const needed = lines * fontInch * 1.28;

      if (box.h - needed < -0.06) {
        issues.push(
          `TEXT TOO BIG needs ~${needed.toFixed(2)}" in ${box.h.toFixed(2)}" ` +
          `at ${size}pt "${text.replace(/\n/g, " / ").slice(0, 44)}"`
        );
      }
    }
  }

  for (const g of xml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)) {
    const box = shapeBox(g[0]);
    if (!box) continue;

    if (box.y + box.h > H + 0.01) {
      issues.push(`TABLE OUT OF BOUNDS bottom=${(box.y + box.h).toFixed(2)}`);
    }

    for (const s of shapes) {
      if (s.h < 0.15) continue;
      const oy = Math.min(box.y + box.h, s.y + s.h) - Math.max(box.y, s.y);
      const ox = Math.min(box.x + box.w, s.x + s.w) - Math.max(box.x, s.x);
      if (oy > 0.02 && ox > 0.1) {
        issues.push(
          `TABLE COLLIDES with y=${s.y.toFixed(2)} "${s.text.slice(0, 38)}" by ${oy.toFixed(2)}"`
        );
      }
    }
  }

  console.log(`slide ${n.padStart(2)}  ${issues.length ? "PROBLEMS" : "ok"}`);
  for (const issue of issues) {
    console.log(`           ${issue}`);
    problems += 1;
  }
}

console.log("");
console.log(`slides: ${slides.length}   speaker-notes parts: ${notesEntries.length}`);

if (slides.length !== 9) {
  console.log(`EXPECTED 9 SLIDES, FOUND ${slides.length}`);
  problems += 1;
}

if (notesEntries.length < 9) {
  console.log(`MISSING NOTES: only ${notesEntries.length} of 9 slides have speaker notes`);
  problems += 1;
}

console.log(problems === 0
  ? "Layout OK: nothing outside the canvas, no table collisions, 9 slides, notes on all."
  : `${problems} problem(s).`);

process.exit(problems === 0 ? 0 : 1);
