# Tournament Setup Guide

This guide outlines the steps required to set up your Firebase project for the Crossword Tournament Solver using Google Authentication and centralized participant management.

## Overview
The Tournament Solver uses **Firebase** for authentication, database (Firestore), and tournament configuration. Both Admins and Participants must sign in with a **Google Account**. Access is strictly controlled via whitelists in Firestore.

---

## Initial Firebase Setup (One-Time)

### 1. Create a Firebase Project
1.  Go to the [Firebase console](https://console.firebase.google.com/).
2.  Click "Add project" and follow the prompts. (You can disable Google Analytics; it is not required for this project).

### 2. Enable Firestore Database
1.  In the left-hand sidebar, click on **"Build"** to expand the menu.
2.  Select **"Firestore Database"**.
3.  Click **"Create database"**.
4.  If prompted for a database edition, choose **"Standard Edition"**.
5.  Choose **"Start in test mode"** for initial setup.
6.  Select a location (e.g., `nam5`) and click **"Enable"**.

### 3. Enable Google Authentication
1.  Under the **"Build"** menu, select **"Authentication"**.
2.  Click **"Get started"** and go to the **"Sign-in method"** tab.
3.  Enable the **Google** provider.
    *   **Public-facing name:** Enter your tournament name.
    *   **Support email:** Select your Google email.
    *   Click **Save**.

### 4. Authorize the Super-Admin (Firestore)
Access to the Admin Dashboard is restricted to emails found in the `admins` collection.
1.  In the Firebase console, go to **Firestore Database** (under **Build**).
2.  Click **"Start collection"**.
3.  Collection ID: `admins`
4.  Document ID: (Your Google Email, e.g., `you@gmail.com`)
5.  Add a field: **Field Name:** `role`, **Type:** `string`, **Value:** `admin`
6.  Click **Save**.

### 5. Register Your Web App & Get Config
1.  Navigate back to the **Project Overview** (home icon at the top of the left sidebar).
2.  Click the **"+ Add app"** button.
3.  Click the **Web icon (</>)** to register a new web app.
4.  **App nickname:** Enter a name (e.g., "Tournament Solver").
5.  **Firebase Hosting:** You can leave the "Also set up Firebase Hosting" checkbox **unchecked** if you are hosting on your own server or GitHub Pages.
6.  Click **"Register app"**.
7.  Copy the `firebaseConfig` object provided.
8.  In the `tournament/` folder, rename `firebase-config.example.js` to `firebase-config.js`.
9.  Paste your config and uncomment `firebase.initializeApp(firebaseConfig);`.

### 6. Create Required Firestore Indices
To enable the live puzzle list and the detailed leaderboard, you must create composite indices in Firestore.
1.  Open the Solver (`tournament.html`) or Admin (`admin.html`) in your browser.
2.  Open the browser console (**F12**).
3.  If you see a red error message starting with `The query requires an index...`, **click the link provided in the error message**.
4.  This will take you to the Firebase console with the required index settings pre-filled.
5.  Click **"Create Index"** and wait for the status to become "Enabled" (usually 1-3 minutes).
6.  You will likely need to do this twice: once for the **Puzzle List** and once for the **Grid Leaderboard**.

---

## Production Security Setup

Apply these rules in the **Firestore > Rules** tab to protect your data.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Checks if the user is in the 'admins' collection
    function isAdmin() {
      return request.auth != null &&
             exists(/databases/$(database)/documents/admins/$(request.auth.token.email.lower()));
    }

    // Puzzles & Config: Publicly readable by auth users, only Admin can modify
    match /puzzles/{puzzle} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /tournament_config/{config} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Admins list: Only Admins can manage other admins
    match /admins/{email} {
      allow read, write: if isAdmin();
    }

    // Participants list: Admins manage, Users can read their own
    match /participants/{email} {
      allow read: if request.auth != null && request.auth.token.email.lower() == email.lower();
      allow read, write: if isAdmin();
    }

    // Solver Profiles: Users can only create/edit their own profile
    match /solvers/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Scores: Publicly readable, users can only create their own score entries
    match /scores/{scoreId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
```

## Administrative Tasks

### 1. Managing Divisions
1.  Open **`tournament/admin.html`** and sign in.
2.  Go to the **Divisions** tab.
3.  Define your tournament tiers (e.g., `Harder`, `Easier`). 
4.  **Note:** These names must exactly match the divisions you use in your Participants CSV.

### 2. Authorize Participants (CSV)
1.  Go to the **Participants** tab.
2.  Upload a CSV with headers: `email, division`.
3.  Only users in this list will be allowed to sign in to the solver dashboard.

### 3. Managing Puzzles
1.  Place your puzzle files in **`tournament/puzzles/`**.
2.  In the Admin UI, use the **Puzzles** tab to add metadata.
3.  Use the **"Check"** button to verify your local file paths.

### 4. Tournament Settings
*   Set your **Tournament Title** and **Scoring Rules** in the **Settings** tab.
*   The title updates live on the participant dashboard.

### 5. Viewing Results
*   The **Results** tab shows a live feed of all submissions.
*   The **Leaderboard** on the solver page is also live for administrators.
