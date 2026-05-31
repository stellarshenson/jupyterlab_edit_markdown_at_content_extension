<!-- @import /home/lab/workspace/.claude/CLAUDE.md -->

# Project-Specific Configuration

This file imports workspace-level configuration from `/home/lab/workspace/.claude/CLAUDE.md`.
All workspace rules apply. Project-specific rules below strengthen or extend them.

The workspace `/home/lab/workspace/.claude/` directory contains additional instruction files
(MERMAID.md, NOTEBOOK.md, DATASCIENCE.md, GIT.md, and others) referenced by CLAUDE.md.
Consult workspace CLAUDE.md and the .claude directory to discover all applicable standards.

## Required Workspace Skills

The workspace ships skills at `/home/lab/workspace/.claude/skills/` that MUST be referenced
when working on this project:

- **jupyterlab-extension** (`/home/lab/workspace/.claude/skills/jupyterlab-extension/SKILL.md`) - extension development guidelines, testing strategy, CI/CD with jupyter-releaser, common caveats, TypeScript compatibility, syntax highlighting, and local development patterns. Consult on any extension code, build, or release work
- **playwright** (`/home/lab/workspace/.claude/skills/playwright/SKILL.md`) - browser automation for capturing screenshots and verifying the extension UI inside a running JupyterLab. Use when validating UI behaviour or producing README screenshots

## Mandatory Bans (Reinforced)

The following workspace rules are STRICTLY ENFORCED for this project:

- **No automatic git tags** - only create tags when user explicitly requests
- **No automatic version changes** - only modify version in package.json/pyproject.toml/etc. when user explicitly requests
- **No automatic publishing** - never run `make publish`, `npm publish`, `twine upload`, or similar without explicit user request
- **No manual package installs if Makefile exists** - use `make install` or equivalent Makefile targets, not direct `pip install`/`uv install`/`npm install`/`jlpm install`/`jlpm build`
- **No automatic git commits or pushes** - only when user explicitly requests

## Project Context

`jupyterlab_edit_markdown_at_content_extension` is a JupyterLab 4 extension that opens the
editor at the exact location of the rendered content, eliminating the scrolling step between
viewing a markdown file and editing the line you were looking at.

It is composed of a Python server extension (`jupyterlab_edit_markdown_at_content_extension`)
and a frontend NPM package of the same name. Scaffolded from the JupyterLab extension copier
template (see `.copier-answers.yml`).

**Technology Stack**:
- TypeScript frontend against `@jupyterlab/application` (JupyterLab >= 4.0.0)
- Python `jupyter_server` extension for server-side routes
- jupyter-releaser CI/CD via the `.github/workflows/` pipelines
- Pytest (server), Jest (frontend), Playwright/Galata (integration)

## Mandatory Build and Install

- **Install ONLY via `make install`** - never run `pip install`, `jlpm install`, `jlpm build`,
  `yarn`, or `npm install` directly. The Makefile manages the project-local nodeenv and the
  correct install ordering. Use `make build`, `make test`, `make uninstall` for the other operations
- All package operations route through Makefile targets (`make help` lists them)

## Mandatory Makefile Version Sync

- The canonical Makefile lives at `/home/lab/workspace/private/jupyterlab/@utils/jupyterlab-extensions/Makefile`
- The version is recorded on the first line: `# Makefile for Jupyterlab extensions version X.YZ`
- **Before any build/install work, compare the local `Makefile` version against the canonical one.**
  If the canonical Makefile carries a newer version, copy it over the local `Makefile` and note the
  bump, then proceed. The local Makefile must never lag behind the canonical version

## Mandatory Commit Hygiene

- **Always stage and commit both `package.json` AND `package-lock.json` together** whenever
  dependencies change, so the lockfile never drifts from the manifest

## Journal Rules (Project-Specific)

- **APPEND ONLY**: New journal entries MUST be appended at the end of the file, never inserted between existing entries
- Entries maintain strict chronological order by position - the last entry in the file is always the most recent work
- Never reorder, move, or insert entries out of sequence
- The Stellars **journal plugin** is the canonical tool for this file: create via `/journal:create`, append via `/journal:update`, archive via `/journal:archive`. The `journal:journal` skill auto-triggers on any mention of "journal" and runs `journal-tools check` after every write
- Direct edits to `JOURNAL.md` are a last resort - prefer the plugin so modus secundis format, continuous numbering and append-only order are enforced automatically

## Strengthened Rules

- **No slop** - this is a single-purpose extension; do not add features, settings, commands, or
  scaffolding beyond what is explicitly requested
- **Project boundary** - stay within this project; the only sanctioned external reads are the
  canonical Makefile and the workspace skills referenced above
