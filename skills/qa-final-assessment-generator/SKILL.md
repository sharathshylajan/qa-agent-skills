---
name: qa-final-assessment-generator
description: Generate and validate a new final QA assessment HTML from
  locked qualification values and validated applicable stage results.
  Use only after qualification and report validation succeeds.
---

# QA Final Assessment Generator

## INPUT

Require:

-   Locked `jira_issue_key`
-   Locked `Testing_Type`
-   Locked `qaReady=true`
-   Applicable stages
-   Non-applicable stages
-   Selected applicable reports
-   Validated stage statuses
-   Overall workflow status

Do not derive `jira_issue_key` or `Testing_Type` again.

Do not query Jira.

Do not execute QA tests.

Do not create missing stage reports.

## FINAL ASSESSMENT FILE

Generate a NEW file:

`QA_Final_Assessment_Report_{jira_issue_key}.html`

Save it in the CURRENT WORKSPACE ROOT DIRECTORY.

Do not overwrite or accept an old final assessment as proof of current
generation.

## REQUIRED CONTENT

### Header

Include:

-   QA Final Assessment Report
-   Jira issue key
-   Testing type
-   Overall workflow status
-   Generated date and time when reliably available

### Executive Summary

Include:

-   Testing Type
-   Applicable Stage Count
-   Completed Stage Count
-   Failed Stage Count
-   Not Generated Stage Count
-   Overall Workflow Status

Functional and API wording may reference:

-   Test design
-   Test scenarios
-   Validation

Accessibility wording may reference:

-   Accessibility assessment
-   Page scanning
-   Accessibility audit
-   Accessibility findings

For Accessibility never use:

-   Test-case creation
-   Test-case validation
-   Functional validation
-   API validation

## SUMMARY CARDS

Display exactly:

1.  Testing Type
2.  Applicable Stages
3.  Completed Stages
4.  Attention Required

Calculate:

`Attention Required = Failed + Not Generated`

For Accessibility, Attention Required represents execution stages only.

It does not represent:

-   Critical findings
-   Serious findings
-   Violations
-   WCAG failures
-   Affected elements

## STAGE SUMMARY TABLE

Use columns:

-   Stage
-   Description
-   Status
-   Refer Report

### Functional

Include only:

-   Stage 1 \| Qualification Check
-   Stage 2 \| Test Design
-   Stage 3 \| Functional Validation

### API

Include only:

-   Stage 1 \| Qualification Check
-   Stage 2 \| Test Design
-   Stage 3 \| API Validation

### Accessibility

Include only:

-   Stage 1 \| Qualification Check
-   Stage 4 \| Accessibility Page Scan

Rules:

-   Include applicable stages only.
-   Exclude non-applicable stages.
-   Existing valid reports use the actual filename.
-   Missing applicable reports use Not Generated.
-   Missing report references use Not Available.
-   Use a relative hyperlink only when it safely resolves.
-   Never invent links.

## GUIDANCE NOTE

For Functional or API:

Individual reports contain test design and validation details.

For Accessibility:

The accessibility report contains whole-page scan results and identified
findings. It is not a test-case report.

## HTML DESIGN

Generate standalone HTML5.

Use embedded CSS only.

Do not use:

-   Bootstrap
-   Tailwind
-   External CSS
-   External fonts
-   JavaScript
-   External images
-   Network resources

Use exactly:

``` css
:root {
  --page-bg: #F3F6FA;
  --surface: #FFFFFF;
  --surface-soft: #F8FAFC;
  --heading: #172033;
  --text: #334155;
  --muted: #64748B;
  --primary: #2563EB;
  --primary-dark: #1D4ED8;
  --primary-soft: #EFF6FF;
  --completed: #15803D;
  --completed-soft: #F0FDF4;
  --failed: #DC2626;
  --failed-soft: #FEF2F2;
  --not-generated: #D97706;
  --not-generated-soft: #FFFBEB;
  --not-applicable: #64748B;
  --border: #E2E8F0;
  --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  --radius: 12px;
  --max-width: 1100px;
}
```

Use:

-   Professional QA dashboard layout
-   Responsive design
-   System fonts
-   At least 16px body text
-   Responsive summary cards
-   Accessible status badges
-   Clear stage table
-   Visible keyboard focus
-   Horizontal table scrolling
-   Print styles
-   Sufficient color contrast

Header gradient permitted:

``` css
linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)
```

## FINAL ASSESSMENT VALIDATION

Verify:

-   The file exists.
-   The file is readable.
-   The file is non-empty.
-   Jira key equals the locked `jira_issue_key`.
-   Testing Type equals the locked `Testing_Type`.
-   Stage rows exactly match `Testing_Type`.
-   Non-applicable stages are absent.
-   Stage statuses are valid.
-   Links reference actual selected reports.
-   No stage report was modified.
-   Dynamic values are safely escaped.
-   No executable source HTML was injected.
-   The final assessment was generated during the current execution.

If validation fails:

-   Do not permit email sending.

## ATTACHMENT SELECTION

Attach only existing, readable, applicable HTML reports plus the newly
generated final assessment.

### Functional

Permitted attachments:

-   `QA_01_Qualification_Report_{jira_issue_key}.html`
-   `QA_02_Test_Design_Report_{jira_issue_key}.html`
-   `QA_03_Story_Validation_Report_{jira_issue_key}.html`
-   `QA_Final_Assessment_Report_{jira_issue_key}.html`

### API

Permitted attachments:

-   `QA_01_Qualification_Report_{jira_issue_key}.html`
-   `QA_02_Test_Design_Report_{jira_issue_key}.html`
-   `QA_03_Story_Validation_Report_{jira_issue_key}.html`
-   `QA_Final_Assessment_Report_{jira_issue_key}.html`

### Accessibility

Permitted attachments:

-   `QA_01_Qualification_Report_{jira_issue_key}.html`
-   `QA_04_Accessibility_Validation_Report_{jira_issue_key}.html`
-   `QA_Final_Assessment_Report_{jira_issue_key}.html`

Never attach:

-   Markdown
-   JSON
-   Screenshots
-   Logs
-   Archives
-   Source code
-   Unrelated files
-   Non-applicable stages

Do not create missing attachments.

A missing applicable stage report does not automatically block sending
when:

1.  At least one valid applicable stage report exists.
2.  The current final assessment was successfully generated.
3.  Final assessment validation passed.
4.  The final assessment identifies the missing stage.

## OUTPUT

Return:

-   `final_assessment_filename`
-   `final_assessment_path`
-   `final_assessment_validation_status`
-   `validation_errors`
-   `permitted_attachments`
-   `attachment_count`
-   `warnings`

Do not send email.
