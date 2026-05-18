const DEFAULT_DIRECTIONS = [
  "苏梅", "哈尔科夫", "库普扬斯克", "利曼", "西维尔斯克", "卡玛托尔斯克",
  "康斯坦丁尼夫卡", "波克罗夫斯克", "亚历山德里夫卡", "胡里艾伯勒", "库班", "赫尔松"
];

const STORAGE_KEY = "gsua_frontline_archive_v4";
const pageType = document.body.dataset.page;

let state = loadState();
let selectedDate = getLatestDate();
let selectedDirection = null;
let calendarMonth = selectedDate ? selectedDate.slice(0, 7) : todayMonth();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.directions) && parsed.days) return parsed;
    } catch (e) {}
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    directions: DEFAULT_DIRECTIONS,
    days: {
      [today]: {
        report: "这里是当天文字报告示例。点击报告中的方向名称，例如 波克罗夫斯克、哈尔科夫、赫尔松，可以跳转到对应方向图片集。",
        images: Object.fromEntries(DEFAULT_DIRECTIONS.map(d => [d, ""]))
      }
    }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}

function sortedDates() {
  return Object.keys(state.days).sort();
}

function getLatestDate() {
  const dates = sortedDates();
  return dates.length ? dates[dates.length - 1] : null;
}

function ensureDay(date) {
  if (!state.days[date]) {
    state.days[date] = {
      report: "",
      images: Object.fromEntries(state.directions.map(d => [d, ""]))
    };
  }
  state.directions.forEach(d => {
    if (!(d in state.days[date].images)) state.days[date].images[d] = "";
  });
}

function formatDate(date) {
  return date || "暂无记录";
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}

function renderReportLinks(report) {
  let html = escapeHtml(report || "暂无报告。");
  state.directions.forEach(direction => {
    const escaped = escapeHtml(direction);
    const re = new RegExp(escaped, "g");
    html = html.replace(re, `<a href="#" data-direction-link="${escaped}">${escaped}</a>`);
  });
  return html;
}

function getPrevDate(date) {
  const dates = sortedDates();
  const idx = dates.indexOf(date);
  return idx > 0 ? dates[idx - 1] : date;
}

function getNextDate(date) {
  const dates = sortedDates();
  const idx = dates.indexOf(date);
  return idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : date;
}

function setSelectedDate(date) {
  if (!date || !state.days[date]) return;
  selectedDate = date;
  calendarMonth = date.slice(0, 7);
  renderViewer();
}

function setSelectedDirection(direction) {
  selectedDirection = direction;
  renderViewer();
}

function renderViewerDirections() {
  const box = document.getElementById("viewerDirectionList");
  if (!box) return;
  box.innerHTML = "";
  state.directions.forEach(direction => {
    const btn = document.createElement("button");
    btn.className = "direction-btn" + (selectedDirection === direction ? " active" : "");
    btn.type = "button";
    btn.textContent = direction;
    btn?.addEventListener("click", () => setSelectedDirection(direction));
    box.appendChild(btn);
  });
}

