#!/usr/bin/env node
// Layout verification for the 10-slide deck (13.333 x 7.5 in).
// Checks: shapes inside the canvas, text that cannot fit its box,
// tables overlapping other content, and notes on every slide.

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, "..", "AI-vs-Manual-Pentesting-10-Slides.pptx");

const W = 13.333;
const H = 7.5;
const EMU = 914400;

const zip = new AdmZip(fs.readFileSync(FILE));
const slides = zip.getEntries()
  .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
  .sort((a, b) => +a.entryName.match(/(\d+)/)[1] - +b.entryName.match(/(\d+)/)[1]);
const notes = zip.getEntries().filter(e => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.entryName));

const box = block => {
  const o = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(block);
  const e = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(block);
  if (!o || !e) return null;
  return { x: +o[1] / EMU, y: +o[2] / EMU, w: +e[1] / EMU, h: +e[2] / EMU };
};

const txt = block => [...block.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
  .map(m => m[1]).join("")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

let problems = 0;

for (const entry of slides) {
  const xml = entry.getData().toString("utf8");
  const n = entry.entryName.match(/slide(\d+)/)[1];
  const issues = [];
  const shapes = [];

  for (const m of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const b = box(m[0]);
    if (!b) continue;
    const t = txt(m[0]);
    const sizes = [...m[0].matchAll(/sz="(\d+)"/g)].map(x => +x[1] / 100);
    const size = sizes.length ? Math.max(...sizes) : 12;
    shapes.push({ ...b, t });

    if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > W + 0.01 || b.y + b.h > H + 0.01) {
      issues.push(`OUT OF BOUNDS x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} w=${b.w.toFixed(2)} h=${b.h.toFixed(2)} "${t.slice(0, 40)}"`);
    }

    if (t.length > 2) {
      const fi = size / 72;
      const perLine = Math.max(1, Math.floor(b.w / (fi * 0.50)));
      const lines = t.split("\n").reduce((a, l) => a + Math.max(1, Math.ceil(l.length / perLine)), 0);
      const need = lines * fi * 1.26;
      if (b.h - need < -0.08) {
        issues.push(`TEXT OVERFLOW needs ~${need.toFixed(2)}" in ${b.h.toFixed(2)}" at ${size}pt "${t.replace(/\n/g, " / ").slice(0, 46)}"`);
      }
    }
  }

  for (const g of xml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)) {
    const b = box(g[0]);
    if (!b) continue;
    if (b.y + b.h > H + 0.01) issues.push(`TABLE OFF CANVAS bottom=${(b.y + b.h).toFixed(2)}`);
    for (const s of shapes) {
      if (s.h < 0.14) continue;
      const oy = Math.min(b.y + b.h, s.y + s.h) - Math.max(b.y, s.y);
      const ox = Math.min(b.x + b.w, s.x + s.w) - Math.max(b.x, s.x);
      if (oy > 0.04 && ox > 0.15) {
        issues.push(`TABLE OVERLAP with y=${s.y.toFixed(2)} "${s.t.slice(0, 36)}" by ${oy.toFixed(2)}"`);
      }
    }
  }

  console.log(`slide ${n.padStart(2)}  ${issues.length ? "PROBLEMS" : "ok"}`);
  for (const i of issues) { console.log("          " + i); problems++; }
}

console.log(`\nslides: ${slides.length}   notes parts: ${notes.length}`);
if (slides.length !== 10) { console.log(`EXPECTED 10 SLIDES, FOUND ${slides.length}`); problems++; }
if (notes.length < 10) { console.log(`MISSING NOTES: ${notes.length}/10`); problems++; }

console.log(problems === 0 ? "Layout OK" : `${problems} problem(s)`);
process.exit(problems ? 1 : 0);
