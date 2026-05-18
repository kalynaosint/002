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
  page: document.body.dataset.page,
  directions: load("gsua_directions", DEFAULT_DIRECTIONS),
  records: load("gsua_records", []),
  selectedDirection: "",
  selectedDate: "",
  currentList: [],
  currentIndex: 0,
  pastedImage: ""
};

const $ = (id) => document.getElementById(id);
const has = (id) => Boolean($(id));

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function save() {
  localStorage.setItem("gsua_directions", JSON.stringify(state.directions));
  localStorage.setItem("gsua_records", JSON.stringify(state.records));
}

function today() { return new Date().toISOString().slice(0, 10); }
function sortedRecords() { return [...state.records].sort((a, b) => b.date.localeCompare(a.date) || a.direction.localeCompare(b.direction, "zh")); }
function uniqueDates() { return [...new Set(state.records.map(r => r.date))].sort().reverse(); }

function fillSelect(select, values, placeholder) {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

function renderViewerPage() {
  fillSelect($("directionFilter"), state.directions, "全部方向");
  fillSelect($("dateFilter"), uniqueDates(), "全部日期");
  $("summaryCount").textContent = `${state.records.length} 条记录`;

  const first = sortedRecords()[0];
  if (first) openDirection(first.direction, first.date, false);
  else showEmptyViewer();
  renderLatestGrid();
}

function renderAdminPage() {
  fillSelect($("adminDirection"), state.directions, "选择方向");
  if (has("adminDate")) $("adminDate").value ||= today();
  renderDirectionManager();
}

function openDirection(direction, date = "", scroll = true) {
  state.selectedDirection = direction;
  state.selectedDate = date;
  renderDirectionView();
  if (scroll && has("directionArea")) $("directionArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDirectionView() {
  if (!has("directionTitle")) return;
  const list = sortedRecords().filter(r => !state.selectedDirection || r.direction === state.selectedDirection);
  state.currentList = list;
  state.currentIndex = Math.max(0, list.findIndex(r => !state.selectedDate || r.date === state.selectedDate));
  if (state.currentIndex < 0) state.currentIndex = 0;
  $("directionTitle").textContent = state.selectedDirection ? `${state.selectedDirection}方向` : "综合展示";
  showCurrentRecord();
  renderTimeline();
}

function showEmptyViewer() {
  if (!has("mainImage")) return;
  $("mainImage").style.display = "none";
  $("emptyViewer").style.display = "block";
  $("viewerMeta").textContent = "暂无记录";
  $("viewerReport").innerHTML = "";
  if (has("timelineStrip")) $("timelineStrip").innerHTML = "";
}

function showCurrentRecord() {
  const record = state.currentList[state.currentIndex];
  if (!record) return showEmptyViewer();
  const img = $("mainImage");
  img.src = record.image;
  img.style.display = "block";
  $("emptyViewer").style.display = "none";
  $("viewerMeta").textContent = `${record.direction} · ${record.date}`;
  $("viewerReport").innerHTML = linkifyReport(record.report || "暂无文字报告");
}

function renderTimeline() {
  if (!has("timelineStrip")) return;
  $("timelineStrip").innerHTML = state.currentList.map((r, i) => `
    <button class="timeline-item ${i === state.currentIndex ? "active" : ""}" data-index="${i}">
      ${escapeHtml(r.date)}<br>${escapeHtml(r.direction)}
    </button>`).join("");
  $("timelineStrip").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    state.currentIndex = Number(btn.dataset.index);
    showCurrentRecord();
    renderTimeline();
  }));
}

function renderLatestGrid(date = "") {
  if (!has("dateGrid")) return;
  const grid = $("dateGrid");
  let list;
  if (date) {
    $("dateTitle").textContent = `${date} 所有方向`;
    list = sortedRecords().filter(r => r.date === date);
  } else {
    $("dateTitle").textContent = "最新方向";
    list = state.directions.map(d => sortedRecords().find(r => r.direction === d)).filter(Boolean);
  }
  grid.innerHTML = list.length ? list.map(cardHtml).join("") : emptyCard("暂无数据", "请进入管理后台上传第一张前线图。");
  wireCardButtons(grid);
}

