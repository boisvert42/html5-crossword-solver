# Tournament Setup Guide

This guide will help tournament organizers set up their own instance of the Crossword Tournament Solver using Firebase.

## Prerequisites

*   A Google account.
*   Basic familiarity with web browsers.

## Step-by-Step Setup

### 1. Create a Firebase Project

1.  Go to the [Firebase console](https://console.firebase.google.com/).
2.  Click "Add project" or "Create a project".
3.  Follow the prompts to create a new project. You can name it anything you like (e.g., "My Crossword Tournament"). You can disable Google Analytics for this project if you wish.

### 2. Enable Firestore Database

1.  From your project dashboard, navigate to **"Build" -> "Firestore Database"** in the left-hand menu.
2.  Click **"Create database"**.
3.  Choose **"Start in test mode"**. This is easiest for setup and testing, but for a production tournament, you might want to configure more secure rules later.
4.  Select a Cloud Firestore location (e.g., `nam5 (United States)`). This is where your data will be stored.
5.  Click **"Enable"**.

### 3. Enable Anonymous Authentication

1.  From your project dashboard, navigate to **"Build" -> "Authentication"** in the left-hand menu.
2.  Click **"Get started"**.
3.  Go to the **"Sign-in method"** tab.
4.  Find **"Anonymous"** in the list and click it.
5.  Toggle the **"Enable"** switch to turn it on.
6.  Click **"Save"**.

### 4. Register Your Web App

1.  Once your project is created, you'll be redirected to the project dashboard.
2.  Click the "+ Add App" button, then click the **Web** icon (`</>`).
3.  Register your app:
    *   Choose an app nickname (e.g., "Tournament Solver").
    *   **Crucially, check the box for "Also set up Firebase Hosting".**
    *   Click "Register app".

### 3. Get Your Firebase Configuration

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

### 4. Configure the Tournament Solver

1.  Navigate to the `tournament/` folder in the project.
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

### 5. Set up Firebase Hosting (Detailed in a future step)

Once your `firebase-config.js` is set up, the next step will involve deploying your `tournament.html` and associated files using Firebase Hosting. This will typically involve:

*   Installing the Firebase CLI (a one-time setup on your computer).
*   Running `firebase init` in your project directory.
*   Running `firebase deploy`.

More detailed instructions for deployment will follow.

## Managing Puzzles

You will use Firebase Storage to upload and manage your tournament puzzle files. Instructions for this will also be provided.

## Next Steps

After setting up Firebase configuration, you will proceed to:

1.  Integrate Firebase SDK into `tournament.html`.
2.  Implement puzzle loading from Firebase Storage.
3.  Implement puzzle submission to Firestore.
4.  Build a simple leaderboard.
