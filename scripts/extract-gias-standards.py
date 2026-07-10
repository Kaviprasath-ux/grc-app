"""
Extract & chunk the IIA *Global Internal Audit Standards 2024* PDF into
retrieval-sized JSON chunks for the Internal Audit chatbot knowledge base.

The structure is driven by the document's Table of Contents (the canonical
5 Domains / 15 Principles / 52 Standards). The body is then segmented by
matching only the *next expected* heading id, so in-body cross-references
("...see Standard 10.3") never start a new section. Oversized sections are
split at "Considerations for Implementation" and, if still large, on
paragraph boundaries so every chunk stays under the embedding input limit.

Output is consumed by scripts/seed-gias-standards.ts, which embeds each chunk
and inserts it into ChatbotKBArticle with productScope="audit" (visible to
internal-audit users only).

Usage:
    python scripts/extract-gias-standards.py \
        "c:/path/to/globalinternalauditstandards_2024january9_editable.pdf" \
        scripts/data/gias-2024-standards.json

Requires: PyMuPDF (`pip install pymupdf`).
"""
import fitz, re, json, sys, os

MAX_CHARS = 6000   # split standards above this at "Considerations for Implementation"
HARD_CAP = 7500    # any piece above this is paragraph-split (embed input limit is 8000)
PUBSEC = "Applying the Global Internal Audit Standards in the Public Sector"

FOOTER = [
    re.compile(r"^©?\s*\d{0,4}.{0,2}The Institute of Internal Auditors.*$", re.I),
    re.compile(r"^For individual personal use only\.?\s*$", re.I),
    re.compile(r"^\s*\d{1,3}\s*$"),          # bare page numbers
    re.compile(r"^[IVXL]+:\s+.+$"),          # running headers e.g. "II: Ethics and Professionalism"
]
DOT = re.compile(r"\.{4,}\s*\d+\s*$")        # TOC dotted leader
DOMAIN = re.compile(r"^Domain ([IVXL]+):\s+(.+)$")
PRIN = re.compile(r"^Principle (\d+)\b\s*(.*)$")
STD = re.compile(r"^Standard (\d+\.\d+)\b\s*(.*)$")


def is_footer(s):
    return bool(s) and any(p.match(s) for p in FOOTER)


def get_id(s):
    m = DOMAIN.match(s)
    if m: return f"Domain {m.group(1)}"
    m = PRIN.match(s)
    if m: return f"Principle {m.group(1)}"
    m = STD.match(s)
    if m: return f"Standard {m.group(1)}"
    return None


def build_toc(rawlines):
    """Walk the dotted-leader TOC lines in document order -> canonical anchors."""
    anchors, cur_dom, cur_pri = [], None, None
    for l in rawlines:
        s = l.strip()
        if not DOT.search(s):
            continue
        title = DOT.sub("", s).strip()
        md, mp, ms = DOMAIN.match(title), PRIN.match(title), STD.match(title)
        if md:
            cur_dom = f"Domain {md.group(1)}: {md.group(2).strip()}"; cur_pri = None
            anchors.append({"type": "domain", "id": f"Domain {md.group(1)}", "title": md.group(2).strip(),
                            "heading": cur_dom, "domain": cur_dom, "principle": None})
        elif mp:
            cur_pri = f"Principle {mp.group(1)} {mp.group(2).strip()}"
            anchors.append({"type": "principle", "id": f"Principle {mp.group(1)}", "title": mp.group(2).strip(),
                            "heading": cur_pri, "domain": cur_dom, "principle": cur_pri})
        elif ms:
            anchors.append({"type": "standard", "id": f"Standard {ms.group(1)}", "title": ms.group(2).strip(),
                            "heading": f"Standard {ms.group(1)} {ms.group(2).strip()}",
                            "domain": cur_dom, "principle": cur_pri})
    return anchors


def body_lines(doc):
    out = []
    for pno in range(doc.page_count):
        for raw in doc[pno].get_text().split("\n"):
            s = raw.rstrip(); t = s.strip()
            if is_footer(t) or DOT.search(t):
                continue
            out.append((s, pno + 1))
    return out


