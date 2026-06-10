const DB_NAME = "gympallao-db";
const DB_VERSION = 1;
const STORE_NAME = "app_state";
const STATE_KEY = "main";

const DEFAULT_COLOR = "#facc15";
const MAX_DAY_WORKOUTS = 3;

const els = {
  calendarTabBtn: document.getElementById("calendarTabBtn"),
  workoutsTabBtn: document.getElementById("workoutsTabBtn"),
  settingsBtn: document.getElementById("settingsBtn"),

  calendarScreen: document.getElementById("calendarScreen"),
  workoutsScreen: document.getElementById("workoutsScreen"),

  weekStatsCard: document.getElementById("weekStatsCard"),
  weekWorkoutCount: document.getElementById("weekWorkoutCount"),
  monthWorkoutCount: document.getElementById("monthWorkoutCount"),

  monthTitle: document.getElementById("monthTitle"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  calendarGrid: document.getElementById("calendarGrid"),

  workoutsList: document.getElementById("workoutsList"),
  addWorkoutBtn: document.getElementById("addWorkoutBtn"),

  dayModal: document.getElementById("dayModal"),
  dayModalTitle: document.getElementById("dayModalTitle"),
  dayWorkoutsList: document.getElementById("dayWorkoutsList"),
  addDayWorkoutBtn: document.getElementById("addDayWorkoutBtn"),
  dayWorkoutPicker: document.getElementById("dayWorkoutPicker"),
  dayWorkoutPickerList: document.getElementById("dayWorkoutPickerList"),

  workoutEditorModal: document.getElementById("workoutEditorModal"),
  closeWorkoutEditorBtn: document.getElementById("closeWorkoutEditorBtn"),
  workoutEditorTitle: document.getElementById("workoutEditorTitle"),
  editWorkoutNameBtn: document.getElementById("editWorkoutNameBtn"),
  workoutNameInput: document.getElementById("workoutNameInput"),
  workoutColorPreview: document.getElementById("workoutColorPreview"),
  workoutColorInput: document.getElementById("workoutColorInput"),
  editorExercisesList: document.getElementById("editorExercisesList"),
  addExerciseBtn: document.getElementById("addExerciseBtn"),

  settingsModal: document.getElementById("settingsModal"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  exportBackupBtn: document.getElementById("exportBackupBtn"),
  importBackupBtn: document.getElementById("importBackupBtn"),
  backupFileInput: document.getElementById("backupFileInput"),

  importChoiceModal: document.getElementById("importChoiceModal"),
  replaceImportBtn: document.getElementById("replaceImportBtn"),
  mergeImportBtn: document.getElementById("mergeImportBtn"),
  cancelImportBtn: document.getElementById("cancelImportBtn"),

  confirmDeleteModal: document.getElementById("confirmDeleteModal"),
  cancelDeleteWorkoutBtn: document.getElementById("cancelDeleteWorkoutBtn"),
  confirmDeleteWorkoutBtn: document.getElementById("confirmDeleteWorkoutBtn")
};

const now = new Date();

let visibleYear = now.getFullYear();
let visibleMonth = now.getMonth();

let selectedDateKey = null;
let selectedWorkoutId = null;
let workoutPendingDeleteId = null;
let pendingImportState = null;

let saveTimer = null;

let state = createEmptyState();

function createEmptyState() {
  return {
    id: STATE_KEY,
    appVersion: 1,
    workouts: [],
    logsByDate: {},
    currentValues: {},
    updatedAt: new Date().toISOString()
  };
}

/* =========================
   DATABASE
========================= */

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Errore apertura IndexedDB."));
  });
}

async function loadState() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);

    request.onsuccess = () => {
      const loaded = request.result;

      if (!loaded) {
        resolve(createEmptyState());
        return;
      }

      resolve(normalizeState(loaded));
    };

    request.onerror = () => reject(request.error || new Error("Errore lettura dati."));
  });
}

async function saveStateNow() {
  state.updatedAt = new Date().toISOString();

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const request = tx.objectStore(STORE_NAME).put(state);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Errore salvataggio dati."));
  });
}

function scheduleSave() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveStateNow().catch(error => {
      console.error(error);
      alert("Errore salvataggio dati: " + error.message);
    });
  }, 400);
}

function normalizeState(raw) {
  const safe = {
    ...createEmptyState(),
    ...raw
  };

  if (!Array.isArray(safe.workouts)) safe.workouts = [];
  if (!safe.logsByDate || typeof safe.logsByDate !== "object") safe.logsByDate = {};
  if (!safe.currentValues || typeof safe.currentValues !== "object") safe.currentValues = {};

  safe.workouts = safe.workouts.map((workout, index) => ({
    id: workout.id || makeId("w"),
    name: workout.name || "Senza nome",
    color: workout.color || DEFAULT_COLOR,
    order: Number.isFinite(workout.order) ? workout.order : index + 1,
    exercises: Array.isArray(workout.exercises)
      ? workout.exercises.map((exercise, exerciseIndex) => ({
          id: exercise.id || makeId("e"),
          name: exercise.name || "Nuovo esercizio",
          order: Number.isFinite(exercise.order) ? exercise.order : exerciseIndex + 1
        }))
      : []
  }));

  Object.keys(safe.logsByDate).forEach(dateKey => {
    const log = safe.logsByDate[dateKey];

    safe.logsByDate[dateKey] = {
      date: log.date || dateKey,
      workouts: Array.isArray(log.workouts)
        ? log.workouts.map((dayWorkout, workoutIndex) => ({
            id: dayWorkout.id || makeId("dw"),
            templateId: dayWorkout.templateId || null,
            templateName: dayWorkout.templateName || "Allenamento",
            color: dayWorkout.color || DEFAULT_COLOR,
            order: Number.isFinite(dayWorkout.order) ? dayWorkout.order : workoutIndex + 1,
            expanded: false,
            createdAt: dayWorkout.createdAt || new Date().toISOString(),
            exercises: Array.isArray(dayWorkout.exercises)
              ? dayWorkout.exercises.map((exercise, exerciseIndex) => ({
                  id: exercise.id || makeId("de"),
                  templateExerciseId: exercise.templateExerciseId || null,
                  name: exercise.name || "Esercizio",
                  value: exercise.value || "",
                  extra: Boolean(exercise.extra),
                  order: Number.isFinite(exercise.order) ? exercise.order : exerciseIndex + 1
                }))
              : []
          }))
        : []
    };
  });

  return safe;
}

