"""Build the report DOCX from a lightweight Markdown source."""
import os, re, sys
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.text import WD_BREAK

SRC = sys.argv[1]
OUT = sys.argv[2]
FIGDIR = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(SRC)

NAVY = RGBColor(0x1F, 0x3A, 0x5F)
GREY = RGBColor(0x55, 0x55, 0x55)
BODY_FONT = "Times New Roman"
MONO_FONT = "Consolas"


# ---------- low-level helpers ----------
def set_cell_shading(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def set_para_border(p, side="left", color="1F3A5F", size=18, space=6):
    pPr = p._p.get_or_add_pPr()
    borders = pPr.find(qn("w:pBdr"))
    if borders is None:
        borders = OxmlElement("w:pBdr")
        pPr.append(borders)
    el = OxmlElement(f"w:{side}")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(size))
    el.set(qn("w:space"), str(space))
    el.set(qn("w:color"), color)
    borders.append(el)


def set_para_shading(p, hex_fill):
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    pPr.append(shd)


def add_field(paragraph, instr, placeholder="1", size=9, color=GREY):
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    run._r.append(fld_begin)
    run2 = paragraph.add_run()
    it = OxmlElement("w:instrText")
    it.set(qn("xml:space"), "preserve")
    it.text = instr
    run2._r.append(it)
    run3 = paragraph.add_run()
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    run3._r.append(sep)
    run4 = paragraph.add_run(placeholder)
    run5 = paragraph.add_run()
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run5._r.append(end)
    for r in (run, run2, run3, run4, run5):
        r.font.size = Pt(size)
        r.font.color.rgb = color
        r.font.name = BODY_FONT


def add_page_number_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_field(p, " PAGE ")
    r = p.add_run("  of  ")
    r.font.size = Pt(9)
    r.font.color.rgb = GREY
    r.font.name = BODY_FONT
    add_field(p, " NUMPAGES ")


def add_header(section, text):
    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run(text)
    r.font.size = Pt(8.5)
    r.font.color.rgb = GREY
    r.font.name = BODY_FONT
    r.italic = True
    pPr = p._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), "BFBFBF")
    borders.append(bottom)
    pPr.append(borders)


def restart_page_numbering(section, start=1):
    sectPr = section._sectPr
    pg = sectPr.find(qn("w:pgNumType"))
    if pg is None:
        pg = OxmlElement("w:pgNumType")
        sectPr.append(pg)
    pg.set(qn("w:start"), str(start))


def style_document(doc):
    st = doc.styles["Normal"]
    st.font.name = BODY_FONT
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    pf = st.paragraph_format
    pf.line_spacing = 1.05
    pf.space_after = Pt(4)
    pf.space_before = Pt(0)
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    for name, size, before, after, color in [
        ("Heading 1", 15, 0, 8, NAVY),
        ("Heading 2", 12.5, 10, 5, NAVY),
        ("Heading 3", 11, 8, 3, NAVY),
    ]:
        h = doc.styles[name]
        h.font.name = BODY_FONT
        h.font.size = Pt(size)
        h.font.bold = True
        h.font.color.rgb = color
        h.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
        h.paragraph_format.space_before = Pt(before)
        h.paragraph_format.space_after = Pt(after)
        h.paragraph_format.keep_with_next = True
        h.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        h.paragraph_format.line_spacing = 1.0

    for name in ("TOC 1", "TOC 2"):
        try:
            t = doc.styles[name]
        except KeyError:
            continue
        t.font.name = BODY_FONT
        t.font.size = Pt(9.5 if name == "TOC 1" else 9)
        t.paragraph_format.space_before = Pt(3 if name == "TOC 1" else 0)
        t.paragraph_format.space_after = Pt(0)
        t.paragraph_format.line_spacing = 1.0


INLINE = re.compile(r"(\*\*.+?\*\*|\*[^*]+?\*|`[^`]+?`)")


def add_inline(p, text, size=11, color=None, italic_all=False):
    parts = INLINE.split(text)
    for part in parts:
        if not part:
            continue
        bold = italic = mono = False
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            part, bold = part[2:-2], True
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            part, italic = part[1:-1], True
        elif part.startswith("`") and part.endswith("`") and len(part) > 2:
            part, mono = part[1:-1], True
        r = p.add_run(part)
        r.bold = bold
        r.italic = italic or italic_all
        r.font.size = Pt(size - 1 if mono else size)
        r.font.name = MONO_FONT if mono else BODY_FONT
        if color is not None:
            r.font.color.rgb = color


