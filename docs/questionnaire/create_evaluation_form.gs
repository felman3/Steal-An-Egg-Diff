/**
 * BAT 405 – Analytics Application
 * Interactive Analytics Dashboard Evaluation Questionnaire → Google Form
 *
 * HOW TO USE (about 2 minutes):
 *   1. Go to https://script.google.com → New project.
 *   2. Delete the sample code, paste this whole file, then edit the SETTINGS below
 *      (at least GROUP_NAME).
 *   3. Choose the function `createEvaluationForm` and click Run.
 *      Approve the permission prompt (it only creates a Form and a Sheet in your Drive).
 *   4. Open View → Execution log: it prints the form's edit link, the link to share
 *      with respondents, and the response spreadsheet link.
 *
 * What it builds (from BAT405_Analytics_Dashboard_Evaluation_Questionnaire_Revised.pdf):
 *   • Data-privacy consent (RA 10173): "I agree" continues; "I do not agree" ends the form at once
 *   • Respondent information: Name (Last name, First name M.I.), SR-Code, Section
 *   • Dashboard details and whether a live demonstration was observed
 *   • Sections A–F: 4 statements each, rated 5 / 4 / 3 / 2 / 1 / N/A (one answer per row required)
 *   • Four open-ended questions
 *   • A linked Google Sheet with a "Summary" tab that computes item, domain and overall means
 *     from valid ratings only (N/A is excluded from the denominator, never counted as zero),
 *     as the questionnaire's scoring note requires.
 */

// ============================== SETTINGS ==============================
const SETTINGS = {
  GROUP_NAME: 'Group __ (edit me)',
  DASHBOARD_NAME: 'Academic Quality Dashboard — SETE & Academic Performance Analytics',
  DASHBOARD_URL: 'https://sete-analytics-dashboard.vercel.app',
  PRIMARY_USER: 'Authorized Academic Administrator',
  DEMO_LOGIN: 'demo.academic.admin@example.com',
  DEMO_PASSWORD: 'Demo-SETE-2026',
  SECTIONS: ['BSIT BA - 4101', 'BSIT BA - 4103'],
  // Requires respondents to sign in with Google; prevents duplicate responses.
  ONE_RESPONSE_PER_PERSON: true,
  COLLECT_EMAIL: true,
};
// =====================================================================

const RATING_COLUMNS = ['5', '4', '3', '2', '1', 'N/A'];
const SCALE_TEXT = '5 = Strongly Agree · 4 = Agree · 3 = Neutral · 2 = Disagree · 1 = Strongly Disagree · N/A = Not Assessable';

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

