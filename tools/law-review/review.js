/* DATA được build_review_page.py chèn vào ngay trên dòng này. */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KEY = "legal-review-v1:" + DATA.meta.devset_sha.slice(0, 12);

const CRIT = {
  draft: [
    "Câu hỏi tự nhiên, giống câu người dùng thật sẽ hỏi",
    "Đáp án đúng luật và đủ ý, kể cả ngoại lệ",
    "Khoản căn cứ thật sự chứa đáp án",
    "Căn cứ còn hiệu lực, đã tính tới Luật 76/2025",
    "Đáp án viết gọn bằng lời, không chép nguyên văn"
  ],
  oos: [
    "8 văn bản trong kho thật sự không trả lời được câu này",
    "Câu hỏi rõ ràng, người dùng thật có thể hỏi như vậy"
  ]
};
const VERDICT = {
  draft: ["Giữ nguyên", "Sửa", "Bỏ câu"],
  oos: ["Đúng là ngoài phạm vi", "Kho trả lời được", "Bỏ câu"]
};
const STATE = [["Chưa xét", ""], ["Đạt", "tone-good"], ["Chưa đạt", "tone-bad"], ["Không chắc", "tone-warn"]];
const GROUPS = [
  { kind: "draft", tab: "70 câu nháp", note: "Câu do Team 1 soạn từ một Khoản, với sự hỗ trợ của AI. Chưa có người hiểu luật đọc lại." },
  { kind: "oos", tab: "33 câu ngoài phạm vi", note: "Câu mà hệ thống phải từ chối. Bạn kiểm xem kho có thật sự không trả lời được không." }
];
const CAT = { out_of_domain: "Ngoài lĩnh vực doanh nghiệp", missing_information: "Thiếu dữ kiện tình huống", trap: "Câu bẫy" };