# ---------- block renderers ----------
def add_table(doc, rows, caption=None):
    if caption:
        cp = doc.add_paragraph()
        cp.paragraph_format.space_before = Pt(8)
        cp.paragraph_format.space_after = Pt(3)
        cp.paragraph_format.keep_with_next = True
        cp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = cp.add_run(caption)
        r.font.size = Pt(9)
        r.font.name = BODY_FONT
        r.italic = True
        r.font.color.rgb = GREY

    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        return
    ncols = len(rows[0])
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for i, row in enumerate(rows):
        for j in range(ncols):
            cell = table.cell(i, j)
            txt = row[j].strip() if j < len(row) else ""
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.line_spacing = 1.0
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            add_inline(p, txt, size=8.2 if i else 8.2)
            if i == 0:
                for rr in p.runs:
                    rr.bold = True
                    rr.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                set_cell_shading(cell, "1F3A5F")
            elif i % 2 == 0:
                set_cell_shading(cell, "F2F5F8")
    # tighten cell margins
    tblPr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for side, w in (("top", 40), ("bottom", 40), ("left", 80), ("right", 80)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(w))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tblPr.append(mar)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_code(doc, lines, caption=None):
    if caption:
        cp = doc.add_paragraph()
        cp.paragraph_format.space_before = Pt(8)
        cp.paragraph_format.space_after = Pt(2)
        cp.paragraph_format.keep_with_next = True
        r = cp.add_run(caption)
        r.font.size = Pt(9)
        r.font.name = BODY_FONT
        r.italic = True
        r.font.color.rgb = GREY
    for k, line in enumerate(lines):
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.line_spacing = 1.0
        pf.space_before = Pt(4 if k == 0 else 0)
        pf.space_after = Pt(4 if k == len(lines) - 1 else 0)
        pf.left_indent = Cm(0.3)
        pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
        set_para_shading(p, "F4F6F8")
        set_para_border(p, "left", "1F3A5F", 12, 8)
        r = p.add_run(line if line else " ")
        r.font.name = MONO_FONT
        r.font.size = Pt(7.6)
        r._element.rPr.rFonts.set(qn("w:eastAsia"), MONO_FONT)
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(2)


def add_figure(doc, path, caption, width_cm=13.6):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    run = p.add_run()
    run.add_picture(path, width=Cm(width_cm))
    cp = doc.add_paragraph()
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cp.paragraph_format.space_after = Pt(10)
    r = cp.add_run(caption)
    r.font.size = Pt(9)
    r.font.name = BODY_FONT
    r.italic = True
    r.font.color.rgb = GREY


def add_quote(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.6)
    pf.right_indent = Cm(0.4)
    pf.space_before = Pt(6)
    pf.space_after = Pt(8)
    pf.line_spacing = 1.1
    set_para_border(p, "left", "C8963E", 18, 8)
    add_inline(p, text, size=10.5)
    for r in p.runs:
        r.italic = True


def add_bullet(doc, text, numbered=False):
    style = "List Number" if numbered else "List Bullet"
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.12
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.first_line_indent = Cm(-0.4)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    add_inline(p, text, size=10.5)


def add_toc_field(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), 'TOC \\o "1-1" \\h \\z \\u')
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "Right-click and choose Update Field to build the contents."
    r.append(t)
    fld.append(r)
    p._p.append(fld)


def add_titlepage(doc, lines):
    for _ in range(3):
        doc.add_paragraph()
    title = lines[0] if lines else ""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run(title)
    r.font.size = Pt(24)
    r.font.bold = True
    r.font.color.rgb = NAVY
    r.font.name = BODY_FONT

    for k, ln in enumerate(lines[1:]):
        if not ln.strip():
            continue
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        r = p.add_run(ln)
        r.font.size = Pt(13 if k == 0 else 10)
        r.font.name = BODY_FONT
        r.italic = (k == 0)
        r.font.color.rgb = GREY if k else NAVY

    rule = doc.add_paragraph()
    rule.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rule.paragraph_format.space_before = Pt(14)
    rule.paragraph_format.space_after = Pt(14)
    set_para_border(rule, "bottom", "1F3A5F", 12, 1)