function createEvaluationForm() {
  const title = 'BAT 405 – Interactive Analytics Dashboard Evaluation Questionnaire';
  const form = FormApp.create(title);

  form
    .setDescription(
      'Case Study: Enhancing the University Student and Faculty Portal Through Analytics and Decision Support\n\n' +
        'Purpose: Assess the clarity, usefulness, presentation, interactivity, and responsible design of the analytics dashboard ' +
        'developed for the Student and Faculty Portal and Student Evaluation of Teaching Effectiveness (SETE).\n\n' +
        'Dashboard / Group: ' + SETTINGS.GROUP_NAME + '\n' +
        'Primary dashboard user: ' + SETTINGS.PRIMARY_USER + '\n\n' +
        'Instructions: Review the dashboard and observe its demonstration when available. Indicate how much you agree with each ' +
        'statement. Select N/A if a feature cannot be assessed. Do not assume that a proposed feature is functional unless demonstrated.\n\n' +
        SCALE_TEXT
    )
    .setProgressBar(true)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage('Thank you! Your evaluation of the dashboard has been recorded.');
  if (SETTINGS.COLLECT_EMAIL) form.setCollectEmail(true);
  if (SETTINGS.ONE_RESPONSE_PER_PERSON) form.setLimitOneResponsePerUser(true);

  // ---- Data privacy consent (gate) -----------------------------------------------
  // "I agree" continues to the questionnaire; "I do not agree" submits the form right
  // away, so no name, SR-Code or answers are ever collected from someone who declines.
  const consent = form.addMultipleChoiceItem();
  consent
    .setTitle('Data Privacy Consent')
    .setHelpText(
      'DATA PRIVACY NOTICE\n' +
        'In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), we will collect your name, SR-Code, section and ' +
        'answers only to evaluate our BAT 405 analytics dashboard project.\n\n' +
        '• Your information will be used for academic purposes only and will not be shared outside the class and instructor.\n' +
        '• Results are reported only as summaries (averages), never as individual answers with your name.\n' +
        '• Responses will be kept securely and deleted after the course requirement is completed.\n' +
        '• Participation is voluntary. If you do not agree, select "I do not agree" and the form will end; nothing else will be asked.\n\n' +
        'Do you agree to take part in this evaluation?'
    )
    .setChoices([
      consent.createChoice(
        'I agree. I have read the data privacy notice and voluntarily allow the use of my information for this evaluation.',
        FormApp.PageNavigationType.CONTINUE
      ),
      consent.createChoice('I do not agree. (The form will end here.)', FormApp.PageNavigationType.SUBMIT),
    ])
    .setRequired(true);

  // ---- Respondent information --------------------------------------------------
  form.addPageBreakItem().setTitle('Respondent Information').setHelpText('Please type your details exactly in the formats shown.');

  form
    .addTextItem()
    .setTitle('Name (Last name, First name M.I.)')
    .setHelpText('Format: Last name, First name M.I.   Example: Dela Cruz, Juan A.   (Leave out the M.I. if you have no middle name.)')
    .setRequired(true)
    .setValidation(
      FormApp.createTextValidation()
        .setHelpText('Use the format: Last name, First name M.I. — e.g. Dela Cruz, Juan A.')
        .requireTextMatchesPattern("^[A-Za-zÀ-ÿÑñ][A-Za-zÀ-ÿÑñ' .-]*, [A-Za-zÀ-ÿÑñ][A-Za-zÀ-ÿÑñ' .-]*?( [A-Za-zÑñ]{1,2}\\.)?$")
        .build()
    );

  form
    .addTextItem()
    .setTitle('SR-Code')
    .setHelpText('Format: 00-00000   Example: 23-12345')
    .setRequired(true)
    .setValidation(
      FormApp.createTextValidation().setHelpText('Enter your SR-Code like 23-12345 (2 digits, a dash, 5 digits).').requireTextMatchesPattern('^[0-9]{2}-[0-9]{5}$').build()
    );

  form.addMultipleChoiceItem().setTitle('Section').setChoiceValues(SETTINGS.SECTIONS).setRequired(true);

  // ---- Dashboard details -------------------------------------------------------
  form
    .addPageBreakItem()
    .setTitle('Dashboard Being Evaluated')
    .setHelpText(
      SETTINGS.DASHBOARD_NAME + '\n' +
        'Group: ' + SETTINGS.GROUP_NAME + '\n' +
        'Primary dashboard user: ' + SETTINGS.PRIMARY_USER + '\n' +
        'Link: ' + SETTINGS.DASHBOARD_URL + '\n' +
        'Demo sign-in: ' + SETTINGS.DEMO_LOGIN + ' / password ' + SETTINGS.DEMO_PASSWORD + '\n\n' +
        'All data in the dashboard is synthetic demonstration data. It is an academic prototype, not an official university system.'
    );

  form
    .addMultipleChoiceItem()
    .setTitle('How did you review the dashboard?')
    .setChoiceValues(['I observed a live demonstration', 'I used the dashboard myself', 'Both', 'I only saw screenshots / a recording'])
    .setRequired(true);

  // ---- Rating sections A–F -----------------------------------------------------
  DOMAINS.forEach(function (d) {
    form.addPageBreakItem().setTitle(d.title).setHelpText(SCALE_TEXT + (d.note ? '\n' + d.note : ''));
    form
      .addGridItem()
      .setTitle(d.title)
      .setHelpText('Choose one rating for each statement.')
      .setRows(d.items.map(function (t, i) { return rowLabel_(d, i, t); }))
      .setColumns(RATING_COLUMNS)
      .setRequired(true);
  });

  // ---- Open-ended ------------------------------------------------------------
  form.addPageBreakItem().setTitle('Open-Ended Evaluation').setHelpText('Answer briefly and specifically.');
  OPEN_ENDED.forEach(function (q, i) {
    form.addParagraphTextItem().setTitle(i + 1 + '. ' + q).setRequired(true);
  });

  // ---- Response spreadsheet with automatic scoring ----------------------------
  const ss = SpreadsheetApp.create(title + ' (Responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);
  buildSummary_(ss.getId(), title);

  Logger.log('Form created.');
  Logger.log('Edit the form:          ' + form.getEditUrl());
  Logger.log('Share with respondents: ' + form.getPublishedUrl());
  Logger.log('Responses & scoring:    ' + ss.getUrl());
}

/** Adds a "Summary" tab computing means from valid ratings (1–5) only; N/A never counts as zero. */
function buildSummary_(spreadsheetId, title) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const responses = ss.getSheets().filter(function (s) { return s.getFormUrl(); })[0];
  const r = "'" + (responses ? responses.getName() : 'Form Responses 1') + "'";
  let summary = ss.getSheetByName('Sheet1') || ss.insertSheet('Summary');
  summary.setName('Summary');
  ss.setActiveSheet(summary);
  ss.moveActiveSheet(1);

  // Column of one statement, found by its header so the formula survives column moves.
  const col = function (header) {
    return 'INDEX(' + r + '!$A$2:$ZZ,0,MATCH("' + header.replace(/"/g, '""') + '",' + r + '!$1:$1,0))';
  };
  const interp = function (cell) {
    return '=IF(' + cell + '="","",IFS(' + cell + '>=4.21,"Strongly Agree",' + cell + '>=3.41,"Agree",' + cell + '>=2.61,"Neutral",' +
      cell + '>=1.81,"Disagree",TRUE,"Strongly Disagree"))';
  };

  const rows = [];
  rows.push([title + ' — Summary', '', '', '', '', '', '']);
  // Respondents who declined the privacy consent submit an empty response; count them separately.
  const consentCol = col('Data Privacy Consent');
  rows.push(['Responses (consent given)', '=IFERROR(COUNTIF(' + consentCol + ',"I agree*"),0)', '', '', '', '', '']);
  rows.push(['Declined consent (no data collected)', '=IFERROR(COUNTIF(' + consentCol + ',"I do not agree*"),0)', '', '', '', '', '']);
  rows.push(['Means use valid ratings (1–5) only. N/A is excluded from the denominator and is never treated as zero.', '', '', '', '', '', '']);
  rows.push(['Item', 'Statement', 'Mean', 'Interpretation', 'Valid ratings (n)', 'Sum of ratings', 'N/A count']);

  const domainRows = [];
  DOMAINS.forEach(function (d) {
    const first = rows.length + 2; // first item row (1-based) after the domain header row
    rows.push([d.title, '', '', '', '', '', '']);
    const domainRow = rows.length; // 1-based index of the domain header row
    d.items.forEach(function (t, i) {
      const header = d.title + ' [' + rowLabel_(d, i, t) + ']';
      const n = rows.length + 1;
      rows.push([
        d.code + (i + 1),
        t,
        '=IF(E' + n + '=0,"",F' + n + '/E' + n + ')',
        interp('C' + n),
        '=IFERROR(SUMPRODUCT(--ISNUMBER(VALUE(' + col(header) + '))*(' + col(header) + '<>"")),0)',
        '=IFERROR(SUMPRODUCT(IFERROR(VALUE(' + col(header) + '),0)),0)',
        '=IFERROR(COUNTIF(' + col(header) + ',"N/A"),0)',
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
