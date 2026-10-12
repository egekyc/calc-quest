const Puzzle = (() => {
  'use strict';

  const OPS = {
    '+': { sym: '+', name: 'plus' },
    '-': { sym: '−', name: 'minus' },
    '*': { sym: '×', name: 'times' },
    '/': { sym: '÷', name: 'divided by' },
  };
  const OP_ORDER = ['+', '-', '*', '/'];

  const LEVELS = {
    easy: {
      name: 'EASY', mult: 1,
      numbers: [2, 3], opCount: [1, 2], pool: ['+', '-', '*'],
      min: 5, max: 60, distinct: false,
    },
    normal: {
      name: 'NORMAL', mult: 1.5,
      numbers: [3, 4], opCount: [2, 2], pool: ['+', '-', '*', '/'],
      min: 10, max: 120, distinct: false,
    },
    hard: {
      name: 'HARD', mult: 2,
      numbers: [4, 5], opCount: [2, 3], pool: ['+', '-', '*', '/'],
      min: 20, max: 300, distinct: true,
    },
  };

  const randInt = (lo, hi, rand) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function evaluate(tokens) {
    let total = 0;
    let sign = 1;
    let term = tokens[0];
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const n = tokens[i + 1];
      if (op === '*') term *= n;
      else if (op === '/') {
        if (term % n !== 0) return { value: null, error: 'uneven' };
        term /= n;
      } else {
        total += sign * term;
        sign = op === '+' ? 1 : -1;
        term = n;
      }
    }
    return { value: total + sign * term, error: null };
  }

  const numbersIn = (tokens) => tokens.filter((t) => typeof t === 'number');
  const opsIn = (tokens) => tokens.filter((t) => typeof t === 'string');

  function toText(tokens) {
    return tokens.map((t) => (typeof t === 'number' ? t : OPS[t].sym)).join('');
  }

  function makeDigits(count, distinct, rand) {
    if (distinct) return shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand).slice(0, count);
    return Array.from({ length: count }, () => randInt(1, 9, rand));
  }

  function generate(levelKey, rand = Math.random, avoid = new Set()) {
    const L = LEVELS[levelKey];
    const want = randInt(L.min, L.max, rand);
    for (let shape = 0; shape < 200; shape++) {
      const count = randInt(L.numbers[0], L.numbers[1], rand);
      const k = Math.min(randInt(L.opCount[0], L.opCount[1], rand), count - 1);
      const ops = shuffle(L.pool.slice(), rand).slice(0, k);

      let best = null;
      let found = 0;
      for (let attempt = 0; attempt < 400 && found < 25; attempt++) {
        const seq = ops.slice();
        while (seq.length < count - 1) seq.push(pick(ops, rand));
        shuffle(seq, rand);

        const digits = makeDigits(count, L.distinct, rand);
        const tokens = [digits[0]];
        seq.forEach((op, i) => tokens.push(op, digits[i + 1]));

        const { value, error } = evaluate(tokens);
        if (error || value < L.min || value > L.max) continue;

        if (tokens.some((t, i) => (t === '*' || t === '/') && tokens[i + 1] === 1)) continue;

        if (avoid.has(value)) continue;

        found++;
        if (!best || Math.abs(value - want) < Math.abs(best.value - want)) best = { value, tokens };
      }

      if (best) {
        const sortedOps = OP_ORDER.filter((op) => ops.includes(op));
        return { level: levelKey, target: best.value, ops: sortedOps, count, distinct: L.distinct, solution: best.tokens };
      }
    }
    throw new Error('Could not make a puzzle for ' + levelKey);
  }

  function check(tokens, puzzle) {
    if (!tokens.length) return { ok: false, reason: 'TYPE A NUMBER FIRST' };
    if (typeof tokens[tokens.length - 1] === 'string') return { ok: false, reason: 'END WITH A NUMBER' };

    const nums = numbersIn(tokens);
    if (nums.length !== puzzle.count) return { ok: false, reason: `USE ${puzzle.count} NUMBERS` };

    const used = opsIn(tokens);
    const bad = used.find((op) => !puzzle.ops.includes(op));
    if (bad) return { ok: false, reason: `${OPS[bad].sym} IS NOT ALLOWED` };
    const missing = puzzle.ops.filter((op) => !used.includes(op));
    if (missing.length) return { ok: false, reason: `YOU ALSO NEED ${missing.map((op) => OPS[op].sym).join(' ')}` };

    if (puzzle.distinct && new Set(nums).size !== nums.length) return { ok: false, reason: 'EACH DIGIT ONLY ONCE' };

    const { value, error } = evaluate(tokens);
    if (error) return { ok: false, reason: '÷ MUST COME OUT EVEN' };
    if (value !== puzzle.target) return { ok: false, reason: value > puzzle.target ? 'TOO HIGH' : 'TOO LOW', value };
    return { ok: true, value };
  }

  return { OPS, LEVELS, evaluate, generate, check, toText, numbersIn };
})();

if (typeof module !== 'undefined') module.exports = Puzzle;
