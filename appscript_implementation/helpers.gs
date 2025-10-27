// helpers.gs
var Totals = (function () {
  var NON_WORK = ["gym", "read", "piano", "jp"];
  var ADMIN_KEY = "admin";
  var REV_KEYWORDS = ["rev"];

  var CONFIG = {
    // Classes grouped by semester - last group is current
    CLASS_GROUPS: [
      ["2341", "2340", "2325", "2125", "3377", "1320"], // fall2024
      ["2301", "2418", "reu"], // spring2025
      ["3341", "3301", "1302", "3300", "2326", "2126"], // fall2025 (current)
    ],
    OTHER_CATEGORIES: [
      "dsa",
      "gym",
      "biz",
      "odin",
      "kattis",
      "piano",
      "read",
      "admin",
      "kaggle",
      "jp",
      "extra",
      "",
    ],
    ALIASES: {
      job: "biz",
    },
  };

  function getCurrentClasses() {
    return CONFIG.CLASS_GROUPS[CONFIG.CLASS_GROUPS.length - 1];
  }

  function getAllClasses() {
    var all = [];
    for (var i = 0; i < CONFIG.CLASS_GROUPS.length; i++) {
      all = all.concat(CONFIG.CLASS_GROUPS[i]);
    }
    return all;
  }

  function getAllValidCategories() {
    return CONFIG.OTHER_CATEGORIES.concat(getAllClasses());
  }

  function findCategory(title) {
    var t = String(title || "").toLowerCase();

    // Check aliases first
    for (var alias in CONFIG.ALIASES) {
      if (t.includes(alias)) {
        return CONFIG.ALIASES[alias];
      }
    }

    // Check all valid categories substring (highest priority)
    var validCategories = getAllValidCategories();
    for (var j = 0; j < validCategories.length; j++) {
      var cat = String(validCategories[j]).toLowerCase();
      if (t.includes(cat)) return String(validCategories[j]);
    }

    // Check for rev keywords last (lowest priority)
    for (var i = 0; i < REV_KEYWORDS.length; i++) {
      if (t.includes(REV_KEYWORDS[i])) {
        return "rev";
      }
    }

    return null;
  }

  function compute(categoryTotals) {
    var studying = 0,
      projects = 0,
      admin = 0,
      totalTime = 0;
    var nonWork = new Set(
      NON_WORK.map(function (s) {
        return s.toLowerCase();
      })
    );
    var adminKey = ADMIN_KEY.toLowerCase();
    var currentClasses = getCurrentClasses();

    // Handle distributed rev time
    var revTime = Number(categoryTotals["rev"]) || 0;
    var distributedTime = 0;

    if (revTime > 0 && currentClasses.length > 0) {
      distributedTime = revTime / currentClasses.length;
    }

    for (var k in categoryTotals) {
      if (!categoryTotals.hasOwnProperty(k)) continue;
      var raw = String(k).trim();
      var cat = raw.toLowerCase();
      var dur = Number(categoryTotals[k]) || 0;
      if (dur <= 0) continue;

      // Skip rev entry to avoid double counting
      if (cat === "rev") {
        totalTime += dur;
        studying += dur;
        continue;
      }

      totalTime += dur;

      if (/^\d{4,}$/.test(raw) || cat === "rev") {
        studying += dur;
      } else if (cat === adminKey) {
        admin += dur;
      } else if (!nonWork.has(cat)) {
        projects += dur;
      }
    }

    var totalWork = studying + projects + admin;

    return {
      studying: studying,
      projects: projects,
      admin: admin,
      totalWork: totalWork,
      totalTime: totalTime,
      asRows: [
        ["Studying", studying],
        ["Projects", projects],
        ["Admin", admin],
        ["Total Work", totalWork],
        ["Total Time", totalTime],
      ],
    };
  }

  return {
    compute: compute,
    findCategory: findCategory,
    CONFIG: CONFIG,
  };
})();
