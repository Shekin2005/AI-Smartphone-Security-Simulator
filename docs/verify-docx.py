#!/usr/bin/env python3
"""Checks the generated report for the defects that are easy to ship unnoticed:
unrendered markup, broken citations, missing sections, empty tables.
"""

import re
import sys
from pathlib import Path

from docx import Document

# Default to the full edition; pass a path to check the condensed one.
DOC = (Path(sys.argv[1]) if len(sys.argv) > 1
       else Path(__file__).parent / "AI-Smartphone-Security-Simulator-Project-Report.docx")

print(f"file       : {DOC.name}")
doc = Document(str(DOC))

paras = doc.paragraphs
all_text = "\n".join(p.text for p in paras)

# Table text counts too, since several defects live in cells.
cell_text = []
for t in doc.tables:
    for row in t.rows:
        for cell in row.cells:
            cell_text.append(cell.text)
table_text = "\n".join(cell_text)
everything = all_text + "\n" + table_text

words = len(re.findall(r"\b[\w'’-]+\b", everything))

print(f"paragraphs : {len(paras)}")
print(f"tables     : {len(doc.tables)}")
print(f"words      : {words:,}")
print(f"chars      : {len(everything):,}")

print("\n--- headings ---")
for p in paras:
    if p.style.name.startswith("Heading"):
        print(f"  [{p.style.name[-1]}] {p.text}")

print("\n--- unrendered markup ---")
problems = 0

# Markdown that should have been consumed by the run builder.
for marker, label in (("**", "bold marker"), ("`", "backtick")):
    hits = [p.text for p in paras if marker in p.text]
    # Code blocks legitimately contain backticks? No - they are plain text
    # captured from source, which does use backticks. Report, then inspect.
    if hits:
        print(f"  {label}: {len(hits)} paragraph(s)")
        for h in hits[:6]:
            print(f"     {h[:110]}")
        if marker == "**":
            problems += len(hits)

# An f-string that lost its prefix leaves the call expression on the page.
stray = re.findall(r"\{c\([^)]*\)\}", everything)
if stray:
    print(f"  unrendered citation: {len(stray)} -> {stray[:5]}")
    problems += len(stray)

# Placeholders that were meant to be replaced.
for bad in ("[Student name]", "[Student ID]", "[Module code"):
    n = everything.count(bad)
    if n:
        print(f"  placeholder still present: {bad} x{n} (expected on title page)")

print("\n--- citations ---")
cited = sorted({int(n) for n in re.findall(r"\[(\d{1,2})(?:, \d{1,2})*\]", everything)})

# Nikto plugin ids such as [000287] are five or six digits and must not be
# mistaken for citations; restricting the pattern to one or two digits
# excludes them by construction.
refs_section = False
ref_lines = []
for p in paras:
    if p.text.strip() == "References":
        refs_section = True
        continue
    if refs_section and p.text.startswith("Appendix A."):
        break
    if refs_section and re.match(r"^\[\d+\]", p.text):
        ref_lines.append(p.text)

print(f"  reference entries rendered: {len(ref_lines)}")
nums = [int(re.match(r"^\[(\d+)\]", r).group(1)) for r in ref_lines]
print(f"  numbered {min(nums)}..{max(nums)} contiguous: {nums == list(range(1, len(nums) + 1))}")

# Every citation must resolve to an entry.
in_text = set()
for m in re.finditer(r"\[([\d, ]{1,12})\]", everything):
    raw = m.group(1)
    if len(raw.replace(",", "").replace(" ", "")) > 6:
        continue
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit() and len(part) <= 2 and not part.startswith("0"):
            in_text.add(int(part))
dangling = sorted(n for n in in_text if n > len(ref_lines))
print(f"  distinct numbers cited in text: {len(in_text)}")
print(f"  dangling citations: {dangling if dangling else 'none'}")

print("\n--- tables ---")
for i, t in enumerate(doc.tables, 1):
    empty = sum(1 for r in t.rows for c in r.cells if not c.text.strip())
    print(f"  table {i}: {len(t.rows)} rows x {len(t.columns)} cols, empty cells: {empty}")

print("\n--- encoding ---")
for probe in ("\u2014", "\u2013", "\u2019", "\u00b7"):
    present = probe in everything
    print(f"  U+{ord(probe):04X} {probe!r} present: {present}")

print("\n--- first lines ---")
for p in paras[:8]:
    if p.text.strip():
        print(f"  {p.text.strip()[:100]}")

print("\n--- last lines ---")
for p in [x for x in paras if x.text.strip()][-4:]:
    print(f"  {p.text.strip()[:100]}")

print("\n=== " + ("FAIL: unrendered markup present" if problems else "PASS: no unrendered markup") + " ===")
sys.exit(1 if problems else 0)
