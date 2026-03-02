# Tournament Setup Guide

This guide outlines the steps required to set up your Firebase project for the Crossword Tournament Solver.

## Overview
The Tournament Solver uses **Firebase** for authentication, database (Firestore), and tournament configuration. All puzzle files are served locally from your web server, ensuring fast loads and zero CORS configuration.

---

## Initial Firebase Setup (One-Time)

### 1. Create a Firebase Project
1.  Go to the [Firebase console](https://console.firebase.google.com/).
2.  Click "Add project" and follow the prompts. (You can disable Google Analytics).

### 2. Enable Firestore Database
1.  Navigate to **"Firestore Database"**.
2.  Click **"Create database"**.
3.  Choose **"Start in test mode"** for initial development. For production, you **must** configure secure rules.
4.  Select a location (e.g., `nam5`) and click **"Enable"**.

### 3. Enable Anonymous Authentication
1.  Navigate to **"Authentication"**.
2.  Click **"Get started"** and go to the **"Sign-in method"** tab.
3.  Enable **"Anonymous"** and click **"Save"**.

### 4. Register Your Web App & Get Config
1.  On the project overview, click the **Web icon (</>)** to register a new app.
2.  Copy the `firebaseConfig` object provided.
3.  In the `tournament/` folder, rename `firebase-config.example.js` to `firebase-config.js`.
4.  Paste your config and uncomment `firebase.initializeApp(firebaseConfig);`.
5.  **Important:** Add `tournament/firebase-config.js` to your `.gitignore`.

### 5. Create Required Firestore Index
To enable the puzzle list, you must create a composite index.
1.  Open the Solver (`tournament.html`) in your browser.
2.  Open the browser console (F12). You will likely see an error: `The query requires an index...`.
3.  Click the link in the error message to go directly to the Firebase console and create the index (for `status` and `puzzleNumber`).

---

## Administrative Tasks

### Using the Admin Interface
Once the initial setup is complete, navigate to **`tournament/admin.html`** to manage your tournament.

#### 1. Managing Divisions
*   Go to the **Divisions** tab.
*   Define your tournament divisions (e.g., "Harder", "Easier").
*   These will immediately appear as options for new participants.

#### 2. Configuring Scoring
*   Go to the **Scoring** tab.
*   Set points for correct words, completion bonuses, and time-based bonuses/penalties.

#### 3. Adding Puzzles
1.  **Prepare Files:** Place your puzzle files (`.puz`, `.jpz`, `.ipuz`, etc.) in the **`tournament/puzzles/`** folder.
2.  **Add Metadata:** In the Admin Interface, go to the **Puzzles** tab and click **"Add New Puzzle"**.
3.  **Mapping:** For each division, enter the path starting with `./puzzles/` (e.g., `./puzzles/my-puzzle.ipuz`).

#### 4. Monitoring Results
*   The **Results** tab shows a live feed of all submissions.
*   Use the **"Export CSV"** button to download a complete spreadsheet of the tournament standings.