/* =========================
   UTILS
========================= */

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toDateKey(date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey, amount) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hexToRgba(hex, alpha = 0.18) {
  const clean = String(hex || DEFAULT_COLOR).replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map(char => char + char).join("")
    : clean;

  const value = Number.parseInt(full, 16);

  if (Number.isNaN(value)) {
    return `rgba(250, 204, 21, ${alpha})`;
  }

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatShortDate(dateKey) {
  return fromDateKey(dateKey).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short"
  });
}

function blurActiveElement() {
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
}

function getActiveWorkouts() {
  return [...state.workouts].sort((a, b) => a.order - b.order);
}

function getWorkoutById(workoutId) {
  return state.workouts.find(workout => workout.id === workoutId) || null;
}

function getWorkoutExerciseById(workout, exerciseId) {
  return workout.exercises.find(exercise => exercise.id === exerciseId) || null;
}

function getCurrentValueKey(workoutId, exerciseId) {
  return `${workoutId}:${exerciseId}`;
}

function getCurrentValue(workoutId, exerciseId) {
  return state.currentValues[getCurrentValueKey(workoutId, exerciseId)]?.value || "";
}

function setCurrentValue(workoutId, exerciseId, value, source = "manual") {
  state.currentValues[getCurrentValueKey(workoutId, exerciseId)] = {
    value,
    source,
    updatedAt: new Date().toISOString()
  };
}

function isCurrentVisibleMonth() {
  return visibleYear === now.getFullYear() && visibleMonth === now.getMonth();
}

function getDayLog(dateKey) {
  return state.logsByDate[dateKey] || { date: dateKey, workouts: [] };
}

function setDayLog(dateKey, log) {
  if (!log.workouts.length) {
    delete state.logsByDate[dateKey];
    return;
  }

  log.workouts.forEach((workout, index) => {
    workout.order = index + 1;
  });

  state.logsByDate[dateKey] = log;
}

function getSortedDayWorkouts(log) {
  return [...log.workouts].sort((a, b) => a.order - b.order);
}

function getSortedExercises(exercises) {
  return [...exercises].sort((a, b) => a.order - b.order);
}


/* =========================
   SWIPE ELIMINA
========================= */

function closeSwipeCard(card) {
  if (!card) return;
  card.classList.remove("swipe-open");
  const content = card.querySelector(
    ".workout-card-content, .day-workout-card-content, .exercise-card-content"
  );
  if (content) content.style.transform = "";
}

function closeAllSwipeCards(exceptCard = null) {
  document.querySelectorAll(".swipe-open").forEach(card => {
    if (card !== exceptCard) closeSwipeCard(card);
  });
}

function setupSwipeToDelete(card, content, options = {}) {
  const enabled = options.enabled || (() => true);

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let tracking = false;
  let moved = false;

  content.addEventListener("pointerdown", event => {
    if (!enabled()) return;
    if (event.target.closest("input, textarea, select, button, .drag-handle")) return;

    tracking = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    currentX = card.classList.contains("swipe-open") ? -76 : 0;

    closeAllSwipeCards(card);
  });

  content.addEventListener("pointermove", event => {
    if (!tracking) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 14) {
      return;
    }

    const nextX = Math.min(0, Math.max(-76, currentX + dx));

    if (Math.abs(dx) > 6) {
      moved = true;
      event.preventDefault();
      content.style.transform = `translateX(${nextX}px)`;
    }
  });

  function finishSwipe(event) {
    if (!tracking) return;

    tracking = false;

    const raw = content.style.transform.match(/-?\d+(\.\d+)?/);
    const finalX = raw ? Number(raw[0]) : 0;

    content.style.transform = "";

    if (finalX < -38) {
      card.classList.add("swipe-open");
    } else {
      closeSwipeCard(card);
    }

    if (moved) {
      card.dataset.justSwiped = "1";
      setTimeout(() => {
        card.dataset.justSwiped = "0";
      }, 250);
    }
  }

  content.addEventListener("pointerup", finishSwipe);
  content.addEventListener("pointercancel", finishSwipe);
  content.addEventListener("pointerleave", finishSwipe);

  content.addEventListener("click", event => {
    if (card.dataset.justSwiped === "1") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (card.classList.contains("swipe-open")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSwipeCard(card);
    }
  }, true);
}


/* =========================
   DRAG & DROP
========================= */