function renderOverview() {
  const grid = document.getElementById("overviewGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const day = state.days[selectedDate];
  state.directions.forEach(direction => {
    const card = document.createElement("div");
    card.className = "preview-card";
    const image = day?.images?.[direction] || "";
    card.innerHTML = `
      <button type="button" aria-label="查看${direction}">
        <div class="preview-card-title">${escapeHtml(direction)}</div>
        <div class="image-frame">
          ${image ? `<img src="${image}" alt="${escapeHtml(direction)} 前线图">` : `<div class="empty-state">未上传图片</div>`}
        </div>
      </button>
    `;
    card.querySelector("button")?.addEventListener("click", () => setSelectedDirection(direction));
    grid.appendChild(card);
  });
}

function renderDetail() {
  const detail = document.getElementById("detailView");
  const img = document.getElementById("detailImage");
  const empty = document.getElementById("detailEmpty");
  if (!detail || !img || !empty) return;

  const image = state.days[selectedDate]?.images?.[selectedDirection] || "";
  if (image) {
    img.src = image;
    img.classList.remove("hidden");
    empty.classList.add("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    empty.classList.remove("hidden");
  }
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const label = document.getElementById("calendarMonthLabel");
  if (!grid || !label) return;

  const [year, month] = calendarMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  label.textContent = `${year} 年 ${month} 月`;
  grid.innerHTML = "";

  for (let i = 0; i < first.getDay(); i++) {
    const blank = document.createElement("button");
    blank.className = "calendar-day blank";
    blank.type = "button";
    grid.appendChild(blank);
  }

  const records = new Set(sortedDates());
  for (let day = 1; day <= last.getDate(); day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-day";
    btn.textContent = day;
    if (records.has(dateStr)) {
      btn.classList.add("has-record");
      btn?.addEventListener("click", () => setSelectedDate(dateStr));
    } else {
      btn.disabled = true;
    }
    if (dateStr === selectedDate) btn.classList.add("selected");
    grid.appendChild(btn);
  }
}

function renderViewer() {
  if (pageType !== "viewer") return;
  if (!selectedDate) {
    document.getElementById("currentDateText").textContent = "暂无记录";
    return;
  }

  const currentDateText = document.getElementById("currentDateText");
  const title = document.getElementById("viewerTitle");
  const subtitle = document.getElementById("viewerSubtitle");
  const overview = document.getElementById("overviewGrid");
  const detail = document.getElementById("detailView");
  const reportBody = document.getElementById("reportBody");
  const backBtn = document.getElementById("backToOverviewBtn");

  currentDateText.textContent = formatDate(selectedDate);

  if (selectedDirection) {
    title.textContent = `${selectedDirection} · 日期对比`;
    subtitle.textContent = `当前显示 ${selectedDate} 的 ${selectedDirection} 方向图。使用上方箭头或日历切换日期。`;
    overview.classList.add("hidden");
    detail.classList.remove("hidden");
    backBtn.classList.remove("hidden");
    renderDetail();
  } else {
    title.textContent = selectedDate === getLatestDate() ? "最新前线总览" : "当日前线总览";
    subtitle.textContent = `当前显示 ${selectedDate} 的全部方向预览。`;
    overview.classList.remove("hidden");
    detail.classList.add("hidden");
    backBtn.classList.add("hidden");
    renderOverview();
  }

  if (reportBody) {
    reportBody.innerHTML = renderReportLinks(state.days[selectedDate]?.report);
  }
  reportBody?.querySelectorAll("[data-direction-link]").forEach(link => {
    link?.addEventListener("click", e => {
      e.preventDefault();
      setSelectedDirection(link.dataset.directionLink);
    });
  });

  renderViewerDirections();
  renderCalendar();
}

function shiftCalendarMonth(offset) {
  const [year, month] = calendarMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + offset, 1);
  calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  renderCalendar();
}

function bindViewer() {
  document.getElementById("prevDateBtn")?.addEventListener("click", () => setSelectedDate(getPrevDate(selectedDate)));
  document.getElementById("nextDateBtn")?.addEventListener("click", () => setSelectedDate(getNextDate(selectedDate)));
  document.getElementById("openCalendarBtn")?.addEventListener("click", () => {
    document.getElementById("calendarPopover")?.classList.toggle("hidden");
  });
  document.getElementById("calPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));
  document.getElementById("backToOverviewBtn")?.addEventListener("click", () => {
    selectedDirection = null;
    renderViewer();
  });
  renderViewer();
}

function readFileAsDataUrl(file, cb) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}

function renderAdminDirections() {
  const box = document.getElementById("adminDirectionList");
  if (!box) return;
  box.innerHTML = "";
  state.directions.forEach(direction => {
    const row = document.createElement("div");
    row.className = "button-row";
    row.innerHTML = `
      <button class="direction-btn" type="button">${escapeHtml(direction)}</button>
      <button class="blue-btn outline" type="button">删除</button>
    `;
    row.children[1]?.addEventListener("click", () => {
      if (!confirm(`删除方向：${direction}？所有日期中的该方向图片也会删除。`)) return;
      state.directions = state.directions.filter(d => d !== direction);
      Object.values(state.days).forEach(day => delete day.images[direction]);
      saveState();
      renderAdmin();
    });
    box.appendChild(row);
  });
}

function renderUploadGrid() {
  const grid = document.getElementById("uploadGrid");
  const dateInput = document.getElementById("adminDate");
  if (!grid || !dateInput) return;

  const date = dateInput.value;
  if (!date) {
    grid.innerHTML = `<div class="empty-state">请先选择日期。</div>`;
    return;
  }

  ensureDay(date);
  grid.innerHTML = "";

  state.directions.forEach(direction => {
    const card = document.createElement("div");
    card.className = "upload-card";
    const img = state.days[date].images[direction] || "";
    card.innerHTML = `
      <h3>${escapeHtml(direction)}</h3>
      <div class="upload-body">
        <div class="paste-zone ${img ? "has-image" : ""}" tabindex="0">
          ${img ? `<img src="${img}" alt="${escapeHtml(direction)}">` : `<span>点击选择文件，或复制图片后在此 Ctrl+V 粘贴</span>`}
        </div>
        <input class="file-input" type="file" accept="image/*">
      </div>
    `;

    const zone = card.querySelector(".paste-zone");
    const fileInput = card.querySelector("input");
    zone?.addEventListener("click", () => fileInput?.click());
    zone?.addEventListener("paste", e => {
      const item = [...e.clipboardData.items].find(i => i.type.startsWith("image/"));
      if (item) {
        readFileAsDataUrl(item.getAsFile(), data => {
          state.days[date].images[direction] = data;
          saveState();
          renderUploadGrid();
        });
      }
    });
    fileInput?.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      readFileAsDataUrl(file, data => {
        state.days[date].images[direction] = data;
        saveState();
        renderUploadGrid();
      });
    });

    grid.appendChild(card);
  });
}

