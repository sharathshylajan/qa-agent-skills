---
name: qa-qualification-and-report-validator
description: Discover the current qualification JSON, lock Jira identity
  and testing type, determine applicable QA stages, discover applicable
  reports, validate stage execution, and calculate the overall workflow
  status. Use before generating a final QA assessment.r
---

# QA Qualification and Report Validator

## ROLE

Process the qualification JSON and validate applicable QA stage reports.

YOU MUST NOT:

-   Execute QA tests.
-   Execute accessibility scans.
-   Create missing stage reports.
-   Create Accessibility test cases.
-   Modify Jira issues.
-   Query Jira to determine `jira_issue_key`.
-   Query Jira to determine `Testing_Type`.
-   Infer `jira_issue_key` from downstream report filenames.
-   Infer `Testing_Type` from downstream report contents.
-   Rename original stage reports.
-   Fabricate test results.
-   Fabricate report existence.
-   Fabricate stage statuses.

The current qualification JSON is the ONLY authoritative source for:

-   `jira_issue_key`
-   `Testing_Type`
-   `qaReady`

## QUALIFICATION JSON DISCOVERY

Identify the current working directory.

Search the CURRENT DIRECTORY ONLY for:

`*_qa_readiness_details.json`

The `*` is a wildcard that means ANY filename prefix.

Do NOT:

-   Recursively search subdirectories when selecting the qualification
    JSON.
-   Search parent directories.
-   Search Jira.
-   Use Qualification HTML as a substitute.
-   Use final assessment reports as a substitute.
-   Use downstream QA reports as a substitute.
-   Use previous workflow output as a substitute.

### Exactly One Match

If exactly one matching file exists:

-   Select it as `qualification_json`.
-   Continue.

### No Match

If zero matching files exist:

**STATUS: NOT SENT**

**REASON:**

No `*_qa_readiness_details.json` qualification file was found in the
current directory.

Do not generate a final assessment or send email.

STOP.

### Multiple Matches

If more than one matching file exists:

**STATUS: NOT SENT**

**REASON:**

Multiple `*_qa_readiness_details.json` qualification files exist in the
current directory; the current execution qualification result is
ambiguous.

List only the matching qualification JSON filenames.

Do not select one automatically.

STOP.

## JIRA ISSUE KEY EXTRACTION

Extract `jira_issue_key` from the selected qualification JSON filename.

Required pattern:

`{jira_issue_key}_qa_readiness_details.json`

Remove the exact suffix:

`_qa_readiness_details.json`

The remaining prefix is `jira_issue_key`.

Validate:

-   The value is not empty.
-   The value contains no path separator.
-   The value has not been transformed.
-   The exact filename mapping remains valid.

Verify:

`qualification_json_filename == jira_issue_key + "_qa_readiness_details.json"`

Preserve `jira_issue_key` exactly.

Do NOT:

-   Change case.
-   Remove hyphens.
-   Replace the project prefix.
-   Extract only the numeric portion.
-   Reformat the value.

If extraction fails:

**STATUS: NOT SENT**

**REASON:**

`jira_issue_key` could not be reliably extracted from the qualification
JSON filename.

STOP.

## Testing_Type EXTRACTION

Read `Testing_Type` only from the selected qualification JSON top-level
property:

`Testing_Type`

Supported values are exactly:

-   `Functional`
-   `API`
-   `Accessibility`

Trim harmless surrounding whitespace before comparison.

Do not convert unsupported values into supported values.

If `Testing_Type` is missing, null, empty, ambiguous, or unsupported:

**STATUS: NOT SENT**

**REASON:**

The selected qualification JSON does not contain exactly one supported
`Testing_Type`.

STOP.

## qaReady GATE

Read the top-level `qaReady` property from the same qualification JSON.

If `qaReady=true`:

-   Continue.

If `qaReady=false`:

**STATUS: NOT SENT**

**REASON:**

The qualification JSON indicates `qaReady=false`. Downstream final
assessment and completion email execution is blocked.

STOP.

If `qaReady` is missing or is not a Boolean:

**STATUS: NOT SENT**

**REASON:**

The qualification JSON does not contain a valid Boolean `qaReady` value.

STOP.

## IDENTITY LOCK

Lock these values:

-   `qualification_json_filename`
-   `jira_issue_key`
-   `Testing_Type`
-   `qaReady`

Do not change or derive these values again based on later report
discovery.

## TESTING-TYPE ROUTING

### Functional

Applicable stages:

-   Stage 1: Qualification Check
-   Stage 2: Test Design
-   Stage 3: Functional Validation

Expected files:

-   `QA_01_Qualification_Report_{jira_issue_key}.html`
-   `QA_02_Test_Design_Report_{jira_issue_key}.html`
-   `QA_03_Story_Validation_Report_{jira_issue_key}.html`

Stage 4 is not applicable.

### API

Applicable stages:

-   Stage 1: Qualification Check
-   Stage 2: Test Design
-   Stage 3: API Validation

Expected files:

-   `QA_01_Qualification_Report_{jira_issue_key}.html`
-   `QA_02_Test_Design_Report_{jira_issue_key}.html`
-   `QA_03_Story_Validation_Report_{jira_issue_key}.html`

Stage 4 is not applicable.

### Accessibility

Applicable stages:

-   Stage 1: Qualification Check
-   Stage 4: Accessibility Page Scan

Expected files:

-   `QA_01_Qualification_Report_{jira_issue_key}.html`
-   `QA_04_Accessibility_Validation_Report_{jira_issue_key}.html`

Stages 2 and 3 are not applicable.

Accessibility testing:

-   Does not create test cases.
-   Does not perform story test-case validation.
-   Performs page accessibility scanning or auditing.
-   Produces accessibility findings.

Critical or Serious findings do NOT automatically mean Stage 4 execution
failed.

## STRICT ACCESSIBILITY STAGE 4 CONTRACT

The only valid Accessibility Stage 4 report is:

`QA_04_Accessibility_Validation_Report_{jira_issue_key}.html`

Do not accept substitute reports such as:

-   `{jira_issue_key}_Accessibility_Full_Scan_Report.html`
-   `{jira_issue_key}_Accessibility_Audit_Report.html`
-   `{jira_issue_key}_Accessibility_Audit_Report.md`
-   `{jira_issue_key}_Accessibility_Report.html`
-   `Accessibility_Full_Scan_Report_{jira_issue_key}.html`

Do not rename substitute reports.

Do not treat Markdown as Stage 4.

If the exact Stage 4 report is absent or unusable:

`Stage 4 Status = Not Generated`

## REPORT DISCOVERY

Recursively search the entire current workspace for applicable exact
HTML filenames.

Rules:

1.  Match the filename case-sensitively.
2.  Accept HTML only.
3.  Use the locked `jira_issue_key` only.
4.  Search applicable stages only.
5.  Never use another issue's report.
6.  Markdown is not stage HTML.
7.  JSON is not stage HTML.
8.  Logs are not stage reports.
9.  Screenshots are not stage reports.
10. If multiple valid copies exist, select the latest modification time.
11. Preserve the original filename.
12. Do not rename reports.
13. Do not generate missing reports.
14. Do not use a previous final assessment as the current final
    assessment.

## REPORT VALIDATION

For each applicable stage verify:

1.  The exact expected filename exists.
2.  The report belongs to the locked `jira_issue_key`.
3.  The file is readable.
4.  The file is non-empty.
5.  The file contains meaningful report content.
6.  Execution status can be determined from reliable report evidence.

Allowed statuses:

-   `Completed`
-   `Failed`
-   `Not Generated`

### Completed

Use when:

-   The exact report exists.
-   The report is readable.
-   The report contains meaningful content.
-   Stage execution completed.

### Failed

Use when:

-   The exact report exists.
-   The report explicitly indicates execution failed or could not
    complete.

### Not Generated

Use when:

-   The report is missing.
-   The exact required filename is absent.
-   The report is unreadable.
-   The report is unusable.
-   The report is empty or boilerplate.

Report existence alone does not prove Completed.

Accessibility violations do not automatically mean Stage 4 Failed.

Do not determine status from filename alone.

## OVERALL WORKFLOW STATUS

Calculate from applicable stage execution statuses only.

**Completed:**

-   Every applicable stage is `Completed`.

**Partially Completed:**

-   At least one applicable stage is `Completed`.
-   At least one applicable stage is `Failed` or `Not Generated`.

**Not Completed:**

-   No applicable stage is `Completed`.

Do not calculate the workflow status using:

-   Defect count
-   Test-case failures
-   Accessibility violation count
-   Severity count
-   WCAG count

## OUTPUT

Return:

-   `qualification_json`
-   `qualification_json_filename`
-   `jira_issue_key`
-   `Testing_Type`
-   `qaReady`
-   `applicable_stages`
-   `non_applicable_stages`
-   `selected_reports`
-   `stage_results`
-   `completed_stage_count`
-   `failed_stage_count`
-   `not_generated_stage_count`
-   `overall_workflow_status`
-   `validation_status`
-   `failure_reason`
-   `warnings`

Do not generate the final assessment.

Do not send email.
