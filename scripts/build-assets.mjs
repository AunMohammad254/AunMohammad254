// Generates the neon + 3D SVG assets used by README.md.
// Run with: node scripts/build-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(OUT, { recursive: true });

const C = {
  bg: '#07010f',
  sky: '#1a0533',
  magenta: '#ff3df2',
  cyan: '#00e5ff',
  violet: '#8b5cf6',
  lilac: '#c4b5fd',
  rose: '#ff2d55',
  lime: '#b6ff3b',
  white: '#f5f3ff',
  dim: '#8b8ba7',
};
const SANS = "'Segoe UI','Helvetica Neue',Arial,sans-serif";
const MONO = "'Cascadia Code','JetBrains Mono',Consolas,'Courier New',monospace";

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f1 = (n) => Math.round(n * 10) / 10;

// Seeded RNG so regenerating doesn't reshuffle the stars on every run.
let seed = 254;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const glow = (id, std, color) => `
  <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="${std}" result="b"/>
    ${color ? `<feFlood flood-color="${color}"/><feComposite in2="b" operator="in" result="b"/>` : ''}
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

const svg = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${body}
</svg>
`;

// ---------- wireframe solids (projected per frame, animated with SMIL) ----------

const PHI = (1 + Math.sqrt(5)) / 2;
const SOLIDS = {
  icosahedron: [
    [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
    [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
  ],
  octahedron: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  cube: [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))),
  tetrahedron: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
};

function solid(name) {
  const raw = SOLIDS[name];
  const len = Math.hypot(...raw[0]);
  const verts = raw.map((v) => v.map((c) => c / len));
  // Edges are the vertex pairs at the shortest distance apart.
  const pairs = [];
  let min = Infinity;
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(...verts[i].map((c, k) => c - verts[j][k]));
      pairs.push([i, j, d]);
      min = Math.min(min, d);
    }
  return { verts, edges: pairs.filter((p) => p[2] < min + 1e-6) };
}

function wireframe(name, cx, cy, r, { frames = 60, dur = 14, tilt = 0.45 } = {}) {
  const { verts, edges } = solid(name);
  const paths = [];
  for (let f = 0; f <= frames; f++) {
    const a = (f / frames) * Math.PI * 2;
    const b = tilt + Math.sin(a) * 0.25;
    const pts = verts.map(([x, y, z]) => {
      const x1 = x * Math.cos(a) + z * Math.sin(a);
      const z1 = -x * Math.sin(a) + z * Math.cos(a);
      const y2 = y * Math.cos(b) - z1 * Math.sin(b);
      const z2 = y * Math.sin(b) + z1 * Math.cos(b);
      const s = 3.2 / (3.2 - z2);
      return [cx + x1 * r * s, cy + y2 * r * s];
    });
    paths.push(edges.map(([i, j]) => `M${f1(pts[i][0])} ${f1(pts[i][1])}L${f1(pts[j][0])} ${f1(pts[j][1])}`).join(''));
  }
  return `<path d="${paths[0]}"><animate attributeName="d" dur="${dur}s" repeatCount="indefinite" values="${paths.join(';')}"/></path>`;
}

// ---------- perspective grid floor (lines scroll toward the viewer) ----------

function gridFloor({ width, horizon, bottom, color, depth = 780, period = 2.4 }) {
  const vp = width / 2;
  const dz = 6;
  const yAt = (z) => horizon + depth / z;
  const rows = [];
  for (let k = 1; k <= 22; k++) {
    const ys = [];
    const ops = [];
    for (let s = 0; s <= 8; s++) {
      const z = Math.max(k * dz - (s / 8) * dz, 0.4);
      const y = Math.min(yAt(z), bottom + 40);
      ys.push(f1(y));
      ops.push(f1(Math.min(1, ((y - horizon) / (bottom - horizon)) * 1.6 + 0.05)));
    }
    rows.push(`<rect x="0" width="${width}" height="1.6" y="${ys[0]}" fill="${color}">
      <animate attributeName="y" dur="${period}s" repeatCount="indefinite" values="${ys.join(';')}"/>
      <animate attributeName="opacity" dur="${period}s" repeatCount="indefinite" values="${ops.join(';')}"/></rect>`);
  }
  const cols = [];
  for (let i = -16; i <= 16; i++) {
    cols.push(`<line x1="${vp}" y1="${horizon}" x2="${vp + i * 110}" y2="${bottom + 40}"/>`);
  }
  return `<g stroke="${color}" stroke-width="1.4">${cols.join('')}</g>${rows.join('')}`;
}