function setupDragSort({
  container,
  itemSelector,
  handleSelector = ".drag-handle",
  canDrag = () => true,
  onReorder
}) {
  if (!container) return;

  container.querySelectorAll(itemSelector).forEach(item => {
    const handle = item.querySelector(handleSelector);
    if (!handle) return;

    handle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
    }, true);

    handle.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      if (!canDrag(item)) return;

      event.preventDefault();
      event.stopPropagation();

      closeAllSwipeCards();

      const rect = item.getBoundingClientRect();
      const placeholder = document.createElement("div");
      placeholder.className = "drag-placeholder";
      placeholder.style.height = `${rect.height}px`;

      container.insertBefore(placeholder, item);

      const offsetY = event.clientY - rect.top;
      const startLeft = rect.left;
      const startWidth = rect.width;
      const startHeight = rect.height;

      item.classList.add("dragging-card");
      item.style.left = `${startLeft}px`;
      item.style.top = `${rect.top}px`;
      item.style.width = `${startWidth}px`;
      item.style.height = `${startHeight}px`;

      document.body.classList.add("drag-active");
      document.body.appendChild(item);

      let hasMoved = false;

      function moveTo(clientY) {
        item.style.top = `${clientY - offsetY}px`;

        const siblings = [...container.querySelectorAll(itemSelector)]
          .filter(sibling => sibling !== item);

        let inserted = false;

        for (const sibling of siblings) {
          const siblingRect = sibling.getBoundingClientRect();
          const middle = siblingRect.top + siblingRect.height / 2;

          if (clientY < middle) {
            container.insertBefore(placeholder, sibling);
            inserted = true;
            break;
          }
        }

        if (!inserted) {
          container.appendChild(placeholder);
        }
      }

      function onPointerMove(moveEvent) {
        hasMoved = true;
        moveEvent.preventDefault();
        moveTo(moveEvent.clientY);
      }

      function finishDrag() {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);

        item.classList.remove("dragging-card");
        item.style.left = "";
        item.style.top = "";
        item.style.width = "";
        item.style.height = "";

        container.insertBefore(item, placeholder);
        placeholder.remove();

        document.body.classList.remove("drag-active");

        if (hasMoved) {
          item.dataset.justDragged = "1";
          setTimeout(() => {
            item.dataset.justDragged = "0";
          }, 250);
        }

        const orderedIds = [...container.querySelectorAll(itemSelector)]
          .map(element => element.dataset.dragId)
          .filter(Boolean);

        if (typeof onReorder === "function") {
          onReorder(orderedIds);
        }
      }

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
    });
  });
}

/* =========================
   CALENDARIO / STATS
========================= */

function getMonthGridDates(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const start = new Date(first);
  const firstDayMondayBased = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - firstDayMondayBased);

  const end = new Date(last);
  const lastDayMondayBased = (last.getDay() + 6) % 7;
  end.setDate(last.getDate() + (6 - lastDayMondayBased));

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function countWorkoutsBetween(startKey, endKey) {
  let count = 0;

  Object.values(state.logsByDate).forEach(log => {
    if (log.date >= startKey && log.date <= endKey) {
      count += log.workouts.length;
    }
  });

  return count;
}

function getWeekRangeForToday() {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;

  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: toDateKey(monday),
    end: toDateKey(sunday)
  };
}

function renderStats() {
  const monthStart = toDateKey(new Date(visibleYear, visibleMonth, 1));
  const monthEnd = toDateKey(new Date(visibleYear, visibleMonth + 1, 0));

  els.monthWorkoutCount.textContent = countWorkoutsBetween(monthStart, monthEnd);

  if (isCurrentVisibleMonth()) {
    els.weekStatsCard.classList.remove("hidden");
    const week = getWeekRangeForToday();
    els.weekWorkoutCount.textContent = countWorkoutsBetween(week.start, week.end);
  } else {
    els.weekStatsCard.classList.add("hidden");
  }
}

function renderCalendar() {
  const titleDate = new Date(visibleYear, visibleMonth, 1);

  els.monthTitle.textContent = titleDate.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric"
  });

  els.calendarGrid.innerHTML = "";

  const dates = getMonthGridDates(visibleYear, visibleMonth);
  const todayKey = toDateKey(now);

  dates.forEach(date => {
    const dateKey = toDateKey(date);
    const isCurrentMonth = date.getMonth() === visibleMonth && date.getFullYear() === visibleYear;

    const cell = document.createElement("button");
    cell.type = "button";

    const number = document.createElement("span");
    number.textContent = String(date.getDate());
    cell.appendChild(number);

    if (!isCurrentMonth) {
      cell.className = "day-cell out-month";
      cell.disabled = true;
    } else {
      const log = getDayLog(dateKey);
      cell.className = "day-cell";

      if (dateKey === todayKey) {
        cell.classList.add("today");
      }

      applyDayWorkoutColors(cell, getSortedDayWorkouts(log));

      cell.addEventListener("click", () => openDayModal(dateKey));
    }

    els.calendarGrid.appendChild(cell);
  });
}

function applyDayWorkoutColors(cell, dayWorkouts) {
  const colors = dayWorkouts.slice(0, 3).map(workout => workout.color);

  if (!colors.length) return;

  if (colors.length === 1) {
    cell.classList.add("one-workout");
    addDayColorLayer(cell, "day-color-full", colors[0]);
  }

  if (colors.length === 2) {
    cell.classList.add("two-workouts");
    addDayColorLayer(cell, "day-color-left", colors[0]);
    addDayColorLayer(cell, "day-color-right", colors[1]);
  }

  if (colors.length >= 3) {
    cell.classList.add("three-workouts");
    addDayColorLayer(cell, "day-color-top", colors[0]);
    addDayColorLayer(cell, "day-color-bottom-left", colors[1]);
    addDayColorLayer(cell, "day-color-bottom-right", colors[2]);
  }
}