let store = { reviewer: "", items: {} };
try { store = JSON.parse(localStorage.getItem(KEY)) || store; } catch (e) { /* trình duyệt chặn lưu: vẫn dùng được, chỉ không tự lưu */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const rec = (id) => (store.items[id] ||= { checks: [], verdict: -1, newQ: "", newA: "", cite: "", note: "", t: "" });
const done = (it) => (store.items[it.id]?.verdict ?? -1) >= 0;

let g = 0, cur = 0;
const list = () => DATA.items.filter((it) => it.kind === GROUPS[g].kind);
const visible = () => list().filter((it) => !$("only-todo").checked || !done(it) || it.id === list()[cur]?.id);

/* ---------- đầu trang ---------- */
$("reviewer").value = store.reviewer || "";
$("reviewer").oninput = (e) => { store.reviewer = e.target.value; save(); };
function drawProg() {
  $("prog").innerHTML = GROUPS.map((gr) => {
    const all = DATA.items.filter((it) => it.kind === gr.kind), n = all.filter(done).length;
    return `<div class="bar-row"><span class="bar-k">${gr.tab}</span><div class="track"><i class="fill" style="width:${(100 * n / all.length).toFixed(1)}%"></i></div><span class="num">${n}/${all.length}</span></div>`;
  }).join("");
}

/* ---------- nhóm và lưới số ---------- */
GROUPS.forEach((gr, i) => {
  const b = document.createElement("button");
  b.className = "tab"; b.type = "button"; b.role = "tab"; b.textContent = gr.tab;
  b.onclick = () => { g = i; cur = 0; draw(); };
  $("grp").appendChild(b);
});
$("only-todo").onchange = draw;
function drawChips() {
  const L = list();
  $("chips").innerHTML = L.map((it, i) => {
    const r = store.items[it.id], v = r?.verdict ?? -1;
    const cls = v < 0 ? "" : (v === 0 ? " is-ok" : " is-flag");
    const hide = $("only-todo").checked && done(it) && i !== cur ? " hidden" : "";
    return `<button type="button" role="listitem" class="chip${cls}${i === cur ? " is-active" : ""}" data-i="${i}" title="${esc(it.id)}"${hide}>${i + 1}</button>`;
  }).join("");
  $("chips").querySelectorAll(".chip").forEach((c) => c.onclick = () => { cur = +c.dataset.i; draw(); });
}

/* ---------- một câu ---------- */
function highlight(article, chunk) {
  const safe = esc(article);
  const lines = chunk.split("\n").map((s) => s.trim()).filter((s) => s.length > 20).sort((a, b) => b.length - a.length);
  for (const ln of lines) { const e = esc(ln); if (safe.includes(e)) return safe.replace(e, `<mark>${e}</mark>`); }
  return safe;
}
function drawItem() {
  const L = list(), it = L[cur], r = rec(it.id), kind = it.kind;
  const head = `<div class="item-head"><code>${esc(it.id)}</code><span class="note">${kind === "draft" ? esc(it.category || "") : esc(CAT[it.category] || it.category)}</span></div>`;
  let body = `<p class="case-k">Câu hỏi</p><p class="case-q">${esc(it.q)}</p>`;
  if (kind === "draft") {
    body += `<p class="case-k">Đáp án trong bộ đề</p><p>${esc(it.ans)}</p>`
      + `<p class="case-k">Căn cứ được ghi</p><p>${esc(it.cite)}</p>`
      + `<p class="case-k">Nguyên văn Khoản</p><blockquote>${esc(it.chunk).replace(/\n/g, "<br>")}</blockquote>`
      + `<details><summary>Xem cả ${esc(it.article_title)} · ${esc(it.doc_title)}</summary><div class="article">${highlight(it.article, it.chunk).replace(/\n/g, "<br>")}</div>`
      + (it.source_url ? `<a href="${esc(it.source_url)}" target="_blank" rel="noopener noreferrer">Mở văn bản gốc</a>` : "") + `</details>`;
  } else {
    body += `<p class="case-k">Lý do Team 1 ghi</p><p>${esc(it.reason)}</p>`
      + `<details><summary>8 văn bản đang có trong kho</summary><ul class="docs">${DATA.docs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>`;
  }
  const crit = CRIT[kind].map((c, i) => `<div class="ck-row"><span>${c}</span><button type="button" class="ck-btn" data-c="${i}"></button></div>`).join("");
  const vd = VERDICT[kind].map((v, i) => `<button type="button" class="tab" data-v="${i}">${v}</button>`).join("");
  const fields = kind === "draft"
    ? `<label class="ctl">Câu hỏi sửa lại (nếu cần)<textarea class="mc-field" data-f="newQ" rows="2"></textarea></label>
       <label class="ctl">Đáp án sửa lại (nếu cần)<textarea class="mc-field" data-f="newA" rows="3"></textarea></label>
       <label class="ctl">Căn cứ đúng hoặc căn cứ cần thêm<input class="mc-field" data-f="cite" type="text" placeholder="Ví dụ: Khoản 2 Điều 113 Luật 59/2020, Khoản 5 Điều 1 Luật 76/2025"></label>`
    : `<label class="ctl">Căn cứ trả lời được (nếu có)<input class="mc-field" data-f="cite" type="text" placeholder="Ví dụ: Khoản 1 Điều 17 Luật 59/2020"></label>`;
  $("item").innerHTML = head + `<div class="case">${body}</div>`
    + `<div class="checks">${crit}</div><p class="case-k">Kết luận</p><div class="verdict">${vd}</div>${fields}`
    + `<label class="ctl">Ghi chú<textarea class="mc-field" data-f="note" rows="2"></textarea></label><p class="note" id="saved"></p>`;
  const root = $("item");
  const paint = () => {
    root.querySelectorAll(".ck-btn").forEach((b) => { const s = STATE[r.checks[+b.dataset.c] || 0]; b.textContent = s[0]; b.className = "ck-btn" + (s[1] ? " tone " + s[1] : ""); });
    root.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-selected", +b.dataset.v === r.verdict));
    $("saved").textContent = r.t ? "Đã lưu lúc " + new Date(r.t).toLocaleTimeString("vi-VN") : "Chưa có đánh giá cho câu này.";
  };
  const touch = () => { r.t = new Date().toISOString(); save(); paint(); drawChips(); drawProg(); };
  root.querySelectorAll(".ck-btn").forEach((b) => b.onclick = () => { const i = +b.dataset.c; r.checks[i] = ((r.checks[i] || 0) + 1) % STATE.length; touch(); });
  root.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { const v = +b.dataset.v; r.verdict = r.verdict === v ? -1 : v; touch(); });
  root.querySelectorAll("[data-f]").forEach((f) => { f.value = r[f.dataset.f] || ""; f.oninput = () => { r[f.dataset.f] = f.value; touch(); }; });
  paint();
}

