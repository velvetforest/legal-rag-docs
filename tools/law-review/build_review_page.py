"""Dựng trang soát bộ đề (103 câu) cho người soát pháp lý.

Đọc trực tiếp từ repo dự án (mặc định ../vietnamese-legal-rag, nhánh origin/develop) bằng `git show`,
nên không cần checkout nhánh. Ghi ra một file HTML tự chứa trong v/vietnamese-legal-rag/.

Chạy lại mỗi khi bộ đề, kho chunk hoặc Article Store thay đổi:
    git -C ../vietnamese-legal-rag fetch origin
    python tools/law-review/build_review_page.py
"""
import argparse, json, pathlib, subprocess, datetime

HERE = pathlib.Path(__file__).resolve().parent
DOCS_ROOT = HERE.parents[1]


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout.decode("utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(DOCS_ROOT.parent / "vietnamese-legal-rag"))
    ap.add_argument("--ref", default="origin/develop")
    ap.add_argument("--out", default=str(DOCS_ROOT / "v" / "vietnamese-legal-rag" / "legal-review-dev-set-visualization.html"))
    a = ap.parse_args()
    show = lambda p: git(a.repo, "show", f"{a.ref}:{p}")

    golden = json.loads(show("team1_data/golden/golden_phase1.json"))
    oos = json.loads(show("team1_data/golden/out_of_scope_v1.json"))
    manifest = json.loads(show("team1_data/golden/golden_phase1.manifest.json"))
    chunks = {c["chunk_id"]: c for c in map(json.loads, show("data/doanh-nghiep/processed/chunks.jsonl").splitlines()) if c}
    articles = {(x["document_id"], x["article_id"]): x for x in map(json.loads, show("data/doanh-nghiep/processed/articles.jsonl").splitlines()) if x}
    registry = json.loads(show("data/doanh-nghiep/registry/documents.json"))
    registry = registry if isinstance(registry, list) else registry.get("documents", [])

    items = []
    for c in golden:
        if c.get("review_status") == "team2_reviewed":
            continue
        cid = c["gold_chunk_ids"][0]
        ch = chunks[cid]
        art = articles.get((ch["document_id"], ch["article_id"]), {})
        items.append({
            "kind": "draft", "id": c["id"], "q": c["question"], "ans": c.get("ground_truth") or "",
            "cite": c.get("citation") or "", "category": c.get("category") or "",
            "chunk_ids": c["gold_chunk_ids"],
            "chunk": "\n\n".join(chunks[i]["content"] for i in c["gold_chunk_ids"]),
            "article": art.get("content", ""), "article_title": art.get("article", ch.get("article", "")),
            "doc_title": art.get("document_title", ch.get("document_title", "")), "source_url": art.get("source_url", ""),
        })
    for c in oos:
        items.append({"kind": "oos", "id": c["id"], "q": c["question"], "category": c.get("category", ""), "reason": c.get("reason", "")})

    docs = [f'{d.get("document_number", "")} · {d.get("document_title", "")}'.strip(" ·") for d in registry]
    data = {
        "meta": {"ref": a.ref, "commit": git(a.repo, "rev-parse", "--short", a.ref).strip(),
                 "devset_sha": manifest["sha256"], "built": datetime.date.today().strftime("%d/%m/%Y")},
        "docs": docs, "items": items,
    }

    js = (HERE / "review.js").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = f"""<!doctype html>
<html lang="vi" data-palette="rosegold" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Legal Review Dev Set Visualization</title>
<meta name="description" content="Trang soát pháp lý 70 câu nháp và 33 câu ngoài phạm vi của bộ đề Vietnamese Legal RAG.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Display:ital,wght@0,400;0,500;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
{(HERE / "theme.css").read_text(encoding="utf-8")}
{(HERE / "review.css").read_text(encoding="utf-8")}
</style>
</head>
<body class="mc-page">
{(HERE / "body.html").read_text(encoding="utf-8")}
<script>
const DATA = {payload};
{js}
</script>
</body>
</html>
"""
    out = pathlib.Path(a.out)
    out.write_text(html, encoding="utf-8", newline="\n")
    print(f"{out} · {sum(i['kind'] == 'draft' for i in items)} câu nháp, {sum(i['kind'] == 'oos' for i in items)} câu ngoài phạm vi, {len(html):,} ký tự")


if __name__ == "__main__":
    main()
