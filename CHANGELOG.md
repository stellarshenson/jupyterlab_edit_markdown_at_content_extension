# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## [1.0.22] - 2026-08-27

### Changed

- No functional changes. Republished from the same source tree as 1.0.21

<!-- <END NEW CHANGELOG ENTRY> -->

## [1.0.21] - 2026-08-27

### Changed

- No source changes. Republished on the first tree whose CI run is fully green, so the registry version corresponds to a verified build: Build #30 passed `build`, `Check Links`, `test_isolated` and `Integration tests`

## [1.0.20] - 2026-08-27

### Fixed

- Integration tests collect again. `ui-tests` resolved two copies of `@playwright/test` - the template's `^1.37.0` at 1.60.0 alongside the `^1.60.0` that `@jupyterlab/galata` 5.6.3 pulls at 1.62.1 - so the runner loaded one instance while the spec's `test`, re-exported by galata, came from the other. Playwright reported `test.use() called here` and then found no tests at all. The declared range is now `^1.62.1`, which resolves to a single instance

## [1.0.19] - 2026-08-27

### Fixed

- Editing the source no longer throws the preview away from what you are editing. The scroll sync captured the document once when the editor opened, so every reveal after a keystroke used the pre-edit block map; it now refreshes on the viewer's `rendered` signal and re-reveals while the editor is the pane you are driving
- YAML front matter is stripped before the source is lexed, matching the viewer's own `hideFrontMatter` default. Without it every block after the front matter was off by the number of lines the front matter occupied, so clicking a heading landed the cursor inside the YAML
- A marker-only block now maps to the line it came from. An `<hr>` came from a real `---` and an empty fence from a real pair of backticks, so both resolve normally; an out-of-range ordinal is the only mapping failure left
- "Reveal in Markdown Preview" no longer appears in editors for files that are not markdown
- Integration tests run again: `@jupyterlab/galata` moved to `^5.6.3`. The 5.5 series probes simple mode through a status-bar toggle JupyterLab 4.6 removed, which hangs every `page.goto()` until the test times out

### Changed

- The block map is memoized on the source string, so scroll sync no longer re-lexes an unchanged document on every scroll event
- README: dropped the claim that this extension replaces JupyterLab core's identically named command - it extends it - and documented that mapping is block-level, so a click inside a list or table lands on the first line of that list or table

## [1.0.17] - 2026-08-19

### Fixed

- Build: pinned `vscode-languageserver-protocol` to 3.17.5. The transitive `^3.17.0` range started resolving to 3.18.2, whose `exports` map cannot be resolved under this project's `moduleResolution: node`, so `tsc` failed on `@jupyterlab/lsp` type declarations and the build could not produce a release

### Changed

- Build tooling: synced the project Makefile to the canonical v1.37, which formats the lockfiles with `jlpm prettier` instead of `npx prettier` - the latter fails with `prettier: Permission denied` against a yarn-berry `node_modules`, where `prettier.cjs` ships without the exec bit
- Build tooling: the Makefile now reads the version through the project-local node and fails loudly when the version cannot be read, instead of silently falling back to `0.0.0` and republishing the current version on a fresh clone
