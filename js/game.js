(() => {
  'use strict';

  const ROUND = 10;
  const HINT_COST = 50;
  const OPS = Puzzle.OPS;
  const $ = (id) => document.getElementById(id);
  const isNum = (t) => typeof t === 'number';

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

    const Sound = (() => {
    let ctx = null;
    let on = store.get('calcquest.sound', true);

    function tone(freq, dur, type = 'square', delay = 0, vol = 0.04) {
      if (!on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
      } catch { /* no audio */ }
    }

    return {
      get on() { return on; },
      toggle() { on = !on; store.set('calcquest.sound', on); return on; },
      key() { tone(520, 0.05); },
      op() { tone(780, 0.05); },
      nope() { tone(140, 0.16, 'sawtooth', 0, 0.05); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', i * 0.08)); },
      skip() { [392, 330, 262].forEach((f, i) => tone(f, 0.12, 'triangle', i * 0.09, 0.05)); },
    };
  })();

  const screens = { menu: $('menu'), game: $('game'), summary: $('summary') };
  let best = store.get('calcquest.best', {});

  const S = {
    level: 'easy',
    index: 0,
    score: 0,
    puzzle: null,
    tokens: [],
    start: 0,
    hinted: false,
    done: false,
    flash: '', // 'win' | 'wrong' | 'reveal'
    history: [],
    seen: new Set(),
    shownSec: -1,
  };

  const put = (el, text, label) => el.replaceChildren(PixelNum.make(text, label));

  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    window.scrollTo(0, 0);
  }


  document.querySelectorAll('.px-text').forEach(PixelNum.pxify);

  function renderBest() {
    document.querySelectorAll('[data-best]').forEach((el) => put(el, String(best[el.dataset.best] || 0)));
  }

  document.querySelectorAll('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => startRound(btn.dataset.level));
  });

  const soundBtn = $('soundBtn');
  function renderSound() {
    soundBtn.textContent = Sound.on ? 'SOUND ON' : 'SOUND OFF';
    soundBtn.setAttribute('aria-pressed', String(Sound.on));
  }
  soundBtn.addEventListener('click', () => { Sound.toggle(); renderSound(); Sound.key(); });

  const keys = {};
  document.querySelectorAll('#keypad .key').forEach((btn) => {
    const k = btn.dataset.key;
    keys[k] = btn;
    if (/^[1-9]$/.test(k)) {
      btn.append(PixelNum.make(k));
      btn.setAttribute('aria-label', k);
    } else if (OPS[k]) {
      btn.dataset.op = k;
      btn.append(PixelNum.make(OPS[k].sym));
      btn.setAttribute('aria-label', OPS[k].name);
    }
    btn.addEventListener('click', () => press(k));
  });

  function startRound(level) {
    Object.assign(S, { level, index: 0, score: 0, history: [], seen: new Set() });
    show('game');
    newPuzzle();
  }

  function newPuzzle() {
    const p = Puzzle.generate(S.level, Math.random, S.seen);
    S.seen.add(p.target);
    Object.assign(S, { puzzle: p, tokens: [], hinted: false, done: false, flash: '', start: performance.now(), shownSec: -1 });

    put($('target'), String(p.target));
    $('taskOps').replaceChildren(...p.ops.map((op) => {
      const badge = document.createElement('span');
      badge.className = 'op-badge';
      badge.dataset.op = op;
      badge.append(PixelNum.make(OPS[op].sym, OPS[op].name));
      return badge;
    }));
    put($('taskCount'), String(p.count));

    $('hint').hidden = true;
    $('hintBtn').hidden = false;
    $('hintBtn').disabled = false;
    $('skipBtn').hidden = false;
    $('nextBtn').hidden = true;

    say('');
    render();
    hud();
  }

  function next() {
    S.index++;
    if (S.index >= ROUND) summary();
    else newPuzzle();
  }

  function press(k) {
    if (screens.game.hidden) return;
    if (S.done) {
      if (k === 'enter') next();
      return;
    }
    if (k === 'enter') return submit();
    if (k === 'back') {
      if (!S.tokens.length) return;
      S.tokens.pop();
      edited();
      return;
    }
    if (k === 'clear') {
      if (!S.tokens.length) return;
      S.tokens = [];
      edited();
      return;
    }
    if (/^[1-9]$/.test(k)) return addDigit(Number(k));
    if (OPS[k]) return addOp(k);
  }

  const numCount = () => S.tokens.filter(isNum).length;

  function addDigit(d) {
    if (isNum(S.tokens.at(-1))) return nope('NOW PICK AN OPERATION');
    if (S.puzzle.distinct && S.tokens.includes(d)) return nope('EACH DIGIT ONLY ONCE');
    S.tokens.push(d);
    Sound.key();
    edited(true);
    if (numCount() === S.puzzle.count) submit();
  }

  function addOp(op) {
    if (!S.puzzle.ops.includes(op)) return nope(`${OPS[op].sym} IS NOT IN THIS ONE`);
    if (!S.tokens.length) return nope('START WITH A NUMBER');
    if (!isNum(S.tokens.at(-1))) {
      S.tokens[S.tokens.length - 1] = op; // swap the operation
    } else if (numCount() >= S.puzzle.count) {
      return nope(`ONLY ${S.puzzle.count} NUMBERS`);
    } else {
      S.tokens.push(op);
    }
    Sound.op();
    edited(true);
  }

  function edited(added = false) {
    if (!added) Sound.key();
    S.flash = '';
    say('');
    render(added);
  }

  function nope(text) {
    Sound.nope();
    say(text, 'bad', true);
  }

  function submit() {
    const r = Puzzle.check(S.tokens, S.puzzle);
    if (r.ok) return win();
    Sound.nope();
    if (numCount() === S.puzzle.count) {
      S.flash = 'wrong';
      render();
    }
    say(r.reason, 'bad', true);
  }

  function win() {
    const secs = (performance.now() - S.start) / 1000;
    const speed = Math.max(0, Math.round(50 - secs * 2));
    const base = Math.max(0, 100 + speed - (S.hinted ? HINT_COST : 0));
    const pts = Math.round(base * Puzzle.LEVELS[S.level].mult);
    S.score += pts;
    S.history.push({ puzzle: S.puzzle, tokens: S.tokens.slice(), pts, solved: true, hinted: S.hinted });
    S.done = true;
    S.flash = 'win';
    Sound.win();
    finish();
    say(`SOLVED! +${pts}`, 'good');
  }

  function skip() {
    if (S.done) return;
    S.tokens = S.puzzle.solution.slice();
    S.history.push({ puzzle: S.puzzle, tokens: S.tokens.slice(), pts: 0, solved: false, hinted: S.hinted });
    S.done = true;
    S.flash = 'reveal';
    Sound.skip();
    finish();
    say('ONE WAY TO DO IT');
  }

  function hint() {
    if (S.hinted || S.done) return;
    S.hinted = true;
    const [first, op] = S.puzzle.solution;
    const el = $('hint');
    PixelNum.set(el, `TRY STARTING WITH ${first} ${OPS[op].sym}`);
    el.hidden = false;
    $('hintBtn').disabled = true;
    Sound.op();
  }

  function finish() {
    render();
    hud();
    $('hintBtn').hidden = true;
    $('skipBtn').hidden = true;
    $('nextBtn').hidden = false;
    $('nextBtn').textContent = S.index + 1 >= ROUND ? 'RESULTS ▶' : 'NEXT ▶';
    $('nextBtn').focus({ preventScroll: true });
  }

  $('hintBtn').addEventListener('click', hint);
  $('skipBtn').addEventListener('click', skip);
  $('nextBtn').addEventListener('click', () => { if (S.done) next(); });
  $('quitBtn').addEventListener('click', () => { renderBest(); show('menu'); });

  function say(text, tone = '', shake = false) {
    const el = $('message');
    el.className = 'message px-text';
    PixelNum.set(el, text);
    if (tone) el.classList.add(tone);
    if (shake) {
      void el.offsetWidth; // restart animation
      el.classList.add('shake');
    }
  }

  function render(added = false) {
    const { puzzle: p, tokens } = S;
    const slots = $('slots');
    slots.dataset.count = p.count;
    slots.className = 'slots';
    if (S.flash) {
      void slots.offsetWidth;
      slots.classList.add(S.flash);
    }

    const cells = [];
    for (let i = 0; i < p.count * 2 - 1; i++) {
      const numSlot = i % 2 === 0;
      const tok = tokens[i];
      const el = document.createElement('span');
      el.className = `slot ${numSlot ? 'num' : 'op'}`;
      el.style.setProperty('--i', i);
      if (tok !== undefined) {
        el.classList.add('filled');
        if (!numSlot) el.dataset.op = tok;
        el.append(PixelNum.make(numSlot ? String(tok) : OPS[tok].sym));
        if (added && i === tokens.length - 1) el.classList.add('new');
      } else if (i === tokens.length && !S.done) {
        el.classList.add('cursor');
      }
      cells.push(el);
    }
    slots.replaceChildren(...cells);
    slots.setAttribute('aria-label', tokens.length ? Puzzle.toText(tokens) : 'Empty');

    const res = $('result');
    const body = isNum(tokens.at(-1)) ? tokens : tokens.slice(0, -1);
    res.className = 'result';
    if (!body.length) {
      res.replaceChildren();
    } else {
      const { value, error } = Puzzle.evaluate(body);
      put(res, error ? '=?' : `=${value}`);
      if (S.flash === 'win') res.classList.add('good');
      else if (S.flash === 'wrong' || error) res.classList.add('bad');
    }

    for (let d = 1; d <= 9; d++) keys[d].disabled = S.done || (p.distinct && tokens.includes(d));
    for (const op of Object.keys(OPS)) {
      const allowed = p.ops.includes(op);
      keys[op].disabled = S.done || !allowed;
      keys[op].classList.toggle('off', !allowed);
    }
    keys.back.disabled = keys.clear.disabled = S.done;
    keys.enter.textContent = S.done ? 'NEXT' : 'OK';
    keys.enter.setAttribute('aria-label', S.done ? 'Next puzzle' : 'Check');
  }

  function hud() {
    put($('hudRound'), `${Math.min(S.index + 1, ROUND)}/${ROUND}`);
    put($('hudScore'), String(S.score));
    tick(true);
  }

  function tick(force = false) {
    if (screens.game.hidden || !S.puzzle) return;
    if (S.done && !force) return;
    const sec = Math.min(999, Math.floor((performance.now() - S.start) / 1000));
    if (sec === S.shownSec && !force) return;
    S.shownSec = sec;
    put($('hudTime'), String(sec), `${sec} seconds`);
  }
  setInterval(tick, 200);

  function summary() {
    const solved = S.history.filter((h) => h.solved).length;
    put($('sumScore'), String(S.score), `${S.score} points`);
    PixelNum.set($('sumSolved'), `SOLVED ${solved}/${ROUND}`);

    const isBest = S.score > 0 && S.score > (best[S.level] || 0);
    if (isBest) {
      best = { ...best, [S.level]: S.score };
      store.set('calcquest.best', best);
    }
    $('sumBest').hidden = !isBest;

    $('sumList').replaceChildren(...S.history.map((h) => {
      const li = document.createElement('li');
      li.className = 'sum-item' + (h.solved ? '' : ' skipped');

      const target = document.createElement('span');
      target.className = 'sum-target';
      put(target, String(h.puzzle.target));

      const expr = document.createElement('span');
      expr.className = 'sum-expr';
      expr.append(PixelNum.make(Puzzle.toText(h.tokens)));
      const note = h.solved ? (h.hinted ? 'HINT' : '') : 'SKIPPED';
      if (note) {
        const small = document.createElement('small');
        small.textContent = note;
        expr.append(small);
      }

      const pts = document.createElement('span');
      pts.className = 'sum-pts';
      put(pts, h.pts ? `+${h.pts}` : '0');

      li.append(target, expr, pts);
      return li;
    }));

    show('summary');
    $('againBtn').focus({ preventScroll: true });
  }

  $('againBtn').addEventListener('click', () => startRound(S.level));
  $('homeBtn').addEventListener('click', () => { renderBest(); show('menu'); });

  const KEYMAP = {
    '+': '+', '-': '-', '*': '*', x: '*', X: '*', '/': '/',
    Backspace: 'back', Delete: 'back', Escape: 'clear', Enter: 'enter', '=': 'enter',
  };

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || screens.game.hidden) return;
    const k = /^[1-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (!k) return;
    e.preventDefault(); // stops Enter from also clicking a button
    if (S.done && k === 'enter') return next();
    const btn = keys[k];
    if (btn) {
      btn.classList.add('down');
      setTimeout(() => btn.classList.remove('down'), 90);
    }
    press(k);
  });

  renderBest();
  renderSound();
  show('menu');
})();
