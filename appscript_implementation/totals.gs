// useCurrent toggles this week default is last week
function getCalendarEvents(weeksBack = 1) {
  const calendarIds = [
    "primary",
    "b0125d75b40c054146be30170a7949097a77b5e1d988fcdb84aa96a738a144be@group.calendar.google.com",
    "969bafd735cf271cdb01517fabb363629a0d137426e7633ca87488da848ec545@group.calendar.google.com",
    "8076fc594c97317f21e482988ff29a6a8d6ef5b83b3d8c10ed21450e395c18ca@group.calendar.google.com",
  ];

  const now = new Date();
  const daysFromSunday = now.getDay();

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - daysFromSunday - weeksBack * 7);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  let events = [];
  calendarIds.forEach((id) => {
    let calendar = CalendarApp.getCalendarById(id);
    if (calendar) {
      events = events.concat(calendar.getEvents(sunday, saturday));
    }
  });

  const spreadsheetId = "1xVnrx3_aEXYIP4N9s_mZ6K0aMp6KUlPzc0OSYHqLQho";
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  const sheetName = `Week ${sunday.getFullYear()}-${
    sunday.getMonth() + 1
  }-${sunday.getDate()}`;
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  sheet.clear();

  // Set headers
  sheet.appendRow(["Date", "Event Title", "Category", "Duration (Hours)"]);

  // Format headers with dark blue and white text
  const headerRange = sheet.getRange("A1:D1");
  headerRange
    .setFontWeight("bold")
    .setBackground("#1A237E")
    .setFontColor("white")
    .setHorizontalAlignment("center");

  let categoryTotals = {};
  let totalTimeSpent = 0;
  let rowIndex = 2;

  for (const ev of events) {
    const title = ev.getTitle();
    const start = ev.getStartTime();
    const end = ev.getEndTime();
    const duration = (end - start) / 36e5; // hours

    if (duration <= 0 || duration >= 16) continue;

    // ⬇️ centralized category detection from helpers
    const category = Totals.findCategory(title);
    if (!category) continue;

    sheet.appendRow([start, title, category, duration]);
    categoryTotals[category] = (categoryTotals[category] || 0) + duration;
    totalTimeSpent += duration;
    rowIndex++;
  }

  // Apply formatting for date and duration columns
  const dataRange = sheet.getRange(`A2:A${rowIndex}`);
  dataRange.setNumberFormat("yyyy-MM-dd HH:mm");

  sheet.getRange("C2:C").setHorizontalAlignment("right"); // Right-align entire Category column

  const durationRange = sheet.getRange(`D2:D${rowIndex}`);
  durationRange.setNumberFormat("0.00");

  // Append summary with darker green background and white text
  sheet.appendRow(["", "", "Summary", ""]);
  let summaryStartRow = rowIndex;

  // Style the "Summary" row with a darker green background and white text
  const summaryHeaderRange = sheet.getRange(summaryStartRow, 3, 1, 2);
  summaryHeaderRange
    .setFontWeight("bold")
    .setBackground("#2C6B38")
    .setFontColor("white");

  // Append category totals
  Object.keys(categoryTotals).forEach((cat) => {
    sheet.appendRow(["", "", cat, categoryTotals[cat]]);
  });

  // Style category summary with a darker green background
  const summaryRange = sheet.getRange(
    summaryStartRow + 1,
    3,
    Object.keys(categoryTotals).length,
    2
  );
  summaryRange
    .setFontWeight("bold")
    .setBackground("#2C6B38")
    .setFontColor("white");

  // === Calculate and append grouped totals via helper ===
  var grouped = Totals.compute(categoryTotals);

  // Append Studying/Projects/Admin/Total Work
  sheet.appendRow(["", "", "Studying", grouped.studying]);
  sheet.appendRow(["", "", "Projects", grouped.projects]);
  sheet.appendRow(["", "", "Admin", grouped.admin]);
  sheet.appendRow(["", "", "Total Work", grouped.totalWork]);

  // Style the sums rows with a darker green background
  const summarySumsRange = sheet.getRange(
    summaryStartRow + Object.keys(categoryTotals).length + 1,
    3,
    4,
    2
  ); // 4 rows for Studying, Projects, Admin, and Total Work
  summarySumsRange
    .setFontWeight("bold")
    .setBackground("#205029")
    .setFontColor("white");

  // Append total time spent at the end with darker green and white text
  let finalRow = summaryStartRow + Object.keys(categoryTotals).length + 5;
  sheet.appendRow(["", "", "Total Time", totalTimeSpent]);

  const totalTimeRange = sheet.getRange(finalRow, 3, 1, 2);
  totalTimeRange
    .setFontWeight("bold")
    .setBackground("#1A237E")
    .setFontColor("white");

  // Auto resize all columns and add a slight padding (increase column width by a few pixels)
  sheet.autoResizeColumns(1, 4);

  // Add padding by slightly increasing column width (e.g., add 5 pixels)
  for (let i = 1; i <= 4; i++) {
    let currentWidth = sheet.getColumnWidth(i);
    sheet.setColumnWidth(i, currentWidth + 5); // Adjust this value for more/less padding
  }
}
