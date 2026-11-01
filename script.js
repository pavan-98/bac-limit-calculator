'use strict';

/* ------------------------------------------------------------------ *
 * Constants & drink catalogue
 * ------------------------------------------------------------------ */

const ALCOHOL_ELIMINATION_RATE = 0.015; // % BAC burned off per hour
const INDIA_LEGAL_LIMIT = 0.03; // 0.03% BAC (30 mg / 100 ml blood)
const WARNING_THRESHOLD = INDIA_LEGAL_LIMIT * 0.8; // "too close" zone
const ALCOHOL_DENSITY = 0.789; // g/ml
const STANDARD_DRINK_GRAMS = 10; // one standard drink in India ≈ 10 g alcohol
const SESSION_MAX_AGE_HOURS = 24; // forget a drinking session after this
const MAX_HOURS_AGO = 24;
const HOUR_MS = 3600 * 1000;

const BEER_STRENGTHS = {
  light: 0.035, // 3.5% ABV
  regular: 0.05, // 5% ABV
  strong: 0.07, // 7% ABV
};

const BODY_WATER_RATIO = {
  male: 0.68,
  female: 0.55,
};

// Beer ABV comes from the selected beer strength, so beer entries have no abv.
const DRINKS = {
  small: { name: 'Small beer', volume: 330, emoji: '🍺', category: 'beer' },
  can: { name: 'Beer can', volume: 500, emoji: '🥫', category: 'beer' },
  full: { name: 'Big bottle', volume: 650, emoji: '🍾', category: 'beer' },
  pitcher: { name: 'Pitcher', volume: 1500, emoji: '🍻', category: 'beer' },

  shot30: { name: 'Small peg', volume: 30, abv: 0.4, emoji: '🥃', category: 'spirits' },
  shot60: { name: 'Large peg', volume: 60, abv: 0.4, emoji: '🥃', category: 'spirits' },
  shot90: { name: 'Patiala peg', volume: 90, abv: 0.4, emoji: '🥃', category: 'spirits' },
  quarter: { name: 'Quarter', volume: 180, abv: 0.4, emoji: '🍾', category: 'spirits' },
  half: { name: 'Half bottle', volume: 375, abv: 0.4, emoji: '🍾', category: 'spirits' },
  fullBottle: { name: 'Full bottle', volume: 750, abv: 0.4, emoji: '🍾', category: 'spirits' },

  wine: { name: 'Glass of wine', volume: 150, abv: 0.12, emoji: '🍷', category: 'other' },
  wineBottle: { name: 'Wine bottle', volume: 750, abv: 0.12, emoji: '🍷', category: 'other' },
  breezer: { name: 'Breezer / RTD', volume: 275, abv: 0.048, emoji: '🍹', category: 'other' },
};

/* ------------------------------------------------------------------ *
 * Pure calculation helpers (exported for tests)
 * ------------------------------------------------------------------ */

function drinkAbv(drinkId, beerStrength = 'regular') {
  const drink = DRINKS[drinkId];
  if (!drink) return 0;
  if (drink.category === 'beer') {
    return BEER_STRENGTHS[beerStrength] || BEER_STRENGTHS.regular;
  }
  return drink.abv;
}

// Grams of pure alcohol in everything consumed.
function calculateTotalAlcohol(counts, beerStrength = 'regular') {
  return Object.keys(counts || {}).reduce((total, id) => {
    const count = counts[id] || 0;
    const drink = DRINKS[id];
    if (!drink || count <= 0) return total;
    return total + drink.volume * drinkAbv(id, beerStrength) * ALCOHOL_DENSITY * count;
  }, 0);
}

// Widmark formula, minus what the body has already burned off.
function calculateWidmarkBAC(alcoholGrams, weight, gender, hours) {
  if (!weight || !BODY_WATER_RATIO[gender]) return 0;
  const bodyWaterMl = weight * BODY_WATER_RATIO[gender] * 1000;
  let bac = (alcoholGrams / bodyWaterMl) * 100;
  if (hours > 0) bac -= ALCOHOL_ELIMINATION_RATE * hours;
  return Math.max(0, bac);
}

// Hours until BAC falls to `target` (0 = fully sober).
function hoursUntil(bac, target = 0) {
  if (bac <= target) return 0;
  return (bac - target) / ALCOHOL_ELIMINATION_RATE;
}