def add_section_break(doc):
    new = doc.add_section(WD_SECTION.NEW_PAGE)
    new.page_height = Cm(29.7)
    new.page_width = Cm(21.0)
    new.top_margin = Cm(2.0)
    new.bottom_margin = Cm(2.0)
    new.left_margin = Cm(2.1)
    new.right_margin = Cm(2.1)
    new.header.is_linked_to_previous = False
    new.footer.is_linked_to_previous = False
    add_header(new, "AI and Manual Penetration Testing  |  Technical Report")
    add_page_number_footer(new)
    restart_page_numbering(new, 1)
    return new


# ---------- parse ----------
def build():
    doc = Document()
    style_document(doc)
    sec = doc.sections[0]
    sec.page_height = Cm(29.7)
    sec.page_width = Cm(21.0)
    for m in ("top_margin", "bottom_margin"):
        setattr(sec, m, Cm(2.0))
    sec.left_margin = Cm(2.1)
    sec.right_margin = Cm(2.1)

    raw = open(SRC, encoding="utf-8").read().replace("\r\n", "\n").split("\n")
    i = 0
    in_code = False
    code_buf = []
    code_caption = None
    table_buf = []
    table_caption = None
    body_started = False

    def flush_table():
        nonlocal table_buf, table_caption
        if table_buf:
            parsed = [[c for c in ln.strip().strip("|").split("|")] for ln in table_buf]
            parsed = [r for r in parsed if not all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in r)]
            add_table(doc, parsed, table_caption)
        table_buf = []
        table_caption = None

    while i < len(raw):
        line = raw[i].rstrip()
        s = line.strip()

        if in_code:
            if s.startswith("```"):
                add_code(doc, code_buf, code_caption)
                in_code = False
                code_buf = []
                code_caption = None
            else:
                code_buf.append(line)
            i += 1
            continue

        if s.startswith("```"):
            flush_table()
            in_code = True
            # caption may be on the same line after the fence
            rest = s[3:].strip()
            code_caption = rest if rest else None
            i += 1
            continue

        if s.startswith("::: table"):
            flush_table()
            table_caption = s[len("::: table"):].strip() or None
            i += 1
            continue

        if s.startswith("|"):
            table_buf.append(s)
            i += 1
            continue
        else:
            flush_table()

        if not s:
            i += 1
            continue

        if s == "::: pagebreak":
            doc.add_page_break()
            i += 1
            continue

        if s == "::: sectionbreak":
            add_section_break(doc)
            i += 1
            continue

        if s == "::: title":
            block = []
            i += 1
            while i < len(raw) and raw[i].strip() != "::: endtitle":
                block.append(raw[i].strip())
                i += 1
            add_titlepage(doc, block)
            i += 1
            continue

        if s == "::: toc":
            add_toc_field(doc)
            i += 1
            continue

        if s.startswith("::: quote"):
            txt = s[len("::: quote"):].strip()
            add_quote(doc, txt)
            i += 1
            continue

        if s.startswith("::: figure"):
            payload = s[len("::: figure"):].strip()
            path, _, cap = payload.partition("|")
            path = path.strip()
            if not os.path.isabs(path):
                path = os.path.join(FIGDIR, path)
            add_figure(doc, path, cap.strip())
            i += 1
            continue

        if s.startswith("# "):
            if body_started:
                pass
            h = doc.add_heading(level=1)
            h.add_run(s[2:].strip())
            body_started = True
            i += 1
            continue

        if s.startswith("## "):
            h = doc.add_heading(level=2)
            h.add_run(s[3:].strip())
            i += 1
            continue

        if s.startswith("### "):
            h = doc.add_heading(level=3)
            h.add_run(s[4:].strip())
            i += 1
            continue

        if s.startswith("- "):
            add_bullet(doc, s[2:].strip(), numbered=False)
            i += 1
            continue

        m = re.match(r"^(\d+)\.\s+(.*)$", s)
        if m:
            add_bullet(doc, m.group(2), numbered=True)
            i += 1
            continue

        p = doc.add_paragraph()
        add_inline(p, s, size=11)
        i += 1

    flush_table()
    if in_code and code_buf:
        add_code(doc, code_buf, code_caption)

    doc.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    build()
