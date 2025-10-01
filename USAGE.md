Inline Color Annotator — Usage
=============================

Elevator Pitch (20 seconds)
- Drop lightweight delimiters (e.g., `△`, `▢`, `○`) directly in your files.
- Run `annotate-delimiters.js` to produce a sidecar `<file>.ann.json` — no source edits.
- The bundled VS Code extension reads that sidecar and overlays subtle background colors on the exact regions between delimiters.
- Two delimiter types: fixed on/off colors (e.g., `△`) and randomizers that pick contrasting colors (e.g., `▢`, `○`).

Quick Start
- Place delimiters in a file:
  - `△ ... △` toggles a fixed highlight color.
  - `▢ ... ▢` or `○ ... ○` toggle a randomly chosen color from a palette.
- Generate annotations:
  - `node annotate-delimiters.js path/to/file.ext`
  - This writes `path/to/file.ext.ann.json` with color ranges.
- Load the extension:
  - Open `vsc-annotator` in VS Code and press `F5` to run the extension in a dev window; or
  - Copy/symlink `vsc-annotator` into `~/.vscode/extensions/inline-color-annotator` and reload VS Code.
- Open `file.ext`; colored regions render automatically. Use command palette → “Inline Color Annotator: Refresh” to force refresh.

Delimiters and Defaults
- Symbols and behavior (default):
  - `△` → kind: `onoff`, color: `#FFE26A` (opaque yellow).
  - `▢`, `○` → kind: `random` (color chosen from palette per region).
- Nesting: You can nest delimiters; regions close when the same symbol is seen again.
- Unclosed regions: If a region isn’t closed, it’s highlighted to end-of-file.

Palette and Config (optional)
- Palette: Provide a JSON palette to influence random colors.
  - Accepts either `{"colors":["#RRGGBB", ...]}` or an array `["#RRGGBB", ...]`.
  - Example run: `node annotate-delimiters.js file.ext --palette my-palette.json`
- Config: Override symbols or colors via a config file:
  - `config.json` example:
    ```json
    {
      "symbols": {
        "△": { "kind": "onoff", "color": "#FFE26A" },
        "▢": { "kind": "random" },
        "○": { "kind": "random" }
      }
    }
    ```
  - Example run: `node annotate-delimiters.js file.ext --config config.json`
- Seed: Use `--seed 123` to make random choices reproducible.

Working Loop (typical)
- Edit code/text and add delimiters where you want visual grouping.
- Save, then run: `node annotate-delimiters.js current-file.ext`
- The extension detects `current-file.ext.ann.json` and decorates the editor.
- Repeat as you iterate; use the refresh command if needed.

CLI Reference
- `node annotate-delimiters.js <file> [--palette palette.json] [--config config.json] [--out out.json] [--seed N]`
- Output defaults to `<file>.ann.json`.

Notes
- Files are never modified; all metadata lives in the sidecar `.ann.json`.
- Keep symbols minimal to avoid visual noise; the colors do the talking.

