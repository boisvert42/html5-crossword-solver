// Tournament-specific JavaScript logic will go here
// This file will interact with Firebase, manage the tournament UI, etc.

const SOLVERS_COLLECTION = 'solvers'; // Firestore collection for solver profiles
const PUZZLES_COLLECTION = 'puzzles'; // Firestore collection for puzzle metadata
const CONFIG_COLLECTION = 'tournament_config'; // Firestore collection for tournament configuration
const SCORES_COLLECTION = 'scores'; // Firestore collection for puzzle scores

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
            const storage = firebase.storage();

            // Store references to the solver's profile and the main app div
            let currentSolver = null;
            const tournamentAppDiv = document.getElementById('tournament-app');

            // Default scoring rules (can be overridden by Firestore)
            let scoringRules = {
                pointsPerWord: 10,
                timeBonusPerSecond: 1,
                completionBonus: 180,
                overtimePenaltyPer4Seconds: 1,
                minCorrectPercentageForTimeBonus: 0.5
            };

            // Fetch scoring rules from Firestore
            async function fetchScoringRules() {
                try {
                    const doc = await db.collection(CONFIG_COLLECTION).doc('scoring').get();
                    if (doc.exists) {
                        scoringRules = { ...scoringRules, ...doc.data() };
                        console.log('Loaded custom scoring rules:', scoringRules);
                    }
                } catch (e) {
                    console.warn('Could not fetch scoring rules, using defaults.', e);
                }
            }

            // Function to handle solver initialization (auth, setup UI)
            async function initSolver() {
                await fetchScoringRules();
                let user = auth.currentUser;

                if (!user) {
                    try {
                        const userCredential = await auth.signInAnonymously();
                        user = userCredential.user;
                        console.log('Signed in anonymously with UID:', user.uid);
                    } catch (error) {
                        console.error('Error signing in anonymously:', error);
                        tournamentAppDiv.innerHTML = `<p class="error">Error signing in: ${error.message}</p>`;
                        return;
                    }
                }

                const solverRef = db.collection(SOLVERS_COLLECTION).doc(user.uid);
                const solverDoc = await solverRef.get();

                if (solverDoc.exists && solverDoc.data().name && solverDoc.data().division) {
                    const data = solverDoc.data();
                    currentSolver = { 
                        uid: user.uid, 
                        name: data.name, 
                        displayName: data.displayName, 
                        division: data.division 
                    };
                    renderPuzzleList();
                } else {
                    renderSetupUI(user, solverDoc.exists ? solverDoc.data() : null);
                }
            }

            async function renderSetupUI(user, existingData) {
                const configDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
                const availableDivisions = (configDoc.exists && configDoc.data().list) ? configDoc.data().list : ['Easier', 'Harder', 'Pairs'];
                
                let html = `
                    <div class="setup-container">
                        <h2>Tournament Setup</h2>
                        <p>Welcome! Please provide a name and select your division to get started.</p>
                        
                        <div id="setupError" class="error-message"></div>

                        <div class="form-group">
                            <label for="solverName">Leaderboard Name:</label>
                            <input type="text" id="solverName" placeholder="Enter your name or nickname" maxlength="30" value="${existingData?.name || ''}">
                        </div>

                        <div class="form-group">
                            <label>Choose Your Division:</label>
                            <div class="division-grid">
                                ${availableDivisions.map(div => `
                                    <div class="division-card ${existingData?.division === div ? 'selected' : ''}" data-division="${div}">
                                        <h4>${div}</h4>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="setup-actions">
                            <button id="completeSetupBtn" class="primary-btn">Complete Setup & Start</button>
                        </div>
                    </div>
                `;

                tournamentAppDiv.innerHTML = html;

                let selectedDivision = existingData?.division || null;
                const errorDiv = document.getElementById('setupError');
                const nameInput = document.getElementById('solverName');

                // Division selection logic
                document.querySelectorAll('.division-card').forEach(card => {
                    card.addEventListener('click', () => {
                        document.querySelectorAll('.division-card').forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        selectedDivision = card.dataset.division;
                        errorDiv.style.display = 'none';
                    });
                });

                document.getElementById('completeSetupBtn').addEventListener('click', async () => {
                    const name = nameInput.value.trim();
                    
                    if (!name) {
                        errorDiv.textContent = 'Please enter a name.';
                        errorDiv.style.display = 'block';
                        return;
                    }

                    if (!selectedDivision) {
                        errorDiv.textContent = 'Please choose a division.';
                        errorDiv.style.display = 'block';
                        return;
                    }

                    const solverRef = db.collection(SOLVERS_COLLECTION).doc(user.uid);
                    const uidSuffix = user.uid.substring(0, 4);
                    const displayName = `${name} (#${uidSuffix})`;

                    try {
                        await solverRef.set({
                            name: name,
                            displayName: displayName,
                            uid: user.uid,
                            division: selectedDivision,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdAt: existingData?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        currentSolver = { uid: user.uid, name, displayName, division: selectedDivision };
                        renderPuzzleList();
                    } catch (e) {
                        console.error('Error saving profile:', e);
                        errorDiv.textContent = 'Error saving profile. Please try again.';
                        errorDiv.style.display = 'block';
                    }
                });
            }

            // Function to calculate score based on rules
            function calculateScore(xw, puzzleData, timeTakenSeconds) {
                const words = Object.values(xw.words);
                const totalWords = words.length;
                const correctWordsCount = words.filter(w => w.isCorrect()).length;
                const isFullyCorrect = correctWordsCount === totalWords;
                const timeLimit = puzzleData.timeLimitSeconds || 0;

                let score = correctWordsCount * scoringRules.pointsPerWord;

                if (isFullyCorrect) {
                    score += scoringRules.completionBonus;
                }

                const correctPercentage = correctWordsCount / totalWords;
                let timeBonus = 0;
                let overtimePenalty = 0;

                if (timeTakenSeconds <= timeLimit) {
                    if (correctPercentage >= scoringRules.minCorrectPercentageForTimeBonus) {
                        timeBonus = (timeLimit - timeTakenSeconds) * scoringRules.timeBonusPerSecond;
                    }
                } else {
                    const overtimeSeconds = timeTakenSeconds - timeLimit;
                    overtimePenalty = Math.floor(overtimeSeconds / 4) * scoringRules.overtimePenaltyPer4Seconds;
                }

                score += timeBonus;
                score -= overtimePenalty;

                return {
                    totalScore: Math.max(0, score), // Score can't be negative
                    correctWords: correctWordsCount,
                    totalWords: totalWords,
                    timeTaken: timeTakenSeconds,
                    timeLimit: timeLimit,
                    timeBonus: timeBonus,
                    overtimePenalty: overtimePenalty,
                    isFullyCorrect: isFullyCorrect
                };
            }

            async function submitPuzzle(puzzleData, scoreInfo) {
                if (puzzleData.isWarmup) {
                    alert('Warm-up puzzle complete! Scores are not recorded for warm-ups.');
                    renderPuzzleList();
                    return;
                }

                try {
                    const scoreRef = db.collection(SCORES_COLLECTION).doc(`${currentSolver.uid}_${puzzleData.id}`);
                    await scoreRef.set({
                        uid: currentSolver.uid,
                        solverName: currentSolver.displayName,
                        division: currentSolver.division,
                        puzzleId: puzzleData.id,
                        puzzleName: puzzleData.name,
                        puzzleNumber: puzzleData.puzzleNumber,
                        ...scoreInfo,
                        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('Score submitted successfully!');
                    showSubmissionResult(scoreInfo);
                } catch (e) {
                    console.error('Error submitting score:', e);
                    alert('Failed to submit score. Please check your connection.');
                }
            }

            function showSubmissionResult(scoreInfo) {
                tournamentAppDiv.innerHTML = `
                    <div class="submission-result">
                        <h2>Puzzle Submitted!</h2>
                        <div class="score-card">
                            <p class="total-score">Total Score: <span>${scoreInfo.totalScore}</span></p>
                            <p>Correct Words: ${scoreInfo.correctWords} / ${scoreInfo.totalWords}</p>
                            <p>Time Taken: ${Math.floor(scoreInfo.timeTaken / 60)}m ${scoreInfo.timeTaken % 60}s</p>
                            ${scoreInfo.timeBonus > 0 ? `<p class="bonus">Time Bonus: +${scoreInfo.timeBonus}</p>` : ''}
                            ${scoreInfo.overtimePenalty > 0 ? `<p class="penalty">Overtime Penalty: -${scoreInfo.overtimePenalty}</p>` : ''}
                            ${scoreInfo.isFullyCorrect ? `<p class="bonus">Completion Bonus: +${scoringRules.completionBonus}</p>` : ''}
                        </div>
                        <div class="puzzle-actions" style="justify-content: center;">
                            <button id="backToListAfterSubmit">Back to Puzzle List</button>
                            <button id="viewLeaderboardAfterSubmit" class="secondary-btn">View Leaderboard</button>
                        </div>
                    </div>
                `;
                document.getElementById('backToListAfterSubmit').addEventListener('click', renderPuzzleList);
                document.getElementById('viewLeaderboardAfterSubmit').addEventListener('click', () => renderLeaderboard());
            }

            async function renderLeaderboard(selectedDivision = currentSolver.division) {
                tournamentAppDiv.innerHTML = `
                    <div class="leaderboard-header">
                        <h2>Leaderboard</h2>
                        <div class="nav-actions">
                            <button id="backToPuzzlesFromLeaderboard">Back to Puzzles</button>
                            <select id="divisionFilter"></select>
                        </div>
                    </div>
                    <div id="leaderboard-content">
                        <p>Loading standings for <strong>${selectedDivision}</strong> division...</p>
                    </div>
                `;

                document.getElementById('backToPuzzlesFromLeaderboard').addEventListener('click', renderPuzzleList);
                
                // Fetch divisions for the filter
                try {
                    const configDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
                    const availableDivisions = (configDoc.exists && configDoc.data().list) ? configDoc.data().list : ['Easier', 'Harder', 'Pairs'];
                    
                    const filter = document.getElementById('divisionFilter');
                    availableDivisions.forEach(div => {
                        const opt = document.createElement('option');
                        opt.value = div;
                        opt.textContent = `${div} Division`;
                        opt.selected = (div === selectedDivision);
                        filter.appendChild(opt);
                    });

                    filter.addEventListener('change', (e) => {
                        renderLeaderboard(e.target.value);
                    });
                } catch (e) {
                    console.warn('Could not fetch divisions for filter', e);
                }

                try {
                    // Query scores for the selected division
                    const scoresSnapshot = await db.collection(SCORES_COLLECTION)
                        .where('division', '==', selectedDivision)
                        .get();

                    const solverScores = {};

                    scoresSnapshot.forEach(doc => {
                        const data = doc.data();
                        if (!solverScores[data.uid]) {
                            solverScores[data.uid] = {
                                name: data.solverName,
                                totalScore: 0,
                                puzzlesSolved: 0,
                                totalTime: 0
                            };
                        }
                        solverScores[data.uid].totalScore += data.totalScore;
                        solverScores[data.uid].puzzlesSolved += 1;
                        solverScores[data.uid].totalTime += data.timeTaken;
                    });

                    // Convert to array and sort
                    const leaderboardData = Object.values(solverScores).sort((a, b) => {
                        if (b.totalScore !== a.totalScore) {
                            return b.totalScore - a.totalScore;
                        }
                        return a.totalTime - b.totalTime; // Lower time wins ties
                    });

                    const leaderboardContent = document.getElementById('leaderboard-content');
                    if (leaderboardData.length === 0) {
                        leaderboardContent.innerHTML = `<p>No scores submitted for the <strong>${selectedDivision}</strong> division yet.</p>`;
                        return;
                    }

                    let tableHtml = `
                        <table class="leaderboard-table">
                            <thead>
                                <tr>
                                    <th class="rank">Rank</th>
                                    <th>Solver</th>
                                    <th>Puzzles</th>
                                    <th>Total Score</th>
                                    <th>Total Time</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    leaderboardData.forEach((entry, index) => {
                        const isMe = (entry.name === currentSolver.displayName);
                        tableHtml += `
                            <tr class="${isMe ? 'current-user' : ''}">
                                <td class="rank">${index + 1}</td>
                                <td>${entry.name} ${isMe ? ' (You)' : ''}</td>
                                <td>${entry.puzzlesSolved}</td>
                                <td class="score-cell">${entry.totalScore}</td>
                                <td>${Math.floor(entry.totalTime / 60)}m ${entry.totalTime % 60}s</td>
                            </tr>
                        `;
                    });

                    tableHtml += '</tbody></table>';
                    leaderboardContent.innerHTML = tableHtml;

                } catch (e) {
                    console.error('Error loading leaderboard:', e);
                    document.getElementById('leaderboard-content').innerHTML = `<p>Error loading leaderboard: ${e.message}</p>`;
                }
            }

            // Function to load and render a specified puzzle
            async function loadPuzzle(puzzleData) {
                // Determine the correct puzzle file based on the solver's division
                let puzzlePath = null;
                if (puzzleData.filesByDivision && currentSolver.division) {
                    puzzlePath = puzzleData.filesByDivision[currentSolver.division] || puzzleData.filesByDivision.default;
                }
                // Fallback to the old filePath field for backward compatibility
                if (!puzzlePath) {
                    puzzlePath = puzzleData.filePath; 
                }

                if (!puzzlePath) {
                    console.error('Could not determine puzzle path for puzzle:', puzzleData.name, 'and division:', currentSolver.division);
                    alert('Error: Could not find the puzzle file for your division.');
                    renderPuzzleList(); // Go back to the list
                    return;
                }

                let puzzleUrl;

                // If path starts with '../', treat as a local relative path. Otherwise, get a Firebase Storage download URL.
                if (puzzlePath.startsWith('../')) {
                    console.log(`Loading local puzzle from: ${puzzlePath}`);
                    puzzleUrl = puzzlePath;
                } else {
                    try {
                        console.log(`Fetching download URL for Firebase Storage path: ${puzzlePath}`);
                        const storageRef = storage.ref(puzzlePath);
                        puzzleUrl = await storageRef.getDownloadURL();
                        console.log('Got download URL:', puzzleUrl);
                    } catch (error) {
                        console.error(`Failed to get download URL for ${puzzlePath}`, error);
                        alert(`Error: Could not load puzzle file from cloud storage. ${error.message}`);
                        renderPuzzleList();
                        return;
                    }
                }

                // Render the puzzle container UI
                tournamentAppDiv.innerHTML = `
                    <div class="puzzle-header">
                        <h2>"${puzzleData.name}"</h2>
                        <div class="puzzle-meta">
                            Author: ${puzzleData.author} | Time Limit: ${puzzleData.timeLimitSeconds / 60} minutes
                            ${puzzleData.isWarmup ? ' <span class="warmup-tag">(Warm-up)</span>' : ''}
                        </div>
                        <div class="puzzle-actions">
                            <button id="backToPuzzles">Exit to List</button>
                            <button id="submitPuzzleBtn" class="primary-btn">Submit Puzzle</button>
                        </div>
                    </div>
                    <div id="crossword-container"></div>
                `;
                document.getElementById('backToPuzzles').addEventListener('click', () => {
                    if (confirm('Are you sure you want to exit? Your progress will be saved locally, but your score won\\'t be submitted yet.')) {
                        renderPuzzleList();
                    }
                });

                const submitBtn = document.getElementById('submitPuzzleBtn');
                submitBtn.addEventListener('click', () => {
                    if (confirm('Are you ready to submit your puzzle? This will finalize your score for this puzzle.')) {
                        const scoreInfo = calculateScore(window.gCrossword, puzzleData, window.gCrossword.xw_timer_seconds);
                        submitPuzzle(puzzleData, scoreInfo);
                    }
                });

                // Now, load the crossword into the container
                try {
                    console.log(`Initializing crossword with URL: ${puzzleUrl}`);
                    const crosswordContainer = $('#crossword-container');
                    crosswordContainer.show();

                    window.gCrossword = CrosswordNexus.createCrossword(crosswordContainer, {
                       puzzle_file: { url: puzzleUrl },
                       onSolved: (xw) => {
                           console.log('Puzzle solved! Enabling quick submit.');
                           // We could auto-submit here, but it's safer to let the user click the button
                           // maybe highlight it?
                           document.getElementById('submitPuzzleBtn').classList.add('ready');
                       }
                    });
                } catch (e) {
                    console.error("Error creating crossword:", e);
                    alert("Failed to render the crossword puzzle.");
                }
            }

            async function renderPuzzleList() {
                if (!currentSolver) {
                    tournamentAppDiv.innerHTML = `<p>Error: Solver not initialized.</p>`;
                    return;
                }

                // Check for already submitted scores
                let submittedPuzzleIds = new Set();
                try {
                    const scoresSnapshot = await db.collection(SCORES_COLLECTION)
                        .where('uid', '==', currentSolver.uid)
                        .get();
                    scoresSnapshot.forEach(doc => {
                        submittedPuzzleIds.add(doc.data().puzzleId);
                    });
                } catch (e) {
                    console.warn('Could not fetch previous scores:', e);
                }

                tournamentAppDiv.innerHTML = `
                    <div class="solver-info">
                        <h2>Welcome, ${currentSolver.displayName}!</h2>
                        <div class="solver-meta">
                            <div>Division: <strong>${currentSolver.division}</strong> | Solver ID: <code>${currentSolver.uid.substring(0,8)}...</code></div>
                            <button id="viewLeaderboardBtn" class="secondary-btn">View Leaderboard</button>
                        </div>
                    </div>
                    <h3>Available Puzzles</h3>
                    <div id="warmup-puzzle-section" class="puzzle-section"></div>
                    <div id="tournament-puzzles-section" class="puzzle-section"></div>
                `;

                document.getElementById('viewLeaderboardBtn').addEventListener('click', () => renderLeaderboard());

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
                            <div class="puzzle-card warmup">
                                <h4>Warm-up: ${warmUpPuzzle.name}</h4>
                                <p>Author: ${warmUpPuzzle.author} (${warmUpPuzzle.timeLimitSeconds / 60} min)</p>
                                <button data-puzzle-id="${warmUpPuzzle.id}" class="start-puzzle-btn">Start Warm-up</button>
                            </div>
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
                            const isSubmitted = submittedPuzzleIds.has(puzzle.id);
                            const li = document.createElement('li');
                            li.className = isSubmitted ? 'submitted' : '';
                            li.innerHTML = `
                                <div class="puzzle-info">
                                    <span class="puz-num">#${puzzle.puzzleNumber}</span>
                                    <span class="puz-name">${puzzle.name}</span>
                                    <span class="puz-author">by ${puzzle.author}</span>
                                    <span class="puz-time">(${puzzle.timeLimitSeconds / 60} min)</span>
                                </div>
                                <div class="puzzle-status">
                                    ${isSubmitted ? '<span class="status-tag">Submitted</span>' : 
                                    `<button data-puzzle-id="${puzzle.id}" class="start-puzzle-btn">Start Puzzle</button>`}
                                </div>
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
            console.error('Error initializing Firebase app or services.', e);
            alert('A problem occurred during initialization. Check the console for details.');
        }
    } else {
        console.warn('Firebase SDK not loaded.');
        alert('Firebase SDK not loaded. Cannot run tournament solver.');
    }
});
