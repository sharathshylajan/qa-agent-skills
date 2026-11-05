---
name: accessibility-scope-planner
description: Retrieve the current Jira issue for an authorized accessibility audit, extract and validate explicit target URLs and requirements, classify authentication, group by exact origin, and write a sanitized execution plan. Use before browser execution. Never modify Jira, launch browsers, scan pages, or generate the final report.
---
# Accessibility Scope Planner
## Inputs
`JIRA_ISSUE_KEY`, optional `TARGET_URL`, and only presence states for `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`.
## Workflow
1. Retrieve current Jira key, summary, description, acceptance criteria, current relevant comments, explicit target URLs, accessibility requirements, and declared authentication requirement.
2. Never use stale history as current truth or modify Jira.
3. Extract only explicitly authorized QA/test URLs. Include runtime `TARGET_URL` only when authorized and consistent with Jira. Never invent, reconstruct, substitute, or expand scope through discovered links.
4. Deduplicate in Jira order. Validate HTTP/HTTPS, hostname, no embedded credentials, authorized destination, and exact origin as scheme + hostname + port. Different scheme, subdomain, or port means a different origin.
5. Authentication mode: both Basic variables present=`HTTP_BASIC`; both empty=`NONE`; only one=`INVALID`. Never output secret values. Keep Basic Auth separate from application login.
6. Write exactly `accessibility_execution_plan.json` with Jira metadata, requirements, targets, source locations, origins, validation/exclusion reasons, counts, authentication mode, `READY|BLOCKED`, and sanitized blockers.
7. If no eligible target or auth input is invalid, return `BLOCKED`. Do not navigate.
## Security
Never obtain credentials from Jira, comments, reports, previous conversations, screenshots, URLs, browser data, or files. Never expose secrets.
