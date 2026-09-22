const procedures = {
  significantChange: {
    title: "Art 49 - Significant changes",
    basis: "Procedure diagram §3.1",
    options: [
      { id: "completenessExtension", label: "Apply the completeness assessment extension (+10 WD)", default: false },
    ],
    steps: (state) => [
      { name: "Acknowledgement of receipt", days: 2, owner: "ESMA / NCA", detail: "Acknowledgement that the documentation has been received." },
      { name: "Completeness assessment", days: 10 + (state.completenessExtension ? 10 : 0), owner: "ESMA / NCA", detail: state.completenessExtension ? "Scenario with a 10 WD extension." : "Base scenario without an extension." },
      { name: "Risk assessment", days: 40, owner: "ESMA / NCA", detail: "Assessment and reporting to the NCA, ESMA and the College." },
      { name: "College opinion", days: 15, owner: "College", detail: "The College issues its opinion." },
      { name: "Validation", days: 10, owner: "ESMA / NCA", detail: "Final validation window shown in the procedure diagram." },
    ],
  },
  authorisation: {
    title: "Art 15 & 16 - Authorization & extension",
    basis: "Procedure diagram §4.1",
    options: [
      { id: "shortCompleteness", label: "Short completeness assessment (10 WD instead of 20)", default: false },
      { id: "shortRisk", label: "Short risk assessment (40 WD instead of 80)", default: false },
      { id: "riskExtension", label: "Apply the risk assessment extension (+10 WD)", default: false },
    ],
    steps: (state) => [
      { name: "Acknowledgement of receipt", days: 2, owner: "NCA", detail: "Acknowledgement that the application has been received." },
      { name: "Completeness assessment", days: state.shortCompleteness ? 10 : 20, owner: "NCA", detail: state.shortCompleteness ? "10 WD route." : "Standard 20 WD route." },
      { name: "NCA risk assessment", days: (state.shortRisk ? 40 : 80) + (state.riskExtension ? 10 : 0), owner: "NCA", detail: `${state.shortRisk ? "Short route" : "Standard route"}${state.riskExtension ? " with a 10 WD extension" : ""}.` },
      { name: "ESMA opinion", days: 15, owner: "ESMA", detail: "ESMA opinion on the draft decision." },
      { name: "College opinion", days: 15, owner: "College", detail: "College opinion; treated sequentially by the calculator." },
      { name: "NCA decision", days: 10, owner: "NCA", detail: "Final decision by the competent authority." },
    ],
  },
};

const el = (id) => document.getElementById(id);
const procedureSelect = el("procedure");
const startInput = el("start-date");
const optionsBox = el("scenario-options");
const timeline = el("timeline");
const holidays = new Set();
const customHolidays = new Set();
const removedItalianHolidays = new Set();
const holidayLabels = new Map();
let phaseDurations = [];

function isoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function parseLocal(value) {
  const [y,m,d] = value.split("-").map(Number);
  return new Date(y, m-1, d, 12);
}

function easterMonday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const monday = new Date(year, month - 1, day + 1, 12);
  return isoLocal(monday);
}

function italianPublicHolidays(year) {
  const fixed = [
    ["01-01", "New Year's Day"],
    ["01-06", "Epiphany"],
    ["04-25", "Liberation Day"],
    ["05-01", "Labour Day"],
    ["06-02", "Republic Day"],
    ["08-15", "Assumption Day"],
    ["11-01", "All Saints' Day"],
    ["12-08", "Immaculate Conception"],
    ["12-25", "Christmas Day"],
    ["12-26", "Saint Stephen's Day"],
  ];
  const entries = fixed.map(([date, name]) => ({ date: `${year}-${date}`, name }));
  entries.push({ date: easterMonday(year), name: "Easter Monday" });
  if (year >= 2026) entries.push({ date: `${year}-10-04`, name: "Saint Francis of Assisi" });
  return entries;
}

function refreshHolidays() {
  holidays.clear();
  holidayLabels.clear();
  if (startInput.value) {
    const startYear = parseLocal(startInput.value).getFullYear();
    [startYear, startYear + 1].forEach(year => {
      italianPublicHolidays(year).forEach(({ date, name }) => {
        if (!removedItalianHolidays.has(date)) {
          holidays.add(date);
          holidayLabels.set(date, name);
        }
      });
    });
  }
  customHolidays.forEach(date => holidays.add(date));
}

function formatDate(date, long = false) {
  return new Intl.DateTimeFormat("en-GB", long
    ? { weekday: "short", day: "2-digit", month: "long", year: "numeric" }
    : { day: "2-digit", month: "short", year: "numeric" }
  ).format(date);
}

function isWorkingDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !holidays.has(isoLocal(date));
}

function addWorkingDays(date, count) {
  const cursor = new Date(date);
  let added = 0;
  while (added < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor)) added += 1;
  }
  return cursor;
}

function workingDaysBetween(start, end) {
  const cursor = new Date(start);
  let count = 0;
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor)) count += 1;
  }
  return count;
}

function currentState() {
  return Object.fromEntries([...optionsBox.querySelectorAll("input[type=checkbox]")].map(input => [input.id, input.checked]));
}

function renderOptions() {
  const proc = procedures[procedureSelect.value];
  optionsBox.innerHTML = "<legend>Scenario</legend>";
  proc.options.forEach(option => {
    const label = document.createElement("label");
    label.className = "option";
    label.innerHTML = `<input id="${option.id}" type="checkbox" ${option.default ? "checked" : ""}><span>${option.label}</span>`;
    optionsBox.appendChild(label);
  });
}

