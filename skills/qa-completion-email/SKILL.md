---
name: qa-completion-email
description: Select the fixed QA completion email template, build and
  validate an immutable payload, send exactly one email to the
  configured recipients, verify the actual email-service response, and
  produce the final execution summary.
---

# QA Completion Email

## INPUT

Require:

-   Locked `qualification_json_filename`
-   Locked `jira_issue_key`
-   Locked `Testing_Type`
-   Locked `qaReady=true`
-   Applicable stage results
-   Overall workflow status
-   Current validated final assessment
-   Permitted readable attachments

Do not derive `jira_issue_key` or `Testing_Type` again.

Do not send when final assessment validation failed.

## FIXED RECIPIENTS

The only permitted recipients are:

-   `poovarasu.g@publicissapient.com`
-   `sharath.ks@publicissapient.com`
-   `anurag.negi1@publicissapient.com`

Send ONE email addressed to both configured recipients.

Do not:

-   Send separate duplicate emails.
-   Add CC.
-   Add BCC.
-   Send to anyone else.

## TEMPLATE MAPPING

Use only:

-   Functional → `FUNCTIONAL_API`
-   API → `FUNCTIONAL_API`
-   Accessibility → `ACCESSIBILITY`

There is no default template.

## FUNCTIONAL/API TEMPLATE

Use only when `Testing_Type` is Functional or API.

**template_id:**

`FUNCTIONAL_API`

**Subject exactly:**

`QA Test Design and Validation Completed - Review Required`

**Body exactly:**

``` text
Hi Team,

The QA test design and validation activities have been completed.

The applicable test scenarios and test cases have been prepared, and the required validation has been performed. The final assessment and supporting QA reports are attached for your review.

Thank you.

Best regards, QA Team
```

Do not rewrite, paraphrase, summarize, or expand.

## ACCESSIBILITY TEMPLATE

Use only when `Testing_Type` is Accessibility.

**template_id:**

`ACCESSIBILITY`

**Subject exactly:**

`Accessibility Page Scan Completed - Review Required`

**Body exactly:**

``` text
Hi Team,

The accessibility assessment has been completed for the applicable page or pages.

The overall page scan was performed, and the identified accessibility findings have been documented. The final assessment and supporting accessibility reports are attached for your review.

Thank you.

Best regards, QA Team
```

Do not rewrite, paraphrase, summarize, or expand.

## ACCESSIBILITY FORBIDDEN WORDING

For Accessibility, reject any payload containing these case-insensitive
phrases:

-   `Test Cases Creation`
-   `Test Case Creation`
-   `Test Cases Created`
-   `Test Design and Validation`
-   `test scenarios and test cases`
-   `test cases have been prepared`
-   `test-case validation`
-   `test case validation`
-   `API Validation`
-   `API testing`
-   `Functional Validation`
-   `Functional testing`

If any forbidden phrase exists:

**EMAIL TEMPLATE VALIDATION: FAILED**

**EMAIL STATUS: NOT SENT**

Do not send.

## NO STALE CONTENT

Construct the subject and body fresh from the fixed template.

Never reuse:

-   A previous email
-   A previous Jira email
-   A previous testing-type template
-   A cached body
-   A cached subject
-   Qualification HTML wording
-   Jira wording
-   Final-assessment wording
-   Generic QA wording

## FINAL PAYLOAD

Build exactly one payload containing:

-   `jira_issue_key`
-   `testing_type`
-   `template_id`
-   `to`
-   `subject`
-   `body`
-   `attachments`

`jira_issue_key` must equal the locked value from the qualification JSON
filename.

`testing_type` must equal the locked `Testing_Type` from the
qualification JSON content.

Do not derive either value again.

## PRE-SEND VALIDATION

Immediately before sending verify:

1.  `qualification_json` is the single selected current-directory file
    matching `*_qa_readiness_details.json`.
