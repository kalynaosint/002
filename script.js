const DEFAULT_DIRECTIONS = [
  "苏梅", "哈尔科夫", "库普扬斯克", "利曼", "西维尔斯克", "卡玛托尔斯克",
  "康斯坦丁尼夫卡", "波克罗夫斯克", "亚历山德里夫卡", "胡里艾伯勒", "库班", "赫尔松",
  "未知方向"
];

const UNKNOWN_DIRECTION = "未知方向";

const LOSS_CATEGORIES = [
  "人员", "坦克", "装甲单位", "火炮", "火箭炮", "防空系统",
  "固定翼战机", "直升机", "无人机", "巡航导弹",
  "战舰", "汽车", "特种设备", "潜艇"
];

const LOCAL_STORAGE_KEY = "gsua_frontline_archive_local_admin";
const DATA_URL = "data/data.json";
const API_BASE = "https://gsua-backend.kalynaosint.workers.dev";
let ADMIN_KEY = localStorage.getItem("gsua_admin_key") || "";

const DIRECTION_COLORS = [
  "#ff00d4", "#ff0000", "#ff8500", "#ffd400", "#1167d8", "#00c987",
  "#9b59b6", "#00a1ff", "#8d6e63", "#cddc39", "#795548", "#607d8b", "#777777"
];

const LOSS_COLORS = [
  "#c2410c", "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d",
  "#059669", "#0891b2", "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
  "#be185d", "#525252"
];

const isAdmin = document.body.dataset.page === "admin" || !!document.getElementById("uploadGrid");
const isViewer = !!document.querySelector("[data-tab]") || !!document.getElementById("overviewGrid");

let state = emptyState();
let selectedDate = null;
let selectedDirection = null;
let calendarMonth = todayMonth();

let activeTab = "frontline";
let selectedCombatDirection = null;
let selectedLossCategory = null;
let combatRange = 60;
let lossRange = 60;
let combatMA = 7;
let lossMA = 7;
let combatChart = null;
let lossChart = null;

function emptyState() {
  return { directions: [...DEFAULT_DIRECTIONS], days: {} };
}

function sampleState() {
  const base = emptyState();

  for (let offset = 12; offset >= 0; offset--) {
    const d = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    base.days[d] = {
      report: `${d} 示例报告：波克罗夫斯克、哈尔科夫、赫尔松方向有记录。上传正式 data.json 后这里会替换为真实内容。`,
      images: Object.fromEntries(base.directions.map(direction => [direction, ""])),
      combat: Object.fromEntries(base.directions.map((direction, i) => [direction, Math.max(0, 2 + (i % 5) * 3 + (offset % 4))])),
      losses: Object.fromEntries(LOSS_CATEGORIES.map((category, i) => [category, i === 0 ? 800 + offset * 20 : Math.max(0, Math.round((i + 1) * 1.4 + offset % 6))]))
    };
  }

  return base;
}

async function loadState() {
  if (isAdmin) {
    try {
      ensureAdminKey();
      const remote = await loadDataFromGithub();
      state = normalizeState(remote);
      saveLocalState();
      return;
    } catch (err) {
      console.warn("Cannot load remote data; using local cache.", err);

      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (raw) {
        try {
          state = normalizeState(JSON.parse(raw));
          return;
        } catch (e) {}
      }

      state = sampleState();
      saveLocalState();
      return;
    }
  }

  try {
    const res = await fetch(DATA_URL + "?v=" + Date.now(), {
      cache: "no-store"
    });

    if (!res.ok) throw new Error("Cannot load data/data.json");

    state = normalizeState(await res.json());
  } catch (err) {
    console.warn("Using sample data because data/data.json failed:", err);
    state = sampleState();
  }
}

function normalizeState(input) {
  const normalized = input && typeof input === "object" ? input : emptyState();

  if (!Array.isArray(normalized.directions)) normalized.directions = [...DEFAULT_DIRECTIONS];
  if (!normalized.directions.includes(UNKNOWN_DIRECTION)) normalized.directions.push(UNKNOWN_DIRECTION);
  if (!normalized.days || typeof normalized.days !== "object") normalized.days = {};

  Object.keys(normalized.days).forEach(date => {
    const day = normalized.days[date] || {};
    if (!day.images) day.images = {};
    if (!day.combat) day.combat = {};
    if (!day.losses) day.losses = {};
    if (typeof day.report !== "string") day.report = "";

    normalized.directions.forEach(direction => {
      if (!(direction in day.images)) day.images[direction] = "";
      const entry = day.images[direction];
      if (entry && typeof entry === "object") {
        day.images[direction] = {
          src: entry.src || entry.url || "",
          changes: Array.isArray(entry.changes) ? entry.changes : []
        };
      }
      if (!(direction in day.combat)) day.combat[direction] = 0;
    });

    LOSS_CATEGORIES.forEach(category => {
      if (!(category in day.losses)) day.losses[category] = 0;
    });

    normalized.days[date] = day;
  });

  return normalized;
}

function saveLocalState() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
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
  if (!date) return;
  if (!state.days[date]) {
    state.days[date] = { report: "", images: {}, combat: {}, losses: {} };
  }

  if (!state.directions.includes(UNKNOWN_DIRECTION)) state.directions.push(UNKNOWN_DIRECTION);

  const day = state.days[date];
  if (!day.images) day.images = {};
  if (!day.combat) day.combat = {};
  if (!day.losses) day.losses = {};
  if (typeof day.report !== "string") day.report = "";

  state.directions.forEach(direction => {
    if (!(direction in day.images)) day.images[direction] = "";
    if (!(direction in day.combat)) day.combat[direction] = 0;
  });

  LOSS_CATEGORIES.forEach(category => {
    if (!(category in day.losses)) day.losses[category] = 0;
  });
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}


