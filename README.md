## Mental Health Program

React + TypeScript (Vite) tracker for monthly mental health program follow-up. Local-first, no backend.

### Run
- `npm run dev`

### Features
- Patient registry with MRN uniqueness, date constraints, and required selects.
- Monthly scales (PHQ-9, GAD-7, SDS) with strict numeric ranges and "Not collected" state.
- Attendance & goals tracking with integer validation.
- Local persistence (LocalStorage) + JSON import/export.
- Settings screen to manage tiers, coordinators, and SDS max range.

### Import / Export
- Export: use **Import/Export → Export JSON**.
- Import: upload a previously exported JSON file; validation runs before applying.

### Validation rules (high level)
- MRN required and unique.
- Age: 0–120 integer.
- Dates: start date required; expected graduation ≥ start date.
- Scales:
  - PHQ-9: 0–27
  - GAD-7: 0–21
  - SDS: 0–30 (configurable)
- Attendance counts: integers ≥ 0.

### Notes
- Month indices used: Initial (0), M2..M12 (no M1). M10 is supported explicitly.
