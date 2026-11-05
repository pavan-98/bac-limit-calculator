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

// Indian police breathalysers show mg of alcohol per 100 ml of blood.
// The legal limit (0.03% BAC) is 30 on that scale.
const METER_LIMIT = Math.round(INDIA_LEGAL_LIMIT * 1000);

// Rounded down so the number never shows 30 while the app says "under the limit".
function bacToMeter(bac) {
  return Math.max(0, Math.floor(bac * 1000 + 1e-9));
}

function meterToBac(reading) {
  return reading / 1000;
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
          <div class="gauge-limit" style="left:${limitPct.toFixed(1)}%"><span>limit ${METER_LIMIT}</span></div>
        </div>
      </div>`;
  }

  // What a police breathalyser would roughly show right now.
  function meterHtml(r) {
    const reading = bacToMeter(r.bac);
    return `
      <a class="meter" href="#police-meter" aria-label="A police breathalyser would show about ${reading}. The limit is ${METER_LIMIT}. Tap to learn more.">
        <span class="meter-label">A police breathalyser would show about</span>
        <span class="meter-screen" aria-hidden="true">${reading}</span>
        <span class="meter-unit" aria-hidden="true">mg/100 ml · limit is ${METER_LIMIT} ›</span>
      </a>`;
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
        <h2 class="hero-question">When can I drive?</h2>
        <p class="hero-lead">Answer 3 quick things and we'll tell you the time it's legal to drive again.</p>
        <button type="button" class="btn btn-primary btn-xl" data-goto="profile">Start — enter your weight</button>`;
    } else if (r.state === 'needDrinks') {
      html = `
        <p class="hero-kicker">Almost there</p>
        <h2 class="hero-question">What did you drink?</h2>
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
          ${meterHtml(r)}
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
          ${meterHtml(r)}
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
          ${meterHtml(r)}
          ${gaugeHtml(r)}
          ${statsHtml(r)}`;
        bar = `Under the limit`;
      } else {
        html = `
          <div class="hero-status"><span class="hero-icon" aria-hidden="true">✅</span><span>Sober</span></div>
          <p class="hero-sub">By our estimate, the alcohol has left your blood.</p>
          <p class="hero-lead">Still feel off? Trust that feeling and don't drive.</p>
          ${meterHtml(r)}
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

  /* ---------- "Got a police reading?" converter ---------- */

  function renderMeterCheck() {
    const input = $('#meter-input');
    const out = $('#meter-result');
    if (!input || !out) return;
    const raw = input.value.trim();
    out.dataset.tone = '';
    if (raw === '') {
      out.innerHTML = '';
      return;
    }
    const reading = Number(raw);
    if (!Number.isFinite(reading) || reading < 0 || reading > 600) {
      out.dataset.tone = 'warning';
      out.innerHTML = '<p>Type the number shown on the meter (0 to 600).</p>';
      return;
    }

    const bac = meterToBac(reading);
    const now = Date.now();
    const underAt = roundUpTo5Min(now + hoursUntil(bac, INDIA_LEGAL_LIMIT) * HOUR_MS);
    const goneAt = roundUpTo5Min(now + hoursUntil(bac, 0) * HOUR_MS);
    const shown = +reading.toFixed(1);
    let html;

    if (reading === 0) {
      out.dataset.tone = 'low';
      html = '<p class="mr-head">0 means no alcohol detected</p>';
    } else if (bac >= INDIA_LEGAL_LIMIT) {
      out.dataset.tone = 'danger';
      html = `
        <p class="mr-head">Over the limit — don't drive</p>
        <p>${shown} = <strong>${bac.toFixed(3)}% BAC</strong>, about ${(bac / INDIA_LEGAL_LIMIT).toFixed(1)}× the limit.</p>
        <p>Under ${METER_LIMIT} around <strong>${formatClock(underAt)}</strong> (in about ${formatDuration(underAt - now)}).
        Alcohol gone around ${formatClock(goneAt)}.</p>`;
      if (reading >= 300) {
        html += `<p class="mr-warn">That's a dangerously high level. If someone is very drowsy, confused or vomiting, <a href="tel:108">call 108</a>.</p>`;
      }
    } else {
      out.dataset.tone = 'low';
      html = `
        <p class="mr-head">Under the limit</p>
        <p>${shown} = <strong>${bac.toFixed(3)}% BAC</strong>. Alcohol gone around <strong>${formatClock(goneAt)}</strong> (in about ${formatDuration(goneAt - now)}).</p>`;
    }
    if (reading > 0) {
      html += '<p class="mr-note">Assumes the test was just now. If you drank in the last hour, the number can still go up.</p>';
    }
    out.innerHTML = html;
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
    renderMeterCheck();
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
    $('#meter-input').addEventListener('input', renderMeterCheck);

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

/* ------------------------------------------------------------------ *
 * Installable app (PWA): install prompt + offline support
 * ------------------------------------------------------------------ */