function addDayColorLayer(cell, className, color) {
  const layer = document.createElement("div");
  layer.className = `day-color-layer ${className}`;
  layer.style.setProperty("--layer-color", color);
  cell.appendChild(layer);
}

function renderCalendarScreen() {
  renderStats();
  renderCalendar();
}

function goToPreviousMonth() {
  visibleMonth--;

  if (visibleMonth < 0) {
    visibleMonth = 11;
    visibleYear--;
  }

  renderCalendarScreen();
}

function goToNextMonth() {
  visibleMonth++;

  if (visibleMonth > 11) {
    visibleMonth = 0;
    visibleYear++;
  }

  renderCalendarScreen();
}


/* =========================
   SCHERMATE
========================= */

function showScreen(screenName) {
  const isCalendar = screenName === "calendar";

  els.calendarScreen.classList.toggle("active-screen", isCalendar);
  els.workoutsScreen.classList.toggle("active-screen", !isCalendar);

  els.calendarTabBtn.classList.toggle("active", isCalendar);
  els.workoutsTabBtn.classList.toggle("active", !isCalendar);

  if (isCalendar) renderCalendarScreen();
  else renderWorkoutsScreen();
}

/* =========================
   SCHEDE
========================= */

function renderWorkoutsScreen() {
  els.workoutsList.innerHTML = "";

  const activeWorkouts = getActiveWorkouts();

  if (!activeWorkouts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div>
        <div class="empty-state-icon">+</div>
        <strong>Nessuna scheda ancora</strong>
        <span>Crea la tua prima scheda allenamento e inizia a riempire il calendario.</span>
      </div>
    `;
    els.workoutsList.appendChild(empty);
  }

  activeWorkouts.forEach(workout => {
    const card = document.createElement("article");
    card.className = "workout-card";
    card.dataset.dragId = workout.id;

    const underlay = document.createElement("div");
    underlay.className = "delete-underlay";
    underlay.innerHTML = `<button type="button" aria-label="Elimina">×</button>`;

    const content = document.createElement("div");
    content.className = "workout-card-content";
    content.style.setProperty("--card-color", workout.color);
    content.style.setProperty("--card-bg", hexToRgba(workout.color, 0.20));
    content.style.setProperty("--card-border", hexToRgba(workout.color, 0.38));

    const lastDone = getLastDoneDateForWorkout(workout.id);

    content.innerHTML = `
      <span class="color-dot"></span>
      <div>
        <p class="card-title">${escapeHtml(workout.name)}</p>
        <p class="card-subtitle">
          ${workout.exercises.length} esercizi · ${lastDone ? `Ultimo svolto: ${formatShortDate(lastDone)}` : "Mai svolta"}
        </p>
      </div>
      <span class="drag-handle">⋮⋮</span>
    `;

    content.addEventListener("click", () => openWorkoutEditor(workout.id));

    underlay.querySelector("button").addEventListener("click", event => {
      event.stopPropagation();
      requestDeleteWorkout(workout.id);
      closeSwipeCard(card);
    });

    setupSwipeToDelete(card, content);

    card.appendChild(underlay);
    card.appendChild(content);
    els.workoutsList.appendChild(card);
  });

  setupDragSort({
    container: els.workoutsList,
    itemSelector: ".workout-card",
    onReorder: ids => {
      ids.forEach((id, index) => {
        const workout = getWorkoutById(id);
        if (workout) workout.order = index + 1;
      });

      scheduleSave();
      renderWorkoutsScreen();
    }
  });
}

function getLastDoneDateForWorkout(workoutId) {
  let latest = null;

  Object.values(state.logsByDate).forEach(log => {
    const found = log.workouts.some(dayWorkout => dayWorkout.templateId === workoutId);

    if (found && (!latest || log.date > latest)) {
      latest = log.date;
    }
  });

  return latest;
}

function createNewWorkout() {
  const nextOrder = getActiveWorkouts().length + 1;

  const workout = {
    id: makeId("w"),
    name: "Nuova scheda",
    color: DEFAULT_COLOR,
    order: nextOrder,
    exercises: []
  };

  state.workouts.push(workout);

  scheduleSave();
  renderWorkoutsScreen();
  openWorkoutEditor(workout.id);
}

function openWorkoutEditor(workoutId) {
  selectedWorkoutId = workoutId;

  const workout = getWorkoutById(workoutId);
  if (!workout) return;

  els.workoutEditorTitle.textContent = workout.name;
  els.workoutNameInput.value = workout.name;
  els.workoutNameInput.classList.remove("hidden");

  els.workoutColorInput.value = workout.color;
  els.workoutColorPreview.style.background = workout.color;

  renderWorkoutEditorExercises(workout);

  els.workoutEditorModal.classList.remove("hidden");
}

function closeWorkoutEditor() {
  blurActiveElement();
  selectedWorkoutId = null;
  els.workoutEditorModal.classList.add("hidden");
}

function renderWorkoutEditorExercises(workout) {
  els.editorExercisesList.innerHTML = "";

  getSortedExercises(workout.exercises).forEach(exercise => {
    const card = document.createElement("article");
    card.className = "exercise-card";
    card.dataset.dragId = exercise.id;

    const underlay = document.createElement("div");
    underlay.className = "delete-underlay";
    underlay.innerHTML = `<button type="button" aria-label="Elimina">×</button>`;

    const content = document.createElement("div");
    content.className = "exercise-card-content";

    const nameInput = document.createElement("input");
    nameInput.className = "exercise-name-input";
    nameInput.type = "text";
    nameInput.value = exercise.name;

    const valueInput = document.createElement("input");
    valueInput.className = "exercise-value-input";
    valueInput.type = "text";
    valueInput.placeholder = "valore";
    valueInput.value = getCurrentValue(workout.id, exercise.id);

    nameInput.addEventListener("input", () => {
      exercise.name = nameInput.value || "Senza nome";
      scheduleSave();
      renderWorkoutsScreen();
    });

    valueInput.addEventListener("input", () => {
      setCurrentValue(workout.id, exercise.id, valueInput.value, "manual");
      scheduleSave();
    });

    content.innerHTML = `<span class="drag-handle">⋮⋮</span>`;
    content.appendChild(nameInput);
    content.appendChild(valueInput);

    underlay.querySelector("button").addEventListener("click", () => {
      workout.exercises = workout.exercises.filter(item => item.id !== exercise.id);
      delete state.currentValues[getCurrentValueKey(workout.id, exercise.id)];

      scheduleSave();
      renderWorkoutEditorExercises(workout);
      renderWorkoutsScreen();
    });

    setupSwipeToDelete(card, content);

    card.appendChild(underlay);
    card.appendChild(content);

    els.editorExercisesList.appendChild(card);
  });

  setupDragSort({
    container: els.editorExercisesList,
    itemSelector: ".exercise-card",
    onReorder: ids => {
      ids.forEach((id, index) => {
        const exercise = getWorkoutExerciseById(workout, id);
        if (exercise) exercise.order = index + 1;
      });

      scheduleSave();
      renderWorkoutEditorExercises(workout);
    }
  });
}

function addExerciseToSelectedWorkout() {
  const workout = getWorkoutById(selectedWorkoutId);
  if (!workout) return;

  const nextOrder = workout.exercises.length + 1;

  workout.exercises.push({
    id: makeId("e"),
    name: "Nuovo esercizio",
    order: nextOrder
  });

  scheduleSave();
  renderWorkoutEditorExercises(workout);
  renderWorkoutsScreen();
}

function enableWorkoutNameEdit() {
  const workout = getWorkoutById(selectedWorkoutId);
  if (!workout) return;

  els.workoutNameInput.classList.remove("hidden");
  els.workoutNameInput.focus();
  els.workoutNameInput.select();
}

function updateSelectedWorkoutName() {
  const workout = getWorkoutById(selectedWorkoutId);
  if (!workout) return;

  const newName = els.workoutNameInput.value.trim() || "Senza nome";

  workout.name = newName;
  els.workoutEditorTitle.textContent = newName;

  scheduleSave();
  renderWorkoutsScreen();
}

function updateSelectedWorkoutColor() {
  const workout = getWorkoutById(selectedWorkoutId);
  if (!workout) return;

  workout.color = els.workoutColorInput.value;
  els.workoutColorPreview.style.background = workout.color;

  /*
    Eccezione voluta:
    il cambio colore aggiorna anche tutto lo storico collegato alla stessa scheda.
  */
  Object.values(state.logsByDate).forEach(log => {
    log.workouts.forEach(dayWorkout => {
      if (dayWorkout.templateId === workout.id) {
        dayWorkout.color = workout.color;
      }
    });
  });

  scheduleSave();
  renderCalendarScreen();
  renderWorkoutsScreen();
}

function requestDeleteWorkout(workoutId) {
  workoutPendingDeleteId = workoutId;
  els.confirmDeleteModal.classList.remove("hidden");
}

function cancelDeleteWorkout() {
  workoutPendingDeleteId = null;
  els.confirmDeleteModal.classList.add("hidden");
}

function confirmDeleteWorkout() {
  const workout = getWorkoutById(workoutPendingDeleteId);

  if (workout) {
    state.workouts = state.workouts.filter(item => item.id !== workout.id);

    Object.keys(state.currentValues).forEach(key => {
      if (key.startsWith(`${workout.id}:`)) {
        delete state.currentValues[key];
      }
    });
  }

  workoutPendingDeleteId = null;
  els.confirmDeleteModal.classList.add("hidden");

  scheduleSave();
  renderWorkoutsScreen();
  renderCalendarScreen();
}

/* =========================
   POPUP GIORNO
========================= */

function openDayModal(dateKey) {
  selectedDateKey = dateKey;

  els.dayModalTitle.textContent = fromDateKey(dateKey).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  els.dayWorkoutPicker.classList.add("hidden");
  renderDayModal();
  els.dayModal.classList.remove("hidden");
}

function closeDayModal() {
  blurActiveElement();
  els.dayModal.classList.add("hidden");
  selectedDateKey = null;
}

function renderDayModal() {
  if (!selectedDateKey) return;

  const log = getDayLog(selectedDateKey);
  const dayWorkouts = getSortedDayWorkouts(log);

  els.dayWorkoutsList.innerHTML = "";

  if (!dayWorkouts.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "empty-state empty-state-button";
    empty.innerHTML = `
      <div>
        <strong>Nessun allenamento</strong>
        <span>Aggiungi una scheda per registrare cosa hai fatto in questo giorno.</span>
      </div>
    `;

    empty.addEventListener("click", () => {
      if (!els.dayWorkoutPicker.classList.contains("hidden")) return;
      toggleWorkoutPicker();
    });

    els.dayWorkoutsList.appendChild(empty);
  }

  dayWorkouts.forEach(dayWorkout => {
    const card = document.createElement("article");
    card.className = "day-workout-card";
    card.dataset.dragId = dayWorkout.id;
    card.dataset.compact = dayWorkout.expanded ? "0" : "1";

    const underlay = document.createElement("div");
    underlay.className = "delete-underlay";
    underlay.innerHTML = `<button type="button" aria-label="Elimina">×</button>`;

    const content = document.createElement("div");
    content.className = "day-workout-card-content";
    if (dayWorkout.expanded) content.classList.add("is-expanded");
    content.style.setProperty("--card-color", dayWorkout.color);
    content.style.setProperty("--card-bg", hexToRgba(dayWorkout.color, 0.20));
    content.style.setProperty("--card-border", hexToRgba(dayWorkout.color, 0.38));

    const top = document.createElement("div");
    top.className = "day-workout-top";
    top.innerHTML = `
      <span class="color-dot"></span>
      <div>
        <p class="card-title">${escapeHtml(dayWorkout.templateName)}</p>
        <p class="card-subtitle">${dayWorkout.exercises.length} esercizi</p>
      </div>
      <span class="drag-handle">⋮⋮</span>
    `;

    top.addEventListener("click", () => {
      toggleDayWorkoutExpanded(dayWorkout.id);
    });

    content.appendChild(top);

    if (dayWorkout.expanded) {
      const details = document.createElement("div");
      details.className = "day-workout-details open";
      details.dataset.detailsFor = dayWorkout.id;

      const detailsInner = document.createElement("div");
      detailsInner.className = "day-workout-details-inner";

      const list = document.createElement("div");
      list.className = "exercise-list";

      getSortedExercises(dayWorkout.exercises).forEach(exercise => {
        list.appendChild(createDayExerciseCard(dayWorkout, exercise));
      });

      setupDragSort({
        container: list,
        itemSelector: ".exercise-card",
        onReorder: ids => {
          const byId = new Map(dayWorkout.exercises.map(exercise => [exercise.id, exercise]));

          dayWorkout.exercises = ids
            .map((id, index) => {
              const exercise = byId.get(id);
              if (exercise) exercise.order = index + 1;
              return exercise;
            })
            .filter(Boolean);

          scheduleSave();
        }
      });

      const addExtraBtn = document.createElement("button");
      addExtraBtn.className = "dashed-card small-dashed-card icon-only-card";
      addExtraBtn.type = "button";
      addExtraBtn.setAttribute("aria-label", "Aggiungi esercizio");
      addExtraBtn.innerHTML = `<span class="plus-icon">+</span>`;

      addExtraBtn.addEventListener("click", () => {
        dayWorkout.exercises.push({
          id: makeId("de_extra"),
          templateExerciseId: null,
          name: "Nuovo esercizio",
          value: "",
          extra: true,
          order: dayWorkout.exercises.length + 1
        });

        scheduleSave();
        renderDayModal();
      });

      detailsInner.appendChild(list);
      detailsInner.appendChild(addExtraBtn);
      details.appendChild(detailsInner);
      content.appendChild(details);

      requestAnimationFrame(() => {
        details.style.height = `${detailsInner.scrollHeight}px`;
      });
    }

    underlay.querySelector("button").addEventListener("click", () => {
      removeDayWorkout(dayWorkout.id);
      closeSwipeCard(card);
    });

    setupSwipeToDelete(card, content, {
      enabled: () => !dayWorkout.expanded
    });

    card.appendChild(underlay);
    card.appendChild(content);
    els.dayWorkoutsList.appendChild(card);
  });

  setupDragSort({
    container: els.dayWorkoutsList,
    itemSelector: ".day-workout-card",
    canDrag: item => item.dataset.compact === "1",
    onReorder: ids => {
      const log = getDayLog(selectedDateKey);
      const byId = new Map(log.workouts.map(workout => [workout.id, workout]));

      log.workouts = ids
        .map((id, index) => {
          const workout = byId.get(id);
          if (workout) workout.order = index + 1;
          return workout;
        })
        .filter(Boolean);

      setDayLog(selectedDateKey, log);

      scheduleSave();
      renderDayModal();
      renderCalendarScreen();
    }
  });

  if (dayWorkouts.length >= MAX_DAY_WORKOUTS) {
    els.addDayWorkoutBtn.disabled = true;
    els.addDayWorkoutBtn.innerHTML = `<span class="limit-icon">3/3</span>`;
    els.dayWorkoutPicker.classList.add("hidden");
  } else {
    els.addDayWorkoutBtn.disabled = false;
    els.addDayWorkoutBtn.innerHTML = `<span class="plus-icon">+</span>`;
  }
}

function toggleDayWorkoutExpanded(dayWorkoutId) {
  if (!selectedDateKey) return;

  const log = getDayLog(selectedDateKey);
  const dayWorkout = log.workouts.find(workout => workout.id === dayWorkoutId);
  if (!dayWorkout) return;

  if (!dayWorkout.expanded) {
    dayWorkout.expanded = true;
    renderDayModal();
    return;
  }

  const details = document.querySelector(`[data-details-for="${dayWorkoutId}"]`);

  if (!details) {
    dayWorkout.expanded = false;
    renderDayModal();
    return;
  }

  details.style.height = `${details.scrollHeight}px`;
  details.classList.add("closing");
  details.classList.remove("open");

  requestAnimationFrame(() => {
    details.style.height = "0px";
  });

  setTimeout(() => {
    dayWorkout.expanded = false;
    renderDayModal();
  }, 300);
}

function createDayExerciseCard(dayWorkout, exercise) {
  const card = document.createElement("article");
  card.className = "exercise-card";
  card.dataset.dragId = exercise.id;

  const underlay = document.createElement("div");
  underlay.className = "delete-underlay";
  underlay.innerHTML = `<button type="button" aria-label="Elimina">×</button>`;

  const content = document.createElement("div");
  content.className = "exercise-card-content";

  const nameInput = document.createElement("input");
  nameInput.className = "exercise-name-input";
  nameInput.type = "text";
  nameInput.value = exercise.name;

  const valueInput = document.createElement("input");
  valueInput.className = "exercise-value-input";
  valueInput.type = "text";
  valueInput.placeholder = "valore";
  valueInput.value = exercise.value || "";

  nameInput.addEventListener("input", () => {
    exercise.name = nameInput.value || "Senza nome";
    scheduleSave();
  });

  valueInput.addEventListener("input", () => {
    exercise.value = valueInput.value;

    if (
      dayWorkout.templateId &&
      exercise.templateExerciseId &&
      isLatestWorkoutForTemplate(dayWorkout.templateId, selectedDateKey)
    ) {
      setCurrentValue(dayWorkout.templateId, exercise.templateExerciseId, exercise.value, "daily");
    }

    scheduleSave();
  });

  content.innerHTML = `<span class="drag-handle">⋮⋮</span>`;
  content.appendChild(nameInput);
  content.appendChild(valueInput);

  underlay.querySelector("button").addEventListener("click", () => {
    dayWorkout.exercises = dayWorkout.exercises.filter(item => item.id !== exercise.id);

    dayWorkout.exercises.forEach((item, index) => {
      item.order = index + 1;
    });

    scheduleSave();
    renderDayModal();
  });

  setupSwipeToDelete(card, content);

  card.appendChild(underlay);
  card.appendChild(content);

  return card;
}

function isLatestWorkoutForTemplate(templateId, dateKey) {
  let latest = null;

  Object.values(state.logsByDate).forEach(log => {
    const found = log.workouts.some(dayWorkout => dayWorkout.templateId === templateId);

    if (found && (!latest || log.date > latest)) {
      latest = log.date;
    }
  });

  return latest === dateKey;
}

function toggleWorkoutPicker() {
  if (!selectedDateKey) return;

  const activeWorkouts = getActiveWorkouts();

  els.dayWorkoutPickerList.innerHTML = "";

  if (!activeWorkouts.length) {
    els.dayWorkoutPickerList.innerHTML = `
      <div class="picker-card">
        <div class="picker-card-content">
          <div>
            <p class="card-title">Nessuna scheda</p>
            <p class="card-subtitle">Creane una dalla sezione Schede.</p>
          </div>
        </div>
      </div>
    `;
  } else {
    activeWorkouts.forEach(workout => {
      const card = document.createElement("button");
      card.className = "picker-card";
      card.type = "button";

      card.innerHTML = `
        <div class="picker-card-content" style="--card-color: ${workout.color}; --card-bg: ${hexToRgba(workout.color, 0.20)}; --card-border: ${hexToRgba(workout.color, 0.38)}">
          <span class="color-dot"></span>
          <div>
            <p class="card-title">${escapeHtml(workout.name)}</p>
            <p class="card-subtitle">${workout.exercises.length} esercizi</p>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        addWorkoutToSelectedDay(workout.id);
      });

      els.dayWorkoutPickerList.appendChild(card);
    });
  }

  els.dayWorkoutPicker.classList.toggle("hidden");
}

