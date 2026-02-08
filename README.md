# Mental Health Program Tracker

A comprehensive, local-first web application designed for tracking patient progress in a mental health program. Built with [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Vite](https://vitejs.dev/), this application provides a robust interface for managing patient registries, clinical scores, and attendance records without the need for a backend server.

## 🚀 Features

### 📋 Patient Registry
-   **Comprehensive Management**: Add, view, and edit patient details including MRN (Medical Record Number), demographics, and program dates.
-   **Validation**: Enforces unique MRNs, valid age ranges (0-120), and logical date constraints (Graduation Date ≥ Start Date).
-   **Search & Filter**: Real-time filtering by MRN, Name, Care Coordinator, and Tier.

### 📊 Clinical Scales Tracking
Track monthly progress using standardized clinical assessments:
-   **PHQ-9** (Patient Health Questionnaire-9): Depression severity tracking (Range: 0-27).
-   **GAD-7** (Generalized Anxiety Disorder-7): Anxiety severity tracking (Range: 0-21).
-   **SDS** (Sheehan Disability Scale): Functional impairment tracking (Range: 0-30, configurable).
-   **Monthly Intervals**: Supports Initial assessment and months M2 through M12 (including M10).
-   **Data Integrity**: Validates scores against strict clinical ranges and supports a "Not collected" status for missing data.

### 📅 Attendance & Goals
Monitor patient engagement across multiple service types:
-   Psychology Individual Sessions
-   Occupational Therapy (OT) Sessions
-   Psychiatry Sessions
-   Workshop Sessions
-   Family Sessions
-   **Validation**: Ensures all attendance records are non-negative integers.

### ⚙️ Configurable Settings
-   **Tiers**: Customize patient tier labels.
-   **Care Coordinators**: Manage the list of available care coordinators.
-   **SDS Max Range**: Adjust the maximum score for the SDS scale (default: 30).

### 💾 Data Management
-   **Local Persistence**: All data is saved automatically to the browser's LocalStorage, ensuring data is retained between sessions.
-   **Import/Export**: detailed JSON import/export functionality for backup, transfer, or analysis.

## 🛠️ Tech Stack

-   **Frontend Framework**: React 18
-   **Language**: TypeScript 5
-   **Build Tool**: Vite 5
-   **Styling**: CSS Modules & Inline Styles for component-level isolation
-   **State Management**: React `useReducer` and `Context` (implied by complex state logic)
-   **Persistence**: LocalStorage API

## 🏁 Getting Started

### Prerequisites
-   [Node.js](https://nodejs.org/) (Version 16 or higher recommended)
-   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/program-register-horizon.git
    cd program-register-horizon
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

### Running the Application

Start the development server:
```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173` (or the URL shown in your terminal).

## 📖 Usage Guide

### adding a New Patient
1.  Click **"Add Patient"** on the main dashboard.
2.  Fill in the required fields: MRN, Name, Age, Tier, Start Date, Expected Graduation Date, and Care Coordinator.
3.  Click **"Save"**. The new patient will appear in the registry.

### Recording Monthly Scores
1.  Select a patient from the registry list to view **Patient Details**.
2.  Navigate to the **Scales** section.
3.  Choose the scale type (PHQ-9, GAD-7, or SDS).
4.  Enter the score for the specific month (Initial, M2, M3, etc.).
5.  Click **"Save"** to validate and persist the score.

### Tracking Attendance
1.  In the **Patient Details** view, scroll to **Attendance & Goals**.
2.  Update the counts for each session type.
3.  Click **Save Attendance** to update the record.

### Exporting Data
1.  Go to the **Import/Export** tab.
2.  Click **"Export JSON"** to download a full backup of the application state.

## 📂 Project Structure

```
src/
├── components/       # Reusable UI components (if applicable)
├── pages/
│   └── ProgramRegister.tsx  # Main application logic and UI
├── types.ts          # TypeScript interfaces and type definitions
├── storage.ts        # LocalStorage and file I/O utilities
├── validators.ts     # Business logic and validation rules
├── seed.ts           # Initial state and seed data
├── App.tsx           # Root component
└── main.tsx          # Entry point
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the **ISC License**.
