---
name: exhaustive-sitemap-link-validation
description: Performs exhaustive, resumable, sitemap-driven broken-link validation with Fetch MCP. Use when a workflow supplies a sitemap index or sitemap URL and requires recursive discovery, deterministic batching, persistent JSON checkpoints, retries, failure diagnostics, and a final HTML summary without sampling.
license: Proprietary
compatibility: Requires Fetch MCP, read/write access to the execution workspace, XML and JSON processing, and a workflow runtime that can pass a dynamic sitemap URL and resume persisted runs.
metadata:
  author: Sharath Shilajan
  version: "1.0.0"
---

# Exhaustive Sitemap Link Validation

## Purpose

Discover every valid HTTP/HTTPS page URL from a workflow-supplied sitemap, validate every unique executable URL with Fetch MCP, persist progress after each URL, resume interrupted runs, and generate JSON and HTML reports only after the report-generation gate is satisfied.

## When to use

Use this skill when the user or workflow requests:

- sitemap-driven broken-link validation
- recursive sitemap discovery
- complete URL validation without sampling or a URL cap
- resumable batch execution
- Fetch MCP-only link validation
- JSON evidence and an executive HTML report

Do not use this skill for browser automation, rendering, visual testing, accessibility testing, form submission, authenticated bypasses, CAPTCHA bypasses, or bot-protection bypasses.

## Required runtime input

Read the sitemap URL from the current workflow/task input. Never hard-code a site URL in this skill.

Accepted input key:

```text
SITEMAP_INDEX_URL
```

The value must be a non-empty absolute `http` or `https` URL. If it is missing or invalid, stop before discovery and return `INPUT_VALIDATION_FAILED` with the exact reason. Do not fall back to an example URL, a previous run's URL, or a URL embedded in this file.

Optional runtime overrides:

```text
BATCH_SIZE=100
CONCURRENCY=10
REQUEST_TIMEOUT_MS=30000
MAX_REDIRECTS=5
RETRY_COUNT=1
RETRY_DELAY_MS=2000
OUTPUT_DIRECTORY=sitemap-link-validation-report
```

Apply defaults only when an optional value is absent. Treat `BATCH_SIZE` as workload partitioning, never as a total URL limit.

## Tools and boundaries

Use Fetch MCP exclusively to retrieve:

- the initial sitemap
- child and nested sitemaps
- `robots.txt` when required
- page URLs
- response status, headers, redirects, timing, and error content when exposed

Do not use Playwright, Puppeteer, browser automation, screenshots, console logs, visual testing, or accessibility scanning.

Perform read-only requests. Do not submit forms, create accounts, place orders, make payments, change customer data, bypass authentication, bypass CAPTCHA, bypass bot protection, bypass access controls, or evade explicit automated-access restrictions.

If Fetch MCP does not expose a requested field, store `NOT_AVAILABLE`. Never infer HTTP status, redirect data, headers, duration, bodies, or error messages.

## Output paths

Create these paths under `OUTPUT_DIRECTORY`:

```text
sitemap-url-inventory.json
sitemap-link-validation-state.json
sitemap-link-validation-results.json
sitemap-link-validation-summary.html
```

Use atomic writes where supported. Persist each URL's final result immediately.

## Execution invariants

1. Do not sample.
2. Do not impose a maximum URL count.
3. A URL is validated only after Fetch MCP attempts that specific URL.
4. Discovery is not validation.
5. Pending URLs remain `PENDING`; they must not be converted to `NOT_TESTED` merely because the current invocation ends.
6. A complete run requires a final status for every unique executable URL.
7. Final URL statuses are `PASS`, `FAIL`, `BLOCKED`, and `NOT_TESTED`.
8. `PENDING` is a workflow state, not a final URL result.
9. Do not generate a COMPLETE report while any URL remains pending.
10. Preserve all confirmed results across interruption and resume from the lowest unfinalized sequence.

## Phase 1: Validate runtime input and initialize

1. Read `SITEMAP_INDEX_URL` from workflow input.
2. Validate that it is an absolute HTTP/HTTPS URL.
3. Resolve configuration values and output paths.
4. Check for an existing inventory, state, and results file.
5. Resume only when persisted files belong to the same normalized sitemap URL.
6. If persisted files belong to a different sitemap URL, create a separate clean execution directory or fail with `STATE_SITEMAP_MISMATCH`; never merge runs.

## Phase 2: Recursive sitemap discovery

Maintain:

```text
discoveredSitemaps
processedSitemaps
failedSitemaps
discoveredPageUrls
```

For the initial sitemap and each newly discovered sitemap:

1. Preserve the original URL.
2. Normalize it for duplicate detection.
3. Skip it only if the normalized sitemap has already been processed.
4. Fetch it with Fetch MCP.
5. Confirm that the response is XML rather than an HTML error page.
6. Parse XML and identify `sitemapindex` or `urlset`.
7. Validate non-empty `loc` elements as absolute HTTP/HTTPS URLs.
8. For `sitemapindex`, enqueue every valid child sitemap.
9. For `urlset`, extract every page URL and its source sitemap.
10. Continue until no undiscovered sitemap remains.
11. Prevent loops using `processedSitemaps`; do not impose an arbitrary recursion-depth limit.
12. Continue independent sitemap processing when one child sitemap fails.