function makeDayWorkoutFromTemplate(template) {
  const sortedExercises = getSortedExercises(template.exercises);

  return {
    id: makeId("dw"),
    templateId: template.id,
    templateName: template.name,
    color: template.color,
    order: 1,
    expanded: false,
    createdAt: new Date().toISOString(),
    exercises: sortedExercises.map((exercise, index) => ({
      id: makeId("de"),
      templateExerciseId: exercise.id,
      name: exercise.name,
      value: getCurrentValue(template.id, exercise.id),
      extra: false,
      order: index + 1
    }))
  };
}

function addWorkoutToSelectedDay(workoutId) {
  const template = getWorkoutById(workoutId);
  if (!template || !selectedDateKey) return;

  const log = getDayLog(selectedDateKey);

  if (log.workouts.length >= MAX_DAY_WORKOUTS) return;

  const newDayWorkout = makeDayWorkoutFromTemplate(template);
  newDayWorkout.order = log.workouts.length + 1;

  log.workouts.push(newDayWorkout);
  setDayLog(selectedDateKey, log);

  els.dayWorkoutPicker.classList.add("hidden");

  scheduleSave();
  renderDayModal();
  renderCalendarScreen();
  renderWorkoutsScreen();
}

function removeDayWorkout(dayWorkoutId) {
  if (!selectedDateKey) return;

  const log = getDayLog(selectedDateKey);
  log.workouts = log.workouts.filter(workout => workout.id !== dayWorkoutId);

  setDayLog(selectedDateKey, log);

  scheduleSave();
  renderDayModal();
  renderCalendarScreen();
  renderWorkoutsScreen();
}

