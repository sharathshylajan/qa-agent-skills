---
name: accessibility-readiness
description: Assess Accessibility readiness for a Jira story during QA
  qualification. Use when Testing_Type is Accessibility, or when the
  common qualification workflow needs a NOT_APPLICABLE Accessibility
  readiness result. Evaluate target scope, URL consistency,
  requirements, approved accessibility baselines, WCAG configuration,
  authentication, test data, interactions, and downstream execution
  dependencies without running accessibility tests.
---

# Accessibility Readiness

## Applicability

When Testing_Type = Accessibility, apply all Accessibility-specific
qualification rules.

For non-Accessibility testing types:

-   Set Accessibility_readiness.status = NOT_APPLICABLE.
-   Provide a concise reason.
-   Do not allow Accessibility_readiness to affect qaReady.

## Accessibility Acceptance Criteria

Accept accessibility requirements found in:

-   Jira Acceptance Criteria
-   Jira description
-   Explicitly approved project-wide baseline
-   Approved Accessibility Testing Agent specification

Use the approved Accessibility Testing Agent's standard checks as the
baseline.

Do not mark accessibility acceptance criteria as missing merely because
the Jira story does not repeat the standard accessibility testing
baseline.

## Accessibility Target and Scope

Require an identifiable:

-   Page
-   Component
-   User journey
-   Explicit valid target

Check the actual target URL when available.

If the stated scope and URL conflict:

-   Set the applicable status to UNCLEAR.
-   Record the qualification-relevant conflict.
-   Do not guess or silently replace the target.

## Accessibility Downstream Testing Specification

Treat the approved Accessibility Testing Agent specification as the
source for standard:

-   Browser behavior
-   Browser authentication procedure
-   WCAG scanning rules
-   axe-core rules
-   Automated testing behavior
-   Manual validation expectations
-   Scan limits
-   Security rules
-   Reporting requirements

Do NOT report those standard configurations as missing Jira information.

Only report missing information when a story-specific requirement or
actual required execution dependency is unavailable.

## A. Target and Scope

Verify:

-   Target page, component, or journey is identifiable.
-   Target URL is present or can be obtained unambiguously from
    authorized Jira information.
-   Actual URL destination agrees with stated scope.
-   Conflicting targets are recorded as UNCLEAR.

Do not invent target URLs or user journeys.

## B. Accessibility Requirements

Verify:

-   Accessibility testing intent is clear.
-   Story-specific accessibility requirements are identifiable when
    present.
-   WCAG version or conformance level comes from Jira or explicitly
    approved project-wide configuration.

If Jira does not define a story-specific WCAG target, use the approved
Accessibility Testing Agent baseline when that baseline is available.

Do not invent a conformance target.

## C. Acceptance Criteria and Expected Results

Check:

-   Jira acceptance criteria
-   Jira description
-   Supporting authorized requirements
-   Approved Accessibility Testing Agent baseline

Standard accessibility validation requirements do not need to be
repeated inside every Jira issue.

Custom story-specific interactions or behavior must still be
sufficiently clear when required.

## D. Authentication and Access

Determine whether the target page requires authentication when this can
be established from authorized information.

Credentials are NOT required to be stored in Jira.

If authentication is not required:

-   Set Authentication prerequisite = NOT_APPLICABLE.

If authentication is handled by the approved downstream secure runtime:

-   Do not report missing Jira credentials as a qualification gap.

If required downstream authentication cannot be verified, distinguish:

-   "authentication configuration could not be verified"

from:

-   "credentials are missing"

Do not claim credentials are missing without evidence.

Before reporting an authentication dependency:

-   Verify the downstream authentication configuration when the
    qualification workflow has authorized visibility into that
    configuration.

If configuration exists:

-   Do NOT report the absence of Jira credentials as missing
    information.

If configuration cannot be verified:

-   Report specifically that the approved authentication or access
    configuration could not be verified.
-   Do NOT claim that credentials are missing without supporting
    evidence.

## E. Test Data and Interactions

Identify story-relevant:

-   Forms
-   Inputs
-   Menus
-   Dialogs
-   Navigation controls
-   Interactive elements

Require specific test data only when behavior cannot be validated using
safe or generic inputs.

Do not require sample data for a static page audit when no test data is
needed.

If behavior depends on a specific:

-   Account
-   Role
-   Application state

verify that the required prerequisite is available.

## F. Downstream Execution Configuration

Confirm the approved Accessibility Testing Agent specification is
available to the downstream workflow.

Treat configured:

-   Browser setup
-   Authentication
-   WCAG or axe rules
-   Scan limits
-   Manual checks
-   Reporting requirements

as downstream execution configuration.

Do not require Jira to repeat them.

Report a missing dependency only when a required downstream
configuration is actually unavailable.

## Accessibility Missing-Information Rules

Do NOT create a blocking acceptance_criteria entry when:

-   The approved Accessibility Testing Agent baseline supplies
    sufficient standard checks

AND

-   Jira identifies the required target or scope.

Do NOT create blocking expected_behavior entries when:

-   Expected accessibility behavior comes from an approved baseline

AND

-   No custom story-specific expected behavior is required.

Do NOT create a blocking testable_expected_result entry when:

-   The approved accessibility baseline provides measurable automated or
    manual validation outcomes.

Do NOT create a blocking test_data_or_test_inputs entry when:

-   No test data is required

OR

-   Safe generic inputs are sufficient.

Do NOT create credentials-related missing information merely because
credentials are absent from Jira.

Check the approved secure runtime access-provisioning mechanism.

Do NOT create a blocking dependency merely because Jira does not contain
credentials when authentication is managed by the approved downstream
Accessibility Testing Agent.

If Jira conflicts with an approved baseline:

-   Do not silently choose one.
-   Record the qualification-relevant conflict as UNCLEAR.

Only create blocking missingInformation entries when the unresolved
information genuinely prevents:

-   Reliable execution

OR

-   Reliable pass/fail assessment.

## Accessibility READY Decision

Set Accessibility_readiness.status = READY only when:

-   Target and scope are sufficiently clear.
-   Applicable requirements are covered.
-   Expected outcomes are available from Jira or the approved baseline.
-   Required execution and access prerequisites are available.
-   No blocking Accessibility qualification issue remains.

## Accessibility NOT_READY Decision

Set Accessibility_readiness.status = NOT_READY when a blocking issue
remains involving:

-   Story-specific requirement
-   Target ambiguity or conflict
-   Custom expected behavior
-   Required access dependency
-   Required execution dependency

## Output

Return:

Accessibility_readiness:

-   status: READY, NOT_READY, or NOT_APPLICABLE
-   details
-   checklist

Also return all Accessibility-specific missingInformation entries.

Do not calculate the final qaReady Boolean.

Do not execute:

-   Accessibility tests
-   Browser automation
-   Playwright
-   WCAG scans
-   axe-core scans
-   Manual accessibility validation
-   Downstream QA agents
