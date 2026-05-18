const DEFAULT_DIRECTIONS = [
  "苏梅", "哈尔科夫", "库普扬斯克", "利曼", "西维尔斯克", "卡玛托尔斯克",
  "康斯坦丁尼夫卡", "波克罗夫斯克", "亚历山德里夫卡", "胡里艾伯勒", "库班", "赫尔松"
];

const PLACE_TO_DIRECTION = {
  "苏梅": "苏梅", "哈尔科夫": "哈尔科夫", "库普扬斯克": "库普扬斯克", "利曼": "利曼",
  "西维尔斯克": "西维尔斯克", "卡玛托尔斯克": "卡玛托尔斯克", "康斯坦丁尼夫卡": "康斯坦丁尼夫卡",
  "波克罗夫斯克": "波克罗夫斯克", "亚历山德里夫卡": "亚历山德里夫卡", "胡里艾伯勒": "胡里艾伯勒",
  "库班": "库班", "赫尔松": "赫尔松",
  "沃夫昌斯克": "哈尔科夫", "恰西夫亚尔": "卡玛托尔斯克", "托列茨克": "康斯坦丁尼夫卡",
  "阿夫迪夫卡": "波克罗夫斯克", "罗博季涅": "胡里艾伯勒"
};

const state = {
  directions: load("gsua_directions", DEFAULT_DIRECTIONS),
  records: load("gsua_records", []),
  selectedDirection: "",
  selectedDate: "",
  currentList: [],
  currentIndex: 0,
  pastedImage: ""
};

const $ = (id) => document.getElementById(id);

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function save() {
  localStorage.setItem("gsua_directions", JSON.stringify(state.directions));
  localStorage.setItem("gsua_records", JSON.stringify(state.records));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sortedRecords() {
  return [...state.records].sort((a, b) => b.date.localeCompare(a.date) || a.direction.localeCompare(b.direction, "zh"));
}

function uniqueDates() {
  return [...new Set(state.records.map(r => r.date))].sort().reverse();
}

function fillSelect(select, values, placeholder = "全部") {
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

function renderAll() {
  fillSelect($("directionFilter"), state.directions, "全部方向");
  fillSelect($("adminDirection"), state.directions, "选择方向");
  fillSelect($("dateFilter"), uniqueDates(), "全部日期");
  $("adminDate").value ||= today();
  renderDashboard();
  renderDirectionManager();
  renderDateGrid();
}

function renderDashboard() {
  const grid = $("latestGrid");
  $("summaryCount").textContent = `${state.records.length} 条记录`;
  const latestByDirection = state.directions.map(d => sortedRecords().find(r => r.direction === d)).filter(Boolean);
  grid.innerHTML = latestByDirection.length ? latestByDirection.map(cardHtml).join("") : emptyCard("暂无数据", "请进入后台上传第一张前线图。");
  wireCardButtons(grid);
}

function cardHtml(record) {
  return `
    <article class="front-card">
      <img src="${record.image}" alt="${escapeHtml(record.direction)} ${escapeHtml(record.date)} 前线图">
      <h3><a href="#" data-open-direction="${escapeHtml(record.direction)}">${escapeHtml(record.direction)}</a></h3>
      <p>${escapeHtml(record.date)}</p>
      <button class="secondary-btn small" data-open-record="${record.id}">查看图文</button>
    </article>`;
}

function emptyCard(title, text) {
  return `<article class="front-card"><h3>${title}</h3><p>${text}</p></article>`;
}

function wireCardButtons(root) {
  root.querySelectorAll("[data-open-record]").forEach(btn => btn.addEventListener("click", () => openRecord(btn.dataset.openRecord)));
  root.querySelectorAll("[data-open-direction]").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault(); openDirection(a.dataset.openDirection);
  }));
}

function openRecord(id) {
  const record = state.records.find(r => r.id === id);
  if (!record) return;
  openDirection(record.direction, record.date);
}

