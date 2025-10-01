#!/usr/bin/env node
/**
 * make-vscode-theme.js
 * Usage:
 *   node make-vscode-theme.js "My Theme" "#007BFF"
 *   node make-vscode-theme.js "Sepia Night" "#9f7a56"
 *   node make-vscode-theme.js "Cardinal Glass" "#ff2800"
 *   node make-vscode-theme.js "Powder Line" "#007BFF"
 *
 * Creates: ~/.vscode/extensions/localcolor-<slug>/ with a minimal theme.
 * Restart VS Code, then pick the theme from the list.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------- helpers ----------
const die = (m) => {
  console.error(m);
  process.exit(1);
};
const argName = process.argv[2];
const argHex = process.argv[3];

if (!argName || !argHex) {
  die('Usage: node make-vscode-theme.js "My Theme" "#RRGGBB"');
}

const HEX = argHex.trim();
if (!/^#?[0-9a-fA-F]{6}$/.test(HEX)) {
  die("Please provide a hex like #007BFF or 007BFF");
}
const baseHex = HEX.startsWith("#") ? HEX : `#${HEX}`;

// slug
const slug =
  argName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "theme";

// color math
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgbToHex({ r, g, b }) {
  const c = (n) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}
function hslToRgb({ h, s, l }) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function withL({ h, s, l }, nl) {
  return { h, s, l: clamp01(nl) };
}
function withS({ h, s, l }, ns) {
  return { h, s: clamp01(ns), l };
}
function shiftL(hsl, delta) {
  return withL(hsl, clamp01(hsl.l + delta));
}
function shiftS(hsl, delta) {
  return withS(hsl, clamp01(hsl.s + delta));
}
function hexShade(hex, deltaL = 0, deltaS = 0) {
  let hsl = rgbToHsl(hexToRgb(hex));
  if (deltaS) hsl = shiftS(hsl, deltaS);
  if (deltaL) hsl = shiftL(hsl, deltaL);
  return rgbToHex(hslToRgb(hsl));
}
function readableText(onHex) {
  // simple YIQ contrast
  const { r, g, b } = hexToRgb(onHex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#1A1A1A" : "#F2F2F2";
}

// derive palette
const primary = baseHex;
const primaryDim = hexShade(primary, -0.1, -0.05);
const primaryDark = hexShade(primary, -0.18, -0.05);
const primaryLight = hexShade(primary, +0.2, -0.2);

const bg0 = "#0f1115"; // editor background
const bg1 = hexShade(primary, -0.36, -0.55); // panels/background accents
const bg2 = hexShade(primary, -0.3, -0.6); // title/activity bar
const fg0 = "#e6e6e6"; // editor foreground
const muted = "#9aa3ad"; // comments / less prominent

const accent = primary;
const accent2 = primaryDim;
const accent3 = primaryLight;

const textOnAccent = readableText(accent);
const textOnBg2 = readableText(bg2);

// theme object
const theme = {
  name: argName,
  type: "dark",
  colors: {
    // window chrome
    "titleBar.activeBackground": bg2,
    "titleBar.activeForeground": textOnBg2,
    "titleBar.inactiveBackground": hexShade(bg2, -0.05),
    "titleBar.inactiveForeground": readableText(hexShade(bg2, -0.05)),

    "activityBar.background": bg2,
    "activityBar.foreground": textOnBg2,
    "activityBarBadge.background": accent,
    "activityBarBadge.foreground": textOnAccent,

    "statusBar.background": primaryDark,
    "statusBar.foreground": textOnAccent,

    // tabs
    "tab.activeBackground": bg0,
    "tab.activeForeground": fg0,
    "tab.inactiveBackground": hexShade(bg0, -0.06),
    "tab.inactiveForeground": muted,
    "tab.hoverBackground": hexShade(bg0, +0.04),
    "tab.border": hexShade(bg0, -0.1),

    // editor
    "editor.background": bg0,
    "editor.foreground": fg0,
    "editorLineNumber.foreground": hexShade(muted, -0.2),
    "editorCursor.foreground": accent,
    "editor.selectionBackground": hexShade(accent, +0.1, -0.3) + "80",
    "editor.inactiveSelectionBackground": hexShade(accent, +0.15, -0.4) + "55",
    "editor.lineHighlightBackground": "#00000040",
    "editor.wordHighlightBackground": "#ffffff10",
    "editor.wordHighlightStrongBackground": "#ffffff15",

    // sidebar/panel
    "sideBar.background": bg1,
    "sideBar.foreground": fg0,
    "sideBarSectionHeader.background": hexShade(bg1, -0.06),
    "sideBarSectionHeader.foreground": fg0,
    "panel.background": bg1,

    // misc
    "button.background": accent,
    "button.foreground": textOnAccent,
    "checkbox.border": primaryDim,
    focusBorder: primaryDim,
    "list.activeSelectionBackground": hexShade(accent, -0.05) + "66",
    "list.activeSelectionForeground": fg0,
    "list.hoverBackground": "#ffffff08",
    "scrollbarSlider.background": "#ffffff20",
    "scrollbarSlider.hoverBackground": "#ffffff30",
    "scrollbarSlider.activeBackground": "#ffffff40",

    // terminal
    "terminal.ansiBlack": "#1c1f26",
    "terminal.ansiRed": "#ff6b6b",
    "terminal.ansiGreen": "#6ed796",
    "terminal.ansiYellow": "#ffd166",
    "terminal.ansiBlue": accent,
    "terminal.ansiMagenta": "#c792ea",
    "terminal.ansiCyan": "#64d6e2",
    "terminal.ansiWhite": "#d8dee9",
    "terminal.background": bg0,
    "terminal.foreground": fg0,
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: muted, fontStyle: "italic" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: accent },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: accent3 },
    },
    {
      scope: ["variable", "meta.definition.variable"],
      settings: { foreground: "#EAEAEA" },
    },
    {
      scope: ["string", "constant.other.symbol"],
      settings: { foreground: "#A6E3A1" },
    },
    {
      scope: ["constant.numeric", "constant.language", "support.constant"],
      settings: { foreground: "#F9E2AF" },
    },
    {
      scope: ["entity.name.type", "support.type", "storage.type.class"],
      settings: { foreground: "#89B4FA" },
    },
    {
      scope: ["punctuation", "meta.brace", "meta.delimiter"],
      settings: { foreground: "#C0C5CE" },
    },
  ],
};

// extension skeleton
const extId = `localcolor-${slug}`;
const baseDir = path.join(os.homedir(), ".vscode", "extensions", extId);
const themesDir = path.join(baseDir, "themes");

const pkg = {
  name: extId,
  displayName: argName,
  publisher: "local",
  version: "0.0.1",
  engines: { vscode: "^1.60.0" },
  categories: ["Themes"],
  contributes: {
    themes: [
      {
        label: argName,
        uiTheme: "vs-dark",
        path: `./themes/${slug}.json`,
      },
    ],
  },
};

// write files
fs.mkdirSync(themesDir, { recursive: true });
fs.writeFileSync(
  path.join(baseDir, "package.json"),
  JSON.stringify(pkg, null, 2)
);
fs.writeFileSync(
  path.join(themesDir, `${slug}.json`),
  JSON.stringify(theme, null, 2)
);

// friendly output
console.log(`✓ Created theme:
  Name:  ${argName}
  Color: ${baseHex}
  Path:  ${baseDir}

Restart VS Code (or reload window) and select “${argName}”.
`);
