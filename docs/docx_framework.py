#!/usr/bin/env python3
"""Formatting helpers for the project report generator.

Kept separate from the content so the content file stays readable. Nothing here
knows what the report says; it only knows how a report is laid out.
"""

import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

# A restrained palette: one accent colour, everything else greyscale. Reports
# that use six colours look like marketing, not evidence.
ACCENT = RGBColor(0x1F, 0x3A, 0x5F)
GREY = RGBColor(0x59, 0x59, 0x59)
CODE_FILL = "F4F4F4"
HEAD_FILL = "E8ECF1"

BODY_FONT = "Calibri"
CODE_FONT = "Consolas"


# ----------------------------------------------------------------------
# References. The numbering is generated from this order, so in-text
# citations cannot drift out of step with the list.
# ----------------------------------------------------------------------

REFS = [
    ("nist115", "Scarfone, K., Souppaya, M., Cody, A. and Orebaugh, A. (2008) "
                "*Technical Guide to Information Security Testing and Assessment*. "
                "NIST Special Publication 800-115. Gaithersburg, MD: National Institute "
                "of Standards and Technology."),
    ("ptes", "Penetration Testing Execution Standard (2012) *PTES Technical Guidelines*. "
             "Available at: http://www.pentest-standard.org/ (Accessed: 24 November 2026)."),
    ("bertoglio", "Bertoglio, D.D. and Zorzo, A.F. (2017) 'Overview and open issues on "
                  "penetration test', *Journal of the Brazilian Computer Society*, 23(1), "
                  "article 2."),
    ("felderer", "Felderer, M., Büchler, M., Johns, M., Brucker, A.D., Breu, R. and "
                 "Pretschner, A. (2016) 'Security testing: A survey', *Advances in "
                 "Computers*, 101, pp. 1–51."),
    ("owasp2021", "OWASP Foundation (2021) *OWASP Top 10:2021*. Available at: "
                  "https://owasp.org/Top10/ (Accessed: 24 November 2026)."),
    ("owaspapi", "OWASP Foundation (2023) *OWASP API Security Top 10 – 2023*. Available "
                 "at: https://owasp.org/API-Security/ (Accessed: 24 November 2026)."),
    ("saltzer", "Saltzer, J.H. and Schroeder, M.D. (1975) 'The protection of information "
                "in computer systems', *Proceedings of the IEEE*, 63(9), pp. 1278–1308."),
    ("cwe639", "MITRE (2024) *CWE-639: Authorization Bypass Through User-Controlled Key*. "
               "Available at: https://cwe.mitre.org/data/definitions/639.html "
               "(Accessed: 24 November 2026)."),
    ("nist63b", "Grassi, P.A., Garcia, M.E. and Fenton, J.L. (2017) *Digital Identity "
                "Guidelines: Authentication and Lifecycle Management*. NIST Special "
                "Publication 800-63B. Gaithersburg, MD: National Institute of Standards "
                "and Technology."),
    ("pinkas", "Pinkas, B. and Sander, T. (2002) 'Securing passwords against dictionary "
               "attacks', *Proceedings of the 9th ACM Conference on Computer and "
               "Communications Security*, pp. 161–170."),
    ("provos", "Provos, N. and Mazières, D. (1999) 'A future-adaptable password scheme', "
               "*Proceedings of the 1999 USENIX Annual Technical Conference*."),
    ("rfc9106", "Biryukov, A., Dinu, D., Khovratovich, D. and Josefsson, S. (2021) "
                "*Argon2 Memory-Hard Function for Password Hashing and Proof-of-Work "
                "Applications*. RFC 9106. Internet Engineering Task Force."),
    ("rfc6238", "M'Raihi, D., Machani, S., Pei, M. and Rydell, J. (2011) *TOTP: Time-Based "
                "One-Time Password Algorithm*. RFC 6238. Internet Engineering Task Force."),
    ("cwe307", "MITRE (2024) *CWE-307: Improper Restriction of Excessive Authentication "
               "Attempts*. Available at: https://cwe.mitre.org/data/definitions/307.html "
               "(Accessed: 24 November 2026)."),
    ("halfond", "Halfond, W.G.J., Viegas, J. and Orso, A. (2006) 'A classification of "
                "SQL-injection attacks and countermeasures', *Proceedings of the IEEE "
                "International Symposium on Secure Software Engineering*."),
    ("cwe89", "MITRE (2024) *CWE-89: Improper Neutralization of Special Elements used in "
              "an SQL Command ('SQL Injection')*. Available at: "
              "https://cwe.mitre.org/data/definitions/89.html (Accessed: 24 November 2026)."),
    ("cwe319", "MITRE (2024) *CWE-319: Cleartext Transmission of Sensitive Information*. "
               "Available at: https://cwe.mitre.org/data/definitions/319.html "
               "(Accessed: 24 November 2026)."),
    ("cwe525", "MITRE (2024) *CWE-525: Use of Web Browser Cache Containing Sensitive "
               "Information*. Available at: https://cwe.mitre.org/data/definitions/525.html "
               "(Accessed: 24 November 2026)."),
    ("rfc6797", "Hodges, J., Jackson, C. and Barth, A. (2012) *HTTP Strict Transport "
                "Security (HSTS)*. RFC 6797. Internet Engineering Task Force."),
    ("rfc6265", "Barth, A. (2011) *HTTP State Management Mechanism*. RFC 6265. Internet "
                "Engineering Task Force."),
    ("barth2008", "Barth, A., Jackson, C. and Mitchell, J.C. (2008) 'Robust defenses for "
                  "cross-site request forgery', *Proceedings of the 15th ACM Conference on "
                  "Computer and Communications Security*, pp. 75–88."),
    ("stamm", "Stamm, S., Sterne, B. and Markham, G. (2010) 'Reining in the web with "
              "content security policy', *Proceedings of the 19th International Conference "
              "on World Wide Web*, pp. 921–930."),
    ("rfc9110", "Fielding, R., Nottingham, M. and Reschke, J. (2022) *HTTP Semantics*. "
                "RFC 9110. Internet Engineering Task Force."),
    ("cvss", "FIRST (2019) *Common Vulnerability Scoring System v3.1: Specification "
             "Document*. Forum of Incident Response and Security Teams. Available at: "
             "https://www.first.org/cvss/v3-1/specification-document "
             "(Accessed: 24 November 2026)."),
    ("asvs", "OWASP Foundation (2021) *OWASP Application Security Verification Standard "
             "4.0.3*. Available at: https://owasp.org/www-project-application-security-"
             "verification-standard/ (Accessed: 24 November 2026)."),
    ("wstg", "OWASP Foundation (2020) *OWASP Web Security Testing Guide v4.2*. Available "
             "at: https://owasp.org/www-project-web-security-testing-guide/ "
             "(Accessed: 24 November 2026)."),
    ("pentestgpt", "Deng, G., Liu, Y., Mayoral-Vilches, V., Liu, P., Li, Y., Xu, Y., "
                   "Zhang, T., Liu, Y., Pinzger, M. and Rass, S. (2024) 'PentestGPT: An "
                   "LLM-empowered automatic penetration testing tool', *arXiv preprint* "
                   "arXiv:2308.06782."),
    ("happe", "Happe, A. and Cito, J. (2023) 'Getting pwn'd by AI: Penetration testing "
              "with large language models', *Proceedings of the 31st ACM Joint European "
              "Software Engineering Conference and Symposium on the Foundations of "
              "Software Engineering*, pp. 2082–2086."),
    ("cybench", "Zhang, A.K. et al. (2024) 'Cybench: A framework for evaluating "
                "cybersecurity capabilities and risks of language models', *arXiv "
                "preprint* arXiv:2408.08926."),
    ("wohlin", "Wohlin, C., Runeson, P., Höst, M., Ohlsson, M.C., Regnell, B. and "
               "Wesslén, A. (2012) *Experimentation in Software Engineering*. Berlin: "
               "Springer."),
    ("runeson", "Runeson, P. and Höst, M. (2009) 'Guidelines for conducting and reporting "
                "case study research in software engineering', *Empirical Software "
                "Engineering*, 14(2), pp. 131–164."),
    ("docker", "Boettiger, C. (2015) 'An introduction to Docker for reproducible "
               "research', *ACM SIGOPS Operating Systems Review*, 49(1), pp. 71–79."),
    ("shannon", "Keygraph (2026) *Shannon: Autonomous AI Penetration Testing Agent* "
                "(version 3.6.1). Available at: https://github.com/KeygraphHQ/shannon "
                "(Accessed: 24 November 2026)."),
    ("express", "OpenJS Foundation (2026) *Express 5.x Documentation*. Available at: "
                "https://expressjs.com/ (Accessed: 24 November 2026)."),
    ("postgres", "PostgreSQL Global Development Group (2026) *PostgreSQL 18 "
                 "Documentation*. Available at: https://www.postgresql.org/docs/18/ "
                 "(Accessed: 24 November 2026)."),
    ("caddy", "Stack Enterprises (2026) *Caddy 2 Documentation*. Available at: "
              "https://caddyserver.com/docs/ (Accessed: 24 November 2026)."),
    ("cwe204", "MITRE (2024) *CWE-204: Observable Response Discrepancy*. Available at: "
               "https://cwe.mitre.org/data/definitions/204.html (Accessed: 24 November 2026)."),
    ("openrouter", "OpenRouter (2026) *API Reference and Model Catalogue*. Available at: "
                   "https://openrouter.ai/docs (Accessed: 24 November 2026)."),
]

NUM = {key: i + 1 for i, (key, _) in enumerate(REFS)}


def c(*keys):
    """In-text citation, e.g. c('owasp2021') -> '[5]'."""
    return "[" + ", ".join(str(NUM[k]) for k in keys) + "]"


# ----------------------------------------------------------------------
# Inline run builder: understands **bold** and `code`
# ----------------------------------------------------------------------

BOLD = re.compile(r"(\*\*.+?\*\*)")
CODE = re.compile(r"(`[^`]+`)")


def add_runs(p, text, size=None, bold=False, italic=False, color=None,
             font=None):
    """Render inline markup.

    Bold is split first, then code within each segment, so that `code` inside a
    **bold** span still renders as code rather than keeping its backticks. An
    earlier version split only once, which left the backticks visible on every
    severity line.
    """
    for seg in BOLD.split(text):
        if not seg:
            continue
        seg_bold = seg.startswith("**") and seg.endswith("**") and len(seg) > 4
        inner = seg[2:-2] if seg_bold else seg

        for part in CODE.split(inner):
            if not part:
                continue
            is_code = part.startswith("`") and part.endswith("`") and len(part) > 2
            r = p.add_run(part[1:-1] if is_code else part)
            r.bold = bold or seg_bold
            if is_code:
                r.font.name = CODE_FONT
                r.font.size = Pt((size or 11) - 1.0)
            else:
                if font:
                    r.font.name = font
                if size:
                    r.font.size = Pt(size)
            if italic:
                r.italic = True
            if color is not None:
                r.font.color.rgb = color
    return p


