# Evaluation questionnaire → Google Form

[`create_evaluation_form.gs`](create_evaluation_form.gs) builds the **BAT 405 Interactive Analytics Dashboard Evaluation
Questionnaire** as a Google Form, together with a response sheet that scores itself.
[`form-header-placeholder.png`](form-header-placeholder.png) is a placeholder header banner (1600 × 400).

## Build or update the form

1. Open your Apps Script project at https://script.google.com.
2. Replace all the code with `create_evaluation_form.gs`. In `SETTINGS`, fill in `APP_NAME`, `GROUP_SECTION` and
   `GROUP_MEMBERS`.
3. **Save (Ctrl + S).** Run stays greyed out ("No functions") until you save.
4. Pick a function in the toolbar and click **Run**:
   - `updateExistingForm` rebuilds the form in `FORM_ID` in place, so the link stays the same.
   - `createEvaluationForm` makes a new form instead.

   Approve the permission prompt: **Advanced → Go to (project) → Allow**.
5. Open the **Execution log** for three links: edit the form, share it with respondents, and the response sheet.
6. Add the header: in the form, open **🎨 Customize theme → Header → Upload** and choose `form-header-placeholder.png` or your
   own banner. Apps Script can't set the header image.

## Form layout (all questions required)

| Page | Content |
|---|---|
| Title page | "*App name* Evaluation", a **Greetings, Respondent!** letter signed by the group, and verified email collection |
| I. Data Privacy Notice and Consent | Notice under RA 10173, then "Do you agree…?". **Yes** continues; **No** ends the form immediately, with nothing else collected |
| II. Respondent Information | Complete name in the format *Last name, First name M.I.* (e.g. `Cruz, Juan R.`), SR-Code (`23-12345`), and a **Section** dropdown (BSIT BA - 4101 / BSIT BA - 4103). Name and SR-Code formats are checked |
| III. Dashboard Evaluation | All six domains (A–F) on **one page**, four statements each, rated 5 / 4 / 3 / 2 / 1 / N/A. Also shows the dashboard link and demo sign-in |
| IV. Open-Ended Evaluation | The four open-ended questions |
| V. Thank You! | Closing message, then Submit (followed by a confirmation message) |

One response per person: respondents must sign in, and answers can't be edited after submitting.

## Scoring (Summary tab of the response sheet)

- Means for each statement, each domain (A–F) and overall, plus the number of valid ratings and the N/A count.
- Following the questionnaire's scoring note, **N/A is excluded from the denominator and never counted as zero**.
- Each mean gets an interpretation: 4.21–5.00 Strongly Agree · 3.41–4.20 Agree · 2.61–3.40 Neutral · 1.81–2.60 Disagree ·
  1.00–1.80 Strongly Disagree.
- Respondents who chose **No** at the consent question are counted separately and add no ratings.