def paragraph_split(text, cap):
    parts, buf = [], ""
    for p in re.split(r"\n\s*\n", text):
        if buf and len(buf) + len(p) + 2 > cap:
            parts.append(buf.strip()); buf = p
        else:
            buf = (buf + "\n\n" + p) if buf else p
    if buf.strip():
        parts.append(buf.strip())
    return parts


def extract(pdf_path):
    doc = fitz.open(pdf_path)
    raw = []
    for p in range(doc.page_count):
        raw += doc[p].get_text().split("\n")

    anchors = build_toc(raw)
    anchors.append({"type": "supplement", "id": "__PUBSEC__", "title": PUBSEC,
                    "heading": PUBSEC, "domain": None, "principle": None})
    id_to_anchor = {a["id"]: a for a in anchors}
    order = [a["id"] for a in anchors]

    blines = body_lines(doc)
    start = next(i for i, (s, _) in enumerate(blines) if get_id(s.strip()) == order[0])
    blines = blines[start:]

    sections, ptr, cur, sup_started = [], 0, None, False
    for s, pno in blines:
        t = s.strip()
        sid = get_id(t)
        is_pubsec = (t == PUBSEC)
        matched = None
        if ptr < len(order):
            nxt = order[ptr]
            if nxt == "__PUBSEC__" and is_pubsec and not sup_started:
                matched = "__PUBSEC__"; sup_started = True; ptr += 1
            elif sid is not None and sid == nxt:
                matched = sid; ptr += 1
        if matched:
            if cur: sections.append(cur)
            cur = {"anchor": id_to_anchor[matched], "buf": [], "page": pno}
        elif cur is not None:
            if sup_started and is_pubsec:
                continue                       # drop repeated supplement running header
            cur["buf"].append(s)
    if cur:
        sections.append(cur)

    chunks = []
    for sec in sections:
        a = sec["anchor"]
        text = re.sub(r"\n{3,}", "\n\n", "\n".join(sec["buf"])).strip()
        if a["type"] == "standard":
            idx = text.find("Requirements")
            if 0 <= idx <= 120:               # drop wrapped-title fragment / running header before body
                text = text[idx:].strip()
        if len(text) < 40:
            continue
        base = {"type": a["type"], "id": a["id"], "domain": a["domain"],
                "principle": a["principle"], "title": a["title"], "heading": a["heading"], "page": sec["page"]}

        pieces = [("", text)]
        if a["type"] == "standard" and len(text) > MAX_CHARS:
            ci = text.find("Considerations for Implementation")
            if ci > 200:
                pieces = [(" — Requirements", text[:ci].strip()),
                          (" — Considerations for Implementation", text[ci:].strip())]

        for suf, body in pieces:
            if len(body) > HARD_CAP:
                sub = paragraph_split(body, HARD_CAP)
                for k, sp in enumerate(sub):
                    s2 = f"{suf} (part {k+1}/{len(sub)})" if len(sub) > 1 else suf
                    chunks.append({**base, "heading": a["heading"] + s2, "content": sp})
            else:
                chunks.append({**base, "heading": a["heading"] + suf, "content": body})
    return anchors, chunks


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/extract-gias-standards.py <pdf> [out.json]")
        sys.exit(1)
    pdf = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "scripts/data/gias-2024-standards.json"
    anchors, chunks = extract(pdf)

    std_ids = {a["id"] for a in anchors if a["type"] == "standard"}
    have = {c["id"] for c in chunks}
    missing = sorted(std_ids - have)
    oversized = [c["heading"] for c in chunks if len(c["content"]) > 8000]
    sizes = sorted(len(c["content"]) for c in chunks)
    print(f"chunks: {len(chunks)} (standards={len(std_ids)}, missing={missing or 'none'})")
    print(f"content chars min/median/max: {sizes[0]}/{sizes[len(sizes)//2]}/{sizes[-1]}")
    if oversized:
        print("WARNING — chunks over 8000 chars:", oversized)
    if missing:
        raise SystemExit(f"ERROR: standards missing from output: {missing}")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    payload = {
        "source": "IIA Global Internal Audit Standards (2024)",
        "effectiveNote": "Released January 9, 2024. © The Institute of Internal Auditors.",
        "chunkCount": len(chunks),
        "chunks": chunks,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print("wrote", out)


if __name__ == "__main__":
    main()