/* =========================
   BACKUP
========================= */

function exportBackup() {
  const date = toDateKey(new Date());
  const filename = `gympallao-backup-${date}.json`;

  const backup = {
    exportedAt: new Date().toISOString(),
    app: "GymPallao",
    data: state
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  link.remove();
  URL.revokeObjectURL(url);
}

function importBackupFromFile(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      pendingImportState = normalizeState(parsed.data || parsed);
      els.importChoiceModal.classList.remove("hidden");
    } catch (error) {
      console.error(error);
      alert("Backup non valido o errore durante l'import.");
      pendingImportState = null;
      els.backupFileInput.value = "";
    }
  };

  reader.readAsText(file);
}

async function applyPendingImport(mode) {
  if (!pendingImportState) return;

  try {
    if (mode === "replace") {
      state = pendingImportState;
    }

    if (mode === "merge") {
      mergeImportedState(pendingImportState);
    }

    await saveStateNow();

    pendingImportState = null;
    els.backupFileInput.value = "";

    selectedDateKey = null;
    selectedWorkoutId = null;

    closeImportChoice();
    closeSettings();
    closeWorkoutEditor();
    closeDayModal();

    renderCalendarScreen();
    renderWorkoutsScreen();

    alert("Backup importato correttamente.");
  } catch (error) {
    console.error(error);
    alert("Errore durante l'import del backup.");
  }
}