2.  `jira_issue_key` still equals the qualification JSON filename
    prefix.
3.  `Testing_Type` still equals the qualification JSON top-level
    `Testing_Type`.
4.  `qaReady` still equals true.
5.  `template_id` corresponds to `Testing_Type`.
6.  Recipients contain exactly:
    -   `poovarasu.g@publicissapient.com`
    -   `sharath.ks@publicissapient.com`
7.  The final assessment was generated during the current execution.
8.  The final assessment passed validation.
9.  Attachments are allowed for `Testing_Type`.
10. Subject exactly matches the selected template.
11. Body exactly matches the selected template.
12. No stale content exists.
13. Email has not already been sent during this execution.

If any check fails:

**EMAIL STATUS: NOT SENT**

Do not invoke the email tool.

## SUBJECT CHARACTER SAFETY

Use the ASCII hyphen:

`-`

Do not substitute:

-   En dash
-   Em dash
-   Arrow
-   Tabs
-   Decorative symbols

## PAYLOAD IMMUTABILITY

Required sequence:

**BUILD PAYLOAD → VALIDATE → SEND THE SAME EXACT PAYLOAD**

Do not:

**BUILD → VALIDATE → REWRITE → SEND**

No subject, body, recipient, or attachment changes are permitted after
validation.

## EMAIL SENDING

Send exactly ONE email.

The one email must contain both configured recipients.

Attach all selected valid attachments to that one email.

Do not send one email per attachment.

Do not send one email per recipient.

If the configured email tool does not support a single email with
multiple recipients:

**EMAIL STATUS: NOT SENT**

Report:

`Configured email tool does not support the required single-email multi-recipient send.`

Do not silently send separate emails.

Success requires actual positive service confirmation such as:

-   `success=true`
-   Accepted response
-   `messageId`

## POST-SEND VERIFICATION

Capture:

-   Actual recipients supplied
-   Actual subject supplied
-   Template ID
-   Actual attachments supplied
-   Send status
-   Message ID when returned
-   Service response when appropriate

Compare the actual subject with the expected subject.

If transport succeeds but the template does not comply:

**EMAIL SEND STATUS: SENT**

**EMAIL TEMPLATE COMPLIANCE: FAILED**

Do not falsely claim complete compliance.

Never convert NOT SENT to SENT without actual positive email-service
confirmation.

## FINAL EXECUTION SUMMARY

Return:

``` text
QUALIFICATION JSON:

JIRA ISSUE KEY:

JIRA ISSUE KEY SOURCE: Qualification JSON filename

TESTING TYPE:

TESTING TYPE SOURCE: Qualification JSON top-level Testing_Type

qaReady:

APPLICABLE STAGES:

COMPLETED STAGES:

FAILED STAGES:

NOT GENERATED STAGES:

NON-APPLICABLE STAGES EXCLUDED:

FINAL ASSESSMENT:

FINAL ASSESSMENT PATH:

ATTACHMENT COUNT:

ATTACHMENTS:

EMAIL RECIPIENTS:

EXPECTED EMAIL SUBJECT:

ACTUAL EMAIL SUBJECT:

EMAIL TEMPLATE VALIDATION:

EMAIL SEND STATUS:

EMAIL TEMPLATE COMPLIANCE:

MESSAGE ID:

WARNINGS:
```

Never fabricate values.

## ABSOLUTE PROHIBITIONS

Never:

-   Obtain `jira_issue_key` from Jira or HTML.
-   Obtain `Testing_Type` from Jira or report availability.
-   Continue when the qualification JSON is absent or ambiguous.
-   Continue when `qaReady=false`.
-   Use Functional/API wording for Accessibility.
-   Use Accessibility wording for Functional/API.
-   Use generic QA email wording.
-   Attach Markdown, JSON, screenshots, logs, or unrelated files.
-   Regenerate the payload after validation.
-   Send more than one email.
-   Claim send success without service confirmation.
