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

- **Edit at content location** - open the editor scrolled to the line matching the rendered content you are viewing
- **No-scroll workflow** - skips the manual hunt for the right line after switching from preview to editor
- **Server-side support** - a Python `jupyter_server` extension backs the frontend with the routes it needs

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
