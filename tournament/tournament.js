/**
 * Tournament Solver Dashboard
 * Manages participant registration, real-time puzzle status, and standings.
 */

// Firestore Collection Constants
const SOLVERS_COLLECTION = 'solvers';
const PUZZLES_COLLECTION = 'puzzles';
const CONFIG_COLLECTION = 'tournament_config';
const SCORES_COLLECTION = 'scores';

document.addEventListener('DOMContentLoaded', () => {
    // Only proceed if Firebase SDK is present
    if (typeof firebase !== 'undefined') {
        try {
            const auth = firebase.auth();
            const db = firebase.firestore();

            // --- State Management ---
            let currentSolver = null;
            let puzzleListenerUnsubscribe = null;
            let activeView = 'setup'; // 'puzzles', 'leaderboard', 'result'
            
            const tournamentAppDiv = document.getElementById('tournament-app');

            // Default scoring rules (overridden by Firestore if present)
            let scoringRules = {
                pointsPerWord: 10,
                timeBonusPerSecond: 1,
                completionBonus: 180,
                overtimePenaltyPer4Seconds: 1,
                minCorrectPercentageForTimeBonus: 0.5
            };

            /**
             * Fetches global scoring rules from Firestore configuration.
             */
            async function fetchScoringRules() {
                try {
                    const doc = await db.collection(CONFIG_COLLECTION).doc('scoring').get();
                    if (doc.exists) {
                        scoringRules = { ...scoringRules, ...doc.data() };
                    }
                } catch (e) {
                    console.warn('Using default scoring rules.', e);
                }
            }

            /**
             * Entry Point: Checks for existing profile or triggers Setup UI.
             */
            async function initSolver() {
                await fetchScoringRules();
                let user = auth.currentUser;

                // Sign in anonymously for participants if no session exists
                if (!user) {
                    try {
                        const userCredential = await auth.signInAnonymously();
                        user = userCredential.user;
                    } catch (error) {
                        console.error('Auth failure:', error);
                        tournamentAppDiv.innerHTML = `<p class="error">Error signing in: ${error.message}</p>`;
                        return;
                    }
                }

                // Check if this user has already completed the setup
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

            /**
             * VIEW: Participant Setup (Name entry and Division selection)
             */
            async function renderSetupUI(user, existingData) {
                activeView = 'setup';
                
                // Fetch available divisions from config
                const configDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
                const availableDivisions = (configDoc.exists && configDoc.data().list) ? configDoc.data().list : ['Easier', 'Harder', 'Pairs'];
                
                tournamentAppDiv.innerHTML = `
                    <div class="setup-container">
                        <h2>Tournament Setup</h2>
                        <p>Welcome! Please provide a name and select your division to get started.</p>
                        <div id="setupError" class="error-message"></div>
                        <div class="form-group">
                            <label for="solverName">Leaderboard Name:</label>
                            <input type="text" id="solverName" placeholder="Enter your nickname" maxlength="30" value="${existingData?.name || ''}">
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

                let selectedDivision = existingData?.division || null;
                const errorDiv = document.getElementById('setupError');
                const nameInput = document.getElementById('solverName');

                // Handle card selection styling
                document.querySelectorAll('.division-card').forEach(card => {
                    card.addEventListener('click', () => {
                        document.querySelectorAll('.division-card').forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        selectedDivision = card.dataset.division;
                        errorDiv.style.display = 'none';
                    });
                });

                // Profile submission logic
                document.getElementById('completeSetupBtn').addEventListener('click', async () => {
                    const name = nameInput.value.trim();
                    if (!name || !selectedDivision) {
                        errorDiv.textContent = 'Please provide both a name and a division.';
                        errorDiv.style.display = 'block';
                        return;
                    }

                    const solverRef = db.collection(SOLVERS_COLLECTION).doc(user.uid);
                    const displayName = `${name} (#${user.uid.substring(0, 4)})`;

                    try {
                        await solverRef.set({
                            name, displayName, division: selectedDivision, uid: user.uid,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdAt: existingData?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        currentSolver = { uid: user.uid, name, displayName, division: selectedDivision };
                        renderPuzzleList();
                    } catch (e) {
                        errorDiv.textContent = 'Error saving profile. Please try again.';
                        errorDiv.style.display = 'block';
                    }
                });
            }

            /**
             * UTILITY: Logic for calculating final score based on accuracy and speed.
             */
            function calculateScore(xw, puzzleData, timeTakenSeconds) {
                let correctWordsCount, totalWords;
                
                // Handle different input formats (full engine object vs simple result map)
                if (xw.words && Array.isArray(xw.words)) {
                    totalWords = xw.words.length;
                    correctWordsCount = xw.words.filter(w => w.isCorrect()).length;
                } else if (xw.words) {
                    const words = Object.values(xw.words);
                    totalWords = words.length;
                    correctWordsCount = words.filter(w => w.isCorrect()).length;
                } else {
                    totalWords = 0; correctWordsCount = 0;
                }

                const isFullyCorrect = correctWordsCount === totalWords && totalWords > 0;
                const timeLimit = puzzleData.timeLimitSeconds || 0;

                // 1. Base Score (Accuracy)
                let score = correctWordsCount * scoringRules.pointsPerWord;

                // 2. Completion Bonus
                if (isFullyCorrect) score += scoringRules.completionBonus;

                // 3. Time Bonus / Penalty
                const correctPercentage = correctWordsCount / totalWords;
                let timeBonus = 0;
                let overtimePenalty = 0;

                if (timeTakenSeconds <= timeLimit) {
                    // Only award time bonus if accuracy threshold is met
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
                    totalScore: Math.max(0, score),
                    correctWords: correctWordsCount,
                    totalWords,
                    timeTaken: timeTakenSeconds,
                    timeLimit,
                    timeBonus,
                    overtimePenalty,
                    isFullyCorrect
                };
            }

            /**
             * Submits final score to Firestore.
             */
            async function submitPuzzle(puzzleData, scoreInfo) {
                if (!currentSolver) return;
                
                if (puzzleData.isWarmup) {
                    showSubmissionResult(scoreInfo, true);
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
                    showSubmissionResult(scoreInfo);
                } catch (e) {
                    console.error('Submission failed:', e);
                    alert('Error submitting score. Please check your internet connection.');
                }
            }

            /**
             * VIEW: Performance summary screen after puzzle completion.
             */
            function showSubmissionResult(scoreInfo, isWarmup = false) {
                activeView = 'result';
                tournamentAppDiv.innerHTML = `
                    <div class="submission-result">
                        <h2>${isWarmup ? 'Warm-up Complete!' : 'Puzzle Submitted!'}</h2>
                        ${isWarmup ? '<p>Practice complete! These scores are not recorded.</p>' : ''}
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

            /**
             * VIEW: Standings screen with live updates.
             */
            async function renderLeaderboard(selectedDivision = currentSolver.division) {
                activeView = 'leaderboard';
                
                if (puzzleListenerUnsubscribe) {
                    puzzleListenerUnsubscribe();
                    puzzleListenerUnsubscribe = null;
                }

                tournamentAppDiv.innerHTML = `
                    <div class="leaderboard-header">
                        <h2>Leaderboard</h2>
                        <div class="nav-actions">
                            <button id="backToPuzzlesFromLeaderboard">Back to Puzzles</button>
                            <select id="divisionFilter"></select>
                        </div>
                    </div>
                    <div id="leaderboard-content" style="overflow-x: auto;"><p>Loading standings...</p></div>
                `;

                document.getElementById('backToPuzzlesFromLeaderboard').onclick = () => {
                    if (puzzleListenerUnsubscribe) puzzleListenerUnsubscribe();
                    renderPuzzleList();
                };
                
                // Fetch puzzles first to determine the columns
                let tournamentPuzzles = [];
                try {
                    const puzzlesSnapshot = await db.collection(PUZZLES_COLLECTION)
                        .where('isWarmup', '==', false)
                        .orderBy('puzzleNumber', 'asc')
                        .get();
                    puzzlesSnapshot.forEach(doc => tournamentPuzzles.push({ id: doc.id, ...doc.data() }));

                    const configDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
                    const availableDivisions = (configDoc.exists && configDoc.data().list) ? configDoc.data().list : ['Easier', 'Harder', 'Pairs'];
                    const filter = document.getElementById('divisionFilter');
                    availableDivisions.forEach(div => {
                        const opt = document.createElement('option');
                        opt.value = div; opt.textContent = `${div} Division`;
                        opt.selected = (div === selectedDivision);
                        filter.appendChild(opt);
                    });
                    filter.onchange = (e) => renderLeaderboard(e.target.value);
                } catch (e) { console.error('Leaderboard init error:', e); }

                // LIVE LISTENER: Aggregate scores into a grid
                puzzleListenerUnsubscribe = db.collection(SCORES_COLLECTION)
                    .where('division', '==', selectedDivision)
                    .onSnapshot((scoresSnapshot) => {
                        if (activeView !== 'leaderboard') return;

                        const solverScores = {};
                        scoresSnapshot.forEach(doc => {
                            const data = doc.data();
                            if (!solverScores[data.uid]) {
                                solverScores[data.uid] = { 
                                    name: data.solverName, 
                                    totalScore: 0, 
                                    totalTime: 0, 
                                    puzzles: {} // Map of puzzleId -> { score, time }
                                };
                            }
                            solverScores[data.uid].totalScore += data.totalScore;
                            solverScores[data.uid].totalTime += data.timeTaken;
                            solverScores[data.uid].puzzles[data.puzzleId] = {
                                score: data.totalScore,
                                time: data.timeTaken
                            };
                        });

                        // Sort by total score (DESC) and tie-break with total time (ASC)
                        const leaderboardData = Object.values(solverScores).sort((a, b) => {
                            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                            return a.totalTime - b.totalTime;
                        });

                        const leaderboardContent = document.getElementById('leaderboard-content');
                        if (!leaderboardContent) return;

                        if (leaderboardData.length === 0) {
                            leaderboardContent.innerHTML = `<p>No submissions for the <strong>${selectedDivision}</strong> division yet.</p>`;
                            return;
                        }

                        // Generate Table with Dynamic Columns
                        let tableHtml = `
                            <table class="leaderboard-table">
                                <thead>
                                    <tr>
                                        <th class="rank">Rank</th>
                                        <th>Solver</th>
                                        ${tournamentPuzzles.map(p => `<th>P${p.puzzleNumber}</th>`).join('')}
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
                                    <td style="white-space: nowrap;">
                                        ${isMe ? `<strong>${entry.name} (You)</strong>` : entry.name}
                                    </td>
                                    ${tournamentPuzzles.map(p => {
                                        const pResult = entry.puzzles[p.id];
                                        if (pResult) {
                                            return `<td style="font-size: 0.85em; color: #666;">
                                                        <div style="font-weight: bold; color: #e67e22;">${pResult.score}</div>
                                                        <div>${Math.floor(pResult.time / 60)}m ${pResult.time % 60}s</div>
                                                    </td>`;
                                        } else {
                                            return `<td style="color: #ccc;">—</td>`;
                                        }
                                    }).join('')}
                                    <td class="score-cell">${entry.totalScore}</td>
                                    <td style="white-space: nowrap;">${Math.floor(entry.totalTime / 60)}m ${entry.totalTime % 60}s</td>
                                </tr>
                            `;
                        });

                        leaderboardContent.innerHTML = tableHtml + '</tbody></table>';
                    });
            }

            /**
             * POST-MESSAGE LISTENER: Listens for signals from the solve.html tab.
             */
            window.addEventListener('message', async (event) => {
                if (event.data && event.data.type === 'CROSSWORD_SOLVED') {
                    const { puzzleId, timeTakenSeconds, correctWords, totalWords } = event.data;
                    
                    // Fetch puzzle meta to perform final calculation
                    try {
                        const puzzleDoc = await db.collection(PUZZLES_COLLECTION).doc(puzzleId).get();
                        if (!puzzleDoc.exists) return;
                        
                        const puzzleData = { id: puzzleDoc.id, ...puzzleDoc.data() };
                        const scoreInfo = calculateScore({
                            words: Array(parseInt(correctWords)).fill({ isCorrect: () => true })
                                .concat(Array(Math.max(0, parseInt(totalWords) - parseInt(correctWords))).fill({ isCorrect: () => false }))
                        }, puzzleData, parseInt(timeTakenSeconds));

                        await submitPuzzle(puzzleData, scoreInfo);
                    } catch (e) {
                        console.error('External submission error:', e);
                    }
                }
            });

            /**
             * BOOTSTRAPPER: Opens the fullscreen solver.
             */
            async function loadPuzzle(puzzleData) {
                // Find correct file for solver division
                let puzzlePath = null;
                if (puzzleData.filesByDivision && currentSolver.division) {
                    puzzlePath = puzzleData.filesByDivision[currentSolver.division] || puzzleData.filesByDivision.default;
                }
                if (!puzzlePath) puzzlePath = puzzleData.filePath || puzzleData.fileName; 

                if (!puzzlePath) {
                    alert('Error: File not found for your division.');
                    return;
                }

                const solverUrl = new URL('solve.html', window.location.href);
                solverUrl.searchParams.set('puzzle', puzzlePath);
                
                // Config passed to solve.html
                const config = {
                    tournament_mode: true,
                    puzzle_id: puzzleData.id,
                    time_limit: puzzleData.timeLimitSeconds,
                    is_warmup: !!puzzleData.isWarmup
                };
                solverUrl.searchParams.set('config', btoa(JSON.stringify(config)));

                window.open(solverUrl.toString(), '_blank');
            }

            /**
             * VIEW: Main puzzle list with live status updates.
             */
            async function renderPuzzleList() {
                if (!currentSolver) return;
                activeView = 'puzzles';
                if (puzzleListenerUnsubscribe) { puzzleListenerUnsubscribe(); puzzleListenerUnsubscribe = null; }

                // Fetch Custom Tournament Name
                let tournamentName = 'Crossword Tournament Solver';
                try {
                    const metaDoc = await db.collection(CONFIG_COLLECTION).doc('metadata').get();
                    if (metaDoc.exists && metaDoc.data().tournamentName) {
                        tournamentName = metaDoc.data().tournamentName;
                        document.title = tournamentName;
                    }
                } catch (e) {}

                tournamentAppDiv.innerHTML = `
                    <h1>${tournamentName}</h1>
                    <div class="solver-info">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start">
                            <h2>Welcome, ${currentSolver.displayName}!</h2>
                            <div style="font-size:0.8em; color:#27ae60; font-weight:bold"><span class="status-dot"></span>Live Connection</div>
                        </div>
                        <div class="solver-meta">
                            <div>Division: <strong>${currentSolver.division}</strong> | Solver ID: <code>${currentSolver.uid.substring(0,8)}...</code></div>
                            <button id="viewLeaderboardBtn" class="secondary-btn">View Leaderboard</button>
                        </div>
                    </div>
                    <div id="warmup-puzzle-section" class="puzzle-section"></div>
                    <div id="tournament-puzzles-section" class="puzzle-section"></div>
                `;

                document.getElementById('viewLeaderboardBtn').addEventListener('click', () => renderLeaderboard());

                const warmUpSection = document.getElementById('warmup-puzzle-section');
                const tournamentSection = document.getElementById('tournament-puzzles-section');

                // LIVE LISTENER: Instantly update list when Admin unlocks/adds puzzles
                puzzleListenerUnsubscribe = db.collection(PUZZLES_COLLECTION)
                    .where('status', 'in', ['available', 'locked'])
                    .orderBy('puzzleNumber', 'asc')
                    .onSnapshot(async (querySnapshot) => {
                        if (activeView !== 'puzzles') return;

                        // Fetch my previous submissions to hide "Start" buttons
                        let submittedPuzzleIds = new Set();
                        try {
                            const scoresSnapshot = await db.collection(SCORES_COLLECTION).where('uid', '==', currentSolver.uid).get();
                            scoresSnapshot.forEach(doc => submittedPuzzleIds.add(doc.data().puzzleId));
                        } catch (e) {}

                        // Handle Warm-ups
                        const warmUps = [];
                        const tourneyPuzzles = [];
                        querySnapshot.forEach(doc => {
                            const p = { id: doc.id, ...doc.data() };
                            if (p.isWarmup) warmUps.push(p); else tourneyPuzzles.push(p);
                        });

                        // Render Warm-Up Section
                        if (warmUps.length > 0) {
                            warmUpSection.innerHTML = `<h3>Warm-up Puzzle${warmUps.length > 1 ? 's' : ''}</h3><ul class="puzzle-list"></ul>`;
                            const ul = warmUpSection.querySelector('ul');
                            warmUps.forEach(p => {
                                const isSubmitted = submittedPuzzleIds.has(p.id);
                                const isLocked = p.status === 'locked';
                                const li = document.createElement('li');
                                li.className = `${isSubmitted ? 'submitted' : ''} ${isLocked ? 'locked' : ''}`;
                                li.innerHTML = `
                                    <div class="puzzle-info">
                                        <span class="puz-name">${p.name}</span>
                                        <span class="puz-author">by ${p.author}</span>
                                        <span class="puz-time">(${p.timeLimitSeconds / 60} min)</span>
                                    </div>
                                    <div class="puzzle-status">
                                        ${isSubmitted ? '<span class="status-tag">Submitted</span>' : 
                                          isLocked ? '<span class="status-tag locked">Locked</span>' :
                                        `<button data-puzzle-id="${p.id}" class="start-puzzle-btn">Start Warm-up</button>`}
                                    </div>
                                `;
                                ul.appendChild(li);
                            });
                        } else warmUpSection.innerHTML = '';

                        // Render Tournament Section
                        if (tourneyPuzzles.length > 0) {
                            tournamentSection.innerHTML = `<h3>Tournament Puzzle${tourneyPuzzles.length > 1 ? 's' : ''}</h3><ul class="puzzle-list"></ul>`;
                            const ul = tournamentSection.querySelector('ul');
                            tourneyPuzzles.forEach(p => {
                                const isSubmitted = submittedPuzzleIds.has(p.id);
                                const isLocked = p.status === 'locked';
                                const li = document.createElement('li');
                                li.className = `${isSubmitted ? 'submitted' : ''} ${isLocked ? 'locked' : ''}`;
                                li.innerHTML = `
                                    <div class="puzzle-info">
                                        <span class="puz-num">#${p.puzzleNumber}</span>
                                        <span class="puz-name">${p.name}</span>
                                        <span class="puz-author">by ${p.author}</span>
                                        <span class="puz-time">(${p.timeLimitSeconds / 60} min)</span>
                                    </div>
                                    <div class="puzzle-status">
                                        ${isSubmitted ? '<span class="status-tag">Submitted</span>' : 
                                          isLocked ? '<span class="status-tag locked">Locked</span>' :
                                        `<button data-puzzle-id="${p.id}" class="start-puzzle-btn">Start Puzzle</button>`}
                                    </div>
                                `;
                                ul.appendChild(li);
                            });
                        } else tournamentSection.innerHTML = `<h3>Tournament Puzzles</h3><p>No puzzles available yet.</p>`;

                        // Event Delegation for Start Buttons
                        document.querySelectorAll('.start-puzzle-btn').forEach(btn => {
                            btn.onclick = async () => {
                                const pDoc = await db.collection(PUZZLES_COLLECTION).doc(btn.dataset.puzzleId).get();
                                if (pDoc.exists) loadPuzzle({ id: pDoc.id, ...pDoc.data() });
                            };
                        });
                    });
            }

            initSolver();

        } catch (e) {
            console.error('Firebase init error:', e);
        }
    }
});
