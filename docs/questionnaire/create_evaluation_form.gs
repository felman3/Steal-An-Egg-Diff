/**
 * BAT 405 – Analytics Application
 * Interactive Analytics Dashboard Evaluation Questionnaire → Google Form
 *
 * HOW TO USE:
 *   1. Open https://script.google.com → New project (or your existing project).
 *   2. Replace all the code with this file and edit SETTINGS below (app name, group members, section).
 *   3. Save (Ctrl+S). In the toolbar choose ONE function and click Run:
 *        • updateExistingForm   → rebuilds the form in SETTINGS.FORM_ID in place (same link)
 *        • createEvaluationForm → makes a brand-new form
 *      Approve the permission prompt (Advanced → Go to project → Allow).
 *   4. Open the Execution log for the edit link, the link to share and the response sheet.
 *   5. Header banner: Forms → 🎨 Customize theme → Header → Upload, and choose
 *      form-header-placeholder.png (or your own design). A script cannot set the header image.
 *
 * FORM LAYOUT (every question is required):
 *   Title + greeting letter + email collection
 *   I.   Data Privacy Notice and Consent  — "No" ends the form; nothing else is collected
 *   II.  Respondent Information           — Name (Cruz, Juan R.), SR-Code, Section (dropdown)
 *   III. Dashboard Evaluation             — sections A–F on ONE page, rated 5 / 4 / 3 / 2 / 1 / N/A
 *   IV.  Open-Ended Evaluation            — four questions
 *   V.   Thank You
 * The linked Google Sheet gets a "Summary" tab with item, domain and overall means computed from
 * valid ratings only (N/A excluded from the denominator, never counted as zero).
 */

// ============================== SETTINGS ==============================
const SETTINGS = {
  FORM_ID: '1VDVwI6FnyCcdIkiwUszxVLZDK48vf55vs6y28zb-Lng', // used by updateExistingForm()
  APP_NAME: 'Academic Quality Dashboard', // change once your group picks the app name
  GROUP_SECTION: 'BSIT BA - 41__', // your group's section
  GROUP_MEMBERS: ['Last name, First name M.I.', 'Last name, First name M.I.'], // signatories of the greeting
  DASHBOARD_URL: 'https://sete-analytics-dashboard.vercel.app',
  PRIMARY_USER: 'Authorized Academic Administrator',
  DEMO_LOGIN: 'demo.academic.admin@example.com',
  DEMO_PASSWORD: 'Demo-SETE-2026',
  SECTIONS: ['BSIT BA - 4101', 'BSIT BA - 4103'],
  ONE_RESPONSE_PER_PERSON: true, // respondents must sign in with Google; prevents duplicates
};
// =====================================================================

const RATING_COLUMNS = ['5', '4', '3', '2', '1', 'N/A'];
const SCALE_TEXT = '5 = Strongly Agree · 4 = Agree · 3 = Neutral · 2 = Disagree · 1 = Strongly Disagree · N/A = Not Assessable';
const CONSENT_TITLE = 'Do you agree to the collection and processing of your personal information as described above?';
const CONSENT_YES = 'Yes, I have read and understood the Data Privacy Notice, and I voluntarily give my consent.';
const CONSENT_NO = 'No, I do not agree to the collection and processing of my personal information. (The form will end here.)';

