---
name: jira-current-state-reader
description: Retrieve and normalize the current state of a configured
  Jira story for QA qualification. Use when a Jira Story Intake and QA
  Qualification workflow needs the current summary, description, labels,
  acceptance criteria, testing requirements, current comments, and
  authorized supporting information. Never use Jira changelog history or
  previous execution artifacts as current qualification evidence.
---

# Jira Current-State Reader

## Objective

Retrieve the single configured Jira issue and provide the current Jira
information required by the QA qualification workflow.

-   Use the configured Jira issue key wherever the issue must be
    retrieved or referenced.
-   Do not repeat or hard-code the Jira issue key.
-   Return the actual Jira issue key so that downstream Skills can use
    it in output filenames.

## Current-State Rule

Do NOT consider Jira's past changelog history when retrieving
information for QA qualification.

Jira information may have been corrected from an older incorrect value
to the current correct value.

Qualification input MUST use the CURRENT Jira issue state only.

Retrieve current:

-   Summary
-   Description
-   Jira labels
-   Acceptance Criteria
-   UI requirements
-   API requirements
-   Accessibility requirements
-   Relevant current Jira comments when applicable
-   Relevant explicitly authorized supporting information

Do NOT return historical values as qualification evidence from:

-   Jira changelog
-   Previous field values
-   Previous labels
-   Previous descriptions
-   Previous acceptance criteria
-   Previous issue states
-   Previous qualification executions

Historical information MUST NOT override the current Jira state.

## Jira Retrieval

Use the authorized Jira integration to retrieve the configured issue.

Use Jira as the primary source of story-specific truth.

Do not invent:

-   Requirements
-   Acceptance criteria
-   Expected outcomes
-   Business rules
-   API endpoints
-   API contracts
-   Accessibility standards
-   Target URLs
-   User journeys

Do not:

-   Modify Jira
-   Edit Jira
-   Transition Jira
-   Update Jira fields
-   Add Jira comments

## Successful Retrieval Output

Return:

-   Actual Jira issue key
-   Retrieval status
-   Retrieval evidence
-   Current summary
-   Current description
-   Current Jira labels
-   Current acceptance criteria
-   Current UI requirements
-   Current API requirements
-   Current accessibility requirements
-   Relevant current comments
-   Relevant authorized supporting information

Do not include Jira changelog or historical values as qualification
evidence.

## Jira Retrieval Failure

If Jira retrieval fails:

-   Record the actual sanitized retrieval or integration error.
-   Set the Jira retrieval result to the appropriate failed state.
-   Do not invent story details.
-   Do not use details from a previous execution.
-   Return sufficient failure information for the qualification workflow
    to set `qaReady=false`.
-   Do not execute downstream QA.

The downstream qualification workflow must still be able to generate:

-   The qualification JSON
-   The QA Qualification Gaps HTML

## Existing Data Safety

Do not treat data from an old JSON or HTML report as the current Jira
state.

Do not derive the issue key from historical Jira data or previous
execution artifacts.

Return only information retrieved or authorized for the current
execution.