// ---------- header ----------

function header() {
  const W = 1200, H = 420, HZ = 290;
  const stars = Array.from({ length: 70 }, () => {
    const x = f1(rand() * W), y = f1(rand() * (HZ - 20)), r = f1(rand() * 1.3 + 0.3);
    const d = f1(rand() * 4 + 2), dl = f1(rand() * 4);
    return `<circle cx="${x}" cy="${y}" r="${r}" style="animation-duration:${d}s;animation-delay:-${dl}s"/>`;
  }).join('');

  const sunStripes = [0, 1, 2, 3, 4, 5].map((i) => {
    const y = 210 + i * 14 + i * i * 0.8;
    return `<rect x="760" y="${f1(y)}" width="340" height="${f1(2 + i * 1.6)}" fill="#000"/>`;
  }).join('');

  const mountains = 'M610 290 L660 262 L700 276 L752 236 L800 270 L846 250 L900 280 L950 244 L1010 274 L1060 252 L1120 278 L1200 258 L1200 290 Z';

  const chips = [['NEXT.JS', C.cyan], ['TYPESCRIPT', C.magenta], ['THREE.JS', C.cyan], ['GSAP', C.magenta], ['MONGODB', C.cyan]];
  let cx = 72;
  const chipEls = chips.map(([t, col]) => {
    const w = t.length * 10 + 28;
    const el = `<g><rect x="${cx}" y="244" width="${w}" height="30" rx="2" fill="${C.bg}" fill-opacity=".85" stroke="${col}" stroke-width="1.4"/>
      <text x="${cx + w / 2}" y="264" text-anchor="middle" font-family="${MONO}" font-size="14" fill="${col}" textLength="${t.length * 10 - 4}" lengthAdjust="spacingAndGlyphs">${t}</text></g>`;
    cx += w + 10;
    return el;
  }).join('');

  const title = (cls, fill, clip) =>
    `<text class="${cls}" x="70" y="186" font-family="${SANS}" font-size="78" font-weight="900" fill="${fill}" textLength="610" lengthAdjust="spacingAndGlyphs"${clip ? ` clip-path="url(#${clip})"` : ''}>AUN MOHAMMAD</text>`;

  return svg(W, H, 'Aun Mohammad — Full-stack developer and creative coder from Karachi, Pakistan', `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.bg}"/><stop offset=".75" stop-color="${C.sky}"/><stop offset="1" stop-color="#3b0a5c"/>
  </linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#16022e"/><stop offset="1" stop-color="${C.bg}"/>
  </linearGradient>
  <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe27a"/><stop offset=".45" stop-color="${C.magenta}"/><stop offset="1" stop-color="${C.violet}"/>
  </linearGradient>
  <linearGradient id="fadeX" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".9"/><stop offset="1" stop-color="${C.magenta}" stop-opacity="0"/>
  </linearGradient>
  <mask id="sunMask"><rect width="${W}" height="${H}" fill="#fff"/>${sunStripes}</mask>
  <clipPath id="floorClip"><rect y="${HZ}" width="${W}" height="${H - HZ}"/></clipPath>
  <clipPath id="sliceA"><rect x="0" y="120" width="${W}" height="26"/></clipPath>
  <clipPath id="sliceB"><rect x="0" y="158" width="${W}" height="20"/></clipPath>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" fill-opacity=".28"/></pattern>
  ${glow('gCyan', 4)}${glow('gMag', 5)}${glow('gSoft', 2)}${glow('gTitle', 6, C.cyan)}
  <style>
    .stars circle{fill:#fff;animation:tw ease-in-out infinite alternate}
    @keyframes tw{from{opacity:.15}to{opacity:.9}}
    .cursor{animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
    .gA{animation:gA 5s infinite}.gB{animation:gB 5s infinite}
    @keyframes gA{0%,88%,100%{opacity:0;transform:none}89%{opacity:.95;transform:translate(-7px,0)}91%{opacity:.95;transform:translate(5px,0)}93%{opacity:0}}
    @keyframes gB{0%,89%,100%{opacity:0;transform:none}90%{opacity:.95;transform:translate(8px,0)}92%{opacity:.95;transform:translate(-4px,0)}94%{opacity:0}}
    .beam{animation:beam 7s linear infinite}
    @keyframes beam{from{transform:translateY(-60px)}to{transform:translateY(${H + 60}px)}}
    .float{animation:float 6s ease-in-out infinite}
    @keyframes float{50%{transform:translateY(-10px)}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}
  </style>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g class="stars">${stars}</g>

<circle cx="930" cy="${HZ}" r="138" fill="url(#sun)" mask="url(#sunMask)" filter="url(#gMag)" opacity=".92"/>
<path d="${mountains}" fill="#0d0221" stroke="${C.magenta}" stroke-width="1.2" stroke-opacity=".7"/>

<rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#floor)"/>
<g clip-path="url(#floorClip)" filter="url(#gSoft)" opacity=".85">${gridFloor({ width: W, horizon: HZ, bottom: H, color: C.magenta })}</g>
<rect y="${HZ - 1}" width="${W}" height="2.5" fill="${C.magenta}" filter="url(#gMag)"/>

<g class="float" fill="none" stroke="${C.cyan}" stroke-width="1.8" stroke-linejoin="round" filter="url(#gCyan)">
  ${wireframe('icosahedron', 930, 150, 100)}
</g>

<text x="72" y="96" font-family="${MONO}" font-size="17" fill="${C.cyan}" letter-spacing="1">&gt; SYSTEM.ONLINE // KARACHI_PK // BSCS<tspan class="cursor"> █</tspan></text>
<g filter="url(#gTitle)">${title('', C.white)}</g>
${title('gA', C.magenta, 'sliceA')}
${title('gB', C.cyan, 'sliceB')}
<text x="74" y="224" font-family="${SANS}" font-size="20" font-weight="600" fill="${C.lilac}" letter-spacing="5">FULL-STACK DEVELOPER · CREATIVE CODER</text>
${chipEls}

<rect class="beam" x="0" y="0" width="${W}" height="40" fill="url(#fadeX)" opacity=".07"/>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
<g fill="none" stroke="${C.cyan}" stroke-width="2" opacity=".8">
  <path d="M18 48V18H48"/><path d="M${W - 48} 18H${W - 18}V48"/><path d="M18 ${H - 48}V${H - 18}H48"/><path d="M${W - 48} ${H - 18}H${W - 18}V${H - 48}"/>
</g>`);
}

