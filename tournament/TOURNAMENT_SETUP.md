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

### 7. Upload Puzzle Files to Firebase Storage

Before you can add puzzle metadata to Firestore, you need to upload the actual puzzle files (e.g., `.puz`, `.jpz` files) to Firebase Storage. These files will be served to the solver client.

1.  In the Firebase console, navigate to **"Storage"** in the left-hand menu.
2.  You should see a default storage bucket. Click on the **"Files"** tab.
3.  Create a new folder named `puzzles`. This helps organize your puzzle assets. To do this, click the "Create folder" icon (or similar UI element), type `puzzles`, and confirm.
4.  Navigate into the `puzzles` folder.
5.  Click the **"Upload file"** button and select your puzzle files from your local computer.
6.  Once uploaded, note the full path to your files (e.g., `puzzles/warmup.puz`, `puzzles/puzzle1.puz`). These paths will be used in your Firestore puzzle metadata.

### 8. Add Sample Puzzle Metadata to Firestore

After uploading your puzzle files to Firebase Storage, you need to manually add initial puzzle data to the `puzzles` collection in Firestore. Ensure the `filePath` values (or paths within `filesByDivision`) exactly match the paths of your uploaded files in Firebase Storage.

*   **Warm-Up Puzzle (Example):**
    *   **Document ID:** (Auto-ID)
    *   **Field:** `name`, **Type:** `string`, **Value:** `Warm-Up Puzzle`
    *   **Field:** `author`, **Type:** `string`, **Value:** `Various`
    *   **Field:** `filePath`, **Type:** `string`, **Value:** `puzzles/warmup.puz` (This is the path to the file in Firebase Storage)
    *   **Field:** `isWarmup`, **Type:** `boolean`, **Value:** `true`
    *   **Field:** `puzzleNumber`, **Type:** `number`, **Value:** `0`
    *   **Field:** `status`, **Type:** `string`, `Value:** `available`
    *   **Field:** `timeLimitSeconds`, **Type:** `number`, **Value:** `600`

*   **Tournament Puzzle 1 (Example):**
    *   **Document ID:** (Auto-ID)
    *   **Field:** `name`, **Type:** `string`, **Value:** `Tournament Puzzle 1`
    *   **Field:** `author`, **Type:** `string`, **Value:** `Jane Doe`
    *   **Field:** `filePath`, **Type:** `string`, **Value:** `puzzles/puzzle1.puz`
    *   **Field:** `isWarmup`, **Type:** `boolean`, **Value:** `false`
    *   **Field:** `puzzleNumber`, **Type:** `number`, **Value:** `1`
    *   **Field:** `status`, **Type:** `string`, **Value:** `available`
    *   **Field:** `timeLimitSeconds`, **Type:** `number`, **Value:** `900`

### 9. Create Firestore Index

To enable efficient querying of puzzles, you need to create a composite index.

1.  You will typically encounter an error in your browser's console (e.g., `Error loading puzzles: The query requires an index...`) which provides a direct link to create the index.
2.  Click on this link.
3.  The Firebase console will pre-fill the details for the required index (for `status` and `puzzleNumber`).
4.  Click **"Create Index"**.
5.  It might take a few minutes for the index to build. Once it's "Enabled", your puzzles will load correctly.

### 10. Setting Up Divisions (Optional)

The tournament solver supports different "divisions" (e.g., "Harder", "Easier"), allowing you to serve different puzzles to different groups of solvers.

#### a. Define Available Divisions

1.  In the Firebase console, go to **Firestore Database**.
2.  Create a new collection named `tournament_config`.
3.  Inside this collection, create a new document with the **specific ID** `divisions`.
4.  In the `divisions` document, add a field:
    *   **Field:** `list`
    *   **Type:** `array`
    *   **Value:** An array of strings representing the names of your divisions.
        *   **Example Value:** `["Harder", "Easier", "Pairs"]`

Your `tournament_config/divisions` document should look like this:

![image](https://user-images.githubusercontent.com/1028/235338101-70529d47-380d-4581-98e3-535d8869c996.png)

When a new user logs in, they will be prompted to choose from one of these divisions.

#### b. Configure Puzzles for Divisions

For any puzzle that should be different across divisions, you need to modify its document in the `puzzles` collection.

1.  Instead of a single `filePath` field, add a new field named `filesByDivision`.
2.  Set its **Type** to `map`.
3.  Add key-value pairs to this map, where the **key** is the exact division name (from your `divisions` list) and the **value** is the path to that division's puzzle file.
4.  **Include a `default` key** as a fallback for any division not explicitly listed.

**Example: A puzzle with different files for "Harder" and "Easier" divisions.**

*   **Field:** `filesByDivision`, **Type:** `map`, **Value:**
    *   `Harder`: (string) `puzzles/p6-hard.puz`
    *   `Easier`: (string) `puzzles/p6-easy.puz`
    *   `default`: (string) `puzzles/p6-easy.puz`

**Example: A puzzle that is the same for all divisions.**
You can continue to use the simple `filePath` field. The application will automatically fall back to it if `filesByDivision` is not present.

*   **Field:** `filePath`, **Type:** `string`, **Value:** `puzzles/puzzle7.puz`

When a user in a specific division starts a puzzle, the solver will first look for a `filesByDivision` map and try to find a puzzle file matching their division. If it can't, it will use the `default` path, and finally, it will look for the top-level `filePath`.

#### c. Using Local Puzzle Files (Optional, Zero-Cost)

As an alternative to uploading files to Firebase Storage, you can store puzzle files directly within the project and serve them locally. This is a good option for testing or for running a tournament without incurring any Firebase Storage costs.

1.  **Place Files:** Place your puzzle files in the `puzzles/` directory at the root of the project (the same directory where you find `sample_puzzles`).

2.  **Use a Relative Path in Firestore:** When defining your puzzle in Firestore, use a relative path for the `filePath` (or in the `filesByDivision` map) that points from the `tournament/` directory to your file. **The path must start with `../`**.

**Example `puzzles` document using a local file:**

*   **Field:** `name`, **Type:** `string`, **Value:** `Local Test Puzzle`
*   **Field:** `author`, **Type:** `string`, **Value:** `Local Host`
*   **Field:** `filePath`, **Type:** `string`, **Value:** `../puzzles/my-local-puzzle.puz`
*   ... (other fields)

The application will detect that the path is local and will load it directly from the project files instead of trying to fetch it from Firebase Storage.

## Next Steps

Once Firebase is configured and sample data is in place, you can proceed with further development of the Tournament Solver UI and functionality.