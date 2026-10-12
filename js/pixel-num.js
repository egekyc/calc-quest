const PixelNum = (() => {
  'use strict';

  const RAW = {
    0: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
    1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
    3: '####.|....#|....#|.###.|....#|....#|####.',
    4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
    5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '..##.|.#...|#....|####.|#...#|#...#|.###.',
    7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
    8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
    9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
    '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
    '−': '.....|.....|.....|#####|.....|.....|.....',
    '×': '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....',
    '÷': '.....|..#..|.....|#####|.....|..#..|.....',
    '=': '.....|.....|#####|.....|#####|.....|.....',
    '/': '.....|....#|...#.|..#..|.#...|#....|.....',
    '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  };
  const ALIAS = { '-': '−', '*': '×' };

  const paths = {};
  for (const [ch, rows] of Object.entries(RAW)) {
    let d = '';
    rows.split('|').forEach((row, y) => {
      [...row].forEach((c, x) => { if (c === '#') d += `M${x} ${y}h1v1h-1z`; });
    });
    paths[ch] = d;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function make(text, label) {
    const chars = [...String(text)].map((c) => ALIAS[c] || c);
    const cols = Math.max(1, chars.length * 6 - 1);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${cols} 7`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.width = `calc(var(--px) * ${cols})`;
    svg.style.height = 'calc(var(--px) * 7)';

    chars.forEach((c, i) => {
      if (!paths[c]) return; 
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', paths[c]);
      if (i) p.setAttribute('transform', `translate(${i * 6} 0)`);
      svg.append(p);
    });

    const span = document.createElement('span');
    span.className = 'pxnum';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', label || chars.join(''));
    span.append(svg);
    return span;
  }

  function pxify(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!/[0-9+−×÷=]/.test(node.nodeValue)) continue;
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/([0-9+−×÷=]+(?:\/[0-9]+)?)/).forEach((part, i) => {
        if (part) frag.append(i % 2 ? make(part) : part);
      });
      node.replaceWith(frag);
    }
    return el;
  }

  function set(el, text) {
    el.textContent = text;
    return pxify(el);
  }

  return { make, pxify, set };
})();
