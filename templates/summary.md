# Finalize Summary

## Deck Source

- Source id: `{{SOURCE_ID}}`
- Presentation slug: `{{PRESENTATION_SLUG}}`
- Source workspace: `{{SOURCE_WORKSPACE}}`
- Preview route: `{{PREVIEW_PATH}}`
- Source theme: `{{SOURCE_THEME}}`
- Source slides: `{{SOURCE_SLIDES}}`
- Brief: `{{BRIEF_PATH}}`
- Revisions: `{{REVISIONS_PATH}}`

## Outputs

- PDF: `{{PDF_PATH}}`
- Report: `{{REPORT_PATH}}`
- Full-page screenshot: `{{FULL_PAGE_PATH}}`
- Slide screenshots: `{{SLIDES_PATH}}/`

## Validation Status

- Status: `{{STATUS}}`
- Slides discovered: {{SLIDE_COUNT}}
- Browser console errors: {{CONSOLE_ERROR_COUNT}}
- Overflow slides: {{OVERFLOW_COUNT}}

## Unresolved Issues

{{UNRESOLVED_ISSUES}}

## What To Tell The User

- The review-ready PDF is at `{{PDF_PATH}}`.
- The screenshots and report are in `{{OUTPUT_DIR}}/`.
- If status is not `pass`, revise the deck and rerun `{{FINALIZE_COMMAND}}`.