function openDirection(direction, date = "") {
  state.selectedDirection = direction;
  state.selectedDate = date;
  switchView("direction");
  renderDirectionView();
}

function renderDirectionView() {
  const list = sortedRecords().filter(r => !state.selectedDirection || r.direction === state.selectedDirection);
  state.currentList = list;
  state.currentIndex = Math.max(0, list.findIndex(r => r.date === state.selectedDate));
  if (state.currentIndex < 0) state.currentIndex = 0;
  $("directionTitle").textContent = state.selectedDirection ? `${state.selectedDirection}方向` : "按方向查看";
  showCurrentRecord();
  renderTimeline();
}

function showCurrentRecord() {
  const record = state.currentList[state.currentIndex];
  const img = $("mainImage");
  const empty = $("emptyViewer");
  if (!record) {
    img.style.display = "none";
    empty.style.display = "block";
    $("viewerMeta").textContent = "暂无记录";
    $("viewerReport").innerHTML = "";
    return;
  }
  img.src = record.image;
  img.style.display = "block";
  empty.style.display = "none";
  $("viewerMeta").textContent = `${record.direction} · ${record.date}`;
  $("viewerReport").innerHTML = linkifyReport(record.report || "暂无文字报告");
}

function renderTimeline() {
  const strip = $("timelineStrip");
  strip.innerHTML = state.currentList.map((r, i) => `
    <button class="timeline-item ${i === state.currentIndex ? "active" : ""}" data-index="${i}">
      ${escapeHtml(r.date)}<br>${escapeHtml(r.direction)}
    </button>`).join("");
  strip.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    state.currentIndex = Number(btn.dataset.index); showCurrentRecord(); renderTimeline();
  }));
}

function renderDateGrid() {
  const date = state.selectedDate || $("dateFilter").value || uniqueDates()[0] || "";
  $("dateTitle").textContent = date ? `${date} 所有方向` : "按日期查看";
  const list = sortedRecords().filter(r => !date || r.date === date);
  $("dateGrid").innerHTML = list.length ? list.map(cardHtml).join("") : emptyCard("暂无数据", "这个日期还没有上传前线图。");
  wireCardButtons($("dateGrid"));
}

function linkifyReport(text) {
  let html = escapeHtml(text);
  const names = Object.keys(PLACE_TO_DIRECTION).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const direction = PLACE_TO_DIRECTION[name];
    html = html.replaceAll(name, `<a href="#" data-place-direction="${escapeHtml(direction)}">${name}</a>`);
  }
  setTimeout(() => document.querySelectorAll("[data-place-direction]").forEach(a => {
    a.addEventListener("click", e => { e.preventDefault(); openDirection(a.dataset.placeDirection); });
  }), 0);
  return html;
}

function renderDirectionManager() {
  const ul = $("directionManager");
  ul.innerHTML = state.directions.map(d => `
    <li><span>${escapeHtml(d)}</span><button class="danger-btn small" data-delete-direction="${escapeHtml(d)}">删除</button></li>`).join("");
  ul.querySelectorAll("[data-delete-direction]").forEach(btn => btn.addEventListener("click", () => {
    const d = btn.dataset.deleteDirection;
    if (!confirm(`确认删除方向：${d}？相关记录不会自动删除。`)) return;
    state.directions = state.directions.filter(x => x !== d);
    save(); renderAll();
  }));
}

function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  $(`${view}View`).classList.add("active-view");
  if (view === "date") renderDateGrid();
  if (view === "direction") renderDirectionView();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePaste(e) {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith("image/"));
  if (!item) return;
  const file = item.getAsFile();
  state.pastedImage = await fileToDataUrl(file);
  $("pasteBox").classList.add("has-image");
  $("pasteBox").textContent = "已读取粘贴图片。填写方向、日期和报告后保存。";
}