// ---------- section titles ----------

function section(num, label, note, color) {
  const W = 1200, H = 92;
  const cube = (x, y, s) => `
    <g transform="translate(${x} ${y})" stroke="${color}" stroke-width="1.5" stroke-linejoin="round">
      <path d="M0 ${-s}L${s * 0.87} ${-s / 2}L0 0L${-s * 0.87} ${-s / 2}Z" fill="${color}" fill-opacity=".55"/>
      <path d="M${-s * 0.87} ${-s / 2}L0 0V${s}L${-s * 0.87} ${s / 2}Z" fill="${color}" fill-opacity=".25"/>
      <path d="M${s * 0.87} ${-s / 2}L0 0V${s}L${s * 0.87} ${s / 2}Z" fill="${color}" fill-opacity=".1"/>
    </g>`;
  const labelW = label.length * 25;
  const lineX = 150 + labelW + 30;
  return svg(W, H, `${num} — ${label.replace(/_/g, ' ').toLowerCase()}`, `
<defs>
  ${glow('g', 4, color)}
  <linearGradient id="ln" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
  </linearGradient>
</defs>
<text x="8" y="66" font-family="${SANS}" font-size="64" font-weight="900" fill="none" stroke="${color}" stroke-width="1.6" opacity=".9">${num}</text>
<text x="150" y="52" font-family="${SANS}" font-size="38" font-weight="800" fill="${C.white}" filter="url(#g)" textLength="${labelW}" lengthAdjust="spacingAndGlyphs">${label}</text>
<text x="152" y="80" font-family="${MONO}" font-size="15" fill="${C.dim}">// ${esc(note)}</text>
<rect x="${lineX}" y="38" width="${W - lineX - 60}" height="2" fill="url(#ln)"/>
<circle r="3.5" fill="#fff" filter="url(#g)"><animateMotion dur="4s" repeatCount="indefinite" path="M${lineX} 39H${W - 120}"/><animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.1;.8;1"/></circle>
${cube(W - 34, 40, 20)}`);
}

