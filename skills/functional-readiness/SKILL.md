---
name: functional-readiness
description: Assess Functional and UI readiness for a Jira story during
  QA qualification. Use only when Testing_Type is Functional, or when
  the common qualification workflow needs a NOT_APPLICABLE Functional
  readiness result for another testing type. Evaluate acceptance
  criteria, expected behavior, and identifiable scope without executing
  UI tests.
---

# Functional and UI Readiness

## Applicability

When Testing_Type = Functional, assess only relevant Functional and UI
readiness.

For non-Functional testing types:

-   Set UI_readiness.status = NOT_APPLICABLE.
-   Provide a concise reason.
-   Do not allow UI_readiness to affect qaReady.

## Functional Readiness Assessment

Verify:

-   Applicable acceptance criteria are available.
-   Relevant expected behavior or outcomes are sufficiently clear.
-   Required scope can be identified.

Do not require unnecessary implementation details.

Check current Jira fields and relevant authorized supporting sources
before determining that information is missing.

Do not invent:

-   Requirements
-   Acceptance criteria
-   Expected behavior
-   Target URLs
-   User journeys
-   Business rules

Do not create acceptance criteria on behalf of the product owner.

If applicable acceptance criteria are genuinely required and unavailable
from acceptable sources:

-   Set the applicable checklist status to MISSING.
-   Create a corresponding missingInformation entry when
    qualification-relevant.

If Functional scope or expected behavior conflicts or cannot be
interpreted reliably:

-   Set the applicable checklist status to UNCLEAR.
-   Create a corresponding missingInformation entry when
    qualification-relevant.

Do not automatically create a gap merely because implementation details
are absent.

## Missing Information

Return only Functional/UI information that is:

-   Absent
-   Incomplete
-   Conflicting
-   Unclear

AND relevant to Functional qualification.

Each gap must contain:

-   field
-   missing_or_unclear_information
-   why_required
-   blocking
-   suggested_resolution

Set blocking=true only when the unresolved information prevents reliable
Functional QA validation and cannot be retrieved or safely determined
without inventing requirements.

Do not classify optional information as blocking.

## Readiness Decision

Set UI_readiness.status = READY only when:

-   Applicable acceptance criteria are available.
-   Relevant expected behavior or outcomes are sufficiently clear.
-   Required Functional/UI scope can be identified.
-   No blocking Functional/UI qualification issue remains.

Set UI_readiness.status = NOT_READY when a blocking Functional/UI
qualification issue remains.

## Output

Return:

UI_readiness:

-   status: READY, NOT_READY, or NOT_APPLICABLE
-   details
-   checklist

Also return any Functional/UI-specific missingInformation entries.

Do not calculate the final qaReady Boolean.

Do not execute:

-   Functional testing
-   Browser automation
-   Playwright
-   Test design
-   Test execution
