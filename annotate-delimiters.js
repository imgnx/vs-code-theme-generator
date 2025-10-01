#!/usr/bin/env node
/**
 * Annotate files with color regions based on inline delimiter symbols.
 *
 * - Does NOT modify the source file. Emits a sidecar JSON with ranges.
 * - Supports two delimiter kinds:
 *   - On/Off: same symbol toggles a region with a fixed color.
 *   - Randomizer: same symbol toggles a region that picks a color from a palette.
 * - Default symbols: On/Off -> { '△': '#FFE26A' }, Randomizers -> { '▢': true, '○': true }
 * - Colors can be provided via a palette JSON (from make-palette) or CLI args.
 *
 * Usage:
 *   node annotate-delimiters.js <file> [--palette palette.json] [--config config.json] [--out out.json] [--seed N]
 *
 * Output JSON:
 * {
 *   version: 1,
 *   file: "path",
 *   legend: { symbols: { '△': {kind:'onoff', color:'#FFE26A'}, '▢': {kind:'random'} }, palette: ["#...", ...] },
 *   ranges: [ { start:{line, col, index}, end:{line, col, index}, symbol:'△', color:'#FFE26A' }, ... ]
 * }
 */

const fs = require('fs');
const path = require('path');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--palette' || a === '-p') out.palette = argv[++i];
    else if (a === '--config' || a === '-c') out.config = argv[++i];
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--seed') out.seed = parseInt(argv[++i] || '0', 10) || 0;
    else out._.push(a);
  }
  return out;
}

function loadPalette(palettePath) {
  if (!palettePath) return null;
  const txt = fs.readFileSync(palettePath, 'utf8');
  try {
    const j = JSON.parse(txt);
    if (Array.isArray(j)) return j;
    if (j && Array.isArray(j.colors)) return j.colors;
    return null;
  } catch {
    return null;
  }
}

function defaultPalette() {
  return [
    '#FF6B6B', '#FFD166', '#6ED796', '#64D6E2', '#89B4FA', '#C792EA',
    '#F9E2AF', '#A6E3A1', '#F38BA8', '#74C7EC', '#FAB387', '#B4BEFE'
  ];
}

// Config structure:
// {
//   symbols: {
//     '△': { kind: 'onoff', color: '#FFE26A' },
//     '▢': { kind: 'random' },
//     '○': { kind: 'random' }
//   }
// }
function loadConfig(configPath) {
  if (!configPath) return null;
  const txt = fs.readFileSync(configPath, 'utf8');
  try { return JSON.parse(txt); } catch { return null; }
}

function buildDefaultConfig() {
  return {
    symbols: {
      '△': { kind: 'onoff', color: '#FFE26A' },
      '▢': { kind: 'random' },
      '○': { kind: 'random' },
    },
  };
}

function pickColor(rand, palette, usedSet) {
  if (!palette || !palette.length) return '#CCCCCC';
  // Prefer unused colors; fallback to any
  const unused = palette.filter(c => !usedSet.has(c));
  const arr = unused.length ? unused : palette;
  const idx = Math.floor(rand() * arr.length);
  const color = arr[idx];
  usedSet.add(color);
  return color;
}

function annotate(content, cfg, palette, seed = 0) {
  const rand = mulberry32(seed >>> 0);
  const symbolMap = cfg.symbols || {};
  const delimiters = new Set(Object.keys(symbolMap));

  const ranges = [];
  const stack = []; // { symbol, color, start: {line,col,index} }
  const usedColors = new Set();

  let line = 0, col = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (delimiters.has(ch)) {
      const spec = symbolMap[ch];
      if (!spec) continue;
      const top = stack.length ? stack[stack.length - 1] : null;
      if (top && top.symbol === ch) {
        // close
        const open = stack.pop();
        ranges.push({
          symbol: ch,
          color: open.color,
          start: open.start,
          end: { line, col, index: i },
        });
      } else {
        // open
        let color = '#CCCCCC';
        if (spec.kind === 'onoff') {
          color = spec.color || '#CCCCCC';
          usedColors.add(color);
        } else if (spec.kind === 'random') {
          color = pickColor(rand, palette, usedColors);
        }
        stack.push({ symbol: ch, color, start: { line, col, index: i } });
      }
      // Do not advance column for delimiter removal/annotation; still count char position
      // We count column as visual position; here we treat delimiter as occupying a column.
      col += 1;
      continue;
    }
    if (ch === '\n') { line += 1; col = 0; } else { col += 1; }
  }

  // Unclosed regions: leave them without end; optionally close at EOF
  const eofPos = { line, col, index: content.length };
  while (stack.length) {
    const open = stack.pop();
    ranges.push({ symbol: open.symbol, color: open.color, start: open.start, end: eofPos, open: true });
  }

  return { ranges };
}

function main() {
  const args = parseArgs(process.argv);
  if (args._.length < 1) {
    die('Usage: node annotate-delimiters.js <file> [--palette palette.json] [--config config.json] [--out out.json] [--seed N]');
  }
  const file = args._[0];
  if (!fs.existsSync(file)) die(`File not found: ${file}`);
  const content = fs.readFileSync(file, 'utf8');

  const cfg = loadConfig(args.config) || buildDefaultConfig();
  const palette = loadPalette(args.palette) || defaultPalette();
  const seed = Number.isFinite(args.seed) ? args.seed : 0;

  const { ranges } = annotate(content, cfg, palette, seed);

  const result = {
    version: 1,
    file: path.resolve(file),
    legend: { symbols: cfg.symbols, palette },
    ranges,
  };

  const outPath = args.out || `${file}.ann.json`;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`✓ Wrote annotations -> ${outPath}`);
}

if (require.main === module) {
  try { main(); } catch (e) { die(e && e.message ? e.message : String(e)); }
}