function renderAdmin() {
  if (pageType !== "admin") return;
  const dateInput = document.getElementById("adminDate");
  const reportEditor = document.getElementById("reportEditor");
  const status = document.getElementById("adminStatus");

  if (dateInput && !dateInput.value) dateInput.value = getLatestDate() || new Date().toISOString().slice(0,10);
  const date = dateInput?.value;
  ensureDay(date);

  if (reportEditor) reportEditor.value = state.days[date]?.report || "";
  if (status) status.textContent = `正在编辑：${date}。请为该日期上传全部方向图片。`;

  renderAdminDirections();
  renderUploadGrid();
}

function bindAdmin() {
  const dateInput = document.getElementById("adminDate");

  document.getElementById("loadAdminDateBtn")?.addEventListener("click", renderAdmin);
  document.getElementById("createDateBtn")?.addEventListener("click", () => {
    const date = dateInput.value;
    if (!date) return alert("请选择日期。");
    ensureDay(date);
    saveState();
    renderAdmin();
    alert("日期已保存。");
  });

  document.getElementById("saveReportBtn")?.addEventListener("click", () => {
    const date = dateInput.value;
    if (!date) return alert("请选择日期。");
    ensureDay(date);
    state.days[date].report = document.getElementById("reportEditor").value;
    saveState();
    alert("报告已保存。");
  });

  document.getElementById("addDirectionBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newDirectionInput");
    const name = input.value.trim();
    if (!name) return;
    if (state.directions.includes(name)) return alert("该方向已存在。");
    state.directions.push(name);
    Object.keys(state.days).forEach(date => ensureDay(date));
    input.value = "";
    saveState();
    renderAdmin();
  });

  document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    document.getElementById("jsonBox").value = JSON.stringify(state, null, 2);
  });

  document.getElementById("importJsonBtn")?.addEventListener("click", () => {
    const raw = document.getElementById("jsonBox").value;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.directions) || !parsed.days) throw new Error();
      state = parsed;
      saveState();
      renderAdmin();
      alert("导入成功。");
    } catch (e) {
      alert("JSON 格式不正确。");
    }
  });

  renderAdmin();
}


function clearInteractionSelection() {
  document.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));
}

document.addEventListener("pointerdown", e => {
  const interactive = e.target.closest("button:not(:disabled), a, .paste-zone");
  if (!interactive || interactive.classList.contains("blank")) {
    clearInteractionSelection();
    return;
  }
  clearInteractionSelection();
  interactive.classList.add("is-selected");
});

document.addEventListener("keydown", e => {
  if (e.key === "Tab") {
    clearInteractionSelection();
  }
});

if (pageType === "viewer") bindViewer();
if (pageType === "admin") bindAdmin();