function cardHtml(record) {
  return `
    <article class="front-card">
      <img src="${record.image}" alt="${escapeHtml(record.direction)} ${escapeHtml(record.date)} 前线图">
      <h2><a href="#" data-open-direction="${escapeHtml(record.direction)}">${escapeHtml(record.direction)}</a></h2>
      <p>${escapeHtml(record.date)}</p>
      <button class="outline-btn small" data-open-record="${record.id}">查看图文</button>
    </article>`;
}

function emptyCard(title, text) { return `<article class="front-card"><h2>${title}</h2><p>${text}</p></article>`; }

function wireCardButtons(root) {
  root.querySelectorAll("[data-open-record]").forEach(btn => btn.addEventListener("click", () => openRecord(btn.dataset.openRecord)));
  root.querySelectorAll("[data-open-direction]").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault();
    openDirection(a.dataset.openDirection);
  }));
}

function openRecord(id) {
  const record = state.records.find(r => r.id === id);
  if (!record) return;
  openDirection(record.direction, record.date);
}

function linkifyReport(text) {
  let html = escapeHtml(text);
  const names = Object.keys(PLACE_TO_DIRECTION).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const direction = PLACE_TO_DIRECTION[name];
    html = html.replaceAll(name, `<a href="#" data-place-direction="${escapeHtml(direction)}">${name}</a>`);
  }
  setTimeout(() => document.querySelectorAll("[data-place-direction]").forEach(a => {
    a?.addEventListener("click", e => { e.preventDefault(); openDirection(a.dataset.placeDirection); });
  }), 0);
  return html;
}

function renderDirectionManager() {
  if (!has("directionManager")) return;
  const ul = $("directionManager");
  ul.innerHTML = state.directions.map(d => `
    <li><span>${escapeHtml(d)}</span><button class="danger-btn small" data-delete-direction="${escapeHtml(d)}">删除</button></li>`).join("");
  ul.querySelectorAll("[data-delete-direction]").forEach(btn => btn.addEventListener("click", () => {
    const d = btn.dataset.deleteDirection;
    if (!confirm(`确认删除方向：${d}？相关记录不会自动删除。`)) return;
    state.directions = state.directions.filter(x => x !== d);
    save(); renderAdminPage();
  }));
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

function bindViewerEvents() {
  document.querySelectorAll(".box-tab").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".box-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    if (tab.dataset.mode === "latest") {
      $("directionFilter").value = "";
      $("dateFilter").value = "";
      renderLatestGrid();
    }
  }));

  $("applyFilterBtn").addEventListener("click", () => {
    const direction = $("directionFilter").value;
    const date = $("dateFilter").value;
    if (direction) openDirection(direction, date);
    else if (date) renderLatestGrid(date);
    else renderLatestGrid();
    if (!direction && has("dateArea")) $("dateArea").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("prevImageBtn").addEventListener("click", () => {
    if (state.currentIndex < state.currentList.length - 1) state.currentIndex++;
    showCurrentRecord(); renderTimeline();
  });
  $("nextImageBtn").addEventListener("click", () => {
    if (state.currentIndex > 0) state.currentIndex--;
    showCurrentRecord(); renderTimeline();
  });
}

function bindAdminEvents() {
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
    $("pasteBox").textContent = "点击这里后 Ctrl+V 粘贴图片";
    $("imageInput").value = "";
    $("reportInput").value = "";
    save();
    alert("已保存。当前版本保存到浏览器 localStorage。 ");
  });

  $("pasteBox").addEventListener("paste", handlePaste);
  $("pasteBox").addEventListener("click", () => $("pasteBox").focus());
  $("addDirectionBtn").addEventListener("click", () => {
    const value = $("newDirectionInput").value.trim();
    if (!value || state.directions.includes(value)) return;
    state.directions.push(value);
    $("newDirectionInput").value = "";
    save(); renderAdminPage();
  });
  $("exportBtn").addEventListener("click", () => {
    $("jsonOutput").value = JSON.stringify({ directions: state.directions, records: state.records }, null, 2);
    $("jsonDialog").showModal();
  });
  $("closeDialogBtn").addEventListener("click", () => $("jsonDialog").close());
  $("wipeBtn").addEventListener("click", () => {
    if (confirm("确认清空本地保存的数据？")) {
      state.records = [];
      save();
      alert("已清空本地记录。");
    }
  });
}

if (state.page === "viewer") {
  bindViewerEvents();
  renderViewerPage();
}

if (state.page === "admin") {
  bindAdminEvents();
  renderAdminPage();
}