// iOS share icon (square with an arrow), so people know what to look for.
const SHARE_ICON_SVG =
  '<svg class="share-glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 10H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';

function setupInstall() {
  const SNOOZE_KEY = 'installSnoozedAt';
  const SNOOZE_DAYS = 14;

  const ua = navigator.userAgent || '';
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Instagram, Facebook etc. open links in a built-in browser that can't install apps.
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|; wv\)/i.test(ua);
  const isMobile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const isStandalone = () =>
    !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;

  let deferredPrompt = null;
  let justInstalled = false;

  const snoozed = () => {
    try {
      return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < SNOOZE_DAYS * 864e5;
    } catch (e) {
      return false;
    }
  };
  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch (e) {
      /* ignore */
    }
  };

  // Which install path applies to this browser.
  function installKind() {
    if (isInAppBrowser) return 'inApp';
    if (deferredPrompt) return 'prompt';
    if (isIOS) return 'ios';
    return 'other';
  }

  const IOS_STEPS = `
    <ol class="install-steps">
      <li>Tap the <strong>Share</strong> button ${SHARE_ICON_SVG}</li>
      <li>Tap <strong>Add to Home Screen</strong> (scroll down if you don't see it)</li>
      <li>Tap <strong>Add</strong></li>
    </ol>`;

  const COPY = {
    prompt: 'Opens in one tap from your home screen and works with no internet.',
    ios: `Tap ${SHARE_ICON_SVG} <strong>Share</strong>, then <strong>Add to Home Screen</strong>.`,
    inApp: 'You\'re inside another app. Tap <strong>⋮</strong> or <strong>···</strong>, choose <strong>Open in browser</strong>, then install from there.',
    other: 'Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.',
  };

  function renderBanner() {
    const el = document.getElementById('install-banner');
    if (!el) return;
    const kind = installKind();
    const canShow =
      !isStandalone() &&
      !justInstalled &&
      !snoozed() &&
      (kind === 'prompt' || kind === 'ios' || (kind === 'inApp' && isMobile));
    el.hidden = !canShow;
    if (!canShow) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <div class="ib-row">
        <img src="icons/icon-192.png" alt="" width="48" height="48" />
        <div class="ib-text">
          <strong>Install the app</strong>
          <span>${COPY[kind]}</span>
        </div>
      </div>
      <div class="ib-actions">
        ${kind === 'prompt' ? '<button type="button" class="btn btn-primary" data-install="go">Install</button>' : ''}
        <button type="button" class="btn btn-secondary" data-install="later">Not now</button>
      </div>`;
  }

  function renderCard() {
    const card = document.getElementById('install-card');
    const body = document.getElementById('install-card-body');
    if (!card || !body) return;
    if (isStandalone()) {
      card.hidden = true; // already using the app
      return;
    }
    card.hidden = false;
    if (justInstalled) {
      body.innerHTML = '<p class="install-done">✓ Installed. Open it from your home screen.</p>';
      return;
    }
    const kind = installKind();
    const lead =
      '<p class="field-hint">Install it now, while you\'re clear-headed, so it\'s one tap away later. It works without internet.</p>';
    let html = lead;
    if (kind === 'prompt') {
      html += '<button type="button" class="btn btn-primary" data-install="go">📲 Install app</button>';
    } else if (kind === 'ios') {
      html += IOS_STEPS;
    } else {
      html += `<p class="install-text">${COPY[kind]}</p>`;
    }
    body.innerHTML = html;
  }

  function render() {
    renderBanner();
    renderCard();
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null; // a prompt can only be used once
    promptEvent.prompt(); // must run inside the tap
    try {
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'dismissed') snooze();
    } catch (e) {
      /* ignore */
    }
    render();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // use our own button instead of the browser's mini-bar
    deferredPrompt = e;
    render();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    justInstalled = true;
    render();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-install]');
    if (!btn) return;
    if (btn.dataset.install === 'go') promptInstall();
    else {
      snooze();
      render();
    }
  });

  if (window.matchMedia) {
    const mq = window.matchMedia('(display-mode: standalone)');
    if (mq.addEventListener) mq.addEventListener('change', render);
  }

  return { render };
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}

if (typeof document !== 'undefined') {
  // Listen for the install prompt as early as possible.
  const install = setupInstall();
  registerServiceWorker();

  const boot = () => {
    initApp();
    install.render();
    // Home-screen shortcuts open "./#drinks" etc. Jump there once the page is built.
    if (location.hash.length > 1) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateTotalAlcohol,
    calculateWidmarkBAC,
    calculateSoberTime,
    getLegalStatus,
    hoursUntil,
    bacToMeter,
    meterToBac,
    computeResult,
    drinkAbv,
    formatDuration,
    DRINKS,
    BEER_STRENGTHS,
    INDIA_LEGAL_LIMIT,
    WARNING_THRESHOLD,
  };
}
