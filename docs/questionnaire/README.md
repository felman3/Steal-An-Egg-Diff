# Evaluation questionnaire → Google Form

[`create_evaluation_form.gs`](create_evaluation_form.gs) builds the **BAT 405 Interactive Analytics Dashboard Evaluation
Questionnaire** as a Google Form, together with a response spreadsheet that scores itself.

## Create the form

1. Open https://script.google.com and click **New project**.
2. Delete the sample code and paste the whole of `create_evaluation_form.gs`.
3. In `SETTINGS` at the top, set `GROUP_NAME`. You can also change the sections, links or demo login there.
4. Select `createEvaluationForm` in the toolbar and click **Run**. Approve the permission prompt; the script only creates a Form and a
   Sheet in your Google Drive.
5. Open **Execution log**. It prints three links: one to edit the form, one to share with respondents, and one to the response sheet.

## What the form contains

| Page | Content |
|---|---|
| 1. Data privacy consent | Notice under RA 10173. **I agree** continues to the form; **I do not agree** ends it immediately, before any personal data is asked |
| 2. Respondent information | **Name** in the format *Last name, First name M.I.* (e.g. `Dela Cruz, Juan A.`), **SR-Code** (`23-12345`) and **Section** (BSIT BA - 4101 / BSIT BA - 4103). The form checks the name and SR-Code formats |
| 3. Dashboard being evaluated | Group, primary user, link, demo sign-in, and how the respondent reviewed it (live demo, own use, both, screenshots only) |
| 4–9. Sections A–F | Four statements each, rated **5 / 4 / 3 / 2 / 1 / N/A**, one answer required per statement. Section D notes that D4 may be N/A if interactivity was not demonstrated |
| 10. Open-ended evaluation | The four open-ended questions, all required |

Form settings:
- A progress bar is shown.
- Each person can answer only once, so they must sign in with Google.
- Email addresses are collected.
- Respondents can't edit their answers after submitting.

## Scoring (Summary tab of the response sheet)

- The tab shows the mean for each statement, each domain (A–F) and overall, plus the number of valid ratings and the N/A count.
- Following the questionnaire's scoring note, means use **valid ratings (1–5) only**: **N/A is excluded from the denominator and
  never counted as zero**.
- Each mean also gets a verbal interpretation: 4.21–5.00 Strongly Agree · 3.41–4.20 Agree · 2.61–3.40 Neutral · 1.81–2.60
  Disagree · 1.00–1.80 Strongly Disagree.
- Respondents who declined consent are counted separately and contribute no ratings.