function getImageEntry(date, direction) {
  return state.days?.[date]?.images?.[direction] || "";
}

function getImageSrc(date, direction) {
  const entry = getImageEntry(date, direction);
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  return entry.src || entry.url || "";
}

function getImageChanges(date, direction) {
  const entry = getImageEntry(date, direction);
  if (!entry || typeof entry === "string") return [];
  return Array.isArray(entry.changes) ? entry.changes : [];
}

function setImageSrc(date, direction, src) {
  ensureDay(date);
  const oldEntry = state.days[date].images[direction];
  const changes = oldEntry && typeof oldEntry === "object" && Array.isArray(oldEntry.changes)
    ? oldEntry.changes
    : [];
  state.days[date].images[direction] = { src, changes };
}

function setImageChanges(date, direction, changes) {
  ensureDay(date);
  const src = getImageSrc(date, direction);
  state.days[date].images[direction] = { src, changes: Array.isArray(changes) ? changes : [] };
}

function imageDisplayBox(img, container) {
  if (!img || !container) return null;
  const naturalW = img.naturalWidth || 0;
  const naturalH = img.naturalHeight || 0;
  const cRect = container.getBoundingClientRect();
  if (!naturalW || !naturalH || !cRect.width || !cRect.height) {
    return { left: 0, top: 0, width: cRect.width, height: cRect.height };
  }
  const scale = Math.min(cRect.width / naturalW, cRect.height / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    left: (cRect.width - width) / 2,
    top: (cRect.height - height) / 2,
    width,
    height
  };
}

function placePercentBox(el, box, display) {
  if (!el || !box || !display) return;
  el.style.left = `${display.left + display.width * box.x / 100}px`;
  el.style.top = `${display.top + display.height * box.y / 100}px`;
  el.style.width = `${display.width * box.w / 100}px`;
  el.style.height = `${display.height * box.h / 100}px`;
}

function renderReportLinks(report) {
  let html = escapeHtml(report || "暂无报告。");
  state.directions.forEach(direction => {
    const escaped = escapeHtml(direction);
    html = html.replace(new RegExp(escaped, "g"), `<a href="#" data-direction-link="${escaped}">${escaped}</a>`);
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
  detailChangesVisible = false;
  renderViewer();
}

function setSelectedDirection(direction) {
  selectedDirection = direction;
  detailChangesVisible = false;
  renderViewer();
}

/* ---------- Tabs ---------- */
function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      activeTab = link.dataset.tab;

      document.querySelectorAll("[data-tab]").forEach(a => a.classList.remove("active"));
      link.classList.add("active");

      document.querySelectorAll(".tab-content").forEach(panel => panel.classList.add("hidden"));
      document.getElementById("tab-" + activeTab)?.classList.remove("hidden");

      if (activeTab === "combat") renderCombatTab();
      if (activeTab === "losses") renderLossTab();
    });
  });
}

/* ---------- Viewer: Frontline ---------- */
function renderViewerDirections() {
  const box = document.getElementById("viewerDirectionList");
  if (!box) return;
  box.innerHTML = "";
  state.directions.filter(d => d !== UNKNOWN_DIRECTION).forEach(direction => {
    const btn = document.createElement("button");
    btn.className = "direction-btn" + (selectedDirection === direction ? " active" : "");
    btn.type = "button";
    btn.textContent = direction;
    btn.addEventListener("click", () => setSelectedDirection(direction));
    box.appendChild(btn);
  });
}

function renderOverview() {
  const grid = document.getElementById("overviewGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const day = state.days[selectedDate];

  state.directions.filter(d => d !== UNKNOWN_DIRECTION).forEach(direction => {
    const card = document.createElement("div");
    card.className = "preview-card";
    const image = getImageSrc(selectedDate, direction);
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

let detailChangesVisible = false;

function renderDetailChangeOverlay() {
  const frame = document.querySelector("#detailView .image-frame.large");
  const img = document.getElementById("detailImage");
  const overlay = document.getElementById("detailChangeOverlay");
  const toggleBtn = document.getElementById("toggleChangesBtn");
  if (!frame || !img || !overlay) return;

  const changes = getImageChanges(selectedDate, selectedDirection);
  overlay.innerHTML = "";
  overlay.classList.toggle("hidden", !detailChangesVisible || !changes.length);

  if (toggleBtn) {
    toggleBtn.disabled = !changes.length;
    toggleBtn.textContent = changes.length
      ? (detailChangesVisible ? `隐藏变化区域（${changes.length}）` : `查看变化区域（${changes.length}）`)
      : "暂无变化标注";
  }

  if (!detailChangesVisible || !changes.length) return;

  const display = imageDisplayBox(img, frame);
  changes.forEach((box, i) => {
    const el = document.createElement("div");
    el.className = "change-box";
    el.innerHTML = `<span>${i + 1}</span>`;
    placePercentBox(el, box, display);
    overlay.appendChild(el);
  });
}

function renderDetail() {
  const img = document.getElementById("detailImage");
  const empty = document.getElementById("detailEmpty");
  const overlay = document.getElementById("detailChangeOverlay");
  if (!img || !empty) return;

  const image = getImageSrc(selectedDate, selectedDirection);
  if (image) {
    img.src = image;
    img.classList.remove("hidden");
    empty.classList.add("hidden");
    img.onload = renderDetailChangeOverlay;
    requestAnimationFrame(renderDetailChangeOverlay);
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    empty.classList.remove("hidden");
    if (overlay) overlay.innerHTML = "";
  }
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const label = document.getElementById("calendarMonthLabel");
  if (!grid || !label || !calendarMonth) return;

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
      btn.addEventListener("click", () => setSelectedDate(dateStr));
    } else {
      btn.disabled = true;
    }
    if (dateStr === selectedDate) btn.classList.add("selected");
    grid.appendChild(btn);
  }
}

function moveCalendarPopover(isDetailMode) {
  const calendar = document.getElementById("calendarPopover");
  const overviewHost = document.getElementById("overviewCalendarHost");
  const detailHost = document.getElementById("detailCalendarHost");

  if (!calendar || !overviewHost || !detailHost) return;

  if (isDetailMode) {
    if (calendar.parentElement !== detailHost) {
      detailHost.appendChild(calendar);
    }
  } else {
    if (calendar.parentElement !== overviewHost) {
      overviewHost.appendChild(calendar);
    }
  }
}

function renderViewer() {
  const currentDateText = document.getElementById("currentDateText");
  if (!currentDateText) return;

  if (!selectedDate) {
    selectedDate = getLatestDate();
    if (selectedDate) calendarMonth = selectedDate.slice(0, 7);
  }

  if (!selectedDate) {
    currentDateText.textContent = "暂无记录";
    return;
  }

  const title = document.getElementById("viewerTitle");
  const overview = document.getElementById("overviewGrid");
  const detail = document.getElementById("detailView");
  const reportBody = document.getElementById("reportBody");
  const backBtn = document.getElementById("backToOverviewBtn");
  const toggleChangesBtn = document.getElementById("toggleChangesBtn");
  const detailCurrentDateText = document.getElementById("detailCurrentDateText");
  const frontlineTab = document.getElementById("tab-frontline");

  currentDateText.textContent = selectedDate;
  if (detailCurrentDateText) detailCurrentDateText.textContent = selectedDate;

  if (selectedDirection) {
    frontlineTab?.classList.add("is-detail-mode");
    moveCalendarPopover(true);
    if (title) title.textContent = `${selectedDirection} · 日期对比`;
    overview?.classList.add("hidden");
    detail?.classList.remove("hidden");
    backBtn?.classList.remove("hidden");
    toggleChangesBtn?.classList.remove("hidden");
    renderDetail();
  } else {
    frontlineTab?.classList.remove("is-detail-mode");
    moveCalendarPopover(false);
    if (title) title.textContent = selectedDate === getLatestDate() ? "最新前线总览" : "当日前线总览";
    overview?.classList.remove("hidden");
    detail?.classList.add("hidden");
    backBtn?.classList.add("hidden");
    toggleChangesBtn?.classList.add("hidden");
    detailChangesVisible = false;
    renderOverview();
  }

  if (reportBody) {
    reportBody.innerHTML = renderReportLinks(state.days[selectedDate]?.report);
    reportBody.querySelectorAll("[data-direction-link]").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        setSelectedDirection(link.dataset.directionLink);
      });
    });
  }

  renderViewerDirections();
  renderCalendar();
}

function bindFrontlineControls() {
  document.getElementById("prevDateBtn")?.addEventListener("click", () => setSelectedDate(getPrevDate(selectedDate)));
  document.getElementById("nextDateBtn")?.addEventListener("click", () => setSelectedDate(getNextDate(selectedDate)));
  document.getElementById("openCalendarBtn")?.addEventListener("click", () => {
    document.getElementById("calendarPopover")?.classList.toggle("hidden");
  });

  document.getElementById("detailPrevDateBtn")?.addEventListener("click", () => setSelectedDate(getPrevDate(selectedDate)));
  document.getElementById("detailNextDateBtn")?.addEventListener("click", () => setSelectedDate(getNextDate(selectedDate)));
  document.getElementById("detailOpenCalendarBtn")?.addEventListener("click", () => {
    document.getElementById("calendarPopover")?.classList.toggle("hidden");
  });
  document.getElementById("calPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));
  document.getElementById("backToOverviewBtn")?.addEventListener("click", () => {
    selectedDirection = null;
    detailChangesVisible = false;
    renderViewer();
  });
  document.getElementById("toggleChangesBtn")?.addEventListener("click", () => {
    detailChangesVisible = !detailChangesVisible;
    renderDetailChangeOverlay();
  });
  window.addEventListener("resize", renderDetailChangeOverlay);
}

function shiftCalendarMonth(offset) {
  const [year, month] = calendarMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + offset, 1);
  calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  renderCalendar();
}

/* ---------- Charts ---------- */
function movingAverage(arr, windowSize) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function filteredDates(rangeDays) {
  const dates = sortedDates();
  if (!rangeDays) return dates;
  return dates.slice(Math.max(0, dates.length - Number(rangeDays)));
}

function directionColor(direction) {
  if (direction === UNKNOWN_DIRECTION) return "#777777";
  const idx = state.directions.indexOf(direction);
  return DIRECTION_COLORS[idx % DIRECTION_COLORS.length];
}

function chartDataset(label, data, type = "bar", extra = {}) {
  if (type === "line") {
    return {
      type: "line",
      label,
      data,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      fill: false,
      ...extra
    };
  }
  return {
    type: "bar",
    label,
    data,
    borderWidth: 1,
    ...extra
  };
}

function makeChart(ctx, oldChart, config) {
  if (!ctx || typeof Chart === "undefined") return oldChart;
  if (oldChart) oldChart.destroy();
  return new Chart(ctx, config);
}

function combatOverviewValues(labels) {
  return labels.map(date => {
    return state.directions.reduce((sum, direction) => {
      return sum + numberValue(state.days[date]?.combat?.[direction]);
    }, 0);
  });
}