// ---------- project cards ----------

function card({ file, index, kicker, status, title, lines, stack, cta, color, shape }) {
  const W = 600, H = 300, D = 16;
  const fw = W - D - 12, fh = H - D - 12, x0 = 6, y0 = 6, cut = 22;
  const face = (dx, dy) =>
    `M${x0 + dx + cut} ${y0 + dy}H${x0 + dx + fw}V${y0 + dy + fh - cut}L${x0 + dx + fw - cut} ${y0 + dy + fh}H${x0 + dx}V${y0 + dy + cut}Z`;
  let sx = 36;
  const chips = stack.map((t) => {
    const w = t.length * 9.2 + 20;
    const el = `<rect x="${f1(sx)}" y="214" width="${f1(w)}" height="28" rx="2" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-opacity=".8"/>
      <text x="${f1(sx + w / 2)}" y="233" text-anchor="middle" font-family="${MONO}" font-size="13.5" fill="${color}" textLength="${f1(t.length * 9.2 - 6)}" lengthAdjust="spacingAndGlyphs">${esc(t)}</text>`;
    sx += w + 8;
    return el;
  }).join('');
  const body = lines.map((l, i) => `<tspan x="36" dy="${i ? 24 : 0}">${esc(l)}</tspan>`).join('');

  writeFileSync(join(OUT, file), svg(W, H, `${title} — ${lines.join(' ')}`, `
<defs>
  ${glow('g', 3, color)}${glow('gs', 1.5)}
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#140428"/><stop offset="1" stop-color="${C.bg}"/>
  </linearGradient>
  <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${color}" fill-opacity=".12"/></pattern>
  <style>
    .lift{animation:lift 6s ease-in-out infinite}
    @keyframes lift{50%{transform:translate(-3px,-5px)}}
    .pulse{animation:pulse 1.6s ease-in-out infinite}
    @keyframes pulse{50%{opacity:.25}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}
  </style>
</defs>
<path d="${face(D, D)}" fill="${color}" fill-opacity=".14" stroke="${color}" stroke-opacity=".45"/>
<g stroke="${color}" stroke-opacity=".45">
  <line x1="${x0 + fw}" y1="${y0}" x2="${x0 + fw + D}" y2="${y0 + D}"/>
  <line x1="${x0 + fw - cut}" y1="${y0 + fh}" x2="${x0 + fw - cut + D}" y2="${y0 + fh + D}"/>
  <line x1="${x0}" y1="${y0 + fh}" x2="${x0 + D}" y2="${y0 + fh + D}"/>
</g>
<g class="lift">
  <path d="${face(0, 0)}" fill="url(#bg)"/>
  <path d="${face(0, 0)}" fill="url(#dots)" stroke="${color}" stroke-width="1.6" filter="url(#gs)"/>
  <text x="36" y="46" font-family="${MONO}" font-size="14" fill="${color}" letter-spacing="1">${esc(`PROJECT_${index} // ${kicker}`)}</text>
  <g transform="translate(${x0 + fw - 30} 34)">
    <circle class="pulse" cx="-${status.length * 8.8 + 14}" cy="7" r="4.5" fill="${color}"/>
    <text x="0" y="12" text-anchor="end" font-family="${MONO}" font-size="14" fill="${C.white}">${esc(status)}</text>
  </g>
  <text x="34" y="98" font-family="${SANS}" font-size="38" font-weight="900" fill="${C.white}" filter="url(#g)" letter-spacing="1">${esc(title)}</text>
  <text y="134" font-family="${SANS}" font-size="17.5" fill="${C.lilac}">${body}</text>
  ${chips}
  <text x="${x0 + fw - 30}" y="266" text-anchor="end" font-family="${MONO}" font-size="14" font-weight="700" fill="${color}" letter-spacing="1">${esc(cta)} →</text>
  <g fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" filter="url(#gs)" opacity=".9">
    ${wireframe(shape, 492, 136, 52, { frames: 40, dur: 12, tilt: 0.5 })}
  </g>
</g>`));
}

// ---------- side HUD panel ----------

function hud() {
  const W = 400, H = 470;
  const rows = [
    ['LOCATION', 'KARACHI, PK'],
    ['ROLE', 'FULL-STACK DEV'],
    ['MODE', 'SHIPPING'],
    ['FOCUS', '3D WEB + AI DX'],
    ['COFFEE', '∞'],
  ];
  const bars = [['FULL-STACK', 0.9, C.cyan], ['3D / MOTION', 0.7, C.magenta], ['AI WORKFLOWS', 0.85, C.cyan]];
  return svg(W, H, 'System status panel: Karachi, full-stack developer, focused on 3D web and AI-assisted development', `
<defs>
  ${glow('g', 4)}${glow('gs', 1.5)}
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140428"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
  <style>
    .bar{transform-box:fill-box;transform-origin:left;animation:grow 2.4s cubic-bezier(.2,.8,.2,1) both}
    @keyframes grow{from{transform:scaleX(0)}}
    .blink{animation:blink 1.2s steps(1) infinite}@keyframes blink{50%{opacity:0}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}
  </style>
</defs>
<path d="M28 4H396V${H - 28}L${W - 28} ${H - 4}H4V28Z" fill="url(#bg)" stroke="${C.violet}" stroke-width="1.5"/>
<path d="M28 4H140" stroke="${C.cyan}" stroke-width="3" filter="url(#gs)"/>
<path d="M${W - 140} ${H - 4}H${W - 28}" stroke="${C.magenta}" stroke-width="3" filter="url(#gs)"/>
<text x="28" y="40" font-family="${MONO}" font-size="14" fill="${C.cyan}" letter-spacing="2">SYS.STATUS<tspan class="blink" fill="${C.magenta}"> ●</tspan></text>
<g fill="none" stroke="${C.magenta}" stroke-width="1.6" stroke-linejoin="round" filter="url(#g)">
  ${wireframe('octahedron', W / 2, 140, 74, { frames: 48, dur: 10, tilt: 0.35 })}
</g>
<ellipse cx="${W / 2}" cy="236" rx="78" ry="10" fill="none" stroke="${C.cyan}" stroke-opacity=".5"/>
${rows.map(([k, v], i) => `
<text x="28" y="${278 + i * 25}" font-family="${MONO}" font-size="15" fill="${C.dim}">${k}</text>
<text x="${W - 28}" y="${278 + i * 25}" text-anchor="end" font-family="${MONO}" font-size="15" fill="${C.white}">${esc(v)}</text>`).join('')}
${bars.map(([k, p, col], i) => {
    const y = 396 + i * 22;
    return `<text x="28" y="${y + 10}" font-family="${MONO}" font-size="12.5" fill="${C.lilac}">${k}</text>
<rect x="150" y="${y}" width="222" height="10" fill="${col}" fill-opacity=".12"/>
<rect class="bar" x="150" y="${y}" width="${f1(222 * p)}" height="10" fill="${col}" filter="url(#gs)" style="animation-delay:${i * 0.25}s"/>`;
  }).join('')}`);
}

// ---------- footer ----------

function footer() {
  const W = 1200, H = 210, HZ = 70;
  return svg(W, H, 'Thanks for stopping by', `
<defs>
  ${glow('g', 5)}${glow('gs', 2)}
  <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16022e"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
  <clipPath id="c"><rect y="${HZ}" width="${W}" height="${H - HZ}"/></clipPath>
  <style>.blink{animation:blink 1s steps(1) infinite}@keyframes blink{50%{opacity:0}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
</defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#fl)"/>
<g clip-path="url(#c)" filter="url(#gs)" opacity=".7">${gridFloor({ width: W, horizon: HZ, bottom: H, color: C.violet, depth: 600, period: 3 })}</g>
<rect y="${HZ - 1}" width="${W}" height="2.5" fill="${C.cyan}" filter="url(#g)"/>
<text x="${W / 2}" y="44" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${C.cyan}" letter-spacing="4" filter="url(#gs)">THANKS FOR STOPPING BY // SEE YOU IN THE GRID<tspan class="blink"> █</tspan></text>`);
}

// ---------- write everything ----------

writeFileSync(join(OUT, 'header.svg'), header());
writeFileSync(join(OUT, 'hud.svg'), hud());
writeFileSync(join(OUT, 'footer.svg'), footer());

const sections = [
  ['01', 'ABOUT_ME', "who's behind the grid", C.cyan],
  ['02', 'PROJECTS', 'things I built and shipped', C.magenta],
  ['03', 'TECH_STACK', 'tools of the trade', C.cyan],
  ['04', 'GITHUB_STATS', 'live from the mainframe', C.magenta],
  ['05', 'CONNECT', 'open a channel', C.cyan],
];
for (const [n, l, note, col] of sections) {
  writeFileSync(join(OUT, `section-${l.toLowerCase().replace('_', '-')}.svg`), section(n, l, note, col));
}

card({
  file: 'card-blood-match.svg', index: '01', kicker: 'HACKATHON', status: 'LIVE',
  title: 'BLOOD MATCH', color: C.rose, shape: 'icosahedron', cta: 'VIEW REPO',
  lines: ['Emergency blood-donor matching platform', 'for MAJU CodeCraft. Every build gets an', 'independent security re-audit.'],
  stack: ['NEXT.JS 14', 'TYPESCRIPT', 'MONGODB', 'BUN', 'JWT'],
});
card({
  file: 'card-hireflow.svg', index: '02', kicker: '3D REDESIGN', status: 'BUILDING',
  title: 'HIREFLOW', color: C.cyan, shape: 'cube', cta: 'COMING SOON',
  lines: ['A job board reimagined as an Awwwards-', 'style experience: scroll-driven 3D', 'scenes and smooth-scroll motion.'],
  stack: ['THREE.JS', 'GSAP', 'LENIS', 'NEXT.JS'],
});
card({
  file: 'card-1think2win.svg', index: '03', kicker: 'CRICKET QUIZ', status: 'LIVE',
  title: '1THINK2WIN', color: C.lime, shape: 'octahedron', cta: 'VIEW REPO',
  lines: ['Prediction-based cricket quiz platform', 'with tuned hero motion that stays', 'smooth under real interaction load.'],
  stack: ['NEXT.JS', 'SUPABASE', 'TAILWIND', 'FRAMER'],
});
card({
  file: 'card-anime-legends.svg', index: '04', kicker: 'GAME', status: 'PLAYABLE',
  title: 'ANIME LEGENDS', color: C.magenta, shape: 'tetrahedron', cta: 'VIEW REPO',
  lines: ['A single-file anime fighting game in', 'vanilla HTML, CSS and JS, built through', 'iterative AI-assisted prompting.'],
  stack: ['JAVASCRIPT', 'CANVAS', 'HTML/CSS'],
});

console.log('assets written to', OUT);