# ----------------------------------------------------------------------
# Paragraph and block helpers
# ----------------------------------------------------------------------

def body(doc, text, size=11, space_after=8, align=None, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    add_runs(p, text, size=size, italic=italic)
    if align:
        p.alignment = align
    return p


def bullet(doc, text, size=11):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.12
    add_runs(p, text, size=size)
    return p


def numbered(doc, text, size=11):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.12
    add_runs(p, text, size=size)
    return p


def quote(doc, text, size=10):
    """Indented block for quotations and key statements."""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(1.0)
    p.paragraph_format.right_indent = Cm(0.5)
    p.paragraph_format.space_after = Pt(8)
    add_runs(p, text, size=size, italic=True, color=GREY)
    return p


def heading(doc, text, level=1):
    h = doc.add_heading(level=level)
    r = h.add_run(text)
    r.font.color.rgb = ACCENT
    r.font.name = BODY_FONT
    if level == 1:
        r.font.size = Pt(16)
        h.paragraph_format.space_before = Pt(18)
        h.paragraph_format.space_after = Pt(8)
    elif level == 2:
        r.font.size = Pt(13)
        h.paragraph_format.space_before = Pt(13)
        h.paragraph_format.space_after = Pt(5)
    else:
        r.font.size = Pt(11.5)
        r.italic = False
        h.paragraph_format.space_before = Pt(10)
        h.paragraph_format.space_after = Pt(4)
    return h


def _shade_paragraph(p, fill):
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pPr.append(shd)


def _left_border(p, color="C9CBD1"):
    pPr = p._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "12")
    left.set(qn("w:space"), "6")
    left.set(qn("w:color"), color)
    borders.append(left)
    pPr.append(borders)


