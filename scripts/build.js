#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Deterministic VS Code theme build to themes/<slug>.json
// - Stable key order: name, type, semanticHighlighting, colors, tokenColors
// - Colors normalized to lowercase hex; 6-digit when opaque, 8-digit preserves alpha
// - tokenColors sorted by name, then scope length, then settings.foreground

const args = process.argv.slice(2);
const CHECK_MODE = args.includes('--check');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Simple, deterministic input: base accent and theme name from env or defaults
const THEME_NAME = process.env.THEME_NAME || 'Electric Lime';
const BASE_HEX = normalizeHex(process.env.BASE_HEX || '#32cd32');

// Color helpers
function normalizeHex(hex) {
  if (!hex) return '#000000';
  let h = hex.trim().toLowerCase();
  if (!h.startsWith('#')) h = '#' + h;
  if (/^#([0-9a-f]{3})$/.test(h)) {
    // expand #abc => #aabbcc
    const [, a, b, c] = h.match(/^#(.)(.)(.)$/);
    h = `#${a}${a}${b}${b}${c}${c}`;
  }
  if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(h)) return '#000000';
  return h;
}
function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
function rgbToHex(r, g, b, a = 1) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const base = `#${c(r)}${c(g)}${c(b)}`;
  if (a >= 1) return base;
  const aa = c(a * 255);
  return `${base}${aa}`;
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s; const l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}
function hslToRgb({ h, s, l }) {
  h /= 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function shade(hex, dl = 0, ds = 0) {
  const hsl = rgbToHsl(hexToRgb(hex));
  const s = Math.max(0, Math.min(1, hsl.s + ds));
  const l = Math.max(0, Math.min(1, hsl.l + dl));
  return rgbToHex(...Object.values(hslToRgb({ h: hsl.h, s, l }))).toLowerCase();
}
function contrastText(bg) {
  const { r, g, b } = hexToRgb(bg);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#1a1a1a' : '#f2f2f2';
}

// Palette roles (minimal for this repo state)
const accent = BASE_HEX;
const accentDim = shade(accent, -0.1, -0.05);
const accentDark = shade(accent, -0.18, -0.05);
const accentLight = shade(accent, +0.2, -0.2);
const bg0 = '#0f1115';
const bg1 = shade(accent, -0.36, -0.55);
const bg2 = shade(accent, -0.3, -0.6);
const fg0 = '#e6e6e6';
const muted = '#9aa3ad';

// Map to VS Code colors
function makeTheme() {
  const colors = {
    'titleBar.activeBackground': bg2,
    'titleBar.activeForeground': contrastText(bg2),
    'titleBar.inactiveBackground': shade(bg2, -0.05),
    'titleBar.inactiveForeground': contrastText(shade(bg2, -0.05)),
    'activityBar.background': bg2,
    'activityBar.foreground': contrastText(bg2),
    'activityBarBadge.background': accent,
    'activityBarBadge.foreground': contrastText(accent),
    'statusBar.background': accentDark,
    'statusBar.foreground': contrastText(accentDark),
    'tab.activeBackground': bg0,
    'tab.activeForeground': fg0,
    'tab.inactiveBackground': shade(bg0, -0.06),
    'tab.inactiveForeground': muted,
    'tab.hoverBackground': shade(bg0, +0.04),
    'tab.border': shade(bg0, -0.1),
    'editor.background': bg0,
    'editor.foreground': fg0,
    'editorLineNumber.foreground': shade(muted, -0.2),
    'editorCursor.foreground': accent,
    'editor.selectionBackground': (shade(accent, +0.1, -0.3) + '80'),
    'editor.inactiveSelectionBackground': (shade(accent, +0.15, -0.4) + '55'),
    'editor.lineHighlightBackground': '#00000040',
    'editor.wordHighlightBackground': '#ffffff10',
    'editor.wordHighlightStrongBackground': '#ffffff15',
    'sideBar.background': bg1,
    'sideBar.foreground': fg0,
    'sideBarSectionHeader.background': shade(bg1, -0.06),
    'sideBarSectionHeader.foreground': fg0,
    'panel.background': bg1,
    'button.background': accent,
    'button.foreground': contrastText(accent),
    'checkbox.border': accentDim,
    'focusBorder': accentDim,
    'list.activeSelectionBackground': (shade(accent, -0.05) + '66'),
    'list.activeSelectionForeground': fg0,
    'list.hoverBackground': '#ffffff08',
    'scrollbarSlider.background': '#ffffff20',
    'scrollbarSlider.hoverBackground': '#ffffff30',
    'scrollbarSlider.activeBackground': '#ffffff40',
    'terminal.ansiBlack': '#1c1f26',
    'terminal.ansiRed': '#ff6b6b',
    'terminal.ansiGreen': '#6ed796',
    'terminal.ansiYellow': '#ffd166',
    'terminal.ansiBlue': accent,
    'terminal.ansiMagenta': '#c792ea',
    'terminal.ansiCyan': '#64d6e2',
    'terminal.ansiWhite': '#d8dee9',
    'terminal.background': bg0,
    'terminal.foreground': fg0,
  };

  const tokenColors = [
    { name: 'Comment', scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: muted, fontStyle: 'italic' } },
    { name: 'Keyword', scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: accent } },
    { name: 'Function', scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: accentLight } },
    { name: 'Variable', scope: ['variable', 'meta.definition.variable'], settings: { foreground: '#eaeaea' } },
    { name: 'String', scope: ['string', 'constant.other.symbol'], settings: { foreground: '#a6e3a1' } },
    { name: 'Number', scope: ['constant.numeric', 'constant.language', 'support.constant'], settings: { foreground: '#f9e2af' } },
    { name: 'Type', scope: ['entity.name.type', 'support.type', 'storage.type.class'], settings: { foreground: '#89b4fa' } },
    { name: 'Punctuation', scope: ['punctuation', 'meta.brace', 'meta.delimiter'], settings: { foreground: '#c0c5ce' } },
  ].map(rule => ({
    ...rule,
    settings: { ...rule.settings, foreground: rule.settings.foreground ? normalizeHex(rule.settings.foreground) : undefined },
  }));

  // sort tokenColors: by name, then scope length, then settings.foreground
  tokenColors.sort((a, b) => {
    const n = (a.name || '').localeCompare(b.name || '');
    if (n) return n;
    const s = (a.scope?.length || 0) - (b.scope?.length || 0);
    if (s) return s;
    return ((a.settings?.foreground || '')).localeCompare((b.settings?.foreground || ''));
  });

  // stable colors object order (alphabetical keys)
  const sortedColorKeys = Object.keys(colors).sort();
  const sortedColors = {};
  for (const k of sortedColorKeys) sortedColors[k] = normalizeHex(colors[k]);

  // top-level stable order
  const theme = {
    name: THEME_NAME,
    type: 'dark',
    semanticHighlighting: true,
    colors: sortedColors,
    tokenColors,
  };
  return theme;
}

function writeStableJson(file, obj) {
  const txt = JSON.stringify(obj, null, 2) + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, txt, 'utf8');
}

function build() {
  const theme = makeTheme();
  const slug = THEME_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'theme';
  const out = path.join(process.cwd(), 'themes', `${slug}.json`);
  if (CHECK_MODE && fs.existsSync(out)) {
    const current = fs.readFileSync(out, 'utf8');
    const next = JSON.stringify(theme, null, 2) + '\n';
    if (current !== next) {
      console.error(`Drift detected in ${out}. Run npm run build to update.`);
      process.exit(2);
    } else {
      console.log('✓ No drift');
      return;
    }
  }
  writeStableJson(out, theme);
  console.log(`✓ Wrote ${out}`);
}

build();

