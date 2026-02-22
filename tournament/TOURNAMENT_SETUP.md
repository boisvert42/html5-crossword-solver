# Tournament Setup Guide (Manual Steps)

This guide outlines the manual steps required to set up your Firebase project for the Crossword Tournament Solver.
**NOTE:** These steps are for initial setup and development. The long-term plan is to abstract these administrative tasks into a dedicated web interface, so a tournament organizer won't need to interact directly with the Firebase console for most operations.

## Prerequisites

*   A Google account.
*   Basic familiarity with web browsers.

## Step-by-Step Setup

### 1. Create a Firebase Project

1.  Go to the [Firebase console](https://console.firebase.google.com/).
2.  Click "Add project" or "Create a project".
3.  Follow the prompts to create a new project. You can name it anything you like (e.g., "My Crossword Tournament"). You can disable Google Analytics for this project if you wish.

### 2. Enable Firestore Database

1.  From your project dashboard, navigate to **"Firestore Database"** in the left-hand menu.
2.  Click **"Create database"**.
3.  Choose **"Start in test mode"**. This is easiest for setup and testing, but for a production tournament, you **must** configure more secure rules later.
4.  Select a Cloud Firestore location (e.g., `nam5 (United States)`). This is where your data will be stored.
5.  Click **"Enable"**.

### 3. Enable Anonymous Authentication

1.  From your project dashboard, navigate to **"Authentication"** in the left-hand menu.
2.  Click **"Get started"**.
3.  Go to the **"Sign-in method"** tab.
4.  Find **"Anonymous"** in the list and click the pencil icon to edit.
5.  Toggle the **"Enable"** switch to turn it on.
6.  Click **"Save"**.

### 4. Register Your Web App

1.  Once your project is created, you'll be redirected to the project dashboard.
2.  In the "Get started by adding your app" section, click the **Web** icon (`</>`).
3.  Register your app:
    *   Choose an app nickname (e.g., "Tournament Solver").
    *   **Crucially, check the box for "Also set up Firebase Hosting".**
    *   Click "Register app".

### 5. Get Your Firebase Configuration

1.  After registering your app, Firebase will present you with your configuration object. It will look something like this:

    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSyC...",
      authDomain: "your-project-id.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project-id.appspot.com",
      messagingSenderId: "...",
      appId: "1:..."
    };
    ```

2.  **Copy this entire `firebaseConfig` object.** You will need it in the next step.

### 6. Configure the Tournament Solver (Local `firebase-config.js`)

1.  Navigate to the `tournament/` folder in your project.
2.  You will find a file named `firebase-config.example.js`.
3.  **Rename this file** to `firebase-config.js`.
4.  Open `firebase-config.js` in a text editor.
5.  **Paste the `firebaseConfig` object** you copied from the Firebase console into this file, replacing the placeholder comments.
6.  **Uncomment the `firebase.initializeApp(firebaseConfig);` line.**

    Your `firebase-config.js` file should now look something like this:

    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSyCaxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      authDomain: "your-project-id.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project-id.appspot.com",
      messagingSenderId: "1234567890",
      appId: "1:1234567890:web:abcdef1234567890"
    };

    firebase.initializeApp(firebaseConfig);
    ```

7.  **IMPORTANT SECURITY STEP:** Add `tournament/firebase-config.js` to your project's `.gitignore` file to prevent sensitive API keys from being committed to public source control.
    *   Open `.gitignore` at your project root.
    *   Add the line `tournament/firebase-config.js`.
    *   If you've previously committed this file, you'll need to remove it from Git's tracking: `git rm --cached tournament/firebase-config.js` and then commit this removal.

### 7. Add Sample Puzzle Metadata to Firestore

You need to manually add initial puzzle data to the `puzzles` collection in Firestore.

1.  In the Firebase console, navigate to **Firestore Database** -> `puzzles` collection.
2.  Add documents with the following fields for each puzzle:

    *   **Warm-Up Puzzle (Example):**
        *   **Document ID:** (Auto-ID)
        *   **Field:** `name`, **Type:** `string`, **Value:** `Warm-Up Puzzle`
        *   **Field:** `author`, **Type:** `string`, **Value:** `Various`
        *   **Field:** `fileName`, **Type:** `string`, **Value:** `warmup.jpz` (This is the name of the file in Firebase Storage)
        *   **Field:** `isWarmup`, **Type:** `boolean`, **Value:** `true`
        *   **Field:** `puzzleNumber`, **Type:** `number`, **Value:** `0`
        *   **Field:** `status`, **Type:** `string`, **Value:** `available`
        *   **Field:** `timeLimitSeconds`, **Type:** `number`, **Value:** `600`

    *   **Tournament Puzzle 1 (Example):**
        *   **Document ID:** (Auto-ID)
        *   **Field:** `name`, **Type:** `string`, **Value:** `Tournament Puzzle 1`
        *   **Field:** `author`, **Type:** `string`, **Value:** `Jane Doe`
        *   **Field:** `fileName`, **Type:** `string`, **Value:** `puzzle1.jpz`
        *   **Field:** `isWarmup`, **Type:** `boolean`, **Value:** `false`
        *   **Field:** `puzzleNumber`, **Type:** `number`, **Value:** `1`
        *   **Field:** `status`, **Type:** `string`, **Value:** `available`
        *   **Field:** `timeLimitSeconds`, **Type:** `number`, **Value:** `900`

    *   **Tournament Puzzle 2 (Example):**
        *   **Document ID:** (Auto-ID)
        *   **Field:** `name`, **Type:** `string`, **Value:** `Tournament Puzzle 2`
        *   **Field:** `author`, **Type:** `string`, **Value:** `John Smith`
        *   **Field:** `fileName`, **Type:** `string`, **Value:** `puzzle2.jpz`
        *   **Field:** `isWarmup`, **Type:** `boolean`, **Value:** `false`
        *   **Field:** `puzzleNumber`, **Type:** `number`, **Value:** `2`
        *   **Field:** `status`, **Type:** `string`, **Value:** `available`
        *   **Field:** `timeLimitSeconds`, **Type:** `number`, **Value:** `1200`

### 8. Create Firestore Index

To enable efficient querying of puzzles, you need to create a composite index.

1.  You will typically encounter an error in your browser's console (e.g., `Error loading puzzles: The query requires an index...`) which provides a direct link to create the index.
2.  Click on this link.
3.  The Firebase console will pre-fill the details for the required index (for `status` and `puzzleNumber`).
4.  Click **"Create Index"**.
5.  It might take a few minutes for the index to build. Once it's "Enabled", your puzzles will load correctly.

## Next Steps

Once Firebase is configured and sample data is in place, you can proceed with further development of the Tournament Solver UI and functionality.