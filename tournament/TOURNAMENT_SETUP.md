# Tournament Setup Guide

This guide outlines the steps required to set up your Firebase project for the Crossword Tournament Solver using Google Authentication and centralized participant management.

## Overview
The Tournament Solver uses **Firebase** for authentication, database (Firestore), and tournament configuration. Both Admins and Participants must sign in with a **Google Account**. Access is strictly controlled via whitelists in Firestore.

---

## Initial Firebase Setup (One-Time)

### 1. Create a Firebase Project
1.  Go to the [Firebase console](https://console.firebase.google.com/).
2.  Click "Add project" and follow the prompts.

### 2. Enable Firestore Database
1.  Navigate to **"Firestore Database"**.
2.  Click **"Create database"**.
3.  Choose **"Start in test mode"** for initial setup.
4.  Select a location (e.g., `nam5`) and click **"Enable"**.

### 3. Enable Google Authentication
1.  Navigate to **"Authentication"**.
2.  Click **"Get started"** and go to the **"Sign-in method"** tab.
3.  Enable the **Google** provider.
    *   **Public-facing name:** Enter your tournament name.
    *   **Support email:** Select your email.
    *   Click **Save**.

### 4. Authorize the Super-Admin (Firestore)
Access to the Admin Dashboard is restricted to emails found in the `admins` collection.
1.  In the Firebase console, go to **Firestore Database**.
2.  Click **"Start collection"**.
3.  Collection ID: `admins`
4.  Document ID: (Your Google Email, e.g., `you@gmail.com`)
5.  Add a field: **Field Name:** `role`, **Type:** `string`, **Value:** `admin`
6.  Click **Save**.

### 5. Register Your Web App
1.  On the project overview, click the **Web icon (</>)** to register a new app.
2.  Copy the `firebaseConfig` object provided.
3.  In the `tournament/` folder, rename `firebase-config.example.js` to `firebase-config.js`.
4.  Paste your config and uncomment `firebase.initializeApp(firebaseConfig);`.
5.  **Important:** Add `tournament/firebase-config.js` to your `.gitignore`.

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

---

## Administrative Tasks

### 1. Authorize Participants (CSV)
1.  Open **`tournament/admin.html`** and sign in.
2.  Go to the **Participants** tab.
3.  Upload a CSV with headers: `email, division`.
4.  Only users in this list will be allowed to sign in to the solver dashboard.

### 2. Managing Puzzles
1.  Place your puzzle files in **`tournament/puzzles/`**.
2.  In the Admin UI, use the **Puzzles** tab to add metadata.
3.  Use the **"Check"** button to verify your local file paths.

### 3. Tournament Settings
*   Set your **Tournament Title** and **Scoring Rules** in the **Settings** tab.
*   The title updates live on the participant dashboard.

### 4. Viewing Results
*   The **Results** tab shows a live feed of all submissions.
*   The **Leaderboard** on the solver page is also live for administrators.