function calculate() {
  if (!startInput.value) return;
  const proc = procedures[procedureSelect.value];
  const steps = proc.steps(currentState());
  let cursor = parseLocal(startInput.value);
  let total = 0;

  timeline.innerHTML = "";
  steps.forEach((step, index) => {
    const start = new Date(cursor);
    const maximumDate = addWorkingDays(start, step.days);
    const duration = Math.max(1, Math.min(phaseDurations[index] ?? step.days, step.days));
    cursor = addWorkingDays(start, duration);
    total += duration;
    const item = document.createElement("li");
    item.className = "step";
    item.innerHTML = `
      <label class="step-date">
        <span class="sr-only">Deadline for ${step.name}</span>
        <input class="step-date-input" type="date" data-step-index="${index}"
          value="${isoLocal(cursor)}" min="${isoLocal(addWorkingDays(start, 1))}"
          max="${isoLocal(maximumDate)}" aria-label="Deadline for ${step.name}">
      </label>
      <span class="step-dot" aria-hidden="true"></span>
      <div class="step-card">
        <strong>${step.name}</strong>
        <p>${step.owner} · From ${formatDate(start)}. ${step.detail}</p>
      </div>
      <span class="step-duration${duration < step.days ? " shortened" : ""}" title="Maximum ${step.days} working days">${duration < step.days ? `${duration} / ${step.days}` : step.days} WD</span>`;
    timeline.appendChild(item);
  });

  el("final-date").textContent = formatDate(cursor, true);
  el("total-wd").textContent = total;
  el("procedure-title").textContent = proc.title;
}

function resetPhaseDurations() {
  phaseDurations = [];
}

function renderHolidays() {
  const list = el("holiday-list");
  list.innerHTML = "";
  [...holidays].sort().forEach(date => {
    const chip = document.createElement("span");
    chip.className = "holiday-chip";
    const name = holidayLabels.get(date);
    chip.innerHTML = `${formatDate(parseLocal(date))}${name ? ` · ${name}` : ""}<button type="button" aria-label="Remove ${name || "excluded date"} ${date}" data-date="${date}">×</button>`;
    list.appendChild(chip);
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

procedureSelect.innerHTML = Object.entries(procedures).map(([id,p]) => `<option value="${id}">${p.title}</option>`).join("");
startInput.value = isoLocal(new Date());
renderOptions();
refreshHolidays();
renderHolidays();
calculate();

procedureSelect.addEventListener("change", () => { resetPhaseDurations(); renderOptions(); calculate(); });
optionsBox.addEventListener("change", () => { resetPhaseDurations(); calculate(); });
startInput.addEventListener("change", () => { refreshHolidays(); renderHolidays(); calculate(); });

timeline.addEventListener("change", (event) => {
  const input = event.target.closest(".step-date-input");
  if (!input) return;

  const index = Number(input.dataset.stepIndex);
  const previousValue = index === 0
    ? startInput.value
    : timeline.querySelector(`[data-step-index="${index - 1}"]`).value;
  if (!input.value) {
    showToast("Choose a deadline date");
    calculate();
    return;
  }

  const previousDate = parseLocal(previousValue);
  const selectedDate = parseLocal(input.value);
  const maximumDays = procedures[procedureSelect.value].steps(currentState())[index].days;

  if (selectedDate <= previousDate || !isWorkingDay(selectedDate)) {
    showToast("Choose a working day after the previous phase");
    calculate();
    return;
  }

  const duration = workingDaysBetween(previousDate, selectedDate);
  if (duration > maximumDays) {
    showToast(`This phase cannot exceed ${maximumDays} working days`);
    calculate();
    return;
  }

  phaseDurations[index] = duration;
  calculate();
});

el("add-holiday").addEventListener("click", () => {
  const value = el("holiday-date").value;
  if (!value) return;
  customHolidays.add(value);
  removedItalianHolidays.delete(value);
  el("holiday-date").value = "";
  refreshHolidays();
  renderHolidays();
  calculate();
});

el("holiday-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date]");
  if (!button) return;
  const date = button.dataset.date;
  customHolidays.delete(date);
  if (holidayLabels.has(date)) removedItalianHolidays.add(date);
  refreshHolidays();
  renderHolidays();
  calculate();
});

el("reset").addEventListener("click", () => {
  customHolidays.clear();
  removedItalianHolidays.clear();
  refreshHolidays();
  renderHolidays();
  renderOptions();
  resetPhaseDurations();
  calculate();
});

el("copy-summary").addEventListener("click", async () => {
  const proc = procedures[procedureSelect.value];
  const rows = [...timeline.querySelectorAll(".step")].map(step => {
    const name = step.querySelector("strong").textContent;
    const date = formatDate(parseLocal(step.querySelector(".step-date-input").value));
    const duration = step.querySelector(".step-duration").textContent;
    return `- ${name}: ${date} (${duration})`;
  });
  const text = `${proc.title}\nStart date: ${formatDate(parseLocal(startInput.value), true)}\nEstimated deadline: ${el("final-date").textContent}\n${rows.join("\n")}\n\nAssumptions: sequential stages; weekends and Italian national public holidays excluded; additional exclusions can be added manually.`;
  try { await navigator.clipboard.writeText(text); showToast("Summary copied"); }
  catch { showToast("Copy unavailable"); }
});
