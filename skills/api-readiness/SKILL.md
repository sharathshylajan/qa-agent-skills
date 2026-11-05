---
name: api-readiness
description: Assess API readiness for a Jira story during QA
  qualification. Use only when Testing_Type is API, or when the common
  qualification workflow needs a NOT_APPLICABLE API readiness result for
  another testing type. Evaluate service identity, endpoint or
  operation, HTTP method, expected behavior, and acceptance criteria
  without executing API tests.
---

# API Readiness

## Applicability

When Testing_Type = API, assess only relevant API readiness.

For non-API testing types:

-   Set API_readiness.status = NOT_APPLICABLE.
-   Provide a concise reason.
-   Do not allow API_readiness to affect qaReady.

## API Readiness Assessment

Assess:

-   The API or service under test can be identified.
-   The required endpoint or operation is available when necessary.
-   The HTTP method is available when necessary.
-   Expected behavior is sufficiently defined.

Do NOT require a supplied sample request or response if a safe
representative example can be generated from documented requirements.

Do NOT invent:

-   Endpoint
-   HTTP method
-   Contract
-   Expected response
-   Business logic

Check current Jira fields and relevant authorized supporting sources
before determining that information is missing.

Do not create acceptance criteria or API contracts on behalf of the
product owner.

If an endpoint or operation is required for reliable API validation and
is unavailable:

-   Set the applicable checklist status to MISSING.
-   Create a qualification-relevant missingInformation entry.

If the HTTP method is required for reliable API validation and is
unavailable:

-   Set the applicable checklist status to MISSING.
-   Create a qualification-relevant missingInformation entry.

If requirements conflict or cannot be interpreted reliably:

-   Set the applicable checklist status to UNCLEAR.
-   Create a qualification-relevant missingInformation entry.

## Optional API Data

Do not treat absent:

-   Sample payloads
-   Mock data
-   Synthetic test data
-   Test fixtures
-   Generic example values
-   Supplied sample request
-   Supplied sample response

as blockers when they can be generated safely from explicit documented
requirements.

Do not invent requirements to generate those examples.

## Missing Information

Return only API information that is:

-   Absent
-   Incomplete
-   Conflicting
-   Unclear

AND relevant to API qualification.

Each gap must contain:

-   field
-   missing_or_unclear_information
-   why_required
-   blocking
-   suggested_resolution

Set blocking=true only when the unresolved information prevents reliable
API validation and cannot be retrieved or safely generated without
inventing requirements.

Do not classify optional information as blocking.

## Readiness Decision

Set API_readiness.status = READY only when:

-   The API or service under test can be identified.
-   Required endpoint or operation information is available when
    necessary.
-   Required HTTP method information is available when necessary.
-   Expected behavior is sufficiently defined.
-   No blocking API qualification issue remains.

Set API_readiness.status = NOT_READY when a blocking API qualification
issue remains.

## Output

Return:

API_readiness:

-   status: READY, NOT_READY, or NOT_APPLICABLE
-   details
-   checklist

Also return any API-specific missingInformation entries.

Do not calculate the final qaReady Boolean.

Do not execute:

-   API tests
-   API calls for test execution
-   Test design agents
-   Test execution agents
-   Downstream QA validation