function buildCombatOverviewDatasets(labels) {
  const datasets = state.directions.map(direction => {
    return chartDataset(direction, labels.map(date => numberValue(state.days[date]?.combat?.[direction])), "bar", {
      backgroundColor: directionColor(direction),
      stack: "combat"
    });
  });

  if (combatMA) {
    datasets.push(chartDataset(`${combatMA}日总数均线`, movingAverage(combatOverviewValues(labels), combatMA), "line", {
      borderColor: "#111",
      backgroundColor: "#111",
      borderWidth: 3,
      pointRadius: 0
    }));
  }

  return datasets;
}

function buildCombatSingleDatasets(labels, direction) {
  const values = labels.map(date => numberValue(state.days[date]?.combat?.[direction]));
  const datasets = [
    chartDataset("击退进攻次数", values, "bar", { backgroundColor: directionColor(direction) })
  ];

  if (combatMA) {
    datasets.push(chartDataset(`${combatMA}日均线`, movingAverage(values, combatMA), "line", {
      borderColor: "#111",
      backgroundColor: "#111",
      borderWidth: 3,
      pointRadius: 0
    }));
  }

  return datasets;
}

function renderCombatDirectionList() {
  const box = document.getElementById("combatDirectionList");
  if (!box) return;
  box.innerHTML = "";

  state.directions.forEach(direction => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "direction-btn" + (selectedCombatDirection !== null && direction === selectedCombatDirection ? " active" : "");
    btn.textContent = direction;
    btn.addEventListener("click", () => {
      selectedCombatDirection = direction;
      renderCombatTab();
    });
    box.appendChild(btn);
  });
}

function renderCombatTab() {
  renderCombatDirectionList();

  const labels = filteredDates(combatRange);
  const isOverview = selectedCombatDirection === null;
  const datasets = isOverview
    ? buildCombatOverviewDatasets(labels)
    : buildCombatSingleDatasets(labels, selectedCombatDirection);

  const title = document.getElementById("combatChartTitle");
  const backBtn = document.getElementById("combatBackBtn");
  if (title) title.textContent = isOverview ? "交战数据 · 全部方向总览" : `交战数据 · ${selectedCombatDirection}`;
  backBtn?.classList.toggle("hidden", isOverview);

  combatChart = makeChart(
    document.getElementById("combatChart"),
    combatChart,
    {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          title: { display: true, text: isOverview ? "每日击退进攻次数 · 全部方向堆叠" : `每日击退进攻次数 · ${selectedCombatDirection}` },
          legend: { display: isOverview, position: "right" }
        },
        scales: {
          x: { stacked: isOverview },
          y: { stacked: isOverview, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    }
  );
}

function renderLossCategoryList() {
  const box = document.getElementById("lossCategoryList");
  if (!box) return;
  box.innerHTML = "";

  LOSS_CATEGORIES.forEach(category => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "direction-btn" + (selectedLossCategory !== null && category === selectedLossCategory ? " active" : "");
    btn.textContent = category;
    btn.addEventListener("click", () => {
      selectedLossCategory = category;
      renderLossTab();
    });
    box.appendChild(btn);
  });
}

function buildLossPieData(labels) {
  return LOSS_CATEGORIES.filter(category => category !== "人员").map(category => {
    return labels.reduce((sum, date) => sum + numberValue(state.days[date]?.losses?.[category]), 0);
  });
}

function buildPersonnelLineData(labels) {
  return labels.map(date => numberValue(state.days[date]?.losses?.["人员"]));
}

function renderLossTab() {
  renderLossCategoryList();

  const labels = filteredDates(lossRange);
  const isOverview = selectedLossCategory === null;
  const title = document.getElementById("lossChartTitle");
  const backBtn = document.getElementById("lossBackBtn");

  if (title) {
    title.textContent = isOverview
      ? "俄军损失 · 总览"
      : `俄军损失 · ${selectedLossCategory}`;
  }

  backBtn?.classList.toggle("hidden", isOverview);

  if (isOverview) {
    const container = document.querySelector("#lossChart")?.parentElement;

    if (container && !document.getElementById("personnelChart")) {
      container.classList.add("split-loss-overview");
      container.innerHTML = `
        <div class="chart-pane"><canvas id="lossChart"></canvas></div>
        <div class="chart-pane"><canvas id="personnelChart"></canvas></div>
      `;
    }

    const pieCategories = LOSS_CATEGORIES.filter(category => category !== "人员");

    lossChart = makeChart(
      document.getElementById("lossChart"),
      lossChart,
      {
        type: "pie",
        data: {
          labels: pieCategories,
          datasets: [{
            label: "损失总数",
            data: buildLossPieData(labels),
            backgroundColor: pieCategories.map((_, i) => LOSS_COLORS[i % LOSS_COLORS.length]),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "装备损失占比总览（不含人员）"
            },
            legend: {
              display: true,
              position: "right"
            }
          }
        }
      }
    );

    if (window.personnelChartInstance) {
      window.personnelChartInstance.destroy();
    }

    window.personnelChartInstance = new Chart(
      document.getElementById("personnelChart"),
      {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "人员损失",
            data: buildPersonnelLineData(labels),
            borderColor: "#111",
            backgroundColor: "#111",
            borderWidth: 3,
            pointRadius: 2,
            tension: 0,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            title: {
              display: true,
              text: "人员损失趋势"
            },
            legend: {
              display: true
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            }
          }
        }
      }
    );

    return;
  }
  
  const container = document.querySelector("#lossChart")?.closest(".split-loss-overview");

  if (container) {
    container.classList.remove("split-loss-overview");
    container.innerHTML = `<canvas id="lossChart"></canvas>`;
  
    if (window.personnelChartInstance) {
      window.personnelChartInstance.destroy();
      window.personnelChartInstance = null;
    }
  
    lossChart = null;
  }

  const values = labels.map(date =>
    numberValue(state.days[date]?.losses?.[selectedLossCategory])
  );

  const datasets = [
    chartDataset("每日损失", values, "bar", {
      backgroundColor: "#4a4632"
    })
  ];

  if (lossMA) {
    datasets.push(
      chartDataset(`${lossMA}日均线`, movingAverage(values, lossMA), "line", {
        borderColor: "#f59a00",
        backgroundColor: "#f59a00",
        borderWidth: 3,
        pointRadius: 0
      })
    );
  }

  lossChart = makeChart(
    document.getElementById("lossChart"),
    lossChart,
    {
      type: "bar",
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: `每日俄军损失 · ${selectedLossCategory}`
          },
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    }
  );
}

