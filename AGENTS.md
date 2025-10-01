# VS Code Theme Generator

Purpose: This repo builds VS Code themes (e.g., electric-lime) from a source schema. The goal is predictable, accessible, and diff-friendly JSON output.

Source of truth:

Input schema: One canonical schema for palette, scales, and semantic tokens.
No ad-hoc color literals in code. All colors derive from the palette utilities.
Keep generation deterministic: same input → same output (no randomness).
Constraints:

Accessibility: Default editor and terminal colors target WCAG AA contrast against background for text, comments, and UI chrome.
Stability: Avoid churn. Only regenerate files that actually changed.
Diffability: Stable key order, 2-space indentation, trailing newline, no trailing commas.
Output format:

VS Code colorTheme JSON compliant.
Include name, type, colors, tokenColors, and any semanticHighlighting as needed.
Sort keys: name, type, semanticHighlighting, colors, tokenColors.
tokenColors rules sorted by name, then scope length, then settings.foreground.
Hex colors lowercase, 6-digit where possible; preserve alpha as 8-digit hex.
Color system:

Define a base HSL palette with named roles (background, foreground, accent, accent-weak, accent-strong, selection, cursor, error, warning, info, success).
Provide luminance-aware utilities to generate ramps (e.g., x050..x900).
Use semantic mapping to editor/terminal slots. No component pulls from raw ramps directly.
Provide a small number of tunables (e.g., contrastBoost, saturationTrim) applied consistently.
Theme policy:

Favor subdued backgrounds with high-chroma accents for focus states.
Comments: lower contrast than code but ≥ 4.0:1 vs background.
Strings and numbers: distinct hues; avoid ambiguity with keywords.
Diagnostics underline: use wavy with alpha; avoid solid red floods.
Selection and line highlight should be visible but not overpowering.
File layout:

src/palette/ palette roles and ramps (no VS Code specifics).
src/maps/ semantic map to VS Code keys.
src/generators/ JSON emitters and sorters.
src/variants/ variant definitions (e.g., high-contrast).
themes/ generated output only (no manual edits).
scripts/ build/verify/release utilities.
Build:

Single entry: npm run build writes to themes/.
Validate against VS Code theme schema during build.
Include a --check mode that fails on nondeterminism or drift.
Testing:

Snapshot tests for emitted JSON (after stable sort and color normalization).
Contrast tests for key surfaces (editor.foreground, comments, selection, terminal text).
Golden tests for a minimal sample theme to catch ordering regressions.
Review checklist:

Inputs changed? Update schema and mappings together.
Contrast thresholds met?
Output diffs limited and intentional?
No hard-coded colors in mappings or generators.
Key ordering and formatting stable.
Contribution style:

Small, focused PRs.
Keep generators pure and side-effect free.
Document new semantic slots with rationale and examples.
Non-goals:

Live-reading user settings or environment to personalize output.
Embedding images or fonts.
Theme-specific hacks that break global rules.
