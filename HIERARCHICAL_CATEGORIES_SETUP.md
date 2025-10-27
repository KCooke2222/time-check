# Hierarchical Categories Setup Guide

## What's New

Your time-track app now supports **hierarchical folder-based categories**!

### Structure
```
📁 Total Work (folder)
   📁 Studying (subfolder)
      📄 1302 (trackable with keywords)
      📄 2126 (trackable with keywords)
   📁 Projects (subfolder)
      📄 3300 (trackable with keywords)
   📄 misc (trackable at section level)

📄 gym (root-level trackable, no folder)
📄 piano (root-level trackable, no folder)
```

### Concepts
- **📁 Folders (Sections)**: Organize categories hierarchically - can nest unlimited levels
- **📄 Trackables (Categories)**: Have keywords to match calendar events - can be at any level
- Categories can be at root level OR inside any folder
- Reports will aggregate up the folder hierarchy

---

## Setup Steps

### 1. Run the Database Migration

**Stop your backend server** (Ctrl+C in the backend terminal), then run:

```bash
cd backend
python migrate_hierarchical.py
```

Type `yes` when prompted. This adds:
- `parent_id` column to sections table
- Makes `section_id` nullable in categories table

### 2. Restart Backend

```bash
cd backend
venv\Scripts\activate   # if not already activated
python run.py
```

### 3. Restart Frontend (if needed)

If your frontend isn't auto-reloading:
```bash
cd frontend
npm run dev
```

### 4. Test the New UI

1. Go to **Settings** → **Categories** tab
2. You'll see the new tree-based interface
3. Try creating:
   - A folder (e.g., "Total Work")
   - A subfolder inside it (e.g., "Studying")
   - A trackable category with keywords (e.g., "1302" with keywords: `1302, comp sci`)

---

## UI Features

### Creating Folders
- Click **"+ Add Folder"**
- Enter name (e.g., "Total Work", "Studying")
- Select parent folder (or "Root Level" for top-level)
- Folders can nest unlimited levels

### Creating Trackable Categories
- Click **"+ Add Trackable"**
- Enter name (e.g., "1302", "gym", "piano")
- Select folder (or "Root Level")
- Enter keywords (comma-separated) - these match your calendar event titles
- Example keywords: `1302, computer science, algorithms`

### Organizing
- Click ▶/▼ to collapse/expand folders
- Delete folders or trackables with the "Delete" button (hover to see it)
- Deleting a folder deletes all its contents

---

## How Matching Works

When your calendar events sync:
1. Event titles are checked against ALL trackable categories
2. First matching keyword wins (based on display_order)
3. Case-insensitive substring matching
4. Example: Event "CS 1302 Lecture" matches category with keyword "1302"

---

## Reports (Next Step)

Reports will show hours aggregated up the hierarchy:
- Individual trackables show their hours
- Folders show sum of all children (recursively)
- "Total Work" would show sum of "Studying" + "Projects" + "misc"

**Note**: Report aggregation is the next feature to implement.

---

## Migration Rollback

If you need to revert (not recommended):
1. Stop backend
2. Delete or restore `backend/instance/time_track.db` from backup
3. Revert changes to `backend/app/models.py`

---

## Files Changed

### Backend
- `backend/app/models.py` - Added parent_id to Section, nullable section_id to Category
- `backend/app/api/categories.py` - Updated API to handle hierarchical sections
- `backend/migrate_hierarchical.py` - Migration script
- `backend/migrations/add_hierarchical_sections.py` - Detailed migration

### Frontend
- `frontend/src/components/CategoryTreeManager.jsx` - New tree UI component
- `frontend/src/components/Settings.jsx` - Uses new CategoryTreeManager
- `frontend/src/services/api.js` - Updated API client for parent_id

---

## Troubleshooting

### "column parent_id does not exist"
- Migration didn't run. Run: `python backend/migrate_hierarchical.py`

### Folders not showing
- Check browser console for errors
- Restart both backend and frontend
- Clear browser cache

### Keywords not matching
- Keywords are case-insensitive substrings
- Check event title contains exact keyword
- Higher display_order = higher priority in matching

---

## What's Next

After setting up your hierarchical categories, the next step is:
1. **Update Reports** to show hierarchical aggregation
2. **Add drag-and-drop** for easier reorganization (optional)
3. **Bulk operations** for moving multiple items at once (optional)
