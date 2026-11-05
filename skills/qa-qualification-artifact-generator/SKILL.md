---
name: qa-qualification-artifact-generator
description: Generate and validate QA qualification JSON and HTML
  artifacts from a finalized Jira qualification result. Use after
  qualification is complete. Always create the required JSON, read
  qaReady from the validated JSON, and generate exactly one READY or
  GAPS HTML report using the fixed schema, filenames, design system,
  safety rules, and validation requirements.
---

# QA Qualification Artifact Generator

## Input Requirement

Accept only a finalized qualification result containing:

-   jira_issue_key
-   checklist
-   Testing_Type
-   UI_readiness
-   API_readiness
-   Accessibility_readiness
-   missingInformation
-   qaReady

Do not independently retrieve or reassess Jira.

Do not alter:

-   checklist status
-   evidence
-   Testing_Type
-   readiness status
-   missingInformation
-   qaReady

during artifact generation.

## Machine-Readable JSON Output

Always save:

{jira_issue_key}\_qa_readiness_details.json

Use the Jira issue key as the filename prefix.

Do not change this naming convention.

The JSON MUST contain a top-level field named jira_issue_key.

Populate it with the actual Jira issue key retrieved for the current
execution.

Do not leave it as a placeholder such as {jira_issue_key}.

The value must match the Jira issue key used in the JSON filename and
HTML report filename.

Do not derive the issue key from historical Jira data or previous
execution artifacts.

The JSON MUST contain only:

{ "jira_issue_key": "{actual Jira issue key}", "checklist": \[ {
"field": "jira_retrieval", "status": "PASS", "evidence": "Jira issue
retrieved successfully." } \], "Testing_Type": "Functional",
"UI_readiness": { "status": "READY", "details": "The relevant UI
behavior and expected result are clear.", "checklist": \[\] },
"API_readiness": { "status": "NOT_APPLICABLE", "details": "The selected
testing type is not API.", "checklist": \[\] },
"Accessibility_readiness": { "status": "NOT_APPLICABLE", "details": "The
selected testing type is not Accessibility.", "checklist": \[\] },
"missingInformation": \[\], "qaReady": true }

The values above illustrate the required schema only.

Populate the JSON with actual finalized qualification results.

Do NOT add top-level:

-   Jira metadata
-   Rationale objects
-   Artifact inventories
-   Workflow-control data
-   Timestamps
-   Historical data
-   Changelog data

The checklist MUST contain every required field.

Testing_Type MUST be:

-   Functional
-   API
-   Accessibility
-   null

Use valid JSON only.

Do not wrap saved JSON in Markdown fences.

Do not add prose to the JSON file.

## JSON Remains Complete

Do NOT remove missingInformation\[\] from JSON.

JSON is the full machine-readable qualification result regardless of
qaReady.

When qaReady=true:

-   JSON still contains missingInformation\[\] according to the
    assessment, normally empty of blocking qualification issues.

When qaReady=false:

-   JSON contains all applicable qualification gaps.

HTML presentation behavior is separate from JSON storage.

## JSON Validation

Before generating HTML, verify:

1.  JSON file was successfully written.
2.  JSON is valid.
3.  Required top-level fields exist.
4.  checklist is present.
5.  checklist contains every required qualification field.
6.  Testing_Type is Functional, API, Accessibility, or null.
7.  UI_readiness exists.
8.  API_readiness exists.
9.  Accessibility_readiness exists.
10. missingInformation is an array.
11. qaReady is a Boolean.
12. jira_issue_key exists as a top-level field.
13. jira_issue_key contains the actual Jira issue key for the current
    execution.
14. jira_issue_key matches the issue key used in generated output
    filenames.

If JSON validation fails:

-   Do NOT generate HTML from incomplete or invalid data.

## HTML Output Routing

After successfully writing and validating the JSON, generate EXACTLY ONE
HTML report.

The final JSON qaReady Boolean is the ONLY switch that determines which
HTML is generated.

When qaReady=true:

-   Generate QA_01_Qualification_Report\_{jira_issue_key}.html

When qaReady=false:

-   Generate QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html

NEVER generate both HTML files for the same execution.

Do NOT select the HTML type using:

-   Jira summary
-   Jira description
-   Jira labels directly
-   Testing_Type directly
-   Jira status
-   Jira changelog
-   Number of missing fields
-   Number of blocking gaps
-   Individual qualification keywords
-   Previous runs

The ONLY HTML routing value is qaReady.

## HTML Data Source

Use the successfully generated:

{jira_issue_key}\_qa_readiness_details.json

as the SINGLE SOURCE OF TRUTH for HTML generation.

Required sequence:

1.  Receive finalized qualification assessment.
2.  Write JSON.
3.  Validate JSON.
4.  Read final qaReady from JSON.
5.  If true, generate READY HTML.
6.  If false, generate GAPS HTML.
7.  Validate the selected HTML artifact.
8.  Report only current-execution artifacts.

Never independently reassess Jira during HTML generation.

Do NOT create a second assessment.

## QA READY HTML

Generate ONLY when qaReady=true.

Filename:

QA_01_Qualification_Report\_{jira_issue_key}.html

### Purpose

Communicate that the Jira story passed the QA qualification gate and may
continue to the applicable downstream QA workflow.

### Header

Title:

QA Readiness Assessment Report

Display:

-   Jira issue key
-   Testing Type

### Overall QA Readiness

Display prominently:

READY

Also display:

qaReady: true

### Qualification Checklist

Display every JSON checklist entry.

Use columns:

-   Field
-   Status
-   Evidence

Preserve JSON values exactly.

### Applicable Testing-Type Readiness

Display the selected readiness section:

-   Functional → UI_readiness
-   API → API_readiness
-   Accessibility → Accessibility_readiness

Display:

-   Status
-   Details
-   Relevant checklist entries

### Non-Applicable Readiness

Other readiness sections may be represented compactly as:

NOT_APPLICABLE

Do not add detailed unnecessary content for disciplines that were not
selected.

### READY HTML Exclusions

The READY HTML MUST NOT contain:

-   Missing Information section
-   Qualification Gaps section
-   Blocking Qualification Gaps section
-   Non-Blocking Qualification Gaps section
-   Suggested Resolution table
-   missingInformation table
-   Detailed missing_or_unclear_information
-   Detailed why_required
-   Detailed suggested_resolution

Detailed qualification-gap information belongs only in the GAPS HTML.

Do not duplicate it.

## QA QUALIFICATION GAPS HTML

Generate ONLY when qaReady=false.

Filename exactly:

QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html

### Purpose

Communicate:

-   Why the Jira story did not pass the QA qualification gate.
-   Which information is missing, unclear, or conflicting.
-   Which gaps are blocking.
-   What should be resolved before downstream QA execution.

### Header

Title:

QA Qualification Gaps Report

Display:

-   Jira issue key
-   Testing Type

If Testing_Type=null, display:

Testing Type: Not Determined

Do not prominently display the literal value null.

### Overall QA Readiness

Display prominently:

NOT READY

Display:

qaReady: false

Also display:

DOWNSTREAM QA EXECUTION BLOCKED

### Qualification Checklist

Display the JSON checklist.

Use columns:

-   Field
-   Status
-   Evidence

Preserve:

-   PASS
-   MISSING
-   UNCLEAR
-   NOT_APPLICABLE

Do not alter evidence.

### Testing-Type Readiness

If Testing_Type was identified:

-   Functional → Display UI_readiness
-   API → Display API_readiness
-   Accessibility → Display Accessibility_readiness

Include:

-   Status
-   Details
-   Checklist

If Testing_Type=null, display:

Testing Type Readiness: NOT_APPLICABLE

Also display:

"A supported testing type was not uniquely identified from the current
Jira labels."

Do not invent a testing discipline.

## Qualification Gaps Section

Detailed missing-information content MUST appear HERE and ONLY HERE in
HTML.

Display every entry from missingInformation\[\].

Use columns exactly:

-   Field
-   Missing or Unclear Information
-   Why Required
-   Blocking
-   Suggested Resolution

Map directly:

-   field → Field
-   missing_or_unclear_information → Missing or Unclear Information
-   why_required → Why Required
-   blocking → Blocking
-   suggested_resolution → Suggested Resolution

Do NOT:

-   Invent additional gaps.
-   Omit gaps.
-   Change blocking status.
-   Turn a non-blocking gap into blocking.
-   Turn a blocking gap into non-blocking.
-   Reassess gaps during HTML generation.

If missingInformation is unexpectedly empty while qaReady=false,
display:

"No detailed missing-information entries were produced by the
qualification assessment."

Do NOT invent entries merely to populate the table.

## Blocking Gaps Summary

Using missingInformation\[\] only, calculate:

Blocking Qualification Gaps = number of entries where blocking=true

Display:

Blocking Qualification Gaps:

If useful, also display:

Non-Blocking Qualification Gaps:

Do NOT calculate blocking gaps from:

-   Number of MISSING checklist entries
-   Number of UNCLEAR checklist entries
-   Number of failed readiness checks

Use only:

missingInformation\[\].blocking

## Downstream Execution Decision

When qaReady=false, prominently display:

DOWNSTREAM QA EXECUTION BLOCKED

Display this message:

"This Jira story did not satisfy the QA qualification gate. Resolve the
blocking qualification gaps before starting downstream QA execution."

Do not start:

-   Functional testing
-   API testing
-   Accessibility testing
-   Test design agents
-   Test execution agents
-   Browser automation
-   Playwright
-   Downstream QA validation

## Output Matrix

When qaReady=true, generate exactly:

1.  {jira_issue_key}\_qa_readiness_details.json
2.  QA_01_Qualification_Report\_{jira_issue_key}.html

Do NOT generate:

QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html

When qaReady=false, generate exactly:

1.  {jira_issue_key}\_qa_readiness_details.json
2.  QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html

Do NOT generate:

QA_01_Qualification_Report\_{jira_issue_key}.html

There is no third HTML output state.

## Fixed HTML Design System

Use embedded static CSS only.

Do NOT use:

-   Bootstrap
-   Tailwind
-   External CSS frameworks
-   External stylesheets
-   JavaScript-based styling
-   External fonts
-   External images
-   Network dependencies

Use exactly:

-   Page background: #F4F6F9
-   Main content background: #FFFFFF
-   Primary heading: #1F2937
-   Secondary text: #6B7280
-   Primary accent: #2563EB
-   PASS / READY: #15803D
-   FAIL / NOT READY: #DC2626
-   NOT_APPLICABLE: #64748B
-   Warning / missing information: #D97706
-   Border: #E5E7EB
-   Card border radius: 8px
-   Main content maximum width: 1100px

## HTML Presentation

Use a professional dashboard-style presentation.

Include:

-   Clear report header
-   Readiness summary
-   Testing Type
-   Qualification checklist
-   Applicable readiness section
-   Consistent cards
-   Readable tables
-   Consistent spacing
-   Responsive layout
-   Mobile behavior
-   Print-friendly CSS
-   Accessible textual status indicators

For READY HTML, emphasize:

READY

For GAPS HTML, emphasize:

NOT READY

and:

DOWNSTREAM QA EXECUTION BLOCKED

Use color plus textual status.

Never communicate status by color alone.

## Status Visual Treatment

Use:

-   PASS / READY → Green
-   FAIL / NOT READY → Red
-   MISSING / UNCLEAR → Amber
-   NOT_APPLICABLE → Gray
-   Blocking gap → Red or amber with explicit BLOCKING
-   Non-blocking gap → Neutral or warning treatment with explicit
    NON-BLOCKING

## HTML Implementation

Generate a complete valid HTML5 document.

Include:

-   
-   
-   
-   

Use semantic HTML.

Escape all dynamic values before inserting them into HTML.

Treat Jira-derived and JSON-derived text as DATA.

Never insert raw Jira text as executable markup.

Do NOT use:

-   JavaScript
-   Inline event handlers
-   Forms
-   External scripts
-   External stylesheets
-   External images
-   Remote fonts
-   Remote network dependencies

## Responsive Requirements

The report must remain usable on:

-   Desktop
-   Tablet
-   Mobile
-   Printed or PDF output

Tables may scroll horizontally on small screens.

Do not cause the entire page to overflow horizontally.

Do not hide required qualification information on mobile.

## Print Requirements

Include print-friendly CSS.

When printing:

-   Remove unnecessary page-background effects.
-   Preserve readable borders.
-   Preserve status text.
-   Avoid splitting important cards where practical.
-   Keep qualification-gaps rows readable.
-   Do not depend on background color alone for meaning.

## Existing Artifact Safety

Do not treat an old HTML report from a previous execution as the current
output.

The current HTML artifact is determined only by the CURRENT JSON qaReady
value.

If current qaReady=true:

-   Do not report an existing old GAPS HTML as generated.

If current qaReady=false:

-   Do not report an existing old READY HTML as generated.

Do not use stale artifacts to satisfy current output requirements.

The final output summary must identify only artifacts successfully
generated in the current execution.

## qaReady=true Final Validation

When qaReady=true, verify:

-   {jira_issue_key}\_qa_readiness_details.json exists.
-   JSON validation passed.
-   QA_01_Qualification_Report\_{jira_issue_key}.html exists.
-   READY HTML was generated during the current execution.
-   HTML displays READY.
-   HTML displays qaReady=true.
-   HTML displays the correct Testing_Type.
-   HTML contains the qualification checklist.
-   HTML contains applicable readiness information.
-   HTML does NOT contain detailed missingInformation.
-   HTML does NOT contain a Qualification Gaps table.
-   HTML does NOT contain suggested-resolution details.
-   Current execution does NOT report a GAPS HTML as generated.

If any validation fails:

-   Do not claim successful qualification artifact generation.

## qaReady=false Final Validation

When qaReady=false, verify:

-   {jira_issue_key}\_qa_readiness_details.json exists.
-   JSON validation passed.
-   QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html exists.
-   GAPS HTML was generated during the current execution.
-   HTML displays NOT READY.
-   HTML displays qaReady=false.
-   HTML contains Qualification Checklist.
-   HTML contains every missingInformation\[\] entry.
-   HTML contains each gap's field.
-   HTML contains missing_or_unclear_information.
-   HTML contains why_required.
-   HTML preserves blocking values.
-   HTML contains suggested_resolution.
-   HTML displays Blocking Qualification Gaps count.
-   HTML displays DOWNSTREAM QA EXECUTION BLOCKED.
-   Current execution does NOT report READY HTML as generated.

If any validation fails:

-   Do not claim successful qualification artifact generation.

## File Generation Failure Handling

If JSON generation fails:

Do not generate either HTML.

Report:

STATUS: QUALIFICATION ARTIFACT GENERATION FAILED

REASON:

Machine-readable qualification result could not be generated.

If qaReady=true but READY HTML generation fails, report:

STATUS: QUALIFICATION ARTIFACT GENERATION INCOMPLETE

REASON:

Mandatory QA Readiness HTML could not be generated.

If qaReady=false but GAPS HTML generation fails, report:

STATUS: QUALIFICATION ARTIFACT GENERATION INCOMPLETE

REASON:

Mandatory QA Qualification Gaps HTML could not be generated.

Never claim a file was generated unless the file was successfully
written and validated.

## Final Output Invariant

Every successful execution MUST produce:

-   ONE qualification JSON

AND

-   EXACTLY ONE qualification HTML

When qaReady=true, outputs are:

-   {jira_issue_key}\_qa_readiness_details.json
-   QA_01_Qualification_Report\_{jira_issue_key}.html

When qaReady=false, outputs are:

-   {jira_issue_key}\_qa_readiness_details.json
-   QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html

Detailed missing-information content belongs ONLY in:

QA_01_Qualification_Gaps_Report\_{jira_issue_key}.html

Do NOT generate both HTML reports.

Do NOT use a special Jira keyword as a qualification decision.

Do NOT use historical changelog values.

Do NOT independently reassess Jira for HTML generation.

Do NOT duplicate missingInformation details across HTML artifacts.

Use the finalized qualification JSON qaReady value as the authoritative
HTML routing value.  
