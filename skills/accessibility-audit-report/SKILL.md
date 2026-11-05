---
name: accessibility-scope-planner
description: Retrieve the current Jira issue for an authorized accessibility audit, select target URLs using strict Jira-first and runtime-fallback precedence, validate targets and requirements, classify authentication, group targets by exact origin, and write a sanitized execution plan. Use before browser execution. Never modify Jira, launch browsers, scan pages, or generate the final report.
---

# Accessibility Scope Planner

Create a sanitized current-run plan in `accessibility_execution_plan.json`. Jira is authoritative. Runtime `TARGET_URL` is optional and may be used only when current Jira contains no usable authorized target URL.

## Inputs

- `JIRA_ISSUE_KEY`
- `TARGET_URL`, optional fallback
- `BASIC_AUTH_USERNAME`, optional protected value
- `BASIC_AUTH_PASSWORD`, optional protected value

Never emit credential values. Record only whether a complete pair exists.

## Jira retrieval

Retrieve current issue key, summary, description, acceptance criteria, relevant current comments, explicit target URL fields, accessibility requirements, and declared authentication requirement. Do not use stale history as current truth. Never modify Jira.

## Target precedence

### 1. Jira first

Extract only explicit authorized QA/test URLs from current Jira. A usable URL must be HTTP/HTTPS, syntactically valid, have a hostname, contain no embedded credentials, be authorized, and have an exact derivable origin.

If at least one usable Jira URL exists:

- Select all usable Jira URLs in Jira order and deduplicate while preserving order.
- Set `urlSource="JIRA"`.
- Ignore runtime `TARGET_URL` completely.
- Never compare, merge, append, or replace Jira URLs with runtime `TARGET_URL`.

Empty, malformed, credential-bearing, unauthorized, or otherwise unusable Jira candidates do not qualify. If Jira has URL-like candidates but none are usable, evaluate fallback.

### 2. Runtime fallback

Evaluate runtime `TARGET_URL` only when Jira has no usable authorized URL.

If supplied, validate it with the same rules. If usable:

- Select it as the only target.
- Set `urlSource="RUNTIME_FALLBACK"`.
- Set `sourceField="TARGET_URL"`.
- Set `sourceLocation="Runtime Input"`.
- Record that Jira had no usable target.

Never modify Jira or imply fallback came from Jira. Do not use fallback because a usable Jira URL is inconvenient, inaccessible, protected, or returns an application error. The decision occurs before navigation.

### 3. No target

If neither source has a usable URL:

- `planStatus="BLOCKED"`
- `blockerType="NO_TARGET_URL_AVAILABLE"`
- `selectedTargetSource="NONE"`

Never guess, construct, reconstruct, substitute, reuse from prior context, or discover a URL through navigation.

## Candidate tracking and validation

For each Jira candidate retain sanitized candidate, source field/location, validation status, and exclusion reason. Never infer pages from links, screenshots, reports, or earlier runs.

Origin is `scheme + hostname + port`. Different scheme, subdomain, or port means a different origin.

Credential-bearing candidates must be excluded as `CREDENTIAL_BEARING_URL`. Never extract or migrate credentials. Sanitize before storage.

## Authentication classification

- Both Basic values non-empty: `authenticationMode="HTTP_BASIC"`, `credentialsProvided=true`.
- Both empty: `authenticationMode="NONE"`, `credentialsProvided=false`.
- Only one supplied: `authenticationMode="INVALID"`, `credentialsProvided=false`, `planStatus="BLOCKED"`, `blockerType="INVALID_AUTHENTICATION_CONFIGURATION"`.

Never reveal which value was supplied, values, encodings, or lengths. Keep Basic Auth separate from application/customer login.

## Output schema

Write exactly `accessibility_execution_plan.json`:

```json
{
  "schemaVersion": "1.1",
  "artifactType": "accessibility-execution-plan",
  "planStatus": "READY",
  "blockerType": null,
  "blockers": [],
  "jira": {
    "issueKey": "",
    "summary": "",
    "requirements": [],
    "declaredAuthenticationRequired": null,
    "usableTargetUrlCount": 0
  },
  "runtime": {
    "runtimeTargetUrlProvided": false,
    "runtimeTargetUrlUsed": false,
    "authenticationMode": "NONE",
    "credentialsProvided": false
  },
  "targetSelection": {
    "precedenceRule": "JIRA_FIRST_RUNTIME_FALLBACK",
    "selectedTargetSource": "JIRA",
    "selectionReason": "",
    "jiraTargetsAuthoritative": true,
    "runtimeTargetIgnored": false
  },
  "targets": [{
    "requestedUrl": "",
    "urlSource": "JIRA",
    "sourceField": "",
    "sourceLocation": "",
    "origin": "",
    "validationStatus": "ELIGIBLE",
    "exclusionReason": null
  }],
  "excludedCandidates": [],
  "counts": {
    "pagesRequested": 0,
    "pagesEligible": 0,
    "excludedUrls": 0
  }
}
```

Allowed `selectedTargetSource`: `JIRA`, `RUNTIME_FALLBACK`, `NONE`.
Allowed `urlSource`: `JIRA`, `RUNTIME_FALLBACK`.
Allowed `validationStatus`: `ELIGIBLE`, `EXCLUDED`.

For Jira selection set `jiraTargetsAuthoritative=true`, `runtimeTargetUrlUsed=false`, and `runtimeTargetIgnored=true` only if runtime target was supplied.

For fallback set `selectedTargetSource="RUNTIME_FALLBACK"`, `jiraTargetsAuthoritative=false`, `runtimeTargetUrlUsed=true`, `runtimeTargetIgnored=false`, and `selectionReason="Current Jira issue contained no usable authorized target URL"`.

For no target set `selectedTargetSource="NONE"`, `planStatus="BLOCKED"`, `blockerType="NO_TARGET_URL_AVAILABLE"`, and `pagesEligible=0`.

## Final validation

Verify output exists and is valid JSON; current Jira key is present; Jira wins whenever any usable Jira URL exists; fallback is used only if Jira has none; sources are never merged; every eligible target has exact origin and provenance; no credential-bearing URL or secret is stored; counts match arrays; blocked plans contain sanitized blockers and no invented target.

On failure set `planStatus="BLOCKED"`, `blockerType="PLAN_VALIDATION_FAILED"`, and preserve only sanitized evidence.

## Absolute prohibitions

Never override usable Jira URLs, merge fallback with Jira targets, imply fallback came from Jira, modify Jira, invent URLs, retrieve credentials from content, expose secrets, launch a browser, install Playwright/Chromium, run axe-core, or generate the final report.
