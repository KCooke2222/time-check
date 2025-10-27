/**
 * Roll up weekly sheets within a date range using centralized category detection.
 * Requires helpers.gs providing:
 *   - Totals.findCategory(title)
 *   - Totals.compute(categoryTotals)
 */
function getRunningTotals() {
  // ====== CONFIG: edit these Sundays (inclusive) ======
  const RANGE = {
    // Use component ctor to avoid UTC parsing issues
    start: new Date(2025, 8 - 1, 24), // ⚠️ Zero based (0-11)
    end: new Date(2025, 9 - 1, 28), // ❗need to subtract one from month
  };
  const startKey =
    RANGE.start.getFullYear() * 10000 +
    (RANGE.start.getMonth() + 1) * 100 +
    RANGE.start.getDate();
  const endKey =
    RANGE.end.getFullYear() * 10000 +
    (RANGE.end.getMonth() + 1) * 100 +
    RANGE.end.getDate();
  // ====================================================

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  const categories = new Map(); // canonicalCat -> total hours
  const categoryWeeks = new Map(); // canonicalCat -> Set(week sheet names)
  let weekCount = 0;

  for (const sheet of sheets) {
    const name = sheet.getName();
    if (!name.startsWith("Week ")) continue;

    // Expect "Week yyyy-m-d" (month/day may be 1 or 2 digits)
    const m = /^Week\s+(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(name);
    if (!m) continue;

    const y = +m[1],
      mo = +m[2],
      d = +m[3];
    const weekKey = y * 10000 + mo * 100 + d; // e.g., 20250525

    // Inclusive range check, time/DST-proof
    if (weekKey < startKey || weekKey > endKey) continue;

    // Find "Summary" row in col C
    const colC = sheet.getRange("C1:C1000").getValues().flat();
    const summaryIdx = colC.findIndex(
      (v) => v && String(v).trim().toLowerCase() === "summary"
    );
    if (summaryIdx === -1 || summaryIdx <= 2) continue;

    const summaryRow = summaryIdx + 1; // back to 1-based row index
    const height = summaryRow - 2; // rows 2..
    const data = sheet.getRange(2, 1, height, 4).getValues();

    let sawAny = false;
    const seenThisWeek = new Set();

    for (const row of data) {
      const title = row[1]; // column B
      const rawCat = row[2]; // column C
      const dur = Number(row[3]); // column D (plain number like 2.5)
      if (isNaN(dur) || dur <= 0) continue;

      // Use centralized finder over "title + rawCat"
      const probe = [title || "", rawCat || ""].join(" ");
      let cat = Totals.findCategory(probe);
      if (!cat && rawCat) cat = String(rawCat).trim(); // fallback: literal cell

      if (!cat) continue;

      sawAny = true;

      categories.set(cat, (categories.get(cat) || 0) + dur);

      if (!seenThisWeek.has(cat)) {
        if (!categoryWeeks.has(cat)) categoryWeeks.set(cat, new Set());
        categoryWeeks.get(cat).add(name);
        seenThisWeek.add(cat);
      }
    }

    if (sawAny) weekCount++; // count only weeks with data ingested
  }

  // ===== Write master summary =====
  const summarySheet =
    ss.getSheetByName("Total Summary") || ss.insertSheet("Total Summary");
  summarySheet.clear();

  // Format date range header
  const startStr = `${RANGE.start.getFullYear()}-${
    RANGE.start.getMonth() + 1
  }-${RANGE.start.getDate()}`;
  const endStr = `${RANGE.end.getFullYear()}-${
    RANGE.end.getMonth() + 1
  }-${RANGE.end.getDate()}`;
  const rangeHeader = `Week Range ${startStr} to ${endStr}`;

  summarySheet
    .getRange("A1")
    .setValue(rangeHeader)
    .setFontWeight("bold")
    .setBackground("#1d5e2a")
    .setFontColor("white")
    .setHorizontalAlignment("center");

  summarySheet.getRange("A1:D1").merge();

  // Change the column headers line to:
  summarySheet
    .getRange("A2:D2")
    .setValues([["Category", "Total Hours", "Weeks", "Avg/Week"]])
    .setFontWeight("bold")
    .setBackground("#1d5e2a")
    .setFontColor("white");

  // Change writeRow from 2 to 3:
  let writeRow = 3;

  // Build per-category rows
  const rows = [];
  let grandTotal = 0;
  for (const [cat, total] of categories.entries()) {
    const weeks = (categoryWeeks.get(cat) || new Set()).size;
    const avg = weeks > 0 ? total / weeks : 0;
    rows.push([cat, total, weeks, avg]);
    grandTotal += total;
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  if (rows.length) {
    summarySheet.getRange(writeRow, 1, rows.length, 4).setValues(rows);
    summarySheet.getRange(writeRow, 2, rows.length, 1).setNumberFormat("0.##"); // Total Hours
    summarySheet.getRange(writeRow, 4, rows.length, 1).setNumberFormat("0.##"); // Avg/Week
    writeRow += rows.length;

    summarySheet
      .getRange(writeRow, 1, 1, 4)
      .setValues([["TOTAL", grandTotal, weekCount, ""]])
      .setFontWeight("bold");
    summarySheet.getRange(writeRow, 2, 1, 1).setNumberFormat("0.##");
    writeRow += 2; // spacer
  } else {
    summarySheet
      .getRange(writeRow, 1)
      .setValue("No data found in selected week range.");
    writeRow += 2;
  }

  // Grouped totals via centralized logic
  const grouped = Totals.compute(Object.fromEntries(categories));

  summarySheet
    .getRange(writeRow, 1, 1, 3)
    .setValues([["Grouped Totals", "Hours", "Avg/Week"]])
    .setFontWeight("bold");
  writeRow++;

  const groupRows = grouped.asRows.map(([label, hours]) => {
    const avg = weekCount > 0 ? hours / weekCount : 0;
    return [label, hours, avg];
  });

  summarySheet.getRange(writeRow, 1, groupRows.length, 3).setValues(groupRows);
  summarySheet
    .getRange(writeRow, 2, groupRows.length, 2)
    .setNumberFormat("0.##");

  summarySheet.autoResizeColumns(1, 4);
}
