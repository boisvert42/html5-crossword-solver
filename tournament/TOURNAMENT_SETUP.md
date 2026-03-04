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
3.  Choose **"Start in test mode"** for initial development.
4.  Select a location (e.g., `nam5`) and click **"Enable"**.

### 3. Enable Authentication
1.  Navigate to **"Authentication"**.
2.  Click **"Get started"** and go to the **"Sign-in method"** tab.
3.  **Anonymous:** Enable "Anonymous" and click "Save". (Used for participants).
4.  **Google:** Enable the "Google" provider.
    *   **Public-facing name:** Enter your tournament name.
    *   **Support email:** Select your Google email.
    *   Click **Save**.

### 4. Authorize Admins (Firestore)
Access to the Admin Dashboard is restricted to emails found in the `admins` collection with the authorized role.
1.  In the Firebase console, go to **Firestore Database**.
2.  Click **"Start collection"**.
3.  Collection ID: `admins`
4.  Document ID: (Your Google Email, e.g., `boisvert@gmail.com`)
5.  Add a field: **Field Name:** `role`, **Type:** `string`, **Value:** `admin`
6.  Click **Save**.

### 5. Create Required Firestore Indices
To enable the live puzzle list and the detailed leaderboard, you must create composite indices in Firestore.
1.  Open the Solver (`tournament.html`) or Admin (`admin.html`) in your browser.
2.  Open the browser console (**F12**).
3.  If you see a red error message starting with `The query requires an index...`, **click the link provided in the error message**.
4.  This will take you to the Firebase console with the required index settings (e.g., `isWarmup` + `puzzleNumber`) pre-filled.
5.  Click **"Create Index"** and wait for the status to become "Enabled" (usually 1-3 minutes).
6.  You will likely need to do this twice: once for the **Puzzle List** and once for the **Grid Leaderboard**.

### 6. Register Your Web App & Get Config
1.  On the project overview, click the **Web icon (</>)** to register a new app.
2.  Copy the `firebaseConfig` object provided.
3.  In the `tournament/` folder, rename `firebase-config.example.js` to `firebase-config.js`.
4.  Paste your config and uncomment `firebase.initializeApp(firebaseConfig);`.
5.  **Important:** Add `tournament/firebase-config.js` to your `.gitignore`.

---

## Production Security Setup

For a live tournament, you **must** apply these rules to protect your data.

### 1. Configure Firestore Rules
1.  In the **Firestore Database** section, click the **"Rules"** tab.
2.  Paste the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Checks if the user is in the 'admins' collection
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.token.email));
    }

    // Puzzles & Config: Publicly readable, only Admin can modify
    match /puzzles/{puzzle} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    match /tournament_config/{config} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Admins list: Only Admins can read/write
    match /admins/{email} {
      allow read, write: if isAdmin();
    }

    // Solver Profiles: Users can only modify their own profile
    match /solvers/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Scores: Users can only create their own score entries
    match /scores/{scoreId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
```
3.  Click **"Publish"**.

### 2. Authorized Domains
1.  Go to **Authentication > Settings**.
2.  Click **"Authorized domains"**.
3.  Ensure your tournament's production domain (e.g., `yourname.github.io`) is in the list.

---

## Administrative Tasks

### Using the Admin Interface
Navigate to **`tournament/admin.html`** and sign in with your authorized Google account.

#### 1. Managing Divisions
*   Go to the **Divisions** tab to define your tournament tiers (e.g., Harder, Easier).

#### 2. Configuring Settings
*   Go to the **Settings** tab to set your Tournament Title and Scoring Rules.

#### 3. Adding Puzzles
1.  **Prepare Files:** Place puzzle files in the **`tournament/puzzles/`** folder.
2.  **Add Metadata:** In the Admin Interface, go to the **Puzzles** tab and click **"Add New Puzzle"**.
3.  **Mapping:** Enter the local path (e.g., `./puzzles/my-puzzle.ipuz`) for each division.
4.  **Live Unlocking:** Setting a puzzle to **"Available"** makes it instantly appear on solver dashboards.

#### 4. Monitoring Results
*   The **Results** tab shows a live feed of submissions.
*   The **Solver Dashboard** Leaderboard is also live for authorized admins.
*   Use **"Export CSV"** for final standings.
