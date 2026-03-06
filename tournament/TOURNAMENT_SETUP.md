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
    *   **Public-facing name:** Enter your tournament name (e.g., "My Crossword Tournament").
    *   **Support email:** Select your Google email from the dropdown.
    *   Click **Save**.

### 4. Authorize the Super-Admin (Firestore)
Access to the Admin Dashboard is restricted to emails found in the `admins` collection.
1.  In the Firebase console, go to **Firestore Database** (under **Build**).
2.  Click **"Start collection"**.
3.  Collection ID: `admins`
4.  Document ID: (Your Google Email, e.g., `admin-name@gmail.com`)
5.  Add a field: **Field Name:** `role`, **Type:** `string`, **Value:** `admin`
6.  Click **Save**.

### 5. Register Your Web App & Get Config
1.  Navigate back to the **Project Overview** (home icon at the top of the left sidebar).
2.  Click the **"+ Add app"** button.
3.  Click the **Web icon (</>)** to register a new web app.
4.  **App nickname:** Enter a name (e.g., "Tournament Solver").
5.  **Firebase Hosting:** You can leave the "Also set up Firebase Hosting" checkbox **unchecked**.
6.  Click **"Register app"**.
7.  Copy the `firebaseConfig` object provided.
8.  In the `tournament/` folder, rename `firebase-config.example.js` to `firebase-config.js`.
9.  Paste your config and uncomment `firebase.initializeApp(firebaseConfig);`.
10. **Important:** Add `tournament/firebase-config.js` to your `.gitignore`.

### 6. Create Required Firestore Indices
To enable the live puzzle list and the detailed leaderboard, you must create composite indices in Firestore.
1.  Open the Admin dashboard (`admin.html`) in your browser.
2.  If an index is missing, a **red error message** will appear directly on the page with a link.
3.  Click the link in the error message.
4.  In the Firebase console, click **"Create Index"** (or **"Save"**).
5.  Wait for the status to become "Enabled" (usually 3-5 minutes).
6.  **Note:** The red error message in the dashboard will persist until the index is fully built. It is okay to continue setting up other tasks while the index builds in the background.
7.  You may need to do this twice: once for the **Puzzle List** and once for the **Grid Leaderboard**.

---

## Firebase Billing & Plan (Recommended for Launch)

While you can start for free on the **Spark Plan**, we strongly recommend switching to the **Blaze Plan (Pay-as-you-go)** for the actual tournament days.

### Why switch to Blaze?
*   **Connection Limit:** The Free (Spark) plan has a hard limit of **100 simultaneous connections**. 
*   **Daily Quotas:** The Free plan has daily limits on database reads (50k). Large crowds can hit this limit, causing the app to shut off.
*   **Blaze is cheap:** For a typical tournament of 100–500 solvers, your total bill will likely be **less than $1.00**, as the Blaze plan still includes the free tiers.

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

### 1. Managing Divisions
1.  Open **`tournament/admin.html`** and sign in.
2.  Go to the **Divisions** tab.
3.  Define your tournament tiers (e.g., `Harder`, `Easier`). 

### 2. Authorize Participants (CSV)
1.  Go to the **Participants** tab.
2.  Upload a CSV with headers: `email, division`. (Typoes in divisions will be flagged).

### 3. Managing Puzzles
1.  Place puzzle files in **`tournament/puzzles/`**.
2.  In the Admin UI, go to the **Puzzles** tab to add metadata and use the **"Check"** button to verify paths.

### 4. Tournament Settings
*   Set your **Tournament Title** and **Scoring Rules** in the **Settings** tab.

### 5. Viewing Results
*   The **Results** tab shows a live feed of all submissions.
*   The **Leaderboard** on the admin page provides a live grid of all standings.
