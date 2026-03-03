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

### 3. Enable Authentication
1.  Navigate to **"Authentication"**.
2.  Click **"Get started"** and go to the **"Sign-in method"** tab.
3.  **Anonymous:** Enable "Anonymous" and click "Save". (Used for participants).
3.  **Google:** Enable the "Google" provider.
    *   **Public-facing name:** Enter your tournament name (e.g., "My Crossword Tournament").
    *   **Support email:** Select your Google email from the dropdown.
    *   Click **Save**.


### 4. Authorize Admins
Access to the Admin Dashboard is restricted by an email whitelist.
1.  Open **`tournament/admin.js`**.
2.  Find the `ALLOWED_ADMINS` constant at the top of the file.
3.  Add your Google email address to the array.
4.  Only emails in this list will be granted access after signing in with Google.

### 4. Register Your Web App & Get Config
1.  On the project overview, click the **Web icon (</>)** to register a new app.
2.  Copy the `firebaseConfig` object provided.
3.  In the `tournament/` folder, rename `firebase-config.example.js` to `firebase-config.js`.
4.  Paste your config and uncomment `firebase.initializeApp(firebaseConfig);`.
5.  **Important:** Add `tournament/firebase-config.js` to your `.gitignore`.

### 5. Create Required Firestore Indices
To enable the live puzzle list and leaderboard, you must create composite indices.
1.  Open the Solver (`tournament.html`) or Admin (`admin.html`) in your browser.
2.  Open the browser console (F12). You will likely see errors like: `The query requires an index...`.
3.  Click the link in each error message to go directly to the Firebase console and create the required indices.
    *   One for the **Puzzles** (Status + PuzzleNumber).
    *   One for the **Leaderboard** (Division + totalScore + totalTime).

---

## Administrative Tasks

### Using the Admin Interface
Once the initial setup is complete, navigate to **`tournament/admin.html`** and log in with your admin credentials.

#### 1. Managing Divisions
*   Go to the **Divisions** tab to define your tournament tiers.
*   These appear instantly for new participants.

#### 2. Configuring Settings
*   Go to the **Settings** tab.
*   **Tournament Metadata:** Set the official title of your event.
*   **Scoring Rules:** Set points for correct words, completion bonuses, and time-based bonuses/penalties.

#### 3. Adding Puzzles
1.  **Prepare Files:** Place your puzzle files (`.puz`, `.jpz`, `.ipuz`, etc.) in the **`tournament/puzzles/`** folder.
2.  **Add Metadata:** In the Admin Interface, go to the **Puzzles** tab and click **"Add New Puzzle"**.
3.  **Mapping:** For each division, enter the path starting with `./puzzles/` (e.g., `./puzzles/my-puzzle.ipuz`).
4.  **Live Unlocking:** Setting a puzzle to **"Available"** will cause it to instantly appear with a pulse animation on all solver dashboards.

#### 4. Monitoring Results (The Live Dashboard)
*   The **Results** tab shows a live feed of all submissions as they happen.
*   The **Solver Dashboard** Leaderboard is also live for the admin, allowing you to show the race to the finish on your stream.
*   Use the **"Export CSV"** button to download a spreadsheet of the final standings.