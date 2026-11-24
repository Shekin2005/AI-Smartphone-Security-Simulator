# Project report — two editions

Both editions describe the same assessment, from the same recorded run of
24 November 2026. They differ in length, not in findings.

| File | Pages | Use it for |
| --- | --- | --- |
| `AI-Smartphone-Security-Simulator-Report-Short.docx` | **8** | Submission where a page limit applies. Every finding, the engine comparison, all 36 references. |
| `AI-Smartphone-Security-Simulator-Project-Report.docx` | 32 | The reference edition. Adds the background chapter, the source-code appendix, reproduction commands, the evidence inventory and a glossary. |

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
edition's Appendix B has the commands and Appendix C lists every evidence file.

## Rebuilding

The documents are generated, so text corrections do not require touching the
layout:

```bash
python docs/build-project-docx-short.py     # 8-page edition
python docs/build-project-docx.py           # full edition
python docs/verify-docx.py docs/AI-Smartphone-Security-Simulator-Report-Short.docx
```

`verify-docx.py` checks for unrendered markup, dangling citations and empty
table cells. It exits non-zero if any is found.

The table of contents in the **full** edition is a Word field. Word resolves it
on open, or right-click → *Update Field*. The short edition has no contents
page, since eight pages does not need one.

## Changing the citation style

References are numbered (IEEE-style) and the numbering is generated from the
`REFS` list in `docx_framework.py`, so an in-text citation cannot drift out of
step with the list. For Harvard or APA, reorder or rewrite that list and change
`c()` to emit `(Author, Year)` — the body text needs no edits beyond the
citation call, because every citation goes through that one function.