For every sitemap, capture its URL, parent, type, Fetch result, exposed HTTP status, root element, entry counts, duplicates, invalid entries, `lastmod` issues, parsing errors, and final sitemap status.

If the initial sitemap cannot be fetched or parsed, set the execution to `FAILED`, set `fullValidation` to `false`, persist exact evidence, generate an explicitly failed report, and do not fabricate URL results.

## Phase 3: Build immutable inventory

For every discovered page URL:

1. Preserve the original value.
2. Decode XML entities and trim accidental outer whitespace.
3. Require HTTP or HTTPS.
4. Preserve legitimate query parameters.
5. Remove fragments for duplicate analysis.
6. Detect exact duplicate normalized URLs.
7. Track source sitemaps for each unique URL.
8. Identify known tracking-parameter variants separately without discarding functional query parameters.
9. Sort deterministically and assign stable sequence numbers beginning at 1.
10. Write the inventory once. Do not resequence during execution.

Known tracking parameters may include `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, and `fbclid`. Do not classify other parameters as tracking without evidence.

Before validation, verify:

```text
TOTAL_QUEUED_URLS == TOTAL_UNIQUE_EXECUTABLE_URLS
```

If not, mark the inventory invalid, record the discrepancy, and reconcile without silently dropping URLs.

## Inventory schema

```json
{
  "sitemapIndex": "",
  "createdAt": "",
  "totalUrlEntriesDiscovered": 0,
  "totalUniqueUrls": 0,
  "invalidUrls": 0,
  "duplicateUrls": 0,
  "trackingVariants": 0,
  "urls": [
    {
      "sequence": 1,
      "url": "",
      "normalizedUrl": "",
      "sourceSitemaps": []
    }
  ]
}
```

## Phase 4: Deterministic batches and resume

Partition the full ordered inventory into batches of `BATCH_SIZE`. Every sequence must belong to exactly one batch. The last batch may be smaller.

When valid persisted state exists:

1. Load inventory, state, and URL-level results.
2. Treat persisted URL-level final results as authoritative.
3. Recalculate counters from URL-level results.
4. Do not revalidate finalized URLs.
5. Resume from the lowest sequence without a final result.

Execute:

```text
WHILE pendingUrls > 0:
  select the next batch containing unfinalized URLs
  validate each selected URL with Fetch MCP
  persist each URL result immediately
  reconcile the batch
  recalculate global state from persisted URL results
  continue from the lowest unfinalized sequence
