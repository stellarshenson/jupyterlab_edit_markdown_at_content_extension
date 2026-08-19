# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## [1.0.17] - 2026-08-19

### Fixed

- Build: pinned `vscode-languageserver-protocol` to 3.17.5. The transitive `^3.17.0` range started resolving to 3.18.2, whose `exports` map cannot be resolved under this project's `moduleResolution: node`, so `tsc` failed on `@jupyterlab/lsp` type declarations and the build could not produce a release

### Changed

- Build tooling: synced the project Makefile to the canonical v1.37, which formats the lockfiles with `jlpm prettier` instead of `npx prettier` - the latter fails with `prettier: Permission denied` against a yarn-berry `node_modules`, where `prettier.cjs` ships without the exec bit
- Build tooling: the Makefile now reads the version through the project-local node and fails loudly when the version cannot be read, instead of silently falling back to `0.0.0` and republishing the current version on a fresh clone

<!-- <END NEW CHANGELOG ENTRY> -->
