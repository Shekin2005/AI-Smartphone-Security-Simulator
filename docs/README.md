# Project report — editions

All three editions describe the same assessment, from the same recorded run of
24 November 2026. They differ in length, not in findings.

| File | Pages | Use it for |
| --- | --- | --- |
| `AI-Smartphone-Security-Simulator-Full-Report.docx` | **22** | The primary submission. Adds the industry-evidence chapter (§3) — Big Sleep, MDASH, Anthropic, XBOW, DARPA AIxCC, the ARTEMIS head-to-head, Semgrep's evaluation and the Omdia survey — plus a dedicated AI-vs-manual chapter (§7) and an AI tooling/cost appendix. 16 references. |
| `AI-Smartphone-Security-Simulator-Report-Short.docx` | 9 | Submission where a strict page limit applies. Every finding, the engine comparison, 38 references. |
| `AI-Smartphone-Security-Simulator-Project-Report.docx` | 32 | The earlier reference edition (pre-industry-evidence). Superseded by the full report; kept for its standalone source-code walkthrough. |

Each has a matching `.pdf` exported from the `.docx`.

## Before submitting

The title block carries five placeholders, because these are not mine to
invent:

- `[Student name]`
- `[Student ID]`
- `[Module code and title]`
- `[University / Department]`
- `[Supervisor]`

They appear on the first page and in the document properties. Replace them in
Word, then save — the properties update with the body text only if you edit
them, so set **File → Info → Properties** as well if your department checks
metadata.

## What the short edition keeps and drops

Kept: the abstract, the aims, the system description, all twelve checks, the
methodology including the two-count measurement, every finding with its code
and capture, the controls that held, the engine comparison, the harness
defects, the discussion, the threats to validity and the full reference list.

Dropped: the background chapter (the references still support the claims in
the text), the long source listings, the reproduction commands and the
evidence inventory. If a marker asks how to reproduce a finding, the full
edition's Appendix C has the commands and Appendix D lists every evidence file.

## Rebuilding

The documents are generated, so text corrections do not require touching the
layout:

```bash
python docs/build-project-docx-full.py      # 22-page primary edition (16 refs)
python docs/build-project-docx-short.py     # 9-page edition (38 refs)
python docs/build-project-docx.py           # 32-page legacy reference edition
python docs/verify-docx.py docs/AI-Smartphone-Security-Simulator-Full-Report.docx
```

`verify-docx.py` checks for unrendered markup, dangling citations and empty
table cells. It exits non-zero if any is found.

The table of contents in the **full** edition is a Word field. Word resolves it
on open, or right-click → *Update Field*. The short edition has no contents
page, since nine pages does not need one.

## Changing the citation style

References are numbered (IEEE-style) and the numbering is generated from the
reference list — `REFS15` in `references_v2.py`, seven core standards and nine
industry sources — so an in-text citation cannot drift out of step with the
list. Every other key used in the body resolves through the `ALIAS` table in
the build script, which maps a dropped source to the nearest retained one; where
a claim existed only in a dropped source, the sentence was rewritten rather than
aliased. For Harvard or APA, reorder or rewrite the list and change `c()` to
emit `(Author, Year)` — the body text needs no edits beyond the citation call,
because every citation goes through that one function.

## What the full edition adds over the short one

Section 3 is the industry-evidence chapter: what AI security testing has
achieved in production (Google Big Sleep's SQLite 0-day, Microsoft MDASH's 16
Windows vulnerabilities via 100+ debating agents, Anthropic's 500+ validated
high-severity findings, XBOW's #1 HackerOne finish and 28-minutes-vs-40-hours
benchmark, DARPA AIxCC's 54 of 63 found and 43 patched), the head-to-head
measurements (ARTEMIS at ICLR 2026 and Semgrep's evaluation), and the Omdia
adoption and buyer study — each with the method stated. Section 7 then reads the
lab's own AI-vs-manual result against that evidence. Appendix B inventories
every AI resource used with its cost, including the four failed runs and why
each failed.

## Setup and structure guide

`SETUP-AND-STRUCTURE.md` (11 pages, with `.docx` and `.pdf`) is a separate
document from the report editions above. It covers how the code is arranged and
how to stand the whole thing up on a different computer: what the working folder
actually contains and what to delete before moving it, the repository file map,
the three deployment paths, database creation and schema application, the
environment variables with the failure each one causes when wrong, account
provisioning, the pentest engines, secret hygiene and a troubleshooting table
built from errors actually hit during the build.

Two facts in it matter more than the rest. The schema is never applied
automatically and `schema.sql` is not inside the Docker image, so a fresh
database stays empty until you run it by hand from the host. And
`tools/ai-agent.mjs` carries a fallback API key in source, which must be revoked
and replaced before the repository is shared or published.
