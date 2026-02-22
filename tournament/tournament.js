// Tournament-specific JavaScript logic will go here
// This file will interact with Firebase, manage the tournament UI, etc.

const SOLVERS_COLLECTION = 'solvers'; // Firestore collection for solver profiles

document.addEventListener('DOMContentLoaded', () => {
    console.log('Tournament page loaded.');

    if (typeof firebase !== 'undefined') {
        console.log('Firebase SDK loaded.');
        try {
            const app = firebase.app();
            console.log('Firebase app initialized:', app.name);

            // Initialize Firebase services
            const auth = firebase.auth();
            const db = firebase.firestore();

            // Function to handle solver initialization (auth, name prompt)
            async function initSolver() {
                let user = auth.currentUser;

                if (!user) {
                    // Sign in anonymously if not already signed in
                    try {
                        const userCredential = await auth.signInAnonymously();
                        user = userCredential.user;
                        console.log('Signed in anonymously with UID:', user.uid);
                    } catch (error) {
                        console.error('Error signing in anonymously:', error);
                        alert('Could not sign in. Please check your Firebase configuration and network connection.');
                        return;
                    }
                }

                // Check if solver profile exists in Firestore
                const solverRef = db.collection(SOLVERS_COLLECTION).doc(user.uid);
                const solverDoc = await solverRef.get();

                let displayName = '';

                if (solverDoc.exists) {
                    displayName = solverDoc.data().displayName;
                    console.log('Found existing solver profile:', displayName);
                } else {
                    // Prompt for name if no profile found
                    let enteredName = prompt('Welcome! Please enter your full name for the leaderboard:');
                    if (enteredName) {
                        enteredName = enteredName.trim();
                        if (enteredName.length === 0) {
                            enteredName = 'Anonymous Solver';
                        }
                    } else {
                        enteredName = 'Anonymous Solver'; // Default if prompt is cancelled or empty
                    }

                    // Generate a short unique suffix from the UID for display disambiguation
                    const uidSuffix = user.uid.substring(0, 4); // First 4 chars of UID
                    const uniqueDisplayName = `${enteredName} (#${uidSuffix})`;

                    // Store the chosen name and unique display name
                    await solverRef.set({
                        name: enteredName,
                        displayName: uniqueDisplayName, // This is what goes on the leaderboard
                        uid: user.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    displayName = uniqueDisplayName;
                    console.log('Created new solver profile:', displayName);
                }

                // Update UI with solver's name
                const appDiv = document.getElementById('tournament-app');
                if (appDiv) {
                    appDiv.innerHTML = `
                        <h2>Welcome, ${displayName}!</h2>
                        <p>Your unique solver ID is: ${user.uid}</p>
                        <p>Loading tournament puzzles...</p>
                        <!-- Crossword UI will be rendered here -->
                        <div class="crossword"></div>
                    `;
                }

                // Now you can start loading puzzles, etc.
                // Example: Initialize the crossword engine (uncomment and adapt when puzzles are ready)
                // const params = CrosswordShared.getCrosswordParams();
                // window.gCrossword = CrosswordNexus.createCrossword($('div.crossword'), params);
            }

            initSolver();

        } catch (e) {
            console.error('Error initializing Firebase app or services. Ensure firebase-config.js is correctly set up.', e);
            console.error('Please make sure you have renamed firebase-config.example.js to firebase-config.js and pasted your Firebase configuration there.');
            alert('A problem occurred during initialization. Check the console for details.');
        }
    } else {
        console.warn('Firebase SDK not loaded. Ensure the SDK scripts are correctly included in tournament.html.');
        alert('Firebase SDK not loaded. Cannot run tournament solver.');
    }
});