function addDemoData() {
  const svg = (title, date) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720"><rect width="100%" height="100%" fill="#e8eef8"/><path d="M80 520 C260 420 360 470 520 360 S780 250 1120 190" fill="none" stroke="#002d72" stroke-width="18"/><path d="M100 560 C340 470 510 530 650 410 S880 300 1160 260" fill="none" stroke="#b00020" stroke-width="12" stroke-dasharray="24 18"/><text x="70" y="100" font-family="Arial" font-size="52" font-weight="700" fill="#002d72">${title}</text><text x="70" y="165" font-family="Arial" font-size="34" fill="#111">${date}</text></svg>`)}`;
  state.records = [
    { id: crypto.randomUUID(), direction: "哈尔科夫", date: "2026-05-18", image: svg("哈尔科夫方向", "2026-05-18"), report: "哈尔科夫方向战线继续调整，沃夫昌斯克附近出现新的接触线变化。" },
    { id: crypto.randomUUID(), direction: "波克罗夫斯克", date: "2026-05-18", image: svg("波克罗夫斯克方向", "2026-05-18"), report: "波克罗夫斯克方向压力仍然较大，阿夫迪夫卡以西区域需要持续观察。" },
    { id: crypto.randomUUID(), direction: "库普扬斯克", date: "2026-05-17", image: svg("库普扬斯克方向", "2026-05-17"), report: "库普扬斯克方向今日变化有限，北侧局部阵地有小幅调整。" }
  ];
  save(); renderAll();
}

$("quickAdminBtn").addEventListener("click", () => switchView("admin"));
$("loadDemoBtn").addEventListener("click", addDemoData);
$("applyFilterBtn").addEventListener("click", () => {
  state.selectedDirection = $("directionFilter").value;
  state.selectedDate = $("dateFilter").value;
  if (state.selectedDirection) switchView("direction"); else switchView("date");
});
$("clearFilterBtn").addEventListener("click", () => { state.selectedDirection = ""; state.selectedDate = ""; $("directionFilter").value = ""; $("dateFilter").value = ""; renderAll(); switchView("dashboard"); });
$("prevImageBtn").addEventListener("click", () => { if (state.currentIndex < state.currentList.length - 1) state.currentIndex++; showCurrentRecord(); renderTimeline(); });
$("nextImageBtn").addEventListener("click", () => { if (state.currentIndex > 0) state.currentIndex--; showCurrentRecord(); renderTimeline(); });

$("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("imageInput").files[0];
  const image = file ? await fileToDataUrl(file) : state.pastedImage;
  if (!image) return alert("请先上传或粘贴一张图片。");
  state.records.push({
    id: crypto.randomUUID(),
    direction: $("adminDirection").value,
    date: $("adminDate").value,
    image,
    report: $("reportInput").value.trim()
  });
  state.pastedImage = "";
  $("pasteBox").classList.remove("has-image");
  $("pasteBox").textContent = "点击这里后 Ctrl+V 粘贴图片，或使用上方文件选择。";
  $("imageInput").value = "";
  $("reportInput").value = "";
  save(); renderAll(); alert("已保存。当前版本保存到浏览器 localStorage。 ");
});

$("pasteBox").addEventListener("paste", handlePaste);
$("pasteBox").addEventListener("click", () => $("pasteBox").focus());
$("addDirectionBtn").addEventListener("click", () => {
  const value = $("newDirectionInput").value.trim();
  if (!value || state.directions.includes(value)) return;
  state.directions.push(value);
  $("newDirectionInput").value = "";
  save(); renderAll();
});
$("exportBtn").addEventListener("click", () => {
  $("jsonOutput").value = JSON.stringify({ directions: state.directions, records: state.records }, null, 2);
  $("jsonDialog").showModal();
});
$("closeDialogBtn").addEventListener("click", () => $("jsonDialog").close());
$("wipeBtn").addEventListener("click", () => { if (confirm("确认清空本地保存的数据？")) { state.records = []; save(); renderAll(); } });

document.querySelectorAll(".nav-tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));

renderAll();