function closeImportChoice() {
  pendingImportState = null;
  els.backupFileInput.value = "";
  els.importChoiceModal.classList.add("hidden");
}

function mergeImportedState(incoming) {
  const existingWorkoutIds = new Set(state.workouts.map(workout => workout.id));

  incoming.workouts.forEach(workout => {
    if (!existingWorkoutIds.has(workout.id)) {
      state.workouts.push(workout);
    }
  });

  Object.entries(incoming.currentValues).forEach(([key, value]) => {
    if (!state.currentValues[key]) {
      state.currentValues[key] = value;
    }
  });

  Object.entries(incoming.logsByDate).forEach(([dateKey, log]) => {
    const currentLog = state.logsByDate[dateKey];

    if (!currentLog || !currentLog.workouts.length) {
      state.logsByDate[dateKey] = log;
    }
  });
}

/* =========================
   IMPOSTAZIONI / MODAL
========================= */

function openSettings() {
  els.settingsModal.classList.remove("hidden");
}

function closeSettings() {
  blurActiveElement();
  els.settingsModal.classList.add("hidden");
}

/* =========================
   SERVICE WORKER
========================= */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("./service-worker.js");
    console.log("Service worker registrato correttamente.");
  } catch (error) {
    console.warn("Service worker non registrato:", error);
  }
}