def code_block(doc, text, size=8.5, caption=None):
    """Monospaced, shaded block. One paragraph so it cannot split mid-block."""
    if caption:
        cap = doc.add_paragraph()
        cap.paragraph_format.space_before = Pt(4)
        cap.paragraph_format.space_after = Pt(2)
        add_runs(cap, caption, size=8.5, bold=True, color=GREY)
        cap.paragraph_format.keep_with_next = True

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.left_indent = Cm(0.3)
    p.paragraph_format.line_spacing = 1.0
    _shade_paragraph(p, CODE_FILL)
    _left_border(p)

    lines = text.strip("\n").split("\n")
    for i, line in enumerate(lines):
        r = p.add_run(line)
        r.font.name = CODE_FONT
        r.font.size = Pt(size)
        if i < len(lines) - 1:
            r.add_break()
    return p


def caption(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(12)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_runs(p, text, size=8.5, italic=True, color=GREY)
    return p


def _shade_cell(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def table(doc, headers, rows, widths=None, size=8.5, first_col_bold=False,
          keep_together=False):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = True

    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(2)
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(size)
        _shade_cell(cell, HEAD_FILL)

    for row in rows:
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            add_runs(p, str(value), size=size,
                     bold=(first_col_bold and i == 0))

    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                if i < len(row.cells):
                    row.cells[i].width = Cm(w)

    # Repeat the header row when a table crosses a page boundary.
    trPr = t.rows[0]._tr.get_or_add_trPr()
    tblHeader = OxmlElement("w:tblHeader")
    tblHeader.set(qn("w:val"), "true")
    trPr.append(tblHeader)

    # Word breaks a table wherever a page ends, even mid-row. Keeping every row
    # but the last with the next one moves the whole table to the following page
    # instead, which reads better in a short document.
    if keep_together:
        for row in t.rows[:-1]:
            for cell in row.cells:
                for para in cell.paragraphs:
                    para.paragraph_format.keep_with_next = True
    return t


def add_field(paragraph, instruction, placeholder=""):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = placeholder
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for el in (begin, instr, sep, text, end):
        run._r.append(el)
    return run


def toc(doc):
    p = doc.add_paragraph()
    add_field(p, r'TOC \o "1-2" \h \z \u',
              "Right-click here and choose “Update Field” to build the contents.")
    for r in p.runs:
        r.font.size = Pt(10)
    return p


def page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)
    return p


def footer_page_numbers(doc, left_text):
    section = doc.sections[0]
    footer = section.footer
    p = footer.paragraphs[0]
    p.text = ""
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(left_text + "    |    Page ")
    r.font.size = Pt(8)
    r.font.color.rgb = GREY
    add_field(p, "PAGE", "1")
    r2 = p.add_run(" of ")
    r2.font.size = Pt(8)
    r2.font.color.rgb = GREY
    add_field(p, "NUMPAGES", "1")
    for r in p.runs:
        r.font.size = Pt(8)
        r.font.color.rgb = GREY


def new_document():
    doc = Document()

    section = doc.sections[0]
    section.page_height = Cm(29.7)
    section.page_width = Cm(21.0)
    section.top_margin = Cm(2.4)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.6)
    section.right_margin = Cm(2.4)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(8)

    # Keep headings with the text that follows them.
    for name in ("Heading 1", "Heading 2", "Heading 3"):
        try:
            doc.styles[name].paragraph_format.keep_with_next = True
        except KeyError:
            pass

    return doc