function bindChartControls() {
  const combatRangeSelect = document.getElementById("combatRangeSelect");
  const combatMASelect = document.getElementById("combatMASelect");
  const lossRangeSelect = document.getElementById("lossRangeSelect");
  const lossMASelect = document.getElementById("lossMASelect");

  if (combatRangeSelect) {
    combatRange = Number(combatRangeSelect.value);
    combatRangeSelect.addEventListener("change", () => {
      combatRange = Number(combatRangeSelect.value);
      renderCombatTab();
    });
  }

  if (combatMASelect) {
    combatMA = Number(combatMASelect.value);
    combatMASelect.addEventListener("change", () => {
      combatMA = Number(combatMASelect.value);
      renderCombatTab();
    });
  }

  if (lossRangeSelect) {
    lossRange = Number(lossRangeSelect.value);
    lossRangeSelect.addEventListener("change", () => {
      lossRange = Number(lossRangeSelect.value);
      renderLossTab();
    });
  }

  if (lossMASelect) {
    lossMA = Number(lossMASelect.value);
    lossMASelect.addEventListener("change", () => {
      lossMA = Number(lossMASelect.value);
      renderLossTab();
    });
  }

  document.getElementById("combatBackBtn")?.addEventListener("click", () => {
    selectedCombatDirection = null;
    renderCombatTab();
  });

  document.getElementById("lossBackBtn")?.addEventListener("click", () => {
    selectedLossCategory = null;
    renderLossTab();
  });
}


/* ---------- Worker API ---------- */
function ensureAdminKey() {
  if (!ADMIN_KEY) {
    ADMIN_KEY = prompt("输入后台密钥：") || "";

    if (ADMIN_KEY) {
      localStorage.setItem("gsua_admin_key", ADMIN_KEY);
    }
  }

  return ADMIN_KEY;
}

async function apiFetch(path, options = {}) {
  ensureAdminKey();

  const headers = {
    ...(options.headers || {}),
    "X-Admin-Key": ADMIN_KEY
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await res.json();
  }

  return await res.text();
}

async function loadDataFromGithub() {
  return await apiFetch("/load-data", {
    method: "GET"
  });
}

async function cropGsuaMap(file) {
  return new Promise(resolve => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const cropX = img.width * 0.35;
      const cropY = img.height * 0.125;

      const cropWidth = img.width - cropX;
      const cropHeight = img.height - cropY;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      canvas.toBlob(blob => {
        resolve(blob);
      }, "image/webp", 1);
    };

    img.src = URL.createObjectURL(file);
  });
}

async function uploadImageToGithub(file, date, direction) {
  const form = new FormData();

  form.append("file", file);
  form.append("date", date);
  form.append("direction", direction);

  return await apiFetch("/upload-image", {
    method: "POST",
    body: form
  });
}

async function saveDataToGithub() {
  saveAdminFormToState();

  return await apiFetch("/save-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(state)
  });
}