/* =========================
   EVENTI
========================= */

function bindEvents() {
  els.calendarTabBtn.addEventListener("click", () => showScreen("calendar"));
  els.workoutsTabBtn.addEventListener("click", () => showScreen("workouts"));
  els.settingsBtn.addEventListener("click", openSettings);

  els.prevMonthBtn.addEventListener("click", goToPreviousMonth);
  els.nextMonthBtn.addEventListener("click", goToNextMonth);

  els.addWorkoutBtn.addEventListener("click", createNewWorkout);

  els.addDayWorkoutBtn.addEventListener("click", toggleWorkoutPicker);

  els.closeWorkoutEditorBtn.addEventListener("click", closeWorkoutEditor);
  els.editWorkoutNameBtn.addEventListener("click", enableWorkoutNameEdit);
  els.workoutNameInput.addEventListener("input", updateSelectedWorkoutName);
  els.workoutNameInput.addEventListener("blur", () => {
    updateSelectedWorkoutName();
  });

  els.workoutColorInput.addEventListener("input", updateSelectedWorkoutColor);
  els.workoutColorPreview.addEventListener("click", () => els.workoutColorInput.click());
  els.addExerciseBtn.addEventListener("click", addExerciseToSelectedWorkout);

  els.closeSettingsBtn.addEventListener("click", closeSettings);

  els.exportBackupBtn.addEventListener("click", exportBackup);
  els.importBackupBtn.addEventListener("click", () => els.backupFileInput.click());
  els.backupFileInput.addEventListener("change", () => {
    const file = els.backupFileInput.files?.[0];
    if (file) importBackupFromFile(file);
  });

  els.replaceImportBtn.addEventListener("click", () => applyPendingImport("replace"));
  els.mergeImportBtn.addEventListener("click", () => applyPendingImport("merge"));
  els.cancelImportBtn.addEventListener("click", closeImportChoice);

  els.cancelDeleteWorkoutBtn.addEventListener("click", cancelDeleteWorkout);
  els.confirmDeleteWorkoutBtn.addEventListener("click", confirmDeleteWorkout);

  document.querySelectorAll("[data-close-modal]").forEach(backdrop => {
    backdrop.addEventListener("click", event => {
      const target = event.currentTarget.dataset.closeModal;

      if (document.activeElement && document.activeElement !== document.body) {
        blurActiveElement();
        return;
      }

      if (target === "day") closeDayModal();
      if (target === "workout-editor") closeWorkoutEditor();
      if (target === "settings") closeSettings();
    });
  });

  window.addEventListener("beforeunload", () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveStateNow().catch(() => {});
    }
  });
}

/* =========================
   START
========================= */

async function start() {
  state = await loadState();

  bindEvents();
  renderCalendarScreen();
  renderWorkoutsScreen();

  await registerServiceWorker();

  console.log("GymPallao avviata con IndexedDB.");
}

start().catch(error => {
  console.error(error);
  alert("Errore avvio GymPallao: " + error.message);
});
