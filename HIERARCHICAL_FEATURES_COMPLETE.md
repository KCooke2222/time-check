# Hierarchical Categories - Complete Implementation Guide

## What's Been Implemented

### ✅ 1. Hierarchical Category System
- **Nested sections**: Folders can contain folders, unlimited depth
- **Flexible categories**: Trackable items with keywords can exist at any level
- **Database changes**: Added `parent_id` to sections, nullable `section_id` to categories

### ✅ 2. Hierarchical Reports
- **Automatic aggregation**: Child hours roll up to parent folders
- **Tree visualization**: Reports show folder structure with expand/collapse
- **Direct vs Total hours**: Shows both direct hours and aggregated totals
- **Works for both**: Weekly and range reports

### ✅ 3. Drag-and-Drop Organization
- **Visual reorganization**: Drag folders and categories to move them
- **Intuitive nesting**: Drop folders onto folders to nest them
- **Move categories**: Drop categories onto folders to relocate them
- **Drag handles**: Clear ⋮⋮ indicators for what's draggable

---

## Setup Instructions

### Step 1: Run Database Migration

**IMPORTANT**: Stop your backend first!

```bash
cd backend
python migrate_hierarchical.py
```

Type `yes` when prompted. This updates your database schema.

### Step 2: Restart Everything

Use your startup script:
```bash
.\start-dev.bat
```

Or manually:
```bash
# Terminal 1 - Backend
cd backend
venv\Scripts\activate
python run.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

---

## Using the New Features

### Creating Your Hierarchy

1. **Go to Settings → Categories**
2. **Create folders** (e.g., "Total Work", "Personal")
3. **Create subfolders** inside folders (e.g., "Studying" inside "Total Work")
4. **Create trackable categories** with keywords at any level

Example structure:
```
📁 Total Work
   📁 Studying
      📄 CS 1302 (keywords: 1302, comp sci)
      📄 Math 2126 (keywords: 2126, calculus)
   📁 Projects
      📄 Web Project (keywords: web, react)
   📄 Admin (keywords: admin, email)
📄 Gym (keywords: gym, workout)
📄 Piano (keywords: piano, practice)
```

### Reorganizing with Drag-and-Drop

1. **Grab the ⋮⋮ handle** on any folder or category
2. **Drag it** to a new location
3. **Drop it**:
   - On a folder → moves it inside that folder
   - At root level → makes it top-level

### Viewing Hierarchical Reports

1. **Go to Reports**
2. **Generate any report** (weekly or range)
3. **See the tree structure** under "By Section (Hierarchical)"
4. **Click ▶/▼** to expand/collapse folders
5. **See aggregated hours** - totals include all children

**Example output:**
```
📁 Total Work           50.00h   62.50h
  ▼ 📁 Studying         30.00h   37.50h
      📄 CS 1302         15.00h   18.75h
      📄 Math 2126       15.00h   18.75h
  ▼ 📁 Projects         15.00h   18.75h
      📄 Web Project     15.00h   18.75h
  📄 Admin (direct)      5.00h    6.25h
```

---

## How It Works

### Calendar Event Matching
1. Events sync from Google Calendar
2. Event titles checked against ALL trackable categories
3. First keyword match wins (based on display_order)
4. Example: "CS 1302 Lecture" → matches category "CS 1302"

### Report Aggregation
1. **Direct hours**: Events matched to categories in that folder
2. **Total hours**: Direct hours + all children's hours (recursive)
3. **Shown in reports**: Both direct and total displayed

### Drag-and-Drop Backend
- Moving folders updates `parent_id`
- Moving categories updates `section_id`
- Circular reference prevention built-in
- Changes save immediately to database

---

## Files Changed

### Backend
```
backend/
├── app/
│   ├── models.py                         # Added parent_id, nullable section_id
│   ├── api/categories.py                 # Updated to handle nesting
│   └── services/report_generator.py      # Added hierarchical aggregation
├── migrate_hierarchical.py               # Migration script
└── migrations/add_hierarchical_sections.py
```

### Frontend
```
frontend/
├── src/
│   ├── components/
│   │   ├── CategoryTreeManagerDnD.jsx    # Drag-and-drop tree UI
│   │   ├── HierarchicalSectionReport.jsx # Tree report display
│   │   ├── Reports.jsx                   # Updated to use hierarchical
│   │   └── Settings.jsx                  # Updated to use DnD manager
│   └── services/api.js                   # Updated API client
└── package.json                          # Added @dnd-kit packages
```

---

## Features in Detail

### 1. Hierarchical Section Summary Function
**File**: `backend/app/services/report_generator.py`

```python
def build_hierarchical_section_summary(section_totals, user):
    """
    Build hierarchical section summary by aggregating children up to parents.
    Returns list of root sections with nested children and aggregated hours.
    """