/* ---------- Admin ---------- */

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
      <button class="blue-btn outline" type="button" ${direction === UNKNOWN_DIRECTION ? "disabled" : ""}>删除</button>
    `;
    row.children[1]?.addEventListener("click", () => {
      if (direction === UNKNOWN_DIRECTION) return;
      if (!confirm(`删除方向：${direction}？所有日期中的该方向图片和交战数据也会删除。`)) return;
      state.directions = state.directions.filter(d => d !== direction);
      Object.values(state.days).forEach(day => {
        delete day.images?.[direction];
        delete day.combat?.[direction];
      });
      saveLocalState();
      renderAdmin();
    });
    box.appendChild(row);
  });
}

let activePasteTarget = null;

function setUploadProgress(message, kind = "info") {
  const status = document.getElementById("uploadProgressStatus");
  if (status) {
    status.textContent = message;
    status.dataset.kind = kind;
    status.classList.toggle("hidden", !message);
  }

  const floating = document.getElementById("floatingUploadStatus");
  if (floating) {
    floating.textContent = message;
    floating.dataset.kind = kind;
    floating.classList.toggle("hidden", !message);
  }
}

function setPasteTargetStatus(message) {
  const status = document.getElementById("pasteTargetStatus");
  if (status) status.textContent = message;
}

function showInstantImagePreview(zone, file, message = "正在上传，已先显示本地预览…") {
  if (!zone || !file) return;
  const url = URL.createObjectURL(file);
  zone.classList.add("has-image", "is-uploading");
  zone.innerHTML = `
    <img src="${url}" alt="本地预览">
    <span class="upload-badge">${escapeHtml(message)}</span>
  `;
  const img = zone.querySelector("img");
  if (img) img.onload = () => URL.revokeObjectURL(url);
}

function findPasteZone(date, direction) {
  return document.querySelector(`.paste-zone[data-date="${CSS.escape(date)}"][data-direction="${CSS.escape(direction)}"]`);
}

async function processImageUpload(file, date, direction, zone, sourceLabel = "图片") {
  if (!date || !direction) {
    alert("请先选择日期，并点击一个方向图片框。");
    return;
  }

  ensureDay(date);
  showInstantImagePreview(zone, file, "正在裁剪 / 上传…");
  setUploadProgress(`正在处理${sourceLabel}：${date} · ${direction}，请稍等…`, "working");

  try {
    const cropped = await cropGsuaMap(file);
    const croppedFile = new File([cropped], "map.webp", { type: "image/webp" });
    const result = await uploadImageToGithub(croppedFile, date, direction);

    setImageSrc(date, direction, result.path);
    saveLocalState();

    const liveZone = findPasteZone(date, direction) || zone;
    if (liveZone) {
      liveZone.classList.remove("is-uploading");
      liveZone.classList.add("has-image", "upload-ok");
      liveZone.innerHTML = `
        <img src="${escapeHtml(result.path)}" alt="${escapeHtml(direction)}">
        <span class="upload-badge success">已上传，正在同步数据…</span>
      `;
    }

    await saveDataToGithub();
    setUploadProgress(`已上传并同步：${date} · ${direction}`, "success");

    if (liveZone) {
      liveZone.classList.remove("is-uploading");
      liveZone.innerHTML = `<img src="${escapeHtml(result.path)}" alt="${escapeHtml(direction)}">`;
    }
  } catch (err) {
    const liveZone = findPasteZone(date, direction) || zone;
    if (liveZone) liveZone.classList.remove("is-uploading");
    setUploadProgress(`上传失败：${date} · ${direction}`, "error");
    alert("上传失败：" + err.message);
  }
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

  state.directions.filter(d => d !== UNKNOWN_DIRECTION).forEach(direction => {
    const card = document.createElement("div");
    card.className = "upload-card";
    const img = getImageSrc(date, direction);
    const changes = getImageChanges(date, direction);
    card.innerHTML = `
      <h3>${escapeHtml(direction)}</h3>
      <div class="upload-body">
        <div class="paste-zone ${img ? "has-image" : ""}" tabindex="0" data-date="${escapeHtml(date)}" data-direction="${escapeHtml(direction)}">
          ${img ? `<img src="${img}" alt="${escapeHtml(direction)}">` : `<span>点击选择文件，或复制图片后在此 Ctrl+V 粘贴</span>`}
        </div>
        <input class="file-input" type="file" accept="image/*">
        <div class="change-admin-tools">
          <button class="blue-btn outline mark-change-btn" type="button" ${img ? "" : "disabled"}>标注变化</button>
          <button class="blue-btn outline clear-change-btn" type="button" ${changes.length ? "" : "disabled"}>清空标注</button>
          <span class="change-count">${changes.length ? `已标注 ${changes.length} 处变化` : "未标注变化"}</span>
        </div>
      </div>
    `;

    const zone = card.querySelector(".paste-zone");
    const fileInput = card.querySelector("input");
    const markBtn = card.querySelector(".mark-change-btn");
    const clearBtn = card.querySelector(".clear-change-btn");
    zone?.addEventListener("click", () => {
      activePasteTarget = { date, direction };
    
      document.querySelectorAll(".paste-zone").forEach(el => {
        el.classList.remove("paste-active");
      });
    
      zone.classList.add("paste-active");
    
      setPasteTargetStatus(`当前粘贴目标：${direction} · ${date}。现在按 Ctrl+V 会直接传到这个方向。`);
      setUploadProgress(`已选择粘贴目标：${date} · ${direction}`, "info");
      zone.focus();
    });
    
    fileInput?.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      activePasteTarget = { date, direction };
      setPasteTargetStatus(`当前粘贴目标：${direction} · ${date}。`);
      processImageUpload(file, date, direction, zone, "选择的图片");
    });

    markBtn?.addEventListener("click", () => openChangeAnnotator(date, direction));
    clearBtn?.addEventListener("click", async () => {
      if (!confirm(`清空 ${date} · ${direction} 的所有变化标注？`)) return;
      setImageChanges(date, direction, []);
      saveLocalState();
      renderUploadGrid();
      setUploadProgress(`正在同步清空标注：${date} · ${direction}`, "working");
      try {
        await saveDataToGithub();
        setUploadProgress(`已清空并同步变化标注：${date} · ${direction}`, "success");
      } catch (err) {
        setUploadProgress(`标注已本地清空，但同步失败：${date} · ${direction}`, "error");
        alert("同步失败：" + err.message);
      }
    });

    grid.appendChild(card);
  });
}


function ensureChangeAnnotatorModal() {
  let modal = document.getElementById("changeAnnotatorModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "changeAnnotatorModal";
  modal.className = "change-modal hidden";
  modal.innerHTML = `
    <div class="change-modal-card">
      <div class="change-modal-head">
        <div>
          <strong id="changeModalTitle">标注变化</strong>
          <p>在图片上按住鼠标拖拽画框。框会按百分比保存，所以前端不同屏幕也能对齐。</p>
        </div>
        <button class="blue-btn outline" id="closeChangeModalBtn" type="button">关闭</button>
      </div>
      <div class="change-canvas-wrap" id="changeCanvasWrap">
        <img id="changeAnnotatorImage" alt="变化标注图片">
        <div class="change-draw-layer" id="changeDrawLayer"></div>
      </div>
      <div class="change-modal-actions">
        <button class="blue-btn" id="saveChangeBoxesBtn" type="button">保存标注</button>
        <button class="blue-btn outline" id="undoChangeBoxBtn" type="button">撤销最后一个框</button>
        <button class="blue-btn outline" id="clearChangeBoxesBtn" type="button">清空当前框</button>
        <span id="changeModalStatus">0 个框</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

