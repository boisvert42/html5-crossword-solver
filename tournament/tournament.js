// Tournament-specific JavaScript logic will go here
// This file will interact with Firebase, manage the tournament UI, etc.

const SOLVERS_COLLECTION = 'solvers'; // Firestore collection for solver profiles
const PUZZLES_COLLECTION = 'puzzles'; // Firestore collection for puzzle metadata

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

            // Store references to the solver's profile and the main app div
            let currentSolver = null;
            const tournamentAppDiv = document.getElementById('tournament-app');

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
                let name = ''; // Store the raw entered name as well

                if (solverDoc.exists) {
                    const data = solverDoc.data();
                    name = data.name;
                    displayName = data.displayName;
                    console.log('Found existing solver profile:', displayName);
                } else {
                    // Prompt for name if no profile found
                    let enteredName = prompt(
                        'Welcome!\\n\\n' +
                        'Please enter a name for the leaderboard. This can be your real name, a nickname, or any identifier you choose. ' +
                        'This name will be publicly displayed on leaderboards to track your progress in the tournament.\\n\\n' +
                        'Your Name:'
                    );
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
                    name = enteredName;
                    displayName = uniqueDisplayName;
                    console.log('Created new solver profile:', displayName);
                }

                currentSolver = { uid: user.uid, name: name, displayName: displayName };
                renderPuzzleList(); // After solver is initialized, render the puzzles
            }

            // Placeholder for loading a puzzle
            function loadPuzzle(puzzleData) {
                console.log('Loading puzzle:', puzzleData.name);
                // In the future, this will fetch the actual puzzle file from Storage
                // and initialize CrosswordNexus.createCrossword
                tournamentAppDiv.innerHTML = `
                    <h2>Loading "${puzzleData.name}"...</h2>
                    <p>Author: ${puzzleData.author}</p>
                    <p>Time Limit: ${puzzleData.timeLimitSeconds / 60} minutes</p>
                    <p>${puzzleData.isWarmup ? '(Warm-up Puzzle - scores not recorded)' : ''}</p>
                    <p>This is where the crossword will be displayed.</p>
                    <button id="backToPuzzles">Back to Puzzle List</button>
                    <div id="crossword-container"></div>
                `;
                document.getElementById('backToPuzzles').addEventListener('click', renderPuzzleList);
                // Here, you'd load the puzzle:
                // window.gCrossword = CrosswordNexus.createCrossword($('#crossword-container'), {
                //   puzzle_file: { url: puzzleData.filePath, type: puzzleData.fileType }
                // });
            }

            async function renderPuzzleList() {
                if (!currentSolver) {
                    tournamentAppDiv.innerHTML = `<p>Error: Solver not initialized.</p>`;
                    return;
                }

                tournamentAppDiv.innerHTML = `
                    <h2>Welcome, ${currentSolver.displayName}!</h2>
                    <p>Your solver ID: ${currentSolver.uid}</p>
                    <h3>Available Puzzles</h3>
                    <div id="warmup-puzzle-section"></div>
                    <div id="tournament-puzzles-section"></div>
                `;

                const warmUpSection = document.getElementById('warmup-puzzle-section');
                const tournamentSection = document.getElementById('tournament-puzzles-section');

                try {
                    const querySnapshot = await db.collection(PUZZLES_COLLECTION)
                        .where('status', '==', 'available')
                        .orderBy('puzzleNumber', 'asc')
                        .get();

                    let warmUpPuzzle = null;
                    const tournamentPuzzles = [];

                    querySnapshot.forEach(doc => {
                        const puzzle = { id: doc.id, ...doc.data() };
                        if (puzzle.isWarmup) {
                            warmUpPuzzle = puzzle;
                        } else {
                            tournamentPuzzles.push(puzzle);
                        }
                    });

                    // Render Warm-Up Puzzle
                    if (warmUpPuzzle) {
                        warmUpSection.innerHTML = `
                            <h4>Warm-up: ${warmUpPuzzle.name}</h4>
                            <p>Author: ${warmUpPuzzle.author}</p>
                            <p>Time Limit: ${warmUpPuzzle.timeLimitSeconds / 60} minutes (Scores not recorded)</p>
                            <button data-puzzle-id="${warmUpPuzzle.id}" class="start-puzzle-btn">Start Warm-up</button>
                        `;
                    } else {
                        warmUpSection.innerHTML = `<p>No warm-up puzzle available yet.</p>`;
                    }

                    // Render Tournament Puzzles
                    if (tournamentPuzzles.length > 0) {
                        tournamentSection.innerHTML = '<h4>Tournament Puzzles</h4>';
                        const ul = document.createElement('ul');
                        ul.className = 'puzzle-list';
                        tournamentPuzzles.forEach(puzzle => {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <span>#${puzzle.puzzleNumber}: ${puzzle.name} by ${puzzle.author}</span>
                                <span>(${puzzle.timeLimitSeconds / 60} min)</span>
                                <button data-puzzle-id="${puzzle.id}" class="start-puzzle-btn">Start Puzzle</button>
                            `;
                            ul.appendChild(li);
                        });
                        tournamentSection.appendChild(ul);
                    } else {
                        tournamentSection.innerHTML = `<p>No tournament puzzles available yet.</p>`;
                    }

                    // Add event listeners to all start buttons
                    document.querySelectorAll('.start-puzzle-btn').forEach(button => {
                        button.addEventListener('click', async (event) => {
                            const puzzleId = event.target.dataset.puzzleId;
                            const puzzleDoc = await db.collection(PUZZLES_COLLECTION).doc(puzzleId).get();
                            if (puzzleDoc.exists) {
                                loadPuzzle({ id: puzzleDoc.id, ...puzzleDoc.data() });
                            } else {
                                alert('Puzzle not found!');
                            }
                        });
                    });

                } catch (error) {
                    console.error('Error fetching puzzles:', error);
                    tournamentAppDiv.innerHTML = `<p>Error loading puzzles: ${error.message}</p>`;
                }
            }


            // Start the solver initialization process
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