const DOMAINS = [
  {
    code: 'A',
    title: 'A. Relevance and Information Organization',
    items: [
      'The dashboard clearly communicates its purpose and intended users.',
      'Important academic and teaching-effectiveness information is easy to locate.',
      'Information is arranged logically and is easy to understand.',
      'The dashboard clearly distinguishes recorded information from analytical insights.',
    ],
  },
  {
    code: 'B',
    title: 'B. KPI Design and Interpretability',
    items: [
      'The five KPI cards are relevant to academic operations and teaching effectiveness.',
      'Each KPI is clearly labeled and understandable.',
      'KPI targets, reporting periods, or thresholds are shown when needed.',
      'The KPIs help identify areas that may require attention or improvement.',
    ],
  },
  {
    code: 'C',
    title: 'C. Data Visualization and Dashboard Design',
    items: [
      'The dashboard includes at least three appropriate data visualizations.',
      'Charts have clear titles, labels, units, and legends when needed.',
      'Visualizations make trends and comparisons easy to understand.',
      'The dashboard is readable and avoids unnecessary clutter or misleading displays.',
    ],
  },
  {
    code: 'D',
    title: 'D. Interactivity and Navigation',
    note: 'If interactivity was not demonstrated, item D4 may be marked N/A.',
    items: [
      'At least two interactive features (such as filters, drill-down, or tooltips) are clearly presented.',
      'The purpose of each interactive feature is easy to understand.',
      'The interactive features are appropriate for the intended users’ tasks.',
      'When demonstrated, interactive controls update the relevant information correctly.',
    ],
  },
  {
    code: 'E',
    title: 'E. Decision Support and Alerts',
    items: [
      'The dashboard includes at least one understandable warning or alert.',
      'The alert clearly indicates the condition requiring attention.',
      'The dashboard helps users identify possible academic or teaching-improvement actions.',
      'Results provide sufficient context to avoid unsupported conclusions.',
    ],
  },
  {
    code: 'F',
    title: 'F. Privacy, SETE Interpretation, and Responsible Analytics',
    items: [
      'The dashboard avoids unnecessarily exposing confidential student or faculty information.',
      'SETE summaries include useful context, such as response rates or evaluation periods.',
      'The dashboard does not present SETE scores as the sole measure of teaching effectiveness.',
      'The information is presented in a fair and responsible manner.',
    ],
  },
];

const OPEN_ENDED = [
  'Which dashboard component is most useful for academic planning or teaching improvement? Why?',
  'Which KPI, chart, or other information needs clarification or revision?',
  'What improvement would make the dashboard easier to use or interact with?',
  'What privacy, fairness, or SETE-interpretation concern should be addressed?',
];

/** Row label used in the form and, therefore, in the response sheet's column headers. */
function rowLabel_(domain, index, text) {
  return domain.code + (index + 1) + '. ' + text;
}

function formTitle_() {
  return SETTINGS.APP_NAME + ' Evaluation';
}

/** Rebuilds the form in SETTINGS.FORM_ID in place, so its link stays the same. */
function updateExistingForm() {
  const form = FormApp.openById(SETTINGS.FORM_ID);
  if (form.getResponses().length > 0) {
    Logger.log('Note: this form already has ' + form.getResponses().length + ' response(s). Rebuilding replaces the questions; ' +
      'old answers stay in the response sheet but no longer match the new questions. Delete test responses first if needed.');
  }
  form.getItems().forEach(function (item) { form.deleteItem(item); });
  buildForm_(form);
  linkSheetAndSummary_(form);
}

/** Creates a brand-new form (and response sheet). */
function createEvaluationForm() {
  const form = FormApp.create(formTitle_());
  buildForm_(form);
  linkSheetAndSummary_(form);
}