function draw() {
  [...$("grp").children].forEach((b, i) => b.setAttribute("aria-selected", i === g));
  $("grp-note").textContent = GROUPS[g].note;
  const L = list();
  if (cur >= L.length) cur = L.length - 1;
  drawChips(); drawItem(); drawProg();
  $("pos").textContent = `Câu ${cur + 1}/${L.length}`;
  $("prev").disabled = cur === 0; $("next").disabled = cur === L.length - 1;
}
function step(d) {
  const L = list(); let i = cur;
  do { i += d; } while (i >= 0 && i < L.length && $("only-todo").checked && done(L[i]));
  if (i >= 0 && i < L.length) { cur = i; draw(); $("work").scrollIntoView({ behavior: "smooth", block: "start" }); }
}
$("prev").onclick = () => step(-1);
$("next").onclick = () => step(1);

/* ---------- tải và mở kết quả ---------- */
function rows() {
  return DATA.items.filter((it) => store.items[it.id]).map((it) => {
    const r = store.items[it.id], C = CRIT[it.kind];
    const pick = (s) => C.map((c, i) => (r.checks[i] || 0) === s ? i + 1 : null).filter(Boolean).join(" ");
    return { loai: it.kind === "draft" ? "nháp" : "ngoài phạm vi", id: it.id, cau_hoi: it.q,
      ket_luan: r.verdict >= 0 ? VERDICT[it.kind][r.verdict] : "chưa kết luận",
      tieu_chi_chua_dat: pick(2), tieu_chi_khong_chac: pick(3),
      cau_hoi_sua: r.newQ, dap_an_sua: r.newA, can_cu: r.cite, ghi_chu: r.note,
      nguoi_soat: store.reviewer, thoi_gian: r.t };
  });
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
$("dl-csv").onclick = () => {
  const R = rows();
  if (!R.length) { $("io-msg").textContent = "Bạn chưa đánh giá câu nào."; return; }
  const cols = Object.keys(R[0]);
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [cols.join(","), ...R.map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n");
  download(`soat-bo-de-${stamp()}.csv`, csv, "text/csv;charset=utf-8");
  $("io-msg").textContent = `Đã tải ${R.length} dòng. Gửi file này cho Team 1. Mở bằng Google Sheet hoặc Excel đều đọc được tiếng Việt.`;
};
$("dl-json").onclick = () => {
  download(`ban-luu-soat-bo-de-${stamp()}.json`, JSON.stringify({ meta: DATA.meta, saved_at: new Date().toISOString(), ...store }, null, 1), "application/json");
  $("io-msg").textContent = "Đã tải bản lưu đầy đủ. Dùng file này để làm tiếp trên máy khác, hoặc gửi kèm cho Team 1.";
};
$("load").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j.items) throw new Error("thiếu dữ liệu");
    if (j.meta?.devset_sha && j.meta.devset_sha !== DATA.meta.devset_sha) $("io-msg").textContent = "Bản lưu này làm trên một phiên bản bộ đề khác. Trang vẫn mở, nhưng hãy báo Team 1.";
    else $("io-msg").textContent = "Đã mở bản lưu.";
    store = { reviewer: j.reviewer || store.reviewer, items: { ...store.items, ...j.items } };
    $("reviewer").value = store.reviewer; save(); draw();
  } catch (err) { $("io-msg").textContent = "Không đọc được file này. Hãy chọn đúng file bản lưu (.json)."; }
  e.target.value = "";
};

$("foot").innerHTML = `Dữ liệu lấy từ nhánh <code>${esc(DATA.meta.ref)}</code> của repo dự án, commit <code>${esc(DATA.meta.commit)}</code>, ngày ${esc(DATA.meta.built)}. Mã bộ đề: <code>${esc(DATA.meta.devset_sha.slice(0, 12))}</code>. Trang chỉ lưu trên trình duyệt của bạn; không ai khác thấy kết quả cho tới khi bạn gửi file.`;
draw();
