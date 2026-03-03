/**
 * Tournament Admin Dashboard
 * Handles puzzle management, scoring configuration, and live result monitoring.
 */

// Firestore Collection Constants
const SOLVERS_COLLECTION = 'solvers';
const PUZZLES_COLLECTION = 'puzzles';
const CONFIG_COLLECTION = 'tournament_config';
const SCORES_COLLECTION = 'scores';

/**
 * AUTHORIZATION: List of Google emails allowed to access the admin dashboard.
 * IMPORTANT: Add your authorized Google email(s) here.
 */
const ALLOWED_ADMINS = [
    'boisvert42@gmail.com' // Replace with your actual email(s)
];

let db;
let auth;
let currentTab = 'puzzles';

// UI Element References
const adminContent = document.getElementById('admin-content');
const loginDiv = document.getElementById('admin-login');
const appDiv = document.getElementById('admin-app');

/**
 * Initialization: Connects to Firebase and sets up the Auth listener.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        db = firebase.firestore();
        auth = firebase.auth();

        // Listen for authentication state changes
        auth.onAuthStateChanged(user => {
            if (user && !user.isAnonymous && ALLOWED_ADMINS.includes(user.email)) {
                // User is signed in with an authorized Google account
                loginDiv.style.display = 'none';
                appDiv.style.display = 'block';
                initTabs();
                loadTab(currentTab);
            } else {
                // User is not signed in or not authorized
                if (user && !ALLOWED_ADMINS.includes(user.email)) {
                    showLoginError(`Account ${user.email} is not authorized for Admin access.`);
                    auth.signOut(); // Sign out unauthorized users immediately
                }
                appDiv.style.display = 'none';
                loginDiv.style.display = 'block';
                initLoginForm();
            }
        });
    } else {
        adminContent.innerHTML = '<p class="error">Firebase SDK not loaded. Check your configuration.</p>';
    }
});

/**
 * Sets up the Google Sign-In logic.
 */
function initLoginForm() {
    const btn = document.getElementById('googleSignInBtn');

    btn.onclick = async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
        } catch (error) {
            showLoginError(error.message);
        }
    };
}

function showLoginError(msg) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

/**
 * Initializes navigation tab click handlers.
 */
function initTabs() {
    // Prevent multiple event attachments
    const oldBtns = document.querySelectorAll('.tab-btn');
    oldBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            loadTab(currentTab);
        });
    });
}

/**
 * Routes the UI rendering based on the active tab.
 */
async function loadTab(tab) {
    adminContent.innerHTML = '<div class="loading">Loading section...</div>';
    switch (tab) {
        case 'puzzles':
            renderPuzzlesTab();
            break;
        case 'divisions':
            renderDivisionsTab();
            break;
        case 'settings':
            renderSettingsTab();
            break;
        case 'results':
            renderResultsTab();
            break;
    }
}

/* ==========================================
   PUZZLES TAB: Manage individual puzzle meta
   ========================================== */

