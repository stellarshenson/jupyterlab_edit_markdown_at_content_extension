# jupyterlab_edit_markdown_at_content_extension

[![GitHub Actions](https://github.com/stellarshenson/jupyterlab_edit_markdown_at_content_extension/actions/workflows/build.yml/badge.svg)](https://github.com/stellarshenson/jupyterlab_edit_markdown_at_content_extension/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/jupyterlab_edit_markdown_at_content_extension.svg)](https://www.npmjs.com/package/jupyterlab_edit_markdown_at_content_extension)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab-edit-markdown-at-content-extension.svg)](https://pypi.org/project/jupyterlab-edit-markdown-at-content-extension/)
[![Total PyPI downloads](https://static.pepy.tech/badge/jupyterlab-edit-markdown-at-content-extension)](https://pepy.tech/project/jupyterlab-edit-markdown-at-content-extension)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)
[![Brought To You By KOLOMOLO](https://img.shields.io/badge/Brought%20To%20You%20By-KOLOMOLO-00ffff?style=flat)](https://kolomolo.com)
[![Donate PayPal](https://img.shields.io/badge/Donate-PayPal-blue?style=flat)](https://www.paypal.com/donate/?hosted_button_id=B4KPBJDLLXTSA)

Jump straight from a rendered markdown file into the editor at the exact line you were reading. No more opening the editor and scrolling to find the content again - this extension opens the editor positioned right where the content is.

## Features

- **Show Markdown Editor** - right-click rendered content and pick "Show Markdown Editor"; the editor opens split-right with the cursor on the line that produced what you clicked. This replaces JupyterLab core's identically named command, which always opened at line 0
- **Reveal in Markdown Preview** - right-click in the editor and pick "Reveal in Markdown Preview" to scroll the rendered preview to the block at the cursor
- **Synced scrolling** - once the editor is opened from the preview, the two panes track each other: the pane you are scrolling drives, the other follows to the matching location. Toggle with the `trackEditor` setting (on by default) under Settings → Edit Markdown at Content

## Usage

- In a rendered Markdown Preview, right-click the content you are reading and choose **Show Markdown Editor**. The editor opens to the right with the cursor on that line, scrolled to the top
- In the editor, right-click and choose **Reveal in Markdown Preview** to scroll the preview to the block at the cursor
- With both panes open, scrolling the focused pane scrolls the other to the matching location

## Settings

- **trackEditor** (default `true`) - keep the editor and preview scrolled together once opened from the preview. Turn it off under Settings → Settings Editor → Edit Markdown at Content

## Requirements

- JupyterLab >= 4.0.0

## Install

```bash
pip install jupyterlab_edit_markdown_at_content_extension
```

## Uninstall

```bash
pip uninstall jupyterlab_edit_markdown_at_content_extension
```
