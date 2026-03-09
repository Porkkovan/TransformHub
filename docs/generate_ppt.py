"""
TransformHub – Senior Leadership Demo Deck
Generates a polished .pptx with white backgrounds, brand colours,
talking points and supporting data on every slide.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from pptx.chart.data import ChartData
from pptx.enum.chart import XL_CHART_TYPE
import copy

# ── Brand palette ──────────────────────────────────────────────────────────
INDIGO      = RGBColor(0x63, 0x66, 0xF1)   # primary accent
CYAN        = RGBColor(0x06, 0xB6, 0xD4)   # secondary accent
GREEN       = RGBColor(0x16, 0xA3, 0x4A)
AMBER       = RGBColor(0xD9, 0x77, 0x06)
RED         = RGBColor(0xDC, 0x26, 0x26)
DARK        = RGBColor(0x0F, 0x17, 0x2A)   # near-black
MID_GRAY    = RGBColor(0x4B, 0x55, 0x63)
LIGHT_GRAY  = RGBColor(0xF3, 0xF4, 0xF6)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
SLIDE_BG    = RGBColor(0xFF, 0xFF, 0xFF)   # white background
ACCENT_BG   = RGBColor(0xEE, 0xF2, 0xFF)  # very light indigo tint
CYAN_BG     = RGBColor(0xEC, 0xFE, 0xFF)
GREEN_BG    = RGBColor(0xF0, 0xFD, 0xF4)
AMBER_BG    = RGBColor(0xFF, 0xFB, 0xEB)
RED_BG      = RGBColor(0xFE, 0xF2, 0xF2)

# ── Slide size (widescreen 16:9) ───────────────────────────────────────────
W = Inches(13.33)
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H

BLANK = prs.slide_layouts[6]   # completely blank layout

# ══════════════════════════════════════════════════════════════════════════════
# Helper utilities
# ══════════════════════════════════════════════════════════════════════════════

def add_slide():
    sl = prs.slides.add_slide(BLANK)
    # White background
    bg = sl.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = SLIDE_BG
    return sl


def box(slide, x, y, w, h,
        fill_color=None, line_color=None, line_width=Pt(0.75), radius=None):
    """Add a filled/outlined rectangle."""
    from pptx.util import Emu
    shape = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        Inches(x), Inches(y), Inches(w), Inches(h)
    )
    if fill_color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
    else:
        shape.fill.background()
    if line_color:
        shape.line.color.rgb = line_color
        shape.line.width = line_width
    else:
        shape.line.fill.background()
    return shape


def txt(slide, text, x, y, w, h,
        size=12, bold=False, color=DARK, align=PP_ALIGN.LEFT,
        italic=False, wrap=True):
    """Add a text box."""
    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox


def multiline_txt(slide, lines, x, y, w, h,
                  size=11, color=DARK, bold_first=False, spacing=1.15,
                  align=PP_ALIGN.LEFT):
    """Add a text box with multiple paragraphs."""
    from pptx.util import Pt as PT
    from pptx.oxml.ns import qn
    import lxml.etree as etree

    txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = txBox.text_frame
    tf.word_wrap = True

    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        run.font.size = PT(size)
        run.font.color.rgb = color
        run.font.bold = (bold_first and i == 0)
    return txBox


def header_bar(slide, title, subtitle=None, accent=INDIGO):
    """Top accent bar + title."""
    # Thin colour bar at top
    bar = box(slide, 0, 0, 13.33, 0.07, fill_color=accent)
    # Title
    txt(slide, title, 0.5, 0.18, 9.5, 0.55,
        size=24, bold=True, color=DARK, align=PP_ALIGN.LEFT)
    if subtitle:
        txt(slide, subtitle, 0.5, 0.72, 9.5, 0.35,
            size=12, color=MID_GRAY, align=PP_ALIGN.LEFT)


def section_label(slide, text, x, y, color=INDIGO):
    """Small ALL-CAPS section eyebrow."""
    txt(slide, text.upper(), x, y, 6, 0.28,
        size=9, bold=True, color=color, align=PP_ALIGN.LEFT)


def card(slide, x, y, w, h, bg=ACCENT_BG, border=INDIGO):
    return box(slide, x, y, w, h,
               fill_color=bg, line_color=border, line_width=Pt(0.5))


def bullet_block(slide, items, x, y, w, h,
                 title=None, title_color=INDIGO,
                 bullet="→", size=10, color=DARK,
                 bg=ACCENT_BG, border=INDIGO, line_gap=0.28):
    """Render a bullet list inside a card."""
    card(slide, x, y, w, h, bg=bg, border=border)
    cy = y + 0.15
    if title:
        txt(slide, title, x + 0.15, cy, w - 0.3, 0.28,
            size=10, bold=True, color=title_color)
        cy += 0.30
    for item in items:
        txt(slide, f"{bullet}  {item}", x + 0.15, cy, w - 0.3, line_gap + 0.02,
            size=size, color=color)
        cy += line_gap
    return cy


def metric_box(slide, value, label, x, y, w=1.4, h=0.85,
               val_color=INDIGO, bg=ACCENT_BG, border=INDIGO):
    card(slide, x, y, w, h, bg=bg, border=border)
    txt(slide, str(value), x + 0.1, y + 0.06, w - 0.2, 0.44,
        size=26, bold=True, color=val_color, align=PP_ALIGN.CENTER)
    txt(slide, label, x + 0.05, y + 0.50, w - 0.1, 0.28,
        size=9, color=MID_GRAY, align=PP_ALIGN.CENTER)


def talking_points_panel(slide, points, x=8.85, y=1.15, w=4.2, h=5.8):
    """Right-hand 'Talking Points' panel."""
    # Panel background
    box(slide, x, y, w, h, fill_color=RGBColor(0xF9, 0xFA, 0xFF),
        line_color=INDIGO, line_width=Pt(0.75))
    # Header strip
    box(slide, x, y, w, 0.38, fill_color=INDIGO)
    txt(slide, "💬  TALKING POINTS", x + 0.15, y + 0.05, w - 0.3, 0.28,
        size=10, bold=True, color=WHITE)
    cy = y + 0.50
    for pt in points:
        # bullet dot
        dot = slide.shapes.add_shape(
            9,  # OVAL
            Inches(x + 0.18), Inches(cy + 0.07),
            Inches(0.09), Inches(0.09)
        )
        dot.fill.solid(); dot.fill.fore_color.rgb = INDIGO
        dot.line.fill.background()
        txt(slide, pt, x + 0.35, cy, w - 0.5, 0.55,
            size=9.5, color=DARK, wrap=True)
        cy += 0.60
        if cy > y + h - 0.15:
            break


def add_accuracy_bar(slide, label, pct, x, y, w=3.6, h=0.44,
                     bar_color=GREEN):
    """Horizontal accuracy bar."""
    txt(slide, label, x, y, 2.2, 0.25, size=9.5, color=DARK)
    pct_label = f"{pct}%"
    txt(slide, pct_label, x + 2.25, y, 0.6, 0.25,
        size=9.5, bold=True, color=bar_color, align=PP_ALIGN.RIGHT)
    # track
    box(slide, x, y + 0.28, w, 0.13, fill_color=LIGHT_GRAY)
    # fill
    fill_w = w * (pct / 100)
    box(slide, x, y + 0.28, fill_w, 0.13, fill_color=bar_color)


def step_badge(slide, num, x, y, color=INDIGO):
    c = slide.shapes.add_shape(9, Inches(x), Inches(y),
                                Inches(0.35), Inches(0.35))
    c.fill.solid(); c.fill.fore_color.rgb = color
    c.line.fill.background()
    tf = c.text_frame
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    r = tf.paragraphs[0].add_run()
    r.text = str(num); r.font.size = Pt(13); r.font.bold = True
    r.font.color.rgb = WHITE


def footer(slide, text="TransformHub  ·  Enterprise Digital Transformation Platform  ·  2026"):
    box(slide, 0, 7.25, 13.33, 0.25, fill_color=LIGHT_GRAY)
    txt(slide, text, 0.3, 7.27, 12.7, 0.2,
        size=8, color=MID_GRAY, align=PP_ALIGN.LEFT)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — Title
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()

# Left colour band
box(sl, 0, 0, 0.18, 7.5, fill_color=INDIGO)

# Big title
txt(sl, "TransformHub", 0.55, 1.0, 8.5, 1.1,
    size=52, bold=True, color=INDIGO, align=PP_ALIGN.LEFT)
txt(sl, "Senior Leadership Demo  ·  March 2026", 0.55, 2.05, 8.5, 0.4,
    size=14, color=MID_GRAY)
txt(sl, "Enterprise Digital Transformation Platform", 0.55, 2.55, 8.5, 0.5,
    size=18, bold=True, color=DARK)
txt(sl, "Powered by 18 AI Agents  ·  Next.js 15 + FastAPI + LangGraph  ·  PostgreSQL + pgvector",
    0.55, 3.05, 8.5, 0.35, size=11, color=MID_GRAY)

# Stats row
stats = [("3", "Enterprise Orgs"), ("8", "Core Modules"),
         ("18", "AI Agents"), ("78", "Capabilities"), ("245+", "Functionalities")]
for i, (val, lbl) in enumerate(stats):
    metric_box(sl, val, lbl, 0.55 + i * 1.65, 4.0, 1.4, 0.9)

# Tagline
box(sl, 0.55, 5.2, 7.8, 0.8, fill_color=ACCENT_BG, line_color=INDIGO, line_width=Pt(0.5))
txt(sl, "AI-powered transformation from discovery to delivery — auditable, benchmark-grounded, transparent.",
    0.75, 5.32, 7.4, 0.55, size=11, italic=True, color=INDIGO)

# Right panel — credentials
card(sl, 9.2, 1.0, 3.7, 5.5, bg=RGBColor(0xF9,0xFA,0xFF), border=INDIGO)
box(sl, 9.2, 1.0, 3.7, 0.4, fill_color=INDIGO)
txt(sl, "DEMO ACCESS", 9.4, 1.07, 3.3, 0.28,
    size=11, bold=True, color=WHITE)
rows = [
    ("Pre-Filled Demo", "demo@transformhub.ai", "demo1234"),
    ("Live Entry Demo", "live@transformhub.ai", "live1234"),
    ("Admin", "admin@transformhub.ai", "demo1234"),
]
cy = 1.55
for label, email, pwd in rows:
    txt(sl, label, 9.4, cy, 3.3, 0.22, size=9, bold=True, color=INDIGO)
    txt(sl, f"✉  {email}", 9.4, cy + 0.22, 3.3, 0.22, size=9, color=DARK)
    txt(sl, f"🔑  {pwd}", 9.4, cy + 0.44, 3.3, 0.22, size=9, color=MID_GRAY)
    cy += 0.9
txt(sl, "🌐  http://localhost:3000", 9.4, cy + 0.1, 3.3, 0.28,
    size=9.5, bold=True, color=CYAN)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — Agenda
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Today's Agenda", "25-minute walkthrough across all platform modules")

agenda = [
    (INDIGO,  "1", "Platform Overview",         "3 min",  "Architecture, 8 modules, 18 AI agents pipeline"),
    (CYAN,    "2", "Discovery Module",           "4 min",  "Multi-pass AI discovery · confidence scoring · source triangulation"),
    (GREEN,   "3", "Value Stream Mapping",       "4 min",  "L1/L2/L3 hierarchy · flow efficiency · Mermaid diagrams"),
    (RGBColor(0xA8,0x55,0xF7), "4", "Future State Vision", "4 min", "Benchmark-grounded projections · automation mix breakdown"),
    (RED,     "5", "Risk & Compliance",          "3 min",  "Risk gates · SHA-256 audit trail · regulatory frameworks"),
    (AMBER,   "6", "Accuracy Dashboard",         "3 min",  "Per-module scores · composite · live action plan"),
    (CYAN,    "7", "Live Entry Demo",             "4 min",  "Create org · run agents · watch data populate in real-time"),
    (GREEN,   "8", "Q&A",                        "5 min",  "Open questions · next steps · roadmap"),
]

cols = [(0.4, 6.0), (6.7, 6.0)]
for i, (color, num, title, dur, desc) in enumerate(agenda):
    col = i % 2
    row = i // 2
    xb = cols[col][0]
    yb = 1.3 + row * 1.35
    w  = 5.9
    card(sl, xb, yb, w, 1.1, bg=LIGHT_GRAY,
         border=color)
    step_badge(sl, num, xb + 0.12, yb + 0.35, color=color)
    txt(sl, title, xb + 0.6, yb + 0.1, w - 0.75, 0.35,
        size=12, bold=True, color=DARK)
    txt(sl, f"⏱  {dur}", xb + 0.6, yb + 0.42, 1.2, 0.25,
        size=9, color=color, bold=True)
    txt(sl, desc, xb + 0.6, yb + 0.65, w - 0.75, 0.38,
        size=9.5, color=MID_GRAY)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — Demo Mode Selection
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Choose Your Demo Path",
           "Two options depending on audience and time available")

# Pre-Filled card
card(sl, 0.4, 1.25, 5.9, 5.5, bg=ACCENT_BG, border=INDIGO)
box(sl, 0.4, 1.25, 5.9, 0.45, fill_color=INDIGO)
txt(sl, "🎯  PRE-FILLED DEMO", 0.6, 1.32, 5.5, 0.32,
    size=12, bold=True, color=WHITE)
txt(sl, "Recommended for Senior Leadership", 0.6, 1.75, 5.5, 0.28,
    size=10, bold=True, color=INDIGO)
pf_items = [
    "Login: demo@transformhub.ai  /  demo1234",
    "3 enterprise orgs pre-loaded — US Bank, Telstra Health, ING Bank",
    "78 AI-mapped capabilities, 245 functionalities, full VSM",
    "Accuracy scores immediately visible (~65–72% composite)",
    "21 context documents across all 5 RAG categories indexed",
    "Rich roadmap: 234 items with RICE scores + approval status",
    "Estimated duration: 15–20 minutes",
]
cy = 2.12
for item in pf_items:
    txt(sl, f"✓  {item}", 0.6, cy, 5.5, 0.38, size=10, color=DARK)
    cy += 0.42
txt(sl, "START →  http://localhost:3000/login", 0.6, 6.3, 5.5, 0.3,
    size=10, bold=True, color=INDIGO)

# Live Entry card
card(sl, 7.0, 1.25, 5.9, 5.5, bg=CYAN_BG, border=CYAN)
box(sl, 7.0, 1.25, 5.9, 0.45, fill_color=CYAN)
txt(sl, "⚡  LIVE ENTRY DEMO", 7.2, 1.32, 5.5, 0.32,
    size=12, bold=True, color=WHITE)
txt(sl, "Best for Technical Audiences", 7.2, 1.75, 5.5, 0.28,
    size=10, bold=True, color=CYAN)
le_items = [
    "Login: live@transformhub.ai  /  live1234",
    "Create new org — enter real company details",
    "Paste a GitHub repo URL or website URL",
    "Run Discovery agent — watch data stream in real-time",
    "Run VSM, Risk, Future State agents sequentially",
    "Watch accuracy scores rise from 0% to live values",
    "Requires OPENAI_API_KEY in .env  ·  20–30 minutes",
]
cy = 2.12
for item in le_items:
    txt(sl, f"✓  {item}", 7.2, cy, 5.5, 0.38, size=10, color=DARK)
    cy += 0.42
txt(sl, "START →  Organizations → + New Organization", 7.2, 6.3, 5.5, 0.3,
    size=10, bold=True, color=CYAN)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — Platform Architecture
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Platform Architecture",
           "Full-stack enterprise-grade AI transformation platform")

tps = [
    "Next.js 15 App Router with TypeScript provides a type-safe, SSR-ready frontend — no runtime surprises in demos",
    "FastAPI + LangGraph gives each of the 18 agents a dedicated execution graph with checkpointing — agents can be resumed on failure",
    "pgvector enables hybrid RAG: BM25 keyword ranking + semantic vector search combined for best retrieval accuracy",
    "Redis (in-memory fallback) handles agent state caching — demo works without Redis running",
    "Multi-tenant from day one: every org is fully isolated at the database row level",
    "SHA-256 chained audit trail means every agent action is tamper-proof and traceable",
]
talking_points_panel(sl, tps)

layers = [
    (INDIGO, "⚛  Frontend", ":3000", "Next.js 15 · TypeScript · Tailwind v4\nDark glassmorphism UI · Dark theme\nReal-time streaming output"),
    (CYAN,   "🐍  Agent Service", ":8000", "FastAPI · LangGraph · Python 3.13\n18 AI Agents · BM25 + pgvector RAG\nAgent memory + feedback loops"),
    (GREEN,  "🗄  Data Layer", ":5432", "PostgreSQL 18 + pgvector extension\nPrisma ORM · SHA-256 audit trail\nMulti-tenant org isolation"),
]

for i, (color, title, port, detail) in enumerate(layers):
    yb = 1.3 + i * 1.72
    card(sl, 0.4, yb, 7.85, 1.5, bg=LIGHT_GRAY, border=color)
    box(sl, 0.4, yb, 0.18, 1.5, fill_color=color)
    txt(sl, title, 0.72, yb + 0.12, 4.5, 0.4, size=14, bold=True, color=color)
    txt(sl, port, 5.4, yb + 0.12, 1.5, 0.4, size=14, bold=True, color=color,
        align=PP_ALIGN.RIGHT)
    txt(sl, detail, 0.72, yb + 0.55, 7.3, 0.85, size=10, color=DARK)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — 8 Core Modules
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "8 Core Modules",
           "End-to-end digital transformation lifecycle — discovery to delivery")

tps = [
    "Each module feeds data into the next — Discovery → VSM → Future State → Risk → Roadmap is a complete workflow",
    "All 8 modules have agent execution tracking and per-module accuracy scores visible on every page header",
    "Context Hub underpins every module: documents uploaded here are injected into every agent's RAG context",
    "The Accuracy dashboard is the single source of truth for AI output quality — show this last to land the data story",
    "Product Workbench shows readiness scores per product — drives the prioritisation discussion",
]
talking_points_panel(sl, tps)

modules = [
    (INDIGO, "🔍", "Discovery",          "Multi-pass AI · 3 review gates\nConfidence + source triangulation\n~85% accuracy"),
    (GREEN,  "🗺", "Value Stream Map",   "L1 / L2 / L3 hierarchy\nMermaid diagrams auto-generated\n100% VSM coverage"),
    (RGBColor(0xA8,0x55,0xF7), "🚀", "Future State", "Benchmark-grounded projections\n3-band metrics (cons/exp/opt)\nAutomation mix breakdown"),
    (RED,    "🛡", "Risk & Compliance",  "Risk gates ≥ 8.0 blocks\nSHA-256 audit trail\nFramework mapping (SOX, PCI-DSS)"),
    (AMBER,  "🗓", "Product Roadmap",    "RICE scoring\nApproval workflows\nQuarterly delivery tracks"),
    (CYAN,   "🔧", "Product Workbench",  "Readiness scoring (0–10)\nArchitecture views\nInline editing"),
    (GREEN,  "📚", "Context Hub",        "5 RAG doc categories\nBM25 + vector hybrid search\nURL + file upload"),
    (AMBER,  "📊", "Accuracy Dashboard", "Per-module composite score\nLive action plan\nAgent memory quality"),
]

cols = 4
for i, (color, icon, title, desc) in enumerate(modules):
    col = i % cols
    row = i // cols
    xb = 0.4 + col * 2.08
    yb = 1.3 + row * 2.6
    card(sl, xb, yb, 1.95, 2.3, bg=LIGHT_GRAY, border=color)
    box(sl, xb, yb, 1.95, 0.08, fill_color=color)
    txt(sl, icon, xb + 0.12, yb + 0.18, 0.5, 0.45, size=20)
    txt(sl, title, xb + 0.12, yb + 0.62, 1.72, 0.35,
        size=11, bold=True, color=color)
    txt(sl, desc, xb + 0.12, yb + 0.98, 1.72, 1.2,
        size=9, color=MID_GRAY)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — Discovery Module (demo step 1)
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 1  ·  Discovery Module",
           "Multi-pass AI analysis with human review gates at each stage", accent=INDIGO)

tps = [
    "3-pass design ensures humans approve products before capabilities are mapped — prevents hallucination cascade",
    "Confidence scores (78–97%) come from triangulating 8 evidence sources: GitHub structure, OpenAPI, DB schema, tests, docs, URL, integrations, Q&A",
    "Source triangulation rate: 100% of seeded capabilities have 3+ sources — show the source distribution chart in the Discovery module",
    "Inline edit/delete means the analyst team can correct AI output before it flows downstream",
    "4 view modes: Products list, Drilldown tree, Hierarchy tree, Product Catalog — switch to Catalog for exec summary",
    "US Bank: 3 products — LoanFlow Digital, PayStream Core, FraudGuard AI — each with 8–9 capabilities",
]
talking_points_panel(sl, tps)

# Pass diagram
passes = [
    (INDIGO, "Pass 1", "Digital Products only", "Human review gate → Approve/Edit/Delete"),
    (CYAN,   "Pass 2", "Capabilities mapped", "Constrained to approved products"),
    (GREEN,  "Pass 3", "Functionalities extracted", "With confidence + source attribution"),
]
for i, (color, pnum, title, sub) in enumerate(passes):
    yb = 1.35 + i * 1.6
    card(sl, 0.4, yb, 7.85, 1.35, bg=LIGHT_GRAY, border=color)
    step_badge(sl, str(i+1), 0.55, yb + 0.47, color=color)
    txt(sl, pnum, 1.1, yb + 0.12, 2.0, 0.35, size=12, bold=True, color=color)
    txt(sl, title, 1.1, yb + 0.48, 4.0, 0.38, size=11, color=DARK)
    txt(sl, sub, 1.1, yb + 0.85, 6.5, 0.38, size=10, color=MID_GRAY, italic=True)
    # arrow between passes
    if i < 2:
        txt(sl, "▼", 4.2, yb + 1.38, 0.5, 0.3, size=12, color=color,
            align=PP_ALIGN.CENTER)

# Stats row
stats2 = [("9", "Products"), ("26", "Capabilities", GREEN), ("79", "Functionalities"),
          ("85%", "Avg Confidence", GREEN), ("100%", "Triangulated", GREEN)]
xst = 0.4
for item in stats2:
    val, lbl = item[0], item[1]
    col = item[2] if len(item) > 2 else INDIGO
    metric_box(sl, val, lbl, xst, 6.15, 1.45, 0.85, val_color=col)
    xst += 1.55

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — Value Stream Mapping
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 2  ·  Value Stream Mapping",
           "Three-level hierarchy from segment overview to functionality step timing", accent=GREEN)

tps = [
    "L1 (Segment) shows cross-product flow efficiency — use this for exec overview; 'Which products have the biggest waste?'",
    "L2 (Capability) shows process time vs wait time — bottlenecks appear clearly; typical FE is 30–40% which means 60–70% is waste",
    "L3 (Functionality) shows individual step timing — step classification panel labels each step as Value-Adding, Bottleneck, Waste, or Waiting",
    "100% of 78 capabilities have VSM metrics — this is the key improvement from the seed rebuild",
    "Mermaid diagrams auto-generated for every capability — visual for stakeholders who don't read tables",
    "Capability Comparison Chart provides side-by-side flow efficiency bars across all products in a segment",
]
talking_points_panel(sl, tps)

# Level cards
levels = [
    (GREEN, "L1", "Segment Level", "Cross-product flow overview\nBusiness segment selector\nComparative FE bar chart"),
    (CYAN,  "L2", "Product Capabilities", "PT / WT / LT / FE per capability\nMermaid diagram auto-rendered\nBottleneck identification"),
    (INDIGO,"L3", "Functionality Steps", "Step-by-step process timing\nClassification: VA / Bottleneck / Waste / Wait\nDrill from L2 with one click"),
]
for i, (color, lvl, title, desc) in enumerate(levels):
    yb = 1.3 + i * 1.6
    card(sl, 0.4, yb, 7.85, 1.38, bg=LIGHT_GRAY, border=color)
    box(sl, 0.4, yb, 0.18, 1.38, fill_color=color)
    txt(sl, lvl, 0.75, yb + 0.45, 0.6, 0.5, size=18, bold=True, color=color)
    txt(sl, title, 1.5, yb + 0.1, 4.5, 0.4, size=13, bold=True, color=DARK)
    txt(sl, desc, 1.5, yb + 0.55, 6.5, 0.75, size=10, color=MID_GRAY)
    if i < 2:
        txt(sl, "▼", 4.2, yb + 1.42, 0.5, 0.3, size=12, color=color,
            align=PP_ALIGN.CENTER)

# Metrics
vsm_stats = [("78", "Capabilities with VSM"), ("100%", "Coverage"), ("78", "Mermaid Diagrams"), ("~35%", "Avg Flow Efficiency"), ("60%+", "Avg Waste Identified")]
xst = 0.4
for val, lbl in vsm_stats:
    col = GREEN if "%" in val and val != "~35%" else INDIGO
    metric_box(sl, val, lbl, xst, 6.15, 1.55, 0.85, val_color=col)
    xst += 1.6

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — Future State Vision
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 3  ·  Future State Vision",
           "Benchmark-grounded transformation projections with automation mix breakdown",
           accent=RGBColor(0xA8,0x55,0xF7))

tps = [
    "The 'Benchmark-grounded' badge appears when VSM_BENCHMARKS or TRANSFORMATION_CASE_STUDIES documents are uploaded to Context Hub",
    "Three-band projections (Conservative/Expected/Optimistic) are grounded in the uploaded benchmark documents — not arbitrary multipliers",
    "Automation mix (RPA / AI-ML / Agent-Based / Conversational / Analytics) gives leadership a technology investment breakdown",
    "RICE scoring on capability modernisation items enables prioritisation — teams can sort by highest expected ROI",
    "Future State feeds directly into Product Roadmap — the agent auto-generates roadmap items from vision output",
    "US Bank seeded future state: all 3 products have vision text + benchmark-grounded metrics pre-populated",
]
talking_points_panel(sl, tps)

purple = RGBColor(0xA8,0x55,0xF7)
purpleBG = RGBColor(0xF5,0xF3,0xFF)

features = [
    (purple, "Automation Mix Breakdown", "RPA · AI/ML · Agent-Based · Conversational · Analytics\nPer-product percentage breakdown with visual chart"),
    (AMBER,  "Projected Metrics — 3 Bands", "Conservative / Expected / Optimistic projections\nGrounded in uploaded VSM benchmarks + case studies\n'Benchmark-grounded' badge indicates doc-based grounding"),
    (CYAN,   "Capability Modernisation List", "RICE scoring (Reach × Impact × Confidence ÷ Effort)\nBusiness impact · Complexity · Recommended tech stack\nAuto-feeds into Product Roadmap agent"),
]
for i, (color, title, desc) in enumerate(features):
    yb = 1.35 + i * 1.65
    card(sl, 0.4, yb, 7.85, 1.42, bg=LIGHT_GRAY, border=color)
    box(sl, 0.4, yb, 0.18, 1.42, fill_color=color)
    txt(sl, title, 0.72, yb + 0.12, 6.5, 0.42, size=13, bold=True, color=color)
    txt(sl, desc, 0.72, yb + 0.58, 6.5, 0.80, size=10, color=DARK)

fs_stats = [("9", "Products with Vision"), ("3", "Metric Bands"), ("✓", "Benchmark Docs"), ("234", "Roadmap Items"), ("~70%", "FS Accuracy")]
xst = 0.4
for val, lbl in fs_stats:
    col = purple if val not in ["234", "~70%"] else (GREEN if "%" in val else INDIGO)
    metric_box(sl, val, lbl, xst, 6.15, 1.55, 0.85, val_color=col)
    xst += 1.6

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — Risk & Compliance
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 4  ·  Risk & Compliance",
           "Risk gates, regulatory compliance mapping, and SHA-256 tamper-proof audit trail",
           accent=RED)

tps = [
    "Risk score ≥ 8.0 AUTOMATICALLY blocks product transformation — this is a hard gate, not advisory",
    "SHA-256 chained audit trail: each entry references the previous hash — if any entry is altered, the whole chain breaks. Critical for SOX/FDIC/GDPR audits",
    "US Bank frameworks: FINRA, SEC, SOX, FDIC, BSA/AML — all mapped to specific capabilities",
    "Telstra Health frameworks: HL7 FHIR, HIPAA, GDPR — healthcare-specific compliance language",
    "ING Bank frameworks: Basel III, MiFID II, SOLVENCY II — EU banking regulatory coverage",
    "The Risk agent identifies compliance gaps and generates mitigation plans with evidence links",
    "Run the Risk agent live — it takes ~60 seconds and populates the entire risk dashboard",
]
talking_points_panel(sl, tps)

# Risk severity table
sev_rows = [
    (RED,    "CRITICAL  ≥ 8.0", "BLOCKS transformation. Mitigation must be completed and approved before any capability is moved to production"),
    (AMBER,  "HIGH  6.0 – 7.9", "Transformation allowed with approved mitigation plan. Tracked in roadmap as mandatory pre-condition"),
    (INDIGO, "MEDIUM  4.0 – 5.9", "Advisory. Mitigation recommended but does not block transformation gate"),
    (GREEN,  "LOW  < 4.0",  "Informational only. Logged in audit trail. No action required before transformation"),
]
yb = 1.35
for color, severity, action in sev_rows:
    card(sl, 0.4, yb, 7.85, 1.1, bg=LIGHT_GRAY, border=color)
    box(sl, 0.4, yb, 0.18, 1.1, fill_color=color)
    txt(sl, severity, 0.72, yb + 0.12, 2.4, 0.38, size=12, bold=True, color=color)
    txt(sl, action, 0.72, yb + 0.55, 6.5, 0.45, size=10, color=DARK)
    yb += 1.22

# Stats
r_stats = [("12", "Risk Assessments"), ("18", "Compliance Maps"), ("4", "Audit Entries/Org"), ("3", "Regulatory Frameworks"), ("SHA-256", "Audit Chain")]
xst = 0.4
for val, lbl in r_stats:
    col = RED if lbl in ("Risk Assessments",) else (GREEN if lbl == "Audit Chain" else INDIGO)
    metric_box(sl, val, lbl, xst, 6.15, 1.55, 0.85, val_color=col)
    xst += 1.6

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — Product Roadmap
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 5  ·  Product Roadmap",
           "AI-generated RICE-scored roadmap with approval workflows and quarterly planning",
           accent=AMBER)

tps = [
    "RICE = Reach × Impact × Confidence ÷ Effort — the AI assigns each value automatically and explains the reasoning",
    "Approval workflow: PENDING → APPROVED / REJECTED — leadership can approve or reject individual roadmap items with notes",
    "234 roadmap items seeded across 3 orgs — mix of capability-level and functionality-level items",
    "Items are product-centric: each roadmap item links to a specific product → capability → functionality",
    "Quarters: Q1 2026 through Q4 2026 — items are spread across quarters and can be reordered",
    "Filter by product, quarter, initiative, or approval status — useful for exec review of a specific product line",
    "The roadmap agent is triggered from Future State — it reads the vision output and generates prioritised items automatically",
]
talking_points_panel(sl, tps)

# RICE explanation
card(sl, 0.4, 1.3, 7.85, 1.35, bg=AMBER_BG, border=AMBER)
txt(sl, "📐  RICE Scoring Formula", 0.6, 1.38, 5.0, 0.38,
    size=13, bold=True, color=AMBER)
txt(sl, "RICE Score  =  (Reach × Impact × Confidence)  ÷  Effort",
    0.6, 1.78, 7.3, 0.38, size=12, bold=True, color=DARK, align=PP_ALIGN.CENTER)
txt(sl, "Reach = users impacted/month   ·   Impact = 1–3x scale   ·   Confidence = 50–100%   ·   Effort = person-weeks",
    0.6, 2.18, 7.3, 0.32, size=9.5, color=MID_GRAY, align=PP_ALIGN.CENTER)

# Status breakdown
statuses = [
    (GREEN,  "APPROVED", "~40%", "Ready for sprint planning"),
    (AMBER,  "PENDING",  "~45%", "Awaiting leadership sign-off"),
    (RED,    "REJECTED", "~15%", "Needs further analysis before proceeding"),
]
for i, (color, status, pct, desc) in enumerate(statuses):
    xb = 0.4 + i * 2.62
    card(sl, xb, 2.7, 2.45, 2.2, bg=LIGHT_GRAY, border=color)
    txt(sl, status, xb + 0.15, 2.82, 2.1, 0.38, size=13, bold=True, color=color)
    txt(sl, pct, xb + 0.15, 3.22, 2.1, 0.55, size=26, bold=True, color=color)
    txt(sl, desc, xb + 0.15, 3.80, 2.15, 0.45, size=9, color=MID_GRAY)

# Initiatives
txt(sl, "Strategic Initiatives:", 0.4, 5.1, 3.0, 0.3, size=10, bold=True, color=DARK)
for i, init in enumerate(["Digital Transformation", "Operational Excellence", "Customer Experience", "Risk Modernization", "Platform Migration"]):
    col = i % 3
    row = i // 3
    box(sl, 0.4 + col * 2.62, 5.45 + row * 0.42, 2.45, 0.35,
        fill_color=LIGHT_GRAY, line_color=INDIGO, line_width=Pt(0.5))
    txt(sl, init, 0.55 + col * 2.62, 5.5 + row * 0.42, 2.2, 0.28,
        size=9, color=INDIGO)

# Stats
rm_stats = [("234", "Roadmap Items"), ("~40%", "Approval Rate"), ("Q1-Q4", "2026 Quarters"), ("5", "Initiatives"), ("RICE", "Scoring")]
xst = 0.4
for val, lbl in rm_stats:
    col = AMBER
    metric_box(sl, val, lbl, xst, 6.15, 1.55, 0.85, val_color=col)
    xst += 1.6

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — Context Hub
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 6  ·  Context Hub",
           "Knowledge base powering RAG for all 18 agents — 5 categories, hybrid BM25 + vector search",
           accent=CYAN)

tps = [
    "Context Hub is the brain behind every agent — documents uploaded here are injected into every agent's RAG context automatically",
    "5 categories create a structured knowledge taxonomy: CURRENT_STATE, VSM_BENCHMARKS, TRANSFORMATION_CASE_STUDIES, ARCHITECTURE_STANDARDS, AGENT_OUTPUT",
    "Hybrid search: BM25 (keyword) + semantic vector similarity — tested to outperform pure vector search by 15–20% recall",
    "Fetch URL: paste any public URL (GitHub repo, Confluence page, API docs) and the system chunks + embeds automatically",
    "21 context documents seeded across all 5 categories, all INDEXED — KB accuracy score ~70%",
    "AGENT_OUTPUT category is auto-populated: every time Discovery/VSM/Future State agents complete, their output is saved as a context doc",
    "Each category has a description in the UI — guide stakeholders on what to upload for each",
]
talking_points_panel(sl, tps)

# Categories
cats = [
    (INDIGO, "📄  CURRENT_STATE",            "BRDs, process maps, existing architecture docs\nGives agents baseline context about current state"),
    (GREEN,  "📊  VSM_BENCHMARKS",           "Industry KPI benchmarks, timing data, FE benchmarks\nGrounds Future State projections in real data"),
    (RGBColor(0xA8,0x55,0xF7), "📚  TRANSFORMATION_CASE_STUDIES", "Published transformation case studies, whitepapers\nProvides precedent patterns for recommendations"),
    (AMBER,  "🏗  ARCHITECTURE_STANDARDS",   "Enterprise architecture standards, tech constraints\nGuides architecture agent recommendations"),
    (CYAN,   "🤖  AGENT_OUTPUT",             "Auto-populated after each agent run (Discovery, VSM, Future State)\nEnables agents to learn from their own prior outputs"),
]
yb = 1.3
for color, title, desc in cats:
    card(sl, 0.4, yb, 7.85, 0.92, bg=LIGHT_GRAY, border=color)
    box(sl, 0.4, yb, 0.12, 0.92, fill_color=color)
    txt(sl, title, 0.65, yb + 0.08, 3.5, 0.35, size=11, bold=True, color=color)
    txt(sl, desc, 0.65, yb + 0.46, 7.1, 0.38, size=9.5, color=DARK)
    yb += 1.02

# Stats
kb_stats = [("21", "Context Docs"), ("5", "Categories Covered"), ("100%", "Indexed"), ("~70%", "KB Accuracy"), ("BM25+V", "Hybrid Search")]
xst = 0.4
for val, lbl in kb_stats:
    col = CYAN if lbl not in ("~70%",) else GREEN
    metric_box(sl, val, lbl, xst, 6.15, 1.55, 0.85, val_color=col)
    xst += 1.6

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — Accuracy Dashboard
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 7  ·  Accuracy Dashboard",
           "Per-module AI output accuracy with composite scoring and live action plan",
           accent=AMBER)

tps = [
    "Accuracy badges appear on EVERY module page header — click any badge to jump to this dashboard",
    "Discovery ~85%: high because avg confidence is 85% + 100% source triangulation + 7 unique evidence source types",
    "VSM ~72%: strong because 100% coverage (all 78 capabilities have metrics) + rich Mermaid diagrams",
    "Risk ~35%: lower because only 4 risk assessments vs 26 capabilities — run the Risk agent to push this to 80%+",
    "The Action Plan auto-generates 4–8 prioritised steps — each item links directly to the module that needs work",
    "Composite formula: Discovery 20% + VSM 18% + Future State 15% + KB 15% + Risk 12% + Product Transformation 12% + Architecture 8%",
    "Show the Knowledge Base module card expanded — it shows which of the 5 categories are missing docs",
]
talking_points_panel(sl, tps)

# Accuracy bars
bars = [
    ("Discovery",               85, GREEN),
    ("Lean VSM",                72, GREEN),
    ("Future State Vision",     70, GREEN),
    ("Knowledge Base / RAG",    70, GREEN),
    ("Product Transformation",  55, AMBER),
    ("Risk & Compliance",       35, AMBER),
    ("Architecture",            40, AMBER),
    ("Composite (weighted)",    68, INDIGO),
]
x0 = 0.4
y0 = 1.35
for i, (label, pct, color) in enumerate(bars):
    is_composite = "Composite" in label
    if is_composite:
        y0 += 0.18
        box(sl, x0, y0, 8.1, 0.02, fill_color=LIGHT_GRAY)
        y0 += 0.1
    add_accuracy_bar(sl, label, pct, x0, y0, w=4.2, bar_color=color)
    if is_composite:
        txt(sl, "Weighted composite across 7 core modules", x0, y0 + 0.28, 4.2, 0.22,
            size=8.5, color=MID_GRAY, italic=True)
    y0 += 0.52 if not is_composite else 0.58

# Scoring legend
box(sl, 4.9, 1.35, 3.35, 2.5, fill_color=LIGHT_GRAY,
    line_color=INDIGO, line_width=Pt(0.5))
txt(sl, "Score Legend", 5.05, 1.45, 3.0, 0.32, size=10, bold=True, color=DARK)
legend = [(GREEN, "80–100%", "Excellent"), (GREEN, "65–79%", "Good"),
          (AMBER, "45–64%", "Fair"), (RED, "0–44%", "Needs Work")]
for i, (color, rng, lbl) in enumerate(legend):
    y = 1.85 + i * 0.48
    box(sl, 5.05, y, 0.18, 0.22, fill_color=color)
    txt(sl, f"{rng}  —  {lbl}", 5.3, y, 2.8, 0.28, size=10, color=DARK)

# Action plan
box(sl, 4.9, 4.0, 3.35, 2.6, fill_color=AMBER_BG,
    line_color=AMBER, line_width=Pt(0.75))
box(sl, 4.9, 4.0, 3.35, 0.38, fill_color=AMBER)
txt(sl, "⚡  TOP ACTIONS TO IMPROVE", 5.05, 4.06, 3.1, 0.26,
    size=9, bold=True, color=WHITE)
actions = [
    "Run Risk Agent → push Risk score 35%→80%+",
    "Upload docs for missing KB categories",
    "Add enrichment sources (OpenAPI + DB schema)",
    "Run Architecture agent to improve arch score",
]
cy = 4.46
for a in actions:
    txt(sl, f"→  {a}", 5.05, cy, 3.1, 0.42, size=9, color=DARK)
    cy += 0.50

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 13 — Live Entry Demo
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Step 8  ·  Live Entry Demo",
           "Create a new org and watch AI agents populate data from scratch in real-time",
           accent=CYAN)

tps = [
    "Login as live@transformhub.ai — this user has no pre-seeded data, so the dashboard starts empty",
    "Create a new org with a real company name and industry type — the more specific, the better the AI output",
    "Use stripe/stripe-node or plaid/plaid-python as demo repos — they're public, well-structured, and have clear API boundaries",
    "Pass 1 typically takes 25–40 seconds to stream — show the streaming output panel while it runs",
    "After Pass 1 review, run Pass 2 immediately — capabilities will appear on the left panel as each batch completes",
    "After all 3 passes are approved, navigate to VSM and run the Lean VSM agent — takes ~30 seconds",
    "Show the Accuracy page at the end — composite goes from 0% to ~45% in a single agent cycle",
]
talking_points_panel(sl, tps)

# Step flow
steps_live = [
    (CYAN,   "1", "Login",           "live@transformhub.ai  /  live1234", "Navigate to http://localhost:3000"),
    (CYAN,   "2", "Create Org",      "Organizations → + New Organization", "Name: [Company], Industry: [Type], Add business segments"),
    (CYAN,   "3", "Run Discovery",   "Discovery → Paste GitHub URL → Analyze", "Recommended: github.com/stripe/stripe-node"),
    (CYAN,   "4", "Review Pass 1",   "Products appear → Edit/Delete inline → Approve", "Human review gate — this is where you add commentary"),
    (CYAN,   "5", "Pass 2 + 3",      "Run automatically after approval", "Capabilities and functionalities populate with confidence scores"),
    (GREEN,  "6", "Run VSM Agent",   "VSM page → Run Lean VSM", "Flow metrics and Mermaid diagrams generated (~30s)"),
    (INDIGO, "7", "Check Accuracy",  "Accuracy page → see composite score", "Watch scores rise from 0% to live values"),
]
for i, (color, num, action, detail, tip) in enumerate(steps_live):
    col = i % 2
    row = i // 2
    xb = 0.4 + col * 4.1
    yb = 1.35 + row * 1.4
    if i == 6:  # last item spans both cols if odd
        xb = 0.4
        card(sl, xb, yb, 8.2, 1.18, bg=GREEN_BG, border=GREEN)
    else:
        card(sl, xb, yb, 3.85, 1.18, bg=LIGHT_GRAY, border=color)
    step_badge(sl, num, xb + 0.1, yb + 0.38, color=color)
    txt(sl, action, xb + 0.6, yb + 0.08, 3.1, 0.38, size=11, bold=True, color=color)
    txt(sl, detail, xb + 0.6, yb + 0.48, 3.1, 0.35, size=10, color=DARK)
    txt(sl, tip, xb + 0.6, yb + 0.82, 3.1, 0.3, size=9, color=MID_GRAY, italic=True)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 14 — Business Value & Key Messages
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Business Value",
           "Key messages for senior leadership — why TransformHub matters")

tps = [
    "Traditional transformation programs take 6–12 months to baseline current state. TransformHub does it in minutes with multi-pass discovery",
    "The 8-source evidence triangulation means confidence scores are evidence-based, not AI guesswork — auditors love this",
    "The platform replaces 6+ separate tools: process mining, risk management, roadmap planning, architecture review, compliance tracking, knowledge management",
    "Human-in-the-loop at every stage: agents propose, humans approve. No black-box AI — every output is reviewable and editable",
    "Benchmark-grounded future state means ROI projections are tied to real industry data, not vendor-supplied estimates",
    "Multi-tenancy means different teams or clients can use the same platform with zero data cross-contamination",
]
talking_points_panel(sl, tps)

# Value pillars
pillars = [
    (INDIGO, "⏱", "Speed", "Hours, not months", "Multi-pass AI discovery maps an enterprise product portfolio in under 10 minutes vs 6–12 months of manual baselining"),
    (GREEN,  "🎯", "Accuracy", "Evidence-based confidence", "8 evidence source triangulation. 78–97% confidence per entity. Human-in-the-loop review gates at every step"),
    (AMBER,  "💰", "Cost Reduction", "Replaces 6+ tools", "Consolidates process mining, risk mgmt, roadmap planning, compliance tracking, architecture review into one platform"),
    (CYAN,   "🔒", "Compliance", "Audit-ready by design", "SHA-256 chained immutable audit trail. SOX, FDIC, GDPR, HIPAA, Basel III framework coverage out of the box"),
]
for i, (color, icon, title, subtitle, body) in enumerate(pillars):
    xb = 0.4 + (i % 2) * 4.1
    yb = 1.3 + (i // 2) * 2.55
    card(sl, xb, yb, 3.85, 2.2, bg=LIGHT_GRAY, border=color)
    box(sl, xb, yb, 3.85, 0.1, fill_color=color)
    txt(sl, icon, xb + 0.15, yb + 0.2, 0.5, 0.45, size=20)
    txt(sl, title, xb + 0.7, yb + 0.22, 2.7, 0.38, size=14, bold=True, color=color)
    txt(sl, subtitle, xb + 0.7, yb + 0.62, 2.7, 0.32, size=10, bold=True, color=DARK)
    txt(sl, body, xb + 0.15, yb + 1.02, 3.55, 0.98, size=9.5, color=MID_GRAY)

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 15 — Pre-Demo Checklist
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()
header_bar(sl, "Pre-Demo Checklist",
           "Verify all services are running before the meeting starts")

tps = [
    "Run this checklist 15 minutes before the demo — not 1 minute before",
    "Port 3000 may be occupied by Product Coach (another project). Kill it with: kill $(lsof -ti:3000)",
    "The health endpoint at localhost:8000/api/v1/health should return {status: healthy} — if it shows database disconnected, restart Postgres.app",
    "Redis unavailable is normal and expected — the system falls back to in-memory, no impact on demo",
    "If US Bank doesn't auto-select, clear the org cookie: localStorage.removeItem('currentOrgId') in browser console",
    "Have a backup plan: if live demo fails, switch to the pre-filled path immediately — demo@transformhub.ai always works",
    "Have the demo guide open in a separate browser tab (TransformHub/docs/demo-guide.html)",
]
talking_points_panel(sl, tps)

# Checklist
checks_left = [
    ("Services", [
        ("Next.js frontend running", "http://localhost:3000  →  should redirect to /login"),
        ("FastAPI backend running", "curl localhost:8000/api/v1/health  →  {status: healthy}"),
        ("PostgreSQL running",      "Postgres.app icon in menu bar shows green"),
        ("Demo data seeded",        "3 orgs visible in org switcher: US Bank, Telstra Health, ING Bank"),
    ]),
    ("Browser", [
        ("Open incognito window",   "Prevents cached session from wrong account interfering"),
        ("Zoom to 90%",             "Ensures all columns visible without horizontal scroll"),
        ("Pre-logged in as demo",   "demo@transformhub.ai / demo1234 — US Bank should auto-load"),
        ("KPIs visible",            "Dashboard shows 9 products, 26 capabilities, 79 functionalities"),
    ]),
]

for ci, (section, items) in enumerate(checks_left):
    xb = 0.4 + ci * 4.1
    card(sl, xb, 1.3, 3.85, 5.4, bg=LIGHT_GRAY, border=INDIGO)
    box(sl, xb, 1.3, 3.85, 0.38, fill_color=INDIGO)
    txt(sl, f"✓  {section.upper()}", xb + 0.15, 1.36, 3.55, 0.28,
        size=10, bold=True, color=WHITE)
    cy = 1.78
    for item, detail in items:
        box(sl, xb + 0.15, cy, 0.22, 0.22,
            fill_color=WHITE, line_color=INDIGO, line_width=Pt(0.75))
        txt(sl, item, xb + 0.48, cy, 3.2, 0.26, size=10, bold=True, color=DARK)
        txt(sl, detail, xb + 0.48, cy + 0.26, 3.2, 0.3, size=8.5, color=MID_GRAY)
        cy += 0.72

# Start commands
card(sl, 8.7, 1.3, 4.2, 3.5, bg=RGBColor(0x0F,0x17,0x2A))
box(sl, 8.7, 1.3, 4.2, 0.38, fill_color=DARK)
txt(sl, "⚡  START COMMANDS", 8.9, 1.36, 3.8, 0.28,
    size=10, bold=True, color=WHITE)
cmd_lines = [
    "# Terminal 1 — Agent Backend",
    "cd TransformHub/agent-service",
    "source venv/bin/activate",
    "uvicorn app.main:app --reload --port 8000",
    "",
    "# Terminal 2 — Next.js Frontend",
    "cd TransformHub/nextjs-app",
    "npm run dev",
    "",
    "# Re-seed demo data if needed",
    "cd nextjs-app",
    "npx tsx prisma/seed.ts",
]
cy = 1.76
for line in cmd_lines:
    color = RGBColor(0x64,0x74,0x8B) if line.startswith("#") else (
            WHITE if line else WHITE)
    txt(sl, line, 8.9, cy, 3.9, 0.26, size=8.5, color=color,
        italic=line.startswith("#"))
    cy += 0.28

# Troubleshooting
card(sl, 8.7, 5.0, 4.2, 1.7, bg=AMBER_BG, border=AMBER)
box(sl, 8.7, 5.0, 4.2, 0.35, fill_color=AMBER)
txt(sl, "⚠  QUICK FIXES", 8.9, 5.05, 3.8, 0.26, size=10, bold=True, color=WHITE)
fixes = [
    ("Wrong org loads:", "localStorage.removeItem('currentOrgId')"),
    ("Port 3000 busy:", "kill $(lsof -ti:3000)  then restart Next.js"),
    ("No data showing:", "npx tsx prisma/seed.ts"),
]
cy = 5.45
for problem, fix in fixes:
    txt(sl, problem, 8.9, cy, 1.4, 0.26, size=9, bold=True, color=AMBER)
    txt(sl, fix, 10.35, cy, 2.45, 0.26, size=9, color=DARK)
    cy += 0.38

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 16 — Closing / Thank You
# ══════════════════════════════════════════════════════════════════════════════
sl = add_slide()

# Left colour band
box(sl, 0, 0, 0.18, 7.5, fill_color=INDIGO)

# Title
txt(sl, "Ready to Transform.", 0.55, 1.3, 9.0, 1.0,
    size=44, bold=True, color=INDIGO)
txt(sl, "AI-powered enterprise transformation from discovery to delivery.", 0.55, 2.3, 9.0, 0.5,
    size=16, color=MID_GRAY, italic=True)

# Summary stats
summary = [
    ("3",    "Enterprise Orgs"),
    ("8",    "Core Modules"),
    ("18",   "AI Agents"),
    ("78",   "Capabilities Mapped"),
    ("245+", "Functionalities"),
    ("~68%", "Composite Accuracy"),
]
xst = 0.55
for val, lbl in summary:
    col = GREEN if "%" in val else INDIGO
    metric_box(sl, val, lbl, xst, 3.1, 1.9, 0.95, val_color=col)
    xst += 1.95

# Access block
box(sl, 0.55, 4.4, 8.3, 1.65, fill_color=ACCENT_BG,
    line_color=INDIGO, line_width=Pt(0.75))
txt(sl, "🌐  http://localhost:3000", 0.8, 4.5, 4.0, 0.38,
    size=13, bold=True, color=INDIGO)
txt(sl, "demo@transformhub.ai  /  demo1234     (pre-filled — use this for leadership demos)",
    0.8, 4.9, 7.7, 0.3, size=10, color=DARK)
txt(sl, "live@transformhub.ai  /  live1234     (blank — use this for live entry walk-throughs)",
    0.8, 5.22, 7.7, 0.3, size=10, color=DARK)
txt(sl, "admin@transformhub.ai  /  demo1234",
    0.8, 5.54, 7.7, 0.3, size=10, color=MID_GRAY)

# Stack badges
badges = ["Next.js 15 + TypeScript", "FastAPI + LangGraph", "PostgreSQL 18 + pgvector",
          "18 AI Agents", "BM25 + Vector RAG", "SHA-256 Audit Trail"]
xst = 0.55
for badge in badges:
    bw = len(badge) * 0.085 + 0.25
    box(sl, xst, 6.25, bw, 0.38,
        fill_color=ACCENT_BG, line_color=INDIGO, line_width=Pt(0.5))
    txt(sl, badge, xst + 0.1, 6.3, bw - 0.15, 0.28, size=9, color=INDIGO)
    xst += bw + 0.1

footer(sl)


# ══════════════════════════════════════════════════════════════════════════════
# Save
# ══════════════════════════════════════════════════════════════════════════════
out = "/Users/125066/projects/TransformHub/docs/TransformHub_Demo_Deck.pptx"
prs.save(out)
print(f"✅  Saved: {out}")
print(f"   Slides: {len(prs.slides)}")