// Kept for backwards compatibility: whole hours until fully sober.
function calculateSoberTime(currentBAC) {
  return Math.ceil(hoursUntil(currentBAC, 0));
}

function getLegalStatus(bac) {
  if (bac >= INDIA_LEGAL_LIMIT) {
    return { key: 'danger', status: 'ILLEGAL', class: 'danger' };
  }
  if (bac >= WARNING_THRESHOLD) {
    return { key: 'warning', status: 'CAUTION', class: 'warning' };
  }
  if (bac > 0) {
    return { key: 'low', status: 'LEGAL', class: 'safe' };
  }
  return { key: 'sober', status: 'LEGAL', class: 'safe' };
}

// Round a timestamp up to the next 5 minutes — always err on the late side.
function roundUpTo5Min(ts) {
  const step = 5 * 60 * 1000;
  return Math.ceil(ts / step) * step;
}

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatHoursAgo(hours) {
  if (hours < 1 / 12) return 'Just now';
  return `${formatDuration(hours * HOUR_MS)} ago`;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function isValidWeight(w) {
  return typeof w === 'number' && Number.isFinite(w) && w >= 30 && w <= 200;
}

/**
 * Everything the UI needs to show, from the current inputs.
 * Returns { state: 'needProfile' | 'needDrinks' | 'result', ... }.
 */
function computeResult(input, now = Date.now()) {
  const { weight, sex, counts, beerStrength, startTime } = input;
  const drinkCount = Object.values(counts || {}).reduce((s, c) => s + c, 0);
  const grams = calculateTotalAlcohol(counts, beerStrength);

  if (!isValidWeight(weight) || !BODY_WATER_RATIO[sex]) {
    return { state: 'needProfile', drinkCount, grams };
  }
  if (drinkCount === 0) {
    return { state: 'needDrinks', drinkCount, grams };
  }

  const hours = startTime ? Math.max(0, (now - startTime) / HOUR_MS) : 0;
  const bac = calculateWidmarkBAC(grams, weight, sex, hours);
  const status = getLegalStatus(bac);

  const at = (target) => roundUpTo5Min(now + hoursUntil(bac, target) * HOUR_MS);

  return {
    state: 'result',
    drinkCount,
    grams,
    hours,
    bac,
    status,
    timesLimit: bac / INDIA_LEGAL_LIMIT,
    legalAt: at(INDIA_LEGAL_LIMIT),
    safeAt: at(WARNING_THRESHOLD),
    soberAt: at(0),
  };
}

/* ------------------------------------------------------------------ *
 * App (browser only)
 * ------------------------------------------------------------------ */

function initApp() {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE = {
    weight: 'userWeight',
    sex: 'userGender',
    session: 'bacSession',
  };

  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      try {
        if (value === null || value === undefined || value === '') localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (e) {
        /* storage unavailable — app still works for this visit */
      }
    },
  };

  const emptyCounts = () => Object.fromEntries(Object.keys(DRINKS).map((id) => [id, 0]));

  const state = {
    weight: null,
    sex: null,
    beerStrength: 'regular',
    counts: emptyCounts(),
    startTime: null,
    profileCollapsed: false,
  };

  let lastResult = null;

  /* ---------- persistence ---------- */

  function loadState() {
    const w = parseFloat(storage.get(STORAGE.weight));
    if (isValidWeight(w)) state.weight = w;
    const s = storage.get(STORAGE.sex);
    if (BODY_WATER_RATIO[s]) state.sex = s;
    state.profileCollapsed = isValidWeight(state.weight) && !!state.sex;

    try {
      const session = JSON.parse(storage.get(STORAGE.session) || 'null');
      if (session) {
        const fresh =
          session.startTime && Date.now() - session.startTime < SESSION_MAX_AGE_HOURS * HOUR_MS;
        if (BEER_STRENGTHS[session.beerStrength]) state.beerStrength = session.beerStrength;
        if (fresh) {
          state.startTime = session.startTime;
          Object.keys(DRINKS).forEach((id) => {
            const c = parseInt(session.counts && session.counts[id], 10);
            state.counts[id] = Number.isFinite(c) && c > 0 ? c : 0;
          });
        }
      }
    } catch (e) {
      /* corrupted session — start fresh */
    }
  }

  function saveProfile() {
    storage.set(STORAGE.weight, isValidWeight(state.weight) ? String(state.weight) : null);
    storage.set(STORAGE.sex, state.sex);
  }

  function saveSession() {
    storage.set(
      STORAGE.session,
      JSON.stringify({
        startTime: state.startTime,
        counts: state.counts,
        beerStrength: state.beerStrength,
      })
    );
  }

  /* ---------- small UX helpers ---------- */

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buzz(pattern = 12) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        /* ignore */
      }
    }
  }

  function scrollToEl(el, focusEl) {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), 350);
  }

  function hoursAgo() {
    return state.startTime ? Math.max(0, (Date.now() - state.startTime) / HOUR_MS) : 0;
  }

  function setHoursAgo(h) {
    const clamped = Math.min(MAX_HOURS_AGO, Math.max(0, h));
    state.startTime = Date.now() - clamped * HOUR_MS;
    saveSession();
  }

  /* ---------- build drink tiles ---------- */

  function buildDrinkTiles() {
    Object.entries(DRINKS).forEach(([id, drink]) => {
      const grid = $(`.drink-grid[data-category="${drink.category}"]`);
      if (!grid) return;
      const tile = document.createElement('div');
      tile.className = 'drink';
      tile.dataset.id = id;
      tile.innerHTML = `
        <button type="button" class="drink-add" data-add="${id}">
          <span class="drink-emoji" aria-hidden="true">${drink.emoji}</span>
          <span class="drink-name">${drink.name}</span>
          <span class="drink-meta"></span>
          <span class="drink-count" aria-hidden="true">0</span>
        </button>
        <button type="button" class="drink-minus" data-remove="${id}">− Remove one</button>
      `;
      grid.appendChild(tile);
    });
  }

  function volumeLabel(ml) {
    return ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, '')} L` : `${ml} ml`;
  }

  /* ---------- toast with undo ---------- */

  let toastTimer = null;
  let undoAction = null;

  function showToast(text, undo) {
    const toast = $('#toast');
    $('#toast-text').textContent = text;
    undoAction = undo || null;
    $('#toast-undo').hidden = !undo;
    toast.hidden = false;
    toast.classList.remove('is-leaving');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4500);
  }

  function hideToast() {
    const toast = $('#toast');
    undoAction = null;
    toast.hidden = true;
  }

  /* ---------- actions ---------- */

  function changeDrink(id, delta, { silent = false } = {}) {
    const before = state.counts[id];
    const after = Math.max(0, before + delta);
    if (after === before) return;

    // The first drink starts the clock (unless the user already set it).
    if (!state.startTime && after > 0) state.startTime = Date.now();

    state.counts[id] = after;
    saveSession();
    buzz(delta > 0 ? 12 : [8, 40, 8]);
    render();

    const tile = $(`.drink[data-id="${id}"]`);
    if (tile && !prefersReducedMotion()) {
      tile.classList.remove('bump');
      void tile.offsetWidth; // restart animation
      tile.classList.add('bump');
    }

    if (!silent) {
      const name = DRINKS[id].name;
      showToast(
        delta > 0 ? `Added ${DRINKS[id].emoji} ${name} (${after})` : `Removed one ${name}`,
        () => changeDrink(id, -delta, { silent: true })
      );
    }
  }

  let resetArmed = false;
  let resetTimer = null;

  function handleReset() {
    const btn = $('#reset');
    if (!resetArmed) {
      resetArmed = true;
      btn.classList.add('is-armed');
      btn.textContent = 'Tap again to clear all drinks';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(disarmReset, 3500);
      return;
    }
    disarmReset();
    const snapshot = { counts: { ...state.counts }, startTime: state.startTime };
    state.counts = emptyCounts();
    state.startTime = null;
    saveSession();
    render();
    buzz([10, 30, 10]);
    showToast('Cleared all drinks', () => {
      state.counts = snapshot.counts;
      state.startTime = snapshot.startTime;
      saveSession();
      render();
    });
  }

  function disarmReset() {
    resetArmed = false;
    clearTimeout(resetTimer);
    const btn = $('#reset');
    btn.classList.remove('is-armed');
    btn.textContent = 'Start over';
  }

  function shareText() {
    const r = lastResult;
    if (r && r.state === 'result' && r.status.key === 'danger') {
      return `I've had a few drinks and shouldn't drive until about ${formatClock(r.legalAt)}. Can you help me get home? 🙏`;
    }
    return `I've had a few drinks and I'm not driving tonight. Can you help me get home? 🙏`;
  }

  async function askFriend() {
    const text = shareText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /* ---------- rendering ---------- */

  function renderProfile() {
    const weightInput = $('#weight');
    if (document.activeElement !== weightInput) {
      weightInput.value = state.weight != null ? String(state.weight) : '';
    }
    $$('[data-sex]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sex === state.sex)));

    const complete = isValidWeight(state.weight) && !!state.sex;
    const collapsed = complete && state.profileCollapsed;
    $('#profile-form').hidden = collapsed;
    $('#profile-summary').hidden = !collapsed;
    $('#profile').classList.toggle('is-done', complete);
    if (complete) {
      $('#profile-summary-text').textContent = `${state.weight} kg · ${state.sex === 'male' ? 'Male' : 'Female'}`;
    }
  }

  function renderTiming() {
    const ago = hoursAgo();
    $('#ago-value').textContent = formatHoursAgo(ago);
    $('#ago-clock').textContent = state.startTime ? `around ${formatClock(state.startTime)}` : 'starts when you add a drink';
    $$('.chip[data-ago]').forEach((chip) => {
      const h = Number(chip.dataset.ago);
      const active = state.startTime ? Math.abs(ago - h) < 0.1 : h === 0;
      chip.setAttribute('aria-pressed', String(active));
    });
    $('#timing').classList.toggle('is-done', !!state.startTime);
  }

  function renderDrinks() {
    $$('[data-strength]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.strength === state.beerStrength))
    );

    Object.entries(DRINKS).forEach(([id, drink]) => {
      const tile = $(`.drink[data-id="${id}"]`);
      if (!tile) return;
      const count = state.counts[id];
      const abvPct = +(drinkAbv(id, state.beerStrength) * 100).toFixed(1);
      tile.classList.toggle('has-count', count > 0);
      $('.drink-meta', tile).textContent = `${volumeLabel(drink.volume)} · ${abvPct}%`;
      $('.drink-count', tile).textContent = count;
      $('.drink-add', tile).setAttribute(
        'aria-label',
        `Add one ${drink.name}, ${volumeLabel(drink.volume)}. You have ${count}.`
      );
      const minus = $('.drink-minus', tile);
      minus.disabled = count === 0;
      minus.setAttribute('aria-label', `Remove one ${drink.name}`);
    });

    const total = Object.values(state.counts).reduce((s, c) => s + c, 0);
    const grams = calculateTotalAlcohol(state.counts, state.beerStrength);
    const std = grams / STANDARD_DRINK_GRAMS;
    $('#drink-total').textContent = total
      ? `${total} drink${total === 1 ? '' : 's'} · about ${Math.round(grams)} g alcohol (≈ ${std.toFixed(1)} standard drinks)`
      : '';
    $('#drinks').classList.toggle('is-done', total > 0);
    $('#reset').hidden = total === 0 && !state.startTime;
  }

  function gaugeHtml(r) {
    const max = Math.max(INDIA_LEGAL_LIMIT * 3, r.bac * 1.1);
    const pct = Math.min(100, (r.bac / max) * 100);
    const limitPct = (INDIA_LEGAL_LIMIT / max) * 100;
    return `
      <div class="gauge" role="img" aria-label="Estimated BAC ${r.bac.toFixed(3)} percent. Legal limit 0.03 percent.">
        <div class="gauge-track">
          <div class="gauge-fill" style="width:${pct.toFixed(1)}%"></div>
          <div class="gauge-limit" style="left:${limitPct.toFixed(1)}%"><span>limit</span></div>
        </div>
      </div>`;
  }

  function statsHtml(r) {
    const timesText =
      r.bac >= INDIA_LEGAL_LIMIT
        ? `${r.timesLimit.toFixed(1)}× limit`
        : r.bac > 0
          ? `${Math.round(r.timesLimit * 100)}%`
          : '—';
    return `
      <dl class="hero-stats">
        <div><dt>Your BAC</dt><dd>${r.bac.toFixed(3)}%</dd></div>
        <div><dt>vs limit</dt><dd>${timesText}</dd></div>
        <div><dt>Sober at</dt><dd>${r.bac > 0 ? formatClock(r.soberAt) : 'Now'}</dd></div>
      </dl>`;
  }

  function renderHero(r) {
    const hero = $('#result');
    const now = Date.now();
    let html = '';
    let bar = '';
    let tone = 'neutral';

    if (r.state === 'needProfile') {
      html = `
        <p class="hero-kicker">Had a few drinks?</p>
        <h1 class="hero-question">When can I drive?</h1>
        <p class="hero-lead">Answer 3 quick things and we'll tell you the time it's legal to drive again.</p>
        <button type="button" class="btn btn-primary btn-xl" data-goto="profile">Start — enter your weight</button>`;
    } else if (r.state === 'needDrinks') {
      html = `
        <p class="hero-kicker">Almost there</p>
        <h1 class="hero-question">What did you drink?</h1>
        <p class="hero-lead">Tap each drink you had below. Your answer updates instantly.</p>
        <button type="button" class="btn btn-primary btn-xl" data-goto="drinks">Add my drinks ↓</button>`;
    } else {
      const k = r.status.key;
      tone = k;
      if (k === 'danger') {
        html = `
          <div class="hero-status"><span class="hero-icon" aria-hidden="true">🚫</span><span>Don't drive</span></div>
          <p class="hero-sub">You're over India's legal limit.</p>
          <p class="hero-lead">You can drive after</p>
          <p class="hero-time">${formatClock(r.legalAt)}</p>
          <p class="hero-countdown">That's in <strong>${formatDuration(r.legalAt - now)}</strong></p>
          ${gaugeHtml(r)}
          ${statsHtml(r)}
          <a class="btn btn-primary btn-xl" href="#get-home">🚕 Get a ride home</a>`;
        bar = `Don't drive till ${formatClock(r.legalAt)}`;
      } else if (k === 'warning') {
        html = `
          <div class="hero-status"><span class="hero-icon" aria-hidden="true">⚠️</span><span>Too close</span></div>
          <p class="hero-sub">Just under the limit — one more sip could tip you over.</p>
          <p class="hero-lead">Safer to wait until</p>
          <p class="hero-time">${formatClock(r.safeAt)}</p>
          <p class="hero-countdown">That's in <strong>${formatDuration(r.safeAt - now)}</strong></p>
          ${gaugeHtml(r)}
          ${statsHtml(r)}
          <a class="btn btn-secondary btn-xl" href="#get-home">🚕 Get a ride home</a>`;
        bar = `Wait till ${formatClock(r.safeAt)}`;
      } else if (k === 'low') {
        html = `
          <div class="hero-status"><span class="hero-icon" aria-hidden="true">✅</span><span>Under the limit</span></div>
          <p class="hero-sub">Legally OK, but alcohol still slows your reactions.</p>
          <p class="hero-lead">Alcohol fully gone around</p>
          <p class="hero-time">${formatClock(r.soberAt)}</p>
          <p class="hero-countdown">That's in <strong>${formatDuration(r.soberAt - now)}</strong></p>
          ${gaugeHtml(r)}
          ${statsHtml(r)}`;
        bar = `Under the limit`;
      } else {
        html = `
          <div class="hero-status"><span class="hero-icon" aria-hidden="true">✅</span><span>Sober</span></div>
          <p class="hero-sub">By our estimate, the alcohol has left your blood.</p>
          <p class="hero-lead">Still feel off? Trust that feeling and don't drive.</p>
          ${statsHtml(r)}`;
        bar = 'Sober (estimated)';
      }
      html += `<p class="hero-note">Estimate only. When in doubt, don't drive.</p>`;
    }

    hero.dataset.state = r.state;
    hero.dataset.tone = tone;
    hero.innerHTML = html;

    const statusbar = $('#statusbar');
    statusbar.dataset.tone = tone;
    $('#statusbar-text').textContent = bar;
    statusbar.dataset.available = bar ? 'true' : 'false';
    updateStatusbarVisibility();

    $('#get-home').classList.toggle('is-urgent', r.state === 'result' && (tone === 'danger' || tone === 'warning'));
    document.documentElement.dataset.tone = tone;
  }

  let heroVisible = true;
  function updateStatusbarVisibility() {
    const statusbar = $('#statusbar');
    statusbar.hidden = !(statusbar.dataset.available === 'true' && !heroVisible);
  }

  function render() {
    lastResult = computeResult({
      weight: state.weight,
      sex: state.sex,
      counts: state.counts,
      beerStrength: state.beerStrength,
      startTime: state.startTime,
    });
    renderProfile();
    renderTiming();
    renderDrinks();
    renderHero(lastResult);
  }

  /* ---------- events ---------- */

  function bindEvents() {
    // Drinks (event delegation)
    $('#drinks').addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      const remove = e.target.closest('[data-remove]');
      const strength = e.target.closest('[data-strength]');
      if (add) changeDrink(add.dataset.add, +1);
      else if (remove) changeDrink(remove.dataset.remove, -1);
      else if (strength) {
        state.beerStrength = strength.dataset.strength;
        saveSession();
        buzz(8);
        render();
      }
    });

    $('#reset').addEventListener('click', handleReset);

    // Weight
    const weightInput = $('#weight');
    weightInput.addEventListener('input', () => {
      const w = parseFloat(weightInput.value);
      state.weight = isValidWeight(w) ? w : null;
      if (state.weight) $('#weight-error').hidden = true;
      saveProfile();
      render();
    });
    weightInput.addEventListener('blur', () => {
      const showError = weightInput.value !== '' && !isValidWeight(parseFloat(weightInput.value));
      $('#weight-error').hidden = !showError;
      weightInput.setAttribute('aria-invalid', String(showError));
    });
    $$('[data-weight-step]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.weightStep);
        const base = isValidWeight(state.weight) ? state.weight : null;
        const next = base === null ? 70 : Math.min(200, Math.max(30, Math.round(base) + delta));
        state.weight = next;
        weightInput.value = String(next);
        $('#weight-error').hidden = true;
        weightInput.setAttribute('aria-invalid', 'false');
        saveProfile();
        buzz(6);
        render();
      })
    );

    // Sex
    $$('[data-sex]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.sex = btn.dataset.sex;
        saveProfile();
        buzz(8);
        render();
      })
    );

    $('#save-profile').addEventListener('click', () => {
      if (!isValidWeight(state.weight)) {
        $('#weight-error').hidden = false;
        $('#weight').setAttribute('aria-invalid', 'true');
        $('#weight').focus();
        return;
      }
      if (!state.sex) {
        showToast('Pick Male or Female');
        $('[data-sex]').focus();
        return;
      }
      state.profileCollapsed = true;
      render();
      scrollToEl($('#timing'));
    });

    $('#edit-profile').addEventListener('click', () => {
      state.profileCollapsed = false;
      render();
      $('#weight').focus();
    });

    // Timing
    $$('[data-ago-step]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.agoStep);
        const ago = hoursAgo();
        // Snap to half hours so the numbers stay tidy.
        const next = dir > 0 ? Math.floor(ago * 2 + 0.01) / 2 + 0.5 : Math.ceil(ago * 2 - 0.01) / 2 - 0.5;
        setHoursAgo(next);
        buzz(6);
        render();
      })
    );
    $$('.chip[data-ago]').forEach((chip) =>
      chip.addEventListener('click', () => {
        setHoursAgo(Number(chip.dataset.ago));
        buzz(8);
        render();
      })
    );

    // Hero CTAs
    $('#result').addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (!go) return;
      if (go.dataset.goto === 'profile') {
        state.profileCollapsed = false;
        render();
        scrollToEl($('#profile'), $('#weight'));
      } else {
        scrollToEl($('#drinks'));
      }
    });

    // Bottom bar
    $('#statusbar').addEventListener('click', () => scrollToEl($('#result'), $('#result')));
    $('#toast-undo').addEventListener('click', () => {
      const fn = undoAction;
      hideToast();
      if (fn) fn();
    });

    $('#ask-friend').addEventListener('click', askFriend);

    // Show the mini status bar only when the big answer is off screen
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          heroVisible = entries[0].isIntersecting;
          updateStatusbarVisibility();
        },
        { threshold: 0.15 }
      );
      io.observe($('#result'));
    }

    // Time keeps moving — keep the answer live.
    setInterval(render, 30 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) render();
    });
  }

  /* ---------- boot ---------- */

  loadState();
  buildDrinkTiles();
  bindEvents();
  render();
  const yearEl = document.getElementById('copyright-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateTotalAlcohol,
    calculateWidmarkBAC,
    calculateSoberTime,
    getLegalStatus,
    hoursUntil,
    computeResult,
    drinkAbv,
    formatDuration,
    DRINKS,
    BEER_STRENGTHS,
    INDIA_LEGAL_LIMIT,
    WARNING_THRESHOLD,
  };
}