function buildForm_(form) {
  const members = SETTINGS.GROUP_MEMBERS.join('\n');

  // ---- Title + greeting -------------------------------------------------------
  form
    .setTitle(formTitle_())
    .setDescription(
      'Greetings, Respondent!\n\n' +
        'We are students from ' + SETTINGS.GROUP_SECTION + ', and we would like to invite you to take part in the evaluation of the ' +
        SETTINGS.APP_NAME + ', the analytics dashboard we developed for our BAT 405 – Analytics Application case study, ' +
        '"Enhancing the University Student and Faculty Portal Through Analytics and Decision Support."\n\n' +
        'The dashboard brings together Student and Faculty Portal data and SETE (Student Evaluation of Teaching Effectiveness) ' +
        'results to help the ' + SETTINGS.PRIMARY_USER + ' monitor academic performance and teaching effectiveness. This ' +
        'evaluation aims to gather your feedback on its clarity, usefulness, design, interactivity and responsible use of data.\n\n' +
        'Please answer each question honestly based on your own review of the dashboard. Your feedback will help us improve our ' +
        'project. Thank you for your time and participation!\n\n' +
        'Respectfully,\n' + members + '\n' + SETTINGS.GROUP_SECTION
    )
    .setProgressBar(true)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage(
      'Thank you! Your evaluation of the ' + SETTINGS.APP_NAME + ' has been recorded. We appreciate your time and feedback.'
    );
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); // signed-in Google account email
  } catch (e) {
    form.setCollectEmail(true); // older Apps Script runtimes
  }
  if (SETTINGS.ONE_RESPONSE_PER_PERSON) form.setLimitOneResponsePerUser(true);

  // ---- I. Data Privacy Notice and Consent (first page) ----------------------------
  form
    .addSectionHeaderItem()
    .setTitle('I. Data Privacy Notice and Consent')
    .setHelpText(
      'DATA PRIVACY NOTICE\n\n' +
        'In accordance with Republic Act No. 10173, also known as the Data Privacy Act of 2012, we respect your privacy and are ' +
        'committed to protecting the personal information you provide.\n\n' +
        'The information collected through this form (your email, name, SR-Code, section and answers) will be used only for the ' +
        'evaluation of the ' + SETTINGS.APP_NAME + ', including the analysis of responses and the documentation of our academic ' +
        'project requirements.\n\n' +
        'All information will be treated as confidential and will be accessed only by the members of our project team and our ' +
        'instructor. Results will be reported only as summaries, never as individual answers with your name, and responses will ' +
        'be deleted once the course requirement is completed.\n\n' +
        'Participation is voluntary. By choosing "Yes", you confirm that you have read and understood this notice and give your ' +
        'consent to the collection and processing of your personal information for the purposes stated above. Choosing "No" ends ' +
        'the form immediately and nothing else is collected.'
    );

  const consent = form.addMultipleChoiceItem();
  consent
    .setTitle(CONSENT_TITLE)
    .setChoices([
      consent.createChoice(CONSENT_YES, FormApp.PageNavigationType.CONTINUE),
      consent.createChoice(CONSENT_NO, FormApp.PageNavigationType.SUBMIT),
    ])
    .setRequired(true);

  // ---- II. Respondent Information ---------------------------------------------
  form
    .addPageBreakItem()
    .setTitle('II. Respondent Information')
    .setHelpText('Please provide the following information before proceeding with the ' + SETTINGS.APP_NAME + ' evaluation.');

  form
    .addTextItem()
    .setTitle('Please enter your complete name (Last name, First name M.I.)')
    .setHelpText('Example: Cruz, Juan R.')
    .setRequired(true)
    .setValidation(
      FormApp.createTextValidation()
        .setHelpText('Please follow the format: Last name, First name M.I. — e.g. Cruz, Juan R.')
        .requireTextMatchesPattern("^[A-Za-zÀ-ÿÑñ][A-Za-zÀ-ÿÑñ' .-]*, [A-Za-zÀ-ÿÑñ][A-Za-zÀ-ÿÑñ' .-]*?( [A-Za-zÑñ]{1,2}\\.)?$")
        .build()
    );

  form
    .addTextItem()
    .setTitle('SR-Code')
    .setHelpText('Example: 23-12345')
    .setRequired(true)
    .setValidation(
      FormApp.createTextValidation()
        .setHelpText('Please enter your SR-Code like 23-12345 (2 digits, a dash, 5 digits).')
        .requireTextMatchesPattern('^[0-9]{2}-[0-9]{5}$')
        .build()
    );

  form.addListItem().setTitle('Section').setChoiceValues(SETTINGS.SECTIONS).setRequired(true);

  // ---- III. Dashboard Evaluation (all Likert items on one page) ------------------
  form
    .addPageBreakItem()
    .setTitle('III. Dashboard Evaluation')
    .setHelpText(
      'Review the ' + SETTINGS.APP_NAME + ' and observe its demonstration when available, then indicate how much you agree with ' +
        'each statement. Select N/A if a feature cannot be assessed. Do not assume that a proposed feature is functional unless it ' +
        'was demonstrated.\n\n' +
        'Dashboard: ' + SETTINGS.DASHBOARD_URL + '\n' +
        'Demo sign-in: ' + SETTINGS.DEMO_LOGIN + ' / ' + SETTINGS.DEMO_PASSWORD + '\n' +
        'Primary dashboard user: ' + SETTINGS.PRIMARY_USER + '\n' +
        '(All data in the dashboard is synthetic demonstration data.)\n\n' +
        SCALE_TEXT
    );

  DOMAINS.forEach(function (d) {
    form
      .addGridItem()
      .setTitle(d.title)
      .setHelpText('Choose one rating for each statement.' + (d.note ? ' ' + d.note : ''))
      .setRows(d.items.map(function (t, i) { return rowLabel_(d, i, t); }))
      .setColumns(RATING_COLUMNS)
      .setRequired(true);
  });

  // ---- IV. Open-Ended Evaluation -------------------------------------------------
  form.addPageBreakItem().setTitle('IV. Open-Ended Evaluation').setHelpText('Please answer each question briefly and specifically.');
  OPEN_ENDED.forEach(function (q, i) {
    form.addParagraphTextItem().setTitle(i + 1 + '. ' + q).setRequired(true);
  });

  // ---- V. Thank You ----------------------------------------------------------
  form
    .addPageBreakItem()
    .setTitle('V. Thank You!')
    .setHelpText(
      'Thank you for taking the time to evaluate the ' + SETTINGS.APP_NAME + '. Your responses and suggestions will help us ' +
        'improve our dashboard and complete our project.\n\nPlease click Submit to record your answers.\n\n' +
        'Respectfully,\n' + members + '\n' + SETTINGS.GROUP_SECTION
    );
}