let changeDraft = { date: null, direction: null, boxes: [], drawing: null };

function renderChangeDraftBoxes() {
  const modal = ensureChangeAnnotatorModal();
  const img = modal.querySelector("#changeAnnotatorImage");
  const wrap = modal.querySelector("#changeCanvasWrap");
  const layer = modal.querySelector("#changeDrawLayer");
  const status = modal.querySelector("#changeModalStatus");
  if (!img || !wrap || !layer) return;
  layer.innerHTML = "";
  const display = imageDisplayBox(img, wrap);
  changeDraft.boxes.forEach((box, i) => {
    const el = document.createElement("div");
    el.className = "change-box admin-change-box";
    el.innerHTML = `<span>${i + 1}</span>`;
    placePercentBox(el, box, display);
    layer.appendChild(el);
  });
  if (status) status.textContent = `${changeDraft.boxes.length} 个框`;
}

function pointerToImagePercent(e, img, wrap) {
  const display = imageDisplayBox(img, wrap);
  const rect = wrap.getBoundingClientRect();
  const x = ((e.clientX - rect.left - display.left) / display.width) * 100;
  const y = ((e.clientY - rect.top - display.top) / display.height) * 100;
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y))
  };
}

function openChangeAnnotator(date, direction) {
  const src = getImageSrc(date, direction);
  if (!src) {
    alert("这个方向还没有图片，先上传图片再标注变化。");
    return;
  }

  const modal = ensureChangeAnnotatorModal();
  const img = modal.querySelector("#changeAnnotatorImage");
  const wrap = modal.querySelector("#changeCanvasWrap");
  const title = modal.querySelector("#changeModalTitle");
  const closeBtn = modal.querySelector("#closeChangeModalBtn");
  const saveBtn = modal.querySelector("#saveChangeBoxesBtn");
  const undoBtn = modal.querySelector("#undoChangeBoxBtn");
  const clearBtn = modal.querySelector("#clearChangeBoxesBtn");

  changeDraft = {
    date,
    direction,
    boxes: getImageChanges(date, direction).map(box => ({ ...box })),
    drawing: null
  };

  if (title) title.textContent = `标注变化：${date} · ${direction}`;
  img.src = src;
  img.onload = renderChangeDraftBoxes;
  modal.classList.remove("hidden");
  requestAnimationFrame(renderChangeDraftBoxes);

  closeBtn.onclick = () => modal.classList.add("hidden");
  undoBtn.onclick = () => {
    changeDraft.boxes.pop();
    renderChangeDraftBoxes();
  };
  clearBtn.onclick = () => {
    changeDraft.boxes = [];
    renderChangeDraftBoxes();
  };
  saveBtn.onclick = async () => {
    setImageChanges(date, direction, changeDraft.boxes);
    saveLocalState();
    modal.classList.add("hidden");
    renderUploadGrid();
    setUploadProgress(`正在同步变化标注：${date} · ${direction}（${changeDraft.boxes.length} 个框）`, "working");
    try {
      await saveDataToGithub();
      setUploadProgress(`已保存并同步变化标注：${date} · ${direction}（${changeDraft.boxes.length} 个框）`, "success");
    } catch (err) {
      setUploadProgress(`标注已本地保存，但同步失败：${date} · ${direction}`, "error");
      alert("同步失败：" + err.message);
    }
  };

  wrap.onpointerdown = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    const start = pointerToImagePercent(e, img, wrap);
    changeDraft.drawing = { start };
  };

  wrap.onpointermove = e => {
    if (!changeDraft.drawing) return;
    const cur = pointerToImagePercent(e, img, wrap);
    const s = changeDraft.drawing.start;
    const box = {
      x: Math.min(s.x, cur.x),
      y: Math.min(s.y, cur.y),
      w: Math.abs(cur.x - s.x),
      h: Math.abs(cur.y - s.y)
    };
    const tempBoxes = [...changeDraft.boxes, box];
    const oldBoxes = changeDraft.boxes;
    changeDraft.boxes = tempBoxes;
    renderChangeDraftBoxes();
    changeDraft.boxes = oldBoxes;
  };

  wrap.onpointerup = e => {
    if (!changeDraft.drawing) return;
    const cur = pointerToImagePercent(e, img, wrap);
    const s = changeDraft.drawing.start;
    const box = {
      x: Math.round(Math.min(s.x, cur.x) * 100) / 100,
      y: Math.round(Math.min(s.y, cur.y) * 100) / 100,
      w: Math.round(Math.abs(cur.x - s.x) * 100) / 100,
      h: Math.round(Math.abs(cur.y - s.y) * 100) / 100
    };
    changeDraft.drawing = null;
    if (box.w >= 1 && box.h >= 1) changeDraft.boxes.push(box);
    renderChangeDraftBoxes();
  };
}

document.addEventListener("paste", e => {
  if (!isAdmin || !activePasteTarget) return;

  const item = [...e.clipboardData.items].find(i => i.type.startsWith("image/"));
  if (!item) return;

  e.preventDefault();

  const file = item.getAsFile();
  const { date, direction } = activePasteTarget;

  if (!date || !direction) {
    alert("请先选择日期，并点击一个方向图片框。");
    return;
  }

  processImageUpload(file, date, direction, findPasteZone(date, direction), "粘贴的图片");
});