```

**What it does**:
- Takes flat section totals
- Builds tree structure
- Recursively aggregates child hours to parents
- Returns nested structure with `total_hours` and `direct_hours`

### 2. Tree Visualization Component
**File**: `frontend/src/components/HierarchicalSectionReport.jsx`

**Features**:
- Recursive rendering of nested sections
- Expand/collapse functionality
- Shows both direct and total hours
- Indentation for visual hierarchy
- Works for both weekly and range reports

### 3. Drag-and-Drop Manager
**File**: `frontend/src/components/CategoryTreeManagerDnD.jsx`

**Features**:
- Uses `@dnd-kit` library
- Draggable folders and categories
- Drop zones on folders
- Real-time API updates
- Error handling with rollback

---

## Troubleshooting

### Migration Issues

**Error**: "column parent_id does not exist"
- **Fix**: Migration didn't run. Stop backend, run `python backend/migrate_hierarchical.py`

**Error**: "no such table: categories"
- **Fix**: Database corrupted. Delete `backend/instance/time_track.db` and restart backend

### Frontend Issues

**Drag-and-drop not working**
- **Fix**: Packages not installed. Run `cd frontend && npm install`

**Reports showing flat list**
- **Fix**: Backend not updated. Restart backend server

**Tree not showing**
- **Fix**: Check browser console for errors. Might need to clear cache.

### Report Aggregation Issues

**Hours not adding up**
- **Explanation**: Direct hours ≠ total hours. Total includes all children.
- **Check**: Look at the "(direct: Xh)" indicator in reports

**Missing sections in reports**
- **Explanation**: Sections with no events won't show unless they have children
- **Behavior**: This is intentional - empty folders are hidden

---

## API Response Format

### Hierarchical Sections Response
```json
{
  "section_hierarchy": [
    {
      "id": 1,
      "name": "Total Work",
      "parent_id": null,
      "direct_raw_hours": 5.0,
      "direct_intensity_hours": 6.25,
      "total_raw_hours": 50.0,
      "total_intensity_hours": 62.5,
      "children": [2, 3],
      "weeks_present": 3,          // Range reports only
      "raw_hours_avg": 16.67,      // Range reports only
      "intensity_hours_avg": 20.83 // Range reports only
    }
  ]
}
```

---

## Next Steps (Optional Enhancements)

1. **Bulk operations**: Select multiple items and move at once
2. **Reordering within folders**: Drag to change display_order
3. **Keyboard shortcuts**: Arrow keys to navigate tree
4. **Search/filter**: Find categories in large trees
5. **Color coding**: Different colors for different section types
6. **Export/import**: Save and restore category hierarchies

---

## Performance Notes

- **Database**: Recursive queries are efficient for reasonable tree depths (< 10 levels)
- **Frontend**: Tree rendering is fast, uses React reconciliation
- **Drag-and-drop**: Optimistic updates with rollback on error
- **Reports**: Backend does heavy lifting, frontend just displays

---

## Testing Your Setup

### Test 1: Create Hierarchy
1. Create folder "Test Parent"
2. Create folder "Test Child" with parent = "Test Parent"
3. Create category "Test Cat" with keywords "test" in "Test Child"
4. Verify tree shows correct nesting

### Test 2: Event Matching
1. Sync calendar events with "test" in title
2. Check events get categorized to "Test Cat"
3. Verify category shows up in "Test Child" section

### Test 3: Report Aggregation
1. Generate weekly report
2. Check "Test Child" shows event hours
3. Check "Test Parent" total includes "Test Child" hours
4. Expand/collapse tree to verify

### Test 4: Drag-and-Drop
1. Create another folder "Test Parent 2"
2. Drag "Test Child" onto "Test Parent 2"
3. Verify it moved in the tree
4. Verify database updated (reload page)

---

## Summary

You now have a fully functional hierarchical category system with:
- ✅ Unlimited nesting depth
- ✅ Drag-and-drop reorganization
- ✅ Automatic hour aggregation in reports
- ✅ Tree visualization with expand/collapse
- ✅ Flexible category placement at any level

The system matches your original spreadsheet structure:
```
Total Work = Studying + Projects + Admin
Total Time = Total Work + Personal + Misc
```

Everything is now in the database and UI!
