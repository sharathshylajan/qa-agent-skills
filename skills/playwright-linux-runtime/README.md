# Playwright Linux Runtime Skill

Reusable Slingshot/Copilot skill for fresh Linux workspaces that need Playwright-managed headless Chromium and HTTP Basic Authentication before accessibility or functional UI testing.

## Repository structure

```text
playwright-linux-runtime/
├── SKILL.md
├── README.md
├── agents/
│   └── ui_metadata.yaml
├── scripts/
│   ├── bootstrap_playwright.sh
│   ├── authenticated_browser.cjs
│   └── verify_browser.cjs
└── references/
    ├── integration.md
    └── troubleshooting.md
```

## GitHub upload

Commit this folder as a repository or as a folder within your shared skills repository. Do not commit credentials, `.env`, `node_modules`, `.cache`, or runtime logs.

## Runtime

Each fresh workflow workspace runs the bootstrap script. It initializes npm when needed, installs Playwright, installs Chromium, handles Linux dependency recovery when permitted, and verifies authenticated navigation with at most five total attempts.

## Quick start

```bash
export TARGET_URL='https://qa.example.com'
export BASIC_AUTH_USERNAME='secret'
export BASIC_AUTH_PASSWORD='secret'
bash scripts/bootstrap_playwright.sh
```

Use protected Slingshot variables rather than literal values in prompts or source control.