function renderNumberInputs(containerId, entries, valueGetter, onInput) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = "";

  entries.forEach(name => {
    const row = document.createElement("div");
    row.className = "data-input-row";
    row.innerHTML = `
      <label>${escapeHtml(name)}</label>
      <input class="text-input" type="number" min="0" step="1" value="${valueGetter(name)}">
    `;
    row.querySelector("input").addEventListener("input", e => onInput(name, e.target.value));
    box.appendChild(row);
  });
}

function saveAdminFormToState() {
  const dateInput = document.getElementById("adminDate");
  const reportEditor = document.getElementById("reportEditor");
  const date = dateInput?.value;

  if (!date) return false;

  ensureDay(date);

  state.days[date].report = reportEditor?.value || "";

  document.querySelectorAll("#combatInputs .data-input-row").forEach(row => {
    const label = row.querySelector("label")?.textContent?.trim();
    const input = row.querySelector("input");

    if (label && input) {
      state.days[date].combat[label] = numberValue(input.value);
    }
  });

  document.querySelectorAll("#lossInputs .data-input-row").forEach(row => {
    const label = row.querySelector("label")?.textContent?.trim();
    const input = row.querySelector("input");

    if (label && input) {
      state.days[date].losses[label] = numberValue(input.value);
    }
  });

  saveLocalState();
  return true;
}

function renderAdmin() {
  const dateInput = document.getElementById("adminDate");
  const reportEditor = document.getElementById("reportEditor");
  const status = document.getElementById("adminStatus");

  if (dateInput && !dateInput.value) dateInput.value = getLatestDate() || new Date().toISOString().slice(0, 10);
  const date = dateInput?.value;
  ensureDay(date);

  if (reportEditor) reportEditor.value = state.days[date]?.report || "";
  if (status) status.textContent = `正在编辑：${date}。`;

  renderAdminDirections();
  renderUploadGrid();

  renderNumberInputs(
    "combatInputs",
    state.directions,
    direction => numberValue(state.days[date]?.combat?.[direction]),
    (direction, value) => {
      ensureDay(date);
      state.days[date].combat[direction] = numberValue(value);
      saveLocalState();
    }
  );

  renderNumberInputs(
    "lossInputs",
    LOSS_CATEGORIES,
    category => numberValue(state.days[date]?.losses?.[category]),
    (category, value) => {
      ensureDay(date);
      state.days[date].losses[category] = numberValue(value);
      saveLocalState();
    }
  );
}

function showAdminStatus(message) {
  const status = document.getElementById("adminStatus");
  if (status) status.textContent = message;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bindAdmin() {
  const dateInput = document.getElementById("adminDate");

  document.getElementById("loadAdminDateBtn")?.addEventListener("click", renderAdmin);

  document.getElementById("createDateBtn")?.addEventListener("click", () => {
    const date = dateInput?.value;
    if (!date) return alert("请选择日期。");

    ensureDay(date);
    saveAdminFormToState();
    saveLocalState();
    renderAdmin();

    showAdminStatus(`正在同步日期：${date} ...`);

    saveDataToGithub()
      .then(() => {
        showAdminStatus(`日期已保存并同步：${date}`);
        alert("日期已保存并同步到 GitHub。");
      })
      .catch(err => {
        showAdminStatus(`日期已保存到本地，但同步失败：${date}`);
        alert("日期已保存到本地，但同步失败：" + err.message);
      });
  });

  document.getElementById("saveAllBtn")?.addEventListener("click", () => {
    showAdminStatus("正在同步到 GitHub ...");

    saveDataToGithub()
      .then(() => {
        saveLocalState();
        showAdminStatus("已同步到 GitHub。前台刷新后会更新。");
        alert("已保存到 GitHub，前台刷新后会同步。");
      })
      .catch(err => {
        showAdminStatus("同步失败。");
        alert("保存失败：" + err.message);
      });
  });

  document.getElementById("reportEditor")?.addEventListener("input", saveAdminFormToState);

  document.getElementById("addDirectionBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newDirectionInput");
    const name = input.value.trim();
    if (!name) return;
    if (state.directions.includes(name)) return alert("该方向已存在。");
    state.directions.push(name);
    Object.keys(state.days).forEach(date => ensureDay(date));
    input.value = "";
    saveLocalState();
    renderAdmin();
  });

  document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    saveAdminFormToState();
    const text = JSON.stringify(state, null, 2);
    document.getElementById("jsonBox").value = text;
    downloadText("data.json", text);
  });

  document.getElementById("importJsonBtn")?.addEventListener("click", () => {
    const raw = document.getElementById("jsonBox").value;
    try {
      state = normalizeState(JSON.parse(raw));
      saveLocalState();
      renderAdmin();
      alert("导入成功。");
    } catch (e) {
      alert("JSON 格式不正确。");
    }
  });

  renderAdmin();
}

/* ---------- Interaction selected state ---------- */
function clearInteractionSelection() {
  document.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));
}

document.addEventListener("pointerdown", e => {
  const interactive = e.target.closest("button:not(:disabled), a, select, .paste-zone");
  if (!interactive || interactive.classList.contains("blank")) {
    clearInteractionSelection();
    return;
  }
  clearInteractionSelection();
  interactive.classList.add("is-selected");
});

document.addEventListener("keydown", e => {
  if (e.key === "Tab") clearInteractionSelection();
});

/* ---------- Init ---------- */
(async function init() {
  await loadState();

  selectedDate = getLatestDate();
  if (selectedDate) calendarMonth = selectedDate.slice(0, 7);

  selectedCombatDirection = null;
  selectedLossCategory = null;

  if (isViewer) {
    bindTabs();
    bindFrontlineControls();
    bindChartControls();
    renderViewer();
    renderCombatTab();
    renderLossTab();
  }

  if (isAdmin) {
    bindAdmin();
  }
})();
