---
name: qa-common-qualification
description: Perform common QA qualification for a Jira story using
  current Jira evidence. Use to classify Testing_Type from current
  labels, create the required qualification checklist, identify genuine
  missing or unclear information, apply blocking rules, combine the
  applicable testing-type readiness result, and calculate the final
  qaReady Boolean.
---

# QA Common Qualification

## Role and Objective

Perform Jira story intake and QA qualification only.

The workflow must:

1.  Evaluate the CURRENT Jira information only.
2.  Determine Testing_Type from the CURRENT Jira labels.
3.  Assess whether the story contains enough information for QA.
4.  Identify only genuine qualification gaps.
5.  Create the complete qualification result.
6.  Calculate the final qaReady Boolean.

Never:

-   Modify Jira.
-   Edit Jira.
-   Transition Jira.
-   Update Jira fields.
-   Add Jira comments.
-   Execute QA tests.
-   Launch browser automation.
-   Start Playwright.
-   Execute API tests.
-   Execute Accessibility tests.
-   Dispatch downstream QA agents.
-   Invent missing requirements.
-   Invent acceptance criteria.
-   Invent expected behavior.
-   Invent URLs.
-   Invent API contracts.
-   Invent accessibility requirements.

This Skill performs qualification only.

## Determine Testing_Type from Current Jira Labels

Use the CURRENT Jira labels directly.

Do NOT use Jira changelog label history.

Do NOT infer Testing_Type from the description when the necessary Jira
label is expected.

Supported values are exactly:

-   Functional
-   API
-   Accessibility

Match supported labels case-insensitively.

### Exactly One Supported Testing Label

If exactly one supported testing label exists:

-   Set Testing_Type to the corresponding supported value.

### No Supported Testing Label

If no supported testing label exists:

-   Set Testing_Type = null.
-   Add the relevant missing or unclear information to
    missingInformation\[\].
-   Set qaReady=false.

### Multiple Supported Testing Labels

If more than one supported testing label exists:

-   Do not guess which label is primary.
-   Set Testing_Type = null.
-   Record the conflict in missingInformation\[\].
-   Set qaReady=false.

### Unsupported Labels

Ignore unrelated Jira labels for Testing_Type classification.

Do not introduce additional Testing_Type values.

## Required-Field Qualification Checklist

Evaluate every required field.

The checklist MUST contain an entry for every required field:

-   jira_retrieval
-   jira_labels
-   story_summary
-   story_description_or_intent
-   acceptance_criteria

Each checklist entry MUST contain:

-   field
-   status
-   evidence

Allowed statuses:

-   PASS
-   MISSING
-   UNCLEAR
-   NOT_APPLICABLE

## General Checklist Principles

Check current Jira fields and relevant authorized supporting sources
before determining that information is missing.

Use NOT_APPLICABLE only when the field genuinely does not apply under
the qualification rules.

Do not require optional metadata when it is unnecessary for QA
validation.

Do not treat absent:

-   Sample payloads
-   Mock data
-   Synthetic test data
-   Test fixtures
-   Generic example values

as blockers when they can be generated safely from explicit
requirements.

Do not invent expected behavior to make a checklist item PASS.

If acceptance criteria are genuinely required and unavailable from
acceptable sources:

-   Set status = MISSING.
-   Do not create acceptance criteria on behalf of the product owner.

If requirements conflict or cannot be interpreted reliably:

-   Set status = UNCLEAR.

## Testing-Type Readiness

Populate all three readiness sections:

-   UI_readiness
-   API_readiness
-   Accessibility_readiness

Only the selected Testing_Type affects qaReady.

Unselected disciplines MUST NOT affect the qaReady decision.

Use the result returned by the applicable readiness Skill.

For unselected testing types, preserve:

-   status = NOT_APPLICABLE
-   A concise reason
-   An empty checklist when applicable

## Missing Information

Create missingInformation\[\] containing only information that is:

-   Absent
-   Incomplete
-   Conflicting
-   Unclear

AND relevant to qualification.

Each entry MUST contain:

-   field
-   missing_or_unclear_information
-   why_required
-   blocking
-   suggested_resolution

Do not automatically create qualification gaps.

Each reported qualification gap MUST be supported by current evidence.

## Blocking Rule

Set blocking = true only when the missing or unclear information
prevents reliable QA validation and cannot be:

-   Retrieved from Jira
-   Retrieved from an authorized supporting source
-   Supplied by the approved downstream specification
-   Safely generated without inventing requirements

Do not classify optional information as blocking.

## General Qualification Rule

Do NOT treat any particular Jira:

-   Word
-   Phrase
-   Description
-   Summary text
-   Issue status

as an automatic qualification or disqualification instruction.

Always perform the complete qualification assessment.

The final decision comes from actual current Jira evidence and the
qualification rules.

Possible qualification gaps include:

-   Missing supported testing label
-   Conflicting supported testing labels
-   Missing applicable acceptance criteria
-   Unclear story intent
-   Ambiguous Functional scope
-   Missing API endpoint when required
-   Missing API method when required
-   Ambiguous Accessibility target
-   Missing custom expected behavior
-   Required access prerequisite unavailable
-   Conflicting requirements
-   Required downstream configuration unavailable

These are examples only.

Do NOT automatically create these gaps.

Each reported qualification gap MUST be supported by current evidence.

## QA-Ready Decision

Set qaReady = true only when ALL are true:

1.  Jira retrieval succeeded.
2.  Exactly one supported Testing_Type was identified from Jira labels.
3.  Required checklist fields for that Testing_Type are sufficiently
    clear.
4.  The selected testing-type readiness section is READY.
5.  No blocking missingInformation\[\] entry remains.

Otherwise:

-   Set qaReady = false.

A NOT_APPLICABLE readiness section for an unselected testing type MUST
NOT affect qaReady.

For Accessibility, apply all Accessibility-specific qualification rules
before setting qaReady.

A story may have qaReady=true without credentials appearing in Jira
when:

-   Authentication is not required

OR

-   Approved secure downstream authentication exists.

A story remains qaReady=false when a blocking issue remains, including:

-   Ambiguous target scope
-   Undefined required custom expected behavior
-   Required access route unavailable
-   Unsupported or missing Testing_Type
-   Unresolved qualification-critical information

Do NOT start QA execution.

Downstream workflows MUST use qaReady as the qualification gate.

## Output Contract

Return only the qualification data required by the artifact generator:

-   jira_issue_key
-   checklist
-   Testing_Type
-   UI_readiness
-   API_readiness
-   Accessibility_readiness
-   missingInformation
-   qaReady

Do not add:

-   Jira metadata
-   Rationale objects
-   Artifact inventories
-   Workflow-control data
-   Timestamps
-   Historical data
-   Changelog data