```

If the workflow runtime cannot continue in the same invocation, persist `PAUSED` state and return the resume coordinates. A surrounding workflow must invoke this skill again with the same `SITEMAP_INDEX_URL` and workspace until `pendingUrls` becomes zero.

## Phase 5: Validate each URL

Use GET. HEAD may be used only as a preliminary request; use GET when HEAD is unsupported, inconclusive, or conflicts with GET behavior.

Capture when exposed:

- sequence and original URL
- source sitemap(s)
- method and attempt count
- HTTP status and text
- final URL
- redirect count and chain
- response duration
- Content-Type and Content-Length
- retry recovery flag
- final status and failure category
- failure reason and sanitized response excerpt

Do not save successful response bodies.

### PASS

Mark `PASS` only when Fetch MCP attempted the URL, the final status is 200-299, no redirect loop exists, and there is no confirmed broken-link or strong soft-error condition.

### FAIL

Mark `FAIL` for confirmed broken-link conditions, including non-blocking 4xx, 5xx, DNS failure, SSL failure, connection failure, redirect loop, redirect-limit excess, malformed response, confirmed soft error, or an eligible retry that still fails.

### BLOCKED

Mark `BLOCKED` for authentication requirements, persistent 429, access denial, CAPTCHA, explicit bot challenge, geo restriction, or explicit automated-access restriction. A 403 alone is not proof of bot protection.

### NOT_TESTED

Mark `NOT_TESTED` only when this specific selected URL could not be attempted for a confirmed URL-specific or tool-specific reason, such as invalid syntax, unsupported protocol, Fetch MCP execution failure, or unavailable required capability. Never use it for queued URLs not yet reached.

## Retry policy

Retry no more than `RETRY_COUNT` for timeout, temporary DNS or connection failure, connection reset, and HTTP 429, 502, 503, or 504. Preserve first-attempt evidence. Respect `Retry-After` when exposed and reduce concurrency when rate limiting occurs.

If retry succeeds, set:

```text
status=PASS
attempts=2
recoveredAfterRetry=true
```

Otherwise classify from final observed evidence.

## Diagnostic categories

Use exactly one primary diagnostic category:

```text
HTTP_400 HTTP_401 HTTP_403 HTTP_404 HTTP_405 HTTP_408 HTTP_409 HTTP_410
HTTP_429 HTTP_OTHER_4XX HTTP_500 HTTP_501 HTTP_502 HTTP_503 HTTP_504
HTTP_OTHER_5XX TIMEOUT DNS_FAILURE SSL_FAILURE CONNECTION_FAILURE
REDIRECT_LOOP REDIRECT_LIMIT BOT_CHALLENGE ACCESS_DENIED
AUTHENTICATION_REQUIRED RATE_LIMITED FETCH_TOOL_ERROR INVALID_RESPONSE
SOFT_ERROR UNKNOWN
```

Classify `BOT_CHALLENGE` only when the returned response explicitly identifies a bot/automation challenge or CAPTCHA. For an unexplained 403, use `BLOCKED`, `HTTP_403`, and diagnostic classification `UNKNOWN`.

For unsuccessful requests, capture up to 2,000 characters of useful response content when available. Remove scripts, styles, cookies, authorization values, tokens, session identifiers, API keys, passwords, secrets, and practical PII.

## Soft-error detection

A 200 response may be `FAIL/SOFT_ERROR` only when strong response evidence shows an error page, such as a combination of an error title, primary not-found message, known application error template, server error, maintenance message, access denial, or unexpectedly empty page. Do not classify from one weak keyword.

## Persistence and reconciliation

After every URL, upsert one result by sequence and atomically persist it. Never create duplicate records for a sequence.

After every batch verify:

```text
BATCH_FINALIZED = BATCH_PASS + BATCH_FAIL + BATCH_BLOCKED + BATCH_NOT_TESTED
BATCH_SELECTED = BATCH_FINALIZED
```

If the second equality fails, mark the batch `PARTIAL`, preserve completed results, and resume from the lowest unprocessed sequence.

After every batch recalculate:

```text
processedUrls = count(final URL statuses)
pendingUrls = totalUniqueUrls - processedUrls
processedUrls = passed + failed + blocked + notTested
```

If pending remains, set `IN_PROGRESS`, `executionComplete=false`, and `fullValidation=false`.

## State schema

```json
{
  "sitemapIndex": "",
  "totalUniqueUrls": 0,
  "batchSize": 100,
  "totalBatches": 0,
  "currentBatch": 1,
  "lastCompletedBatch": 0,
  "nextBatch": 1,
  "nextUrlSequence": 1,
  "processedUrls": 0,
  "pendingUrls": 0,
  "passed": 0,
  "failed": 0,
  "blocked": 0,
  "notTested": 0,
  "recoveredAfterRetry": 0,
  "executionStatus": "READY",
  "fullValidation": false,
  "executionComplete": false
}
```

## Results schema

```json
{
  "sitemapIndex": "",
  "executionDate": "",
  "executionStatus": "READY",
  "fullValidation": false,
  "samplingApplied": false,
  "urlLimitApplied": false,
  "summary": {
    "sitemapsDiscovered": 0,
    "sitemapsProcessed": 0,
    "sitemapsFailed": 0,
    "urlEntriesDiscovered": 0,
    "uniqueUrls": 0,
    "urlsQueued": 0,
    "urlsAttempted": 0,
    "pending": 0,
    "passed": 0,
    "failed": 0,
    "blocked": 0,
    "notTested": 0,
    "recoveredAfterRetry": 0,
    "redirectedUrls": 0
  },
  "batchResults": [],
  "urlResults": [],
  "sitemapFailures": [],
  "failureCategories": [],
  "limitations": []
}
```

Keep PASS entries compact. Store detailed evidence only for `FAIL`, `BLOCKED`, and `NOT_TESTED`.

## Final consistency gate

Set `COMPLETE`, `executionComplete=true`, and `fullValidation=true` only when all conditions hold:

- every discovered sitemap has a final sitemap status
- every unique executable URL has a final URL status
- pending is zero
- processed equals unique URLs
- PASS + FAIL + BLOCKED + NOT_TESTED equals unique URLs
- sampling and URL-limit flags are false
- each failure/block/not-tested result has a specific reason
- no PASS lacks a Fetch attempt
- no unsupported metric is invented
- persisted evidence contains no credentials, cookies, tokens, or secrets

Otherwise set `INCOMPLETE` or `PAUSED`, keep `fullValidation=false`, and record the exact inconsistency.

## Report-generation gate

Generate the final self-contained HTML report only when:

1. pending is zero, or
2. a confirmed unrecoverable platform/tool failure prevents continuation and the report is prominently labelled `INCOMPLETE`.

Do not generate a COMPLETE report after a sample, first batch, or partial run.

The HTML report must use embedded CSS and no external JavaScript. It must include:

1. Executive summary
2. Coverage cards: total, processed, pending, pass, fail, blocked, not tested
3. Batch summary
4. Sitemap summary
5. Failure summary grouped by diagnostic category
6. Expandable details for FAIL, BLOCKED, and NOT_TESTED only
7. Five most frequent available issue categories
8. Actual limitations encountered

Do not list PASS URLs individually.

Before returning, verify that HTML totals, JSON totals, and state totals agree and that all expected files exist.

## Final response contract

For complete execution, return only the status, coverage counts, batch counts, and report paths. For paused execution, return only the paused status, persisted counts, next batch/sequence, state/results paths, confirmed pause reason, and the instruction to resume from persisted state.

Never claim COMPLETE when pending is greater than zero.
