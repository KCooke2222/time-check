# Category Tree UX + Sync Plan

Goal: make the category tree feel instant and reliable (optimistic UI), with correct backend persistence for rename/create/delete/move/reorder, and better inline UX for actions.

## Scope summary
- Frontend: convert tree to controlled state, add optimistic updates, inline rename, improved selection + action placement, icon buttons, inline confirm, remove noisy popups.
- Backend: ensure move + reorder are supported (parent_id/section_id + display_order). Add simple reorder endpoints (sequential PUTs in server).
- Integration: reconcile optimistic state with server responses and handle errors/rollbacks cleanly.

## Current facts (from code review)
- Frontend tree is built from `sections` + `categories` and rebuilt on every render in `CategoryTree.jsx`.
- Drag/drop currently only updates parent (section_id/parent_id) and reloads data; no reorder persistence.
- Rename/create/delete rely on full reload and show global messages.
- Backend supports updating `display_order` for sections and categories via PUT, but no batch endpoint.
- Sections are hierarchical; categories can be root-level (`section_id` null).

## Decisions so far
- Ordering: keep backend normalized (sections + categories) and build React Complex Tree items in the frontend.
- Root ordering: sections (folders) first, then root-level categories.
- New item placement: insert next to the currently selected item (same parent).
- Rename save behavior: click-off (blur) saves current state; Enter saves; Escape cancels.
- Confirm delete: inline popover next to delete action.
- Icons: use `react-icons` (or inline SVG if needed).
- Single-user only; sequential PUTs are acceptable; no undo (warn only).

## Phase 0: Confirm API behavior and data ordering
1. Verify `display_order` usage in backend queries:
   - `sections` are ordered by `Section.display_order`.
   - `categories` are ordered by `Category.display_order`.
2. Confirm how frontend should interpret ordering:
   - Tree order should reflect `display_order` for siblings.
   - Root rendering order: sections first, then categories.
3. Confirm limitations:
   - No reorder API today; we’ll add simple reorder endpoints (sequential updates).

Deliverable: documented expectations for ordering + move semantics.

## Phase 1: Controlled tree state + optimistic updates
1. Replace `buildTreeItems()` with a stateful `items` map and `viewState`.
2. On load:
   - Normalize sections + categories into a single items map.
   - Preserve stable `children` arrays ordered by `display_order`.
3. For create/delete/rename/move:
   - Apply optimistic changes immediately in `items`.
   - Track pending operations for rollback or error handling.
   - Reconcile with server response (ids or display_order corrections).
4. Remove full `loadData()` usage for every action; use targeted updates and a periodic refresh if needed.

Deliverable: tree updates instantly for create/delete/rename/move without full reload.

## Phase 2: Drag + drop move and reorder
1. Enable reorder at the tree level:
   - Set `canReorderItems` true.
2. Interpret drop targets:
   - Drop onto section -> becomes child of that section.
   - Drop between siblings -> reorder within same parent.
3. Update state:
   - Move item in items map (remove from old parent children, insert into new parent children at index).
4. Persist to backend:
   - For moved item: update `parent_id` (section) or `section_id` (category).
   - For reordered siblings: update `display_order` for affected siblings.
5. Backend strategy:
   - Add reorder endpoints that accept ordered IDs and update display_order sequentially on the server.

Deliverable: drag/drop both moves and reorders with correct persisted order.

## Phase 3: Inline rename + selection improvements
1. Double-click on item name to rename (not just expand).
2. Support Enter (save), Escape (cancel), blur = save.
3. Keep selection stable during rename.
4. If rename fails, roll back the optimistic label and show inline error.

Deliverable: fast in-place editing with proper save/rollback.

## Phase 4: Action UI polish
1. Replace "+ Folder" and "+ Category" text buttons with icon buttons.
2. Place delete action inline on the selected row (right side).
3. Replace `confirm()` with a small inline popover near the delete action.
4. Remove or downgrade global "Created/Deleted" popups to light, non-blocking toasts or inline hints.
5. Avoid "item created" popups; consider a subtle highlight on new items instead.

Deliverable: actions are discoverable, localized, and less disruptive.

## Phase 5: Regression checks
Manual checklist:
- Create folder/category -> appears immediately; correct parent; no page flash.
- Rename item -> instant UI update; saved to backend.
- Delete item -> correct item removed; confirm anchored to row.
- Drag item into section -> persists section_id/parent_id; order correct after refresh.
- Reorder among siblings -> persists display_order; order preserved after refresh.
- Tags panel still tracks selected category after operations.

## Backend changes (if needed)
Add simple reorder endpoints for sections and categories:
- `PUT /categories/sections/reorder` with `{ parent_id, ordered_ids: [..] }`
- `PUT /categories/categories/reorder` with `{ section_id, ordered_ids: [..] }`
- Server updates display_order for all ids in order (sequential updates).

## Risks / open questions
- How large can a sibling list get? (performance impacts reorder updates)
- Any ordering edge cases with mixed root sections + categories?

## Files likely to change
- `frontend/src/components/CategoryTree.jsx`
- `frontend/src/services/api.js` (if adding batch endpoints)
- `backend/app/api/categories.py` (if adding reorder endpoints)
- `backend/app/models.py` (if ordering logic needs adjustment)

## Success criteria
- UI actions feel instant with no full reload flicker.
- Drag/drop reorder persists and is stable after refresh.
- Rename/create/delete are intuitive and consistent.
- Reduced noisy popups; confirmations are inline.