/** Links (or reuses) the response spreadsheet and (re)builds its Summary tab. */
function linkSheetAndSummary_(form) {
  let ssId = null;
  try {
    if (form.getDestinationType() === FormApp.DestinationType.SPREADSHEET) ssId = form.getDestinationId();
  } catch (e) {
    ssId = null;
  }
  if (!ssId) {
    const ss = SpreadsheetApp.create(formTitle_() + ' (Responses)');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    ssId = ss.getId();
  }
  SpreadsheetApp.flush();
  Utilities.sleep(3000);
  buildSummary_(ssId);

  Logger.log('Form ready.');
  Logger.log('Edit the form:          ' + form.getEditUrl());
  Logger.log('Share with respondents: ' + form.getPublishedUrl());
  Logger.log('Responses & scoring:    ' + SpreadsheetApp.openById(ssId).getUrl());
  Logger.log('Next: Customize theme → Header → upload your banner image.');
}

/** "Summary" tab: means from valid ratings (1–5) only; N/A never counts as zero. */
function buildSummary_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const responseSheets = ss.getSheets().filter(function (s) { return s.getFormUrl(); });
  const responses = responseSheets[responseSheets.length - 1];
  const r = "'" + (responses ? responses.getName() : 'Form Responses 1') + "'";
  const summary = ss.getSheetByName('Summary') || ss.getSheetByName('Sheet1') || ss.insertSheet('Summary');
  summary.setName('Summary');
  ss.setActiveSheet(summary);
  ss.moveActiveSheet(1);

  // Column of one question, found by its header so the formula survives column moves.
  const col = function (header) {
    return 'INDEX(' + r + '!$A$2:$ZZ,0,MATCH("' + header.replace(/"/g, '""') + '",' + r + '!$1:$1,0))';
  };
  const interp = function (cell) {
    return '=IF(' + cell + '="","",IFS(' + cell + '>=4.21,"Strongly Agree",' + cell + '>=3.41,"Agree",' + cell + '>=2.61,"Neutral",' +
      cell + '>=1.81,"Disagree",TRUE,"Strongly Disagree"))';
  };
  const consentCol = col(CONSENT_TITLE);

  const rows = [];
  rows.push([formTitle_() + ' — Summary', '', '', '', '', '', '']);
  rows.push(['Responses (consent given)', '=IFERROR(COUNTIF(' + consentCol + ',"Yes*"),0)', '', '', '', '', '']);
  rows.push(['Declined consent (no data collected)', '=IFERROR(COUNTIF(' + consentCol + ',"No*"),0)', '', '', '', '', '']);
  rows.push(['Means use valid ratings (1–5) only. N/A is excluded from the denominator and is never treated as zero.', '', '', '', '', '', '']);
  rows.push(['Item', 'Statement', 'Mean', 'Interpretation', 'Valid ratings (n)', 'Sum of ratings', 'N/A count']);

  const domainRows = [];
  DOMAINS.forEach(function (d) {
    rows.push([d.title, '', '', '', '', '', '']);
    const domainRow = rows.length; // 1-based row of the domain header
    const first = domainRow + 1;
    d.items.forEach(function (t, i) {
      const c = col(d.title + ' [' + rowLabel_(d, i, t) + ']');
      const n = rows.length + 1;
      rows.push([
        d.code + (i + 1),
        t,
        '=IF(E' + n + '=0,"",F' + n + '/E' + n + ')',
        interp('C' + n),
        '=IFERROR(SUMPRODUCT(--ISNUMBER(VALUE(' + c + '))*(' + c + '<>"")),0)',
        '=IFERROR(SUMPRODUCT(IFERROR(VALUE(' + c + '),0)),0)',
        '=IFERROR(COUNTIF(' + c + ',"N/A"),0)',
      ]);
    });
    const last = rows.length;
    rows[domainRow - 1] = [
      d.title,
      'Domain mean',
      '=IF(SUM(E' + first + ':E' + last + ')=0,"",SUM(F' + first + ':F' + last + ')/SUM(E' + first + ':E' + last + '))',
      interp('C' + domainRow),
      '=SUM(E' + first + ':E' + last + ')',
      '=SUM(F' + first + ':F' + last + ')',
      '=SUM(G' + first + ':G' + last + ')',
    ];
    domainRows.push(domainRow);
  });

  const o = rows.length + 1;
  const sumOf = function (c) { return domainRows.map(function (x) { return c + x; }).join(','); };
  rows.push([
    'OVERALL',
    'Overall mean (all 24 statements)',
    '=IF(SUM(' + sumOf('E') + ')=0,"",SUM(' + sumOf('F') + ')/SUM(' + sumOf('E') + '))',
    interp('C' + o),
    '=SUM(' + sumOf('E') + ')',
    '=SUM(' + sumOf('F') + ')',
    '=SUM(' + sumOf('G') + ')',
  ]);
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['Interpretation scale', '4.21–5.00 Strongly Agree · 3.41–4.20 Agree · 2.61–3.40 Neutral · 1.81–2.60 Disagree · 1.00–1.80 Strongly Disagree', '', '', '', '', '']);

  summary.clear();
  summary.getRange(1, 1, rows.length, 7).setValues(rows);
  summary.getRange('A1').setFontSize(14).setFontWeight('bold');
  summary.getRange('A5:G5').setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff');
  domainRows.concat([o]).forEach(function (x) {
    summary.getRange(x, 1, 1, 7).setFontWeight('bold').setBackground('#e6f0fc');
  });
  summary.getRange(6, 3, rows.length - 5, 1).setNumberFormat('0.00');
  summary.setColumnWidth(1, 330);
  summary.setColumnWidth(2, 520);
  summary.setColumnWidths(3, 5, 120);
  summary.getRange(1, 2, rows.length, 1).setWrap(true);
  summary.setFrozenRows(5);
}