async function renderPuzzlesTab() {
    try {
        const querySnapshot = await db.collection(PUZZLES_COLLECTION).orderBy('puzzleNumber', 'asc').get();
        const puzzles = [];
        querySnapshot.forEach(doc => puzzles.push({ id: doc.id, ...doc.data() }));

        let html = `
            <div class="admin-section-header">
                <h2>Manage Puzzles</h2>
                <button id="addPuzzleBtn" class="primary-btn">Add New Puzzle</button>
            </div>
            <div class="admin-list">
        `;

        if (puzzles.length === 0) {
            html += '<div class="empty-state">No puzzles found. Click "Add New Puzzle" to create one.</div>';
        } else {
            puzzles.forEach(puzzle => {
                html += `
                    <div class="list-item">
                        <div class="list-item-info">
                            <h4>#${puzzle.puzzleNumber}: ${puzzle.name} ${puzzle.isWarmup ? '<span class="warmup-tag">(Warm-up)</span>' : ''}</h4>
                            <p>Author: ${puzzle.author} | Status: <strong>${puzzle.status}</strong></p>
                        </div>
                        <div class="list-item-actions">
                            <button class="secondary-btn btn-sm edit-puzzle-btn" data-id="${puzzle.id}">Edit</button>
                            <button class="secondary-btn btn-sm btn-danger delete-puzzle-btn" data-id="${puzzle.id}">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
        html += '</div>';
        adminContent.innerHTML = html;

        document.getElementById('addPuzzleBtn').onclick = () => renderPuzzleForm();
        document.querySelectorAll('.edit-puzzle-btn').forEach(btn => {
            btn.onclick = () => {
                const puzzle = puzzles.find(p => p.id === btn.dataset.id);
                renderPuzzleForm(puzzle);
            };
        });
        document.querySelectorAll('.delete-puzzle-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Are you sure you want to delete this puzzle? This cannot be undone.')) {
                    await db.collection(PUZZLES_COLLECTION).doc(btn.dataset.id).delete();
                    renderPuzzlesTab();
                }
            };
        });

    } catch (e) {
        adminContent.innerHTML = `<p class="error">Error loading puzzles: ${e.message}</p>`;
    }
}

async function renderPuzzleForm(puzzle = null) {
    const isEdit = !!puzzle;
    let divisions = ['default'];
    try {
        const divDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
        if (divDoc.exists) divisions = [...divDoc.data().list, 'default'];
    } catch (e) {}

    let html = `
        <div class="admin-card">
            <h3>${isEdit ? 'Edit' : 'Add'} Puzzle</h3>
            <form id="puzzleForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Puzzle Name</label>
                        <input type="text" name="name" value="${puzzle?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Author</label>
                        <input type="text" name="author" value="${puzzle?.author || ''}" required>
                    </div>
                </div>
                <div class="form-row" style="margin-top:15px">
                    <div class="form-group">
                        <label>Puzzle Number</label>
                        <input type="number" name="puzzleNumber" value="${puzzle?.puzzleNumber || 0}" required>
                    </div>
                    <div class="form-group">
                        <label>Time Limit (Seconds)</label>
                        <input type="number" name="timeLimitSeconds" value="${puzzle?.timeLimitSeconds || 900}" required>
                    </div>
                </div>
                <div class="form-row" style="margin-top:15px">
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="available" ${puzzle?.status === 'available' ? 'selected' : ''}>Available (Live)</option>
                            <option value="locked" ${puzzle?.status === 'locked' ? 'selected' : ''}>Locked (Visible but not playable)</option>
                            <option value="hidden" ${puzzle?.status === 'hidden' ? 'selected' : ''}>Hidden (Invisible)</option>
                        </select>
                    </div>
                    <div class="form-group" style="display:flex; align-items:center; padding-top:20px; gap:10px;">
                        <input type="checkbox" name="isWarmup" id="isWarmup" ${puzzle?.isWarmup ? 'checked' : ''}>
                        <label for="isWarmup">Mark as Warm-up</label>
                    </div>
                </div>

                <div class="form-group" style="margin-top:15px">
                    <label>Puzzle File Path</label>
                    <p style="font-size:0.8em; color:#666; margin-bottom:10px">Place files in <code>tournament/puzzles/</code> and reference them here.</p>
                    <div class="division-mapping">
                        ${divisions.map(div => `
                            <div class="mapping-row">
                                <label>${div}:</label>
                                <input type="text" id="input_${div}" name="file_${div}" value="${puzzle?.filesByDivision?.[div] || (div === 'default' ? (puzzle?.filePath || puzzle?.fileName || '') : '')}" placeholder="./puzzles/filename.ipuz">
                                <button type="button" class="secondary-btn btn-sm check-path-btn" data-input="input_${div}">Check</button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="action-row">
                    <button type="button" id="cancelPuzzleBtn" class="secondary-btn">Cancel</button>
                    <button type="submit" class="primary-btn">${isEdit ? 'Update' : 'Create'} Puzzle</button>
                </div>
            </form>
        </div>
    `;

    adminContent.innerHTML = html;

    // Validation buttons logic
    document.querySelectorAll('.check-path-btn').forEach(btn => {
        btn.onclick = async () => {
            const path = document.getElementById(btn.dataset.input).value.trim();
            if (!path) return;
            btn.textContent = '...';
            btn.classList.remove('path-valid', 'path-invalid');
            try {
                const response = await fetch(path, { method: 'HEAD' });
                if (response.ok) { btn.textContent = 'Found!'; btn.classList.add('path-valid'); }
                else { btn.textContent = 'Missing'; btn.classList.add('path-invalid'); }
            } catch (err) { btn.textContent = 'Error'; btn.classList.add('path-invalid'); }
        };
    });

    document.getElementById('cancelPuzzleBtn').onclick = () => renderPuzzlesTab();
    document.getElementById('puzzleForm').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const filesByDivision = {};
        divisions.forEach(div => {
            const val = formData.get(`file_${div}`);
            if (val) filesByDivision[div] = val;
        });

        const puzzleData = {
            name: formData.get('name'),
            author: formData.get('author'),
            puzzleNumber: parseInt(formData.get('puzzleNumber')),
            timeLimitSeconds: parseInt(formData.get('timeLimitSeconds')),
            status: formData.get('status'),
            isWarmup: formData.get('isWarmup') === 'on',
            filesByDivision: filesByDivision,
            filePath: filesByDivision.default || Object.values(filesByDivision)[0] || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (isEdit) await db.collection(PUZZLES_COLLECTION).doc(puzzle.id).update(puzzleData);
            else await db.collection(PUZZLES_COLLECTION).add({ ...puzzleData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            renderPuzzlesTab();
        } catch (err) { alert('Error: ' + err.message); }
    };
}

/* ==========================================
   DIVISIONS TAB: Define tournament categories
   ========================================== */

async function renderDivisionsTab() {
    try {
        const doc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
        let list = doc.exists ? doc.data().list : ['Easier', 'Harder', 'Pairs'];

        let html = `
            <div class="admin-card">
                <h3>Manage Divisions</h3>
                <div id="divisionList" class="admin-list" style="box-shadow:none; border:1px solid #eee">
                    ${list.map(div => `<div class="list-item"><span>${div}</span><button class="secondary-btn btn-sm btn-danger remove-div-btn" data-name="${div}">Remove</button></div>`).join('')}
                </div>
                <div class="form-group" style="margin-top:20px; display:flex; gap:10px;"><input type="text" id="newDivisionName" placeholder="New division name"><button id="addDivisionBtn" class="primary-btn">Add Division</button></div>
                <div class="action-row"><button id="saveDivisionsBtn" class="primary-btn btn-success">Save Changes</button></div>
            </div>
        `;
        adminContent.innerHTML = html;

        document.getElementById('addDivisionBtn').onclick = () => {
            const name = document.getElementById('newDivisionName').value.trim();
            if (name && !list.includes(name)) { list.push(name); renderDivisionsTab(); }
        };

        document.querySelectorAll('.remove-div-btn').forEach(btn => {
            btn.onclick = () => { list = list.filter(d => d !== btn.dataset.name); renderDivisionsTab(); };
        });

        document.getElementById('saveDivisionsBtn').onclick = async () => {
            await db.collection(CONFIG_COLLECTION).doc('divisions').set({ list });
            alert('Divisions saved!');
        };
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}

/* ==========================================
   SETTINGS TAB: Meta-data and Scoring Rules
   ========================================== */

async function renderSettingsTab() {
    try {
        const metaDoc = await db.collection(CONFIG_COLLECTION).doc('metadata').get();
        const metadata = metaDoc.exists ? metaDoc.data() : { tournamentName: 'Crossword Tournament Solver' };
        const scoreDoc = await db.collection(CONFIG_COLLECTION).doc('scoring').get();
        const rules = scoreDoc.exists ? scoreDoc.data() : { pointsPerWord: 10, timeBonusPerSecond: 1, completionBonus: 180, overtimePenaltyPer4Seconds: 1, minCorrectPercentageForTimeBonus: 0.5 };

        let html = `
            <div class="admin-card">
                <h3>Tournament Metadata</h3>
                <form id="metadataForm"><div class="form-group"><label>Tournament Name</label><input type="text" name="tournamentName" value="${metadata.tournamentName}"></div><div class="action-row"><button type="submit" class="primary-btn btn-success">Save Metadata</button></div></form>
            </div>
            <div class="admin-card">
                <h3>Scoring Rules</h3>
                <form id="scoringForm">
                    <div class="form-row"><div class="form-group"><label>Points Per Word</label><input type="number" name="pointsPerWord" value="${rules.pointsPerWord}"></div><div class="form-group"><label>Completion Bonus</label><input type="number" name="completionBonus" value="${rules.completionBonus}"></div></div>
                    <div class="form-row" style="margin-top:15px"><div class="form-group"><label>Time Bonus (pts/sec)</label><input type="number" name="timeBonusPerSecond" value="${rules.timeBonusPerSecond}"></div><div class="form-group"><label>Overtime Penalty</label><input type="number" name="overtimePenaltyPer4Seconds" value="${rules.overtimePenaltyPer4Seconds}"></div></div>
                    <div class="form-group" style="margin-top:15px"><label>Min Accuracy for Time Bonus</label><input type="number" step="0.1" name="minCorrectPercentageForTimeBonus" value="${rules.minCorrectPercentageForTimeBonus}"></div>
                    <div class="action-row"><button type="submit" class="primary-btn btn-success">Save Scoring Rules</button></div>
                </form>
            </div>
        `;
        adminContent.innerHTML = html;

        document.getElementById('metadataForm').onsubmit = async (e) => {
            e.preventDefault();
            await db.collection(CONFIG_COLLECTION).doc('metadata').set({ tournamentName: new FormData(e.target).get('tournamentName') });
            alert('Metadata updated!');
        };

        document.getElementById('scoringForm').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await db.collection(CONFIG_COLLECTION).doc('scoring').set({
                pointsPerWord: parseInt(fd.get('pointsPerWord')), completionBonus: parseInt(fd.get('completionBonus')),
                timeBonusPerSecond: parseInt(fd.get('timeBonusPerSecond')), overtimePenaltyPer4Seconds: parseInt(fd.get('overtimePenaltyPer4Seconds')),
                minCorrectPercentageForTimeBonus: parseFloat(fd.get('minCorrectPercentageForTimeBonus'))
            });
            alert('Scoring rules updated!');
        };
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}

/* ==========================================
   RESULTS TAB: Monitoring and Export
   ========================================== */

async function renderResultsTab() {
    try {
        const querySnapshot = await db.collection(SCORES_COLLECTION).orderBy('submittedAt', 'desc').limit(100).get();
        let html = `<div class="admin-section-header"><h2>Recent Results</h2><button id="exportResultsBtn" class="secondary-btn btn-sm">Export CSV</button></div><div class="admin-card" style="padding:0"><table class="results-table"><thead><tr><th>Solver</th><th>Division</th><th>Puzzle</th><th>Score</th><th>Correct</th><th>Time</th></tr></thead><tbody>`;
        const results = [];
        querySnapshot.forEach(doc => {
            const data = doc.data(); results.push(data);
            html += `<tr><td><strong>${data.solverName}</strong><br><small>${data.submittedAt?.toDate().toLocaleString() || 'N/A'}</small></td><td>${data.division}</td><td>#${data.puzzleNumber}: ${data.puzzleName}</td><td><strong class="score-cell">${data.totalScore}</strong></td><td>${data.correctWords}/${data.totalWords}</td><td>${Math.floor(data.timeTaken/60)}m ${data.timeTaken%60}s</td></tr>`;
        });
        if (results.length === 0) html += '<tr><td colspan="6" class="empty-state">No results yet.</td></tr>';
        adminContent.innerHTML = html + '</tbody></table></div>';

        document.getElementById('exportResultsBtn').onclick = () => {
            const headers = ['Solver', 'Division', 'Puzzle ID', 'Puzzle Name', 'Score', 'Correct Words', 'Total Words', 'Time Taken', 'Submitted At'];
            const csv = [headers.join(','), ...results.map(r => [`"${r.solverName}"`,`"${r.division}"`,`"${r.puzzleId}"`,`"${r.puzzleName}"`,r.totalScore,r.correctWords,r.totalWords,r.timeTaken,r.submittedAt?.toDate().toISOString()||''].join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'tournament_results.csv'; a.click();
        };
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}
