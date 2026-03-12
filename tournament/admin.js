/**
 * Tournament Admin Dashboard
 * Handles puzzle management, participant authorization (CSV), scoring, and results.
 */

// Firestore Collection Constants
const SOLVERS_COLLECTION = 'solvers';
const PUZZLES_COLLECTION = 'puzzles';
const CONFIG_COLLECTION = 'tournament_config';
const SCORES_COLLECTION = 'scores';
const ADMINS_COLLECTION = 'admins';
const PARTICIPANTS_COLLECTION = 'participants'; // Authorized solvers from CSV

let db;
let auth;
let currentTab = 'puzzles';

const adminContent = document.getElementById('admin-content');
const loginDiv = document.getElementById('admin-login');
const appDiv = document.getElementById('admin-app');

/**
 * Initialization: Connects to Firebase and sets up the Admin authorization listener.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        db = firebase.firestore();
        auth = firebase.auth();
        
        auth.onAuthStateChanged(async (user) => {
            if (user && !user.isAnonymous) {
                try {
                    // Check if this Google user is in the 'admins' collection
                    const adminDoc = await db.collection(ADMINS_COLLECTION).doc(user.email.toLowerCase()).get();
                    if (adminDoc.exists) {
                        loginDiv.style.display = 'none';
                        appDiv.style.display = 'block';
                        initTabs();
                        loadTab(currentTab);
                    } else {
                        showLoginError(`Account ${user.email} is not authorized for Admin access.`);
                        await auth.signOut();
                    }
                } catch (e) {
                    showLoginError("Error checking authorization. Ensure your Security Rules are applied.");
                    await auth.signOut();
                }
            } else {
                appDiv.style.display = 'none';
                loginDiv.style.display = 'block';
                initLoginForm();
            }
        });
    } else {
        adminContent.innerHTML = '<p class="error">Firebase SDK not loaded.</p>';
    }
});

function initLoginForm() {
    const btn = document.getElementById('googleSignInBtn');
    btn.onclick = async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try { await auth.signInWithPopup(provider); } catch (e) { showLoginError(e.message); }
    };
}

function showLoginError(msg) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = msg; errorDiv.style.display = 'block';
}

function initTabs() {
    const nav = document.querySelector('.admin-nav');
    const newNav = nav.cloneNode(true);
    nav.parentNode.replaceChild(newNav, nav);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            loadTab(currentTab);
        });
    });

    const signOutBtn = document.getElementById('adminSignOutBtn');
    if (signOutBtn) {
        signOutBtn.onclick = async () => {
            if (confirm('Sign out of admin dashboard?')) await auth.signOut();
        };
    }
}

async function loadTab(tab) {
    adminContent.innerHTML = '<div class="loading">Loading section...</div>';
    switch (tab) {
        case 'puzzles': renderPuzzlesTab(); break;
        case 'leaderboard': renderLeaderboardTab(); break;
        case 'participants': renderParticipantsTab(); break;
        case 'divisions': renderDivisionsTab(); break;
        case 'settings': renderSettingsTab(); break;
        case 'results': renderResultsTab(); break;
    }
}

/* ==========================================
   LEADERBOARD TAB: Shared Live View
   ========================================== */

let leaderboardUnsubscribe = null;

async function renderLeaderboardTab(selectedDivision = null) {
    if (leaderboardUnsubscribe) { leaderboardUnsubscribe(); leaderboardUnsubscribe = null; }

    try {
        // Fetch Puzzles first for column headers
        const pSnap = await db.collection(PUZZLES_COLLECTION).where('isWarmup', '==', false).orderBy('puzzleNumber', 'asc').get();
        const tournamentPuzzles = []; pSnap.forEach(doc => tournamentPuzzles.push({ id: doc.id, ...doc.data() }));

        // Fetch Divisions for filter
        const divDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
        const divisions = divDoc.exists ? divDoc.data().list : ['Easier', 'Harder', 'Pairs'];
        if (!selectedDivision) selectedDivision = divisions[0];

        adminContent.innerHTML = `
            <div class="leaderboard-header">
                <h2>Live Leaderboard</h2>
                <select id="adminLeaderboardFilter"></select>
            </div>
            <div id="admin-leaderboard-container" style="overflow-x:auto;"></div>
        `;

        const filter = document.getElementById('adminLeaderboardFilter');
        divisions.forEach(d => {
            const opt = document.createElement('option'); opt.value = d; opt.textContent = d + ' Division';
            opt.selected = (d === selectedDivision); filter.appendChild(opt);
        });
        filter.onchange = (e) => renderLeaderboardTab(e.target.value);

        const container = document.getElementById('admin-leaderboard-container');
        
        // Use the shared TournamentLeaderboard component
        leaderboardUnsubscribe = await TournamentLeaderboard.render(
            container, 
            db, 
            selectedDivision, 
            tournamentPuzzles,
            null, // No "You" highlighting in admin view
            (uid, pid, pData) => openScoreEditModal(uid, pid, pData) // Handle cell clicks
        );

    } catch (e) { 
        adminContent.innerHTML = `<div class="error-message" style="display:block; text-align:left;">${TournamentLeaderboard.formatError(e)}</div>`; 
    }
}

/**
 * Opens a modal to override or delete a specific score entry.
 */
function openScoreEditModal(uid, pid, pData) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    
    const minutes = Math.floor(pData.time / 60);
    const seconds = pData.time % 60;

    modalOverlay.innerHTML = `
        <div class="edit-score-modal">
            <h3>Override Score</h3>
            <p style="font-size:0.9em; margin-bottom:20px;">
                <strong>Puzzle:</strong> ${pData.puzzleName}<br>
                <strong>Original Correct:</strong> ${pData.correctWords} / ${pData.totalWords}
            </p>
            
            <form id="scoreEditForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Total Score</label>
                        <input type="number" id="editTotalScore" value="${pData.score}" required>
                    </div>
                </div>
                <div class="form-row" style="margin-top:10px">
                    <div class="form-group">
                        <label>Time (Minutes)</label>
                        <input type="number" id="editTimeMin" value="${minutes}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Time (Seconds)</label>
                        <input type="number" id="editTimeSec" value="${seconds}" min="0" max="59">
                    </div>
                </div>

                <div style="margin-top:20px; padding:10px; background:#fdf2f2; border-radius:6px; border:1px solid #f8d7da;">
                    <label style="display:flex; align-items:flex-start; gap:10px; font-size:0.85em; cursor:pointer;">
                        <input type="checkbox" id="confirmOverride" style="margin-top:3px;">
                        <span>I confirm that I want to manually override this participant's official score.</span>
                    </label>
                </div>

                <div class="modal-footer">
                    <button type="button" id="deleteScoreBtn" class="secondary-btn btn-danger" style="margin-right:auto">Delete Entry</button>
                    <button type="button" id="cancelEditBtn" class="secondary-btn">Cancel</button>
                    <button type="submit" class="primary-btn">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const close = () => document.body.removeChild(modalOverlay);
    document.getElementById('cancelEditBtn').onclick = close;

    // Handle Deletion
    document.getElementById('deleteScoreBtn').onclick = async () => {
        if (confirm('Permanently delete this score entry? This cannot be undone.')) {
            try {
                await db.collection(SCORES_COLLECTION).doc(`${uid}_${pid}`).delete();
                close();
            } catch (e) { Toast.error('Delete failed: ' + e.message); }
        }
    };

    // Handle Save
    document.getElementById('scoreEditForm').onsubmit = async (e) => {
        e.preventDefault();
        
        if (!document.getElementById('confirmOverride').checked) {
            Toast.error('Please check the confirmation box to apply changes.');
            return;
        }

        const newScore = parseInt(document.getElementById('editTotalScore').value);
        const newMin = parseInt(document.getElementById('editTimeMin').value) || 0;
        const newSec = parseInt(document.getElementById('editTimeSec').value) || 0;
        const newTotalSeconds = (newMin * 60) + newSec;

        try {
            await db.collection(SCORES_COLLECTION).doc(`${uid}_${pid}`).update({
                totalScore: newScore,
                timeTaken: newTotalSeconds,
                isManuallyOverridden: true,
                overriddenAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            Toast.success('Score updated!');
            close();
        } catch (err) {
            Toast.error('Update failed: ' + err.message);
        }
    };
}

/* ==========================================
   PARTICIPANTS TAB: Manage authorized solvers
   ========================================== */

async function renderParticipantsTab() {
    try {
        const querySnapshot = await db.collection(PARTICIPANTS_COLLECTION).orderBy('email', 'asc').limit(250).get();
        const participants = [];
        querySnapshot.forEach(doc => participants.push({ id: doc.id, ...doc.data() }));

        const divDoc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
        const divisions = divDoc.exists ? divDoc.data().list : ['Easier', 'Harder', 'Pairs'];

        let html = `
            <div class="admin-card">
                <h3>Authorize Participants (CSV)</h3>
                <p>Upload a CSV file with columns: <code>email, division</code></p>
                <div class="form-group">
                    <input type="file" id="csvFileInput" accept=".csv" style="margin-bottom:10px">
                    <button id="uploadCsvBtn" class="primary-btn">Process CSV & Authorize</button>
                </div>
                <div id="uploadStatus" style="font-size:0.9em; margin-top:10px"></div>
            </div>

            <div class="admin-section-header">
                <h2>Authorized Participants (${participants.length})</h2>
            </div>
            <div class="admin-card" style="padding:0">
                <table class="results-table">
                    <thead><tr><th>Email</th><th>Division</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
        `;

        if (participants.length === 0) {
            html += '<tr><td colspan="4" class="empty-state">No participants authorized.</td></tr>';
        } else {
            participants.forEach(p => {
                const isLinked = !!p.uid;
                html += `
                    <tr>
                        <td><strong>${p.email}</strong></td>
                        <td>
                            <select class="change-division-select" data-email="${p.email}">
                                ${divisions.map(d => `<option value="${d}" ${p.division === d ? 'selected' : ''}>${d}</option>`).join('')}
                            </select>
                        </td>
                        <td>
                            <span class="status-tag" style="background-color:${isLinked ? '#2ecc71' : '#95a5a6'}">
                                ${isLinked ? 'Linked (' + (p.name || 'No Name') + ')' : 'Pending Login'}
                            </span>
                        </td>
                        <td><button class="secondary-btn btn-sm btn-danger delete-participant-btn" data-email="${p.email}">Remove</button></td>
                    </tr>
                `;
            });
        }
        adminContent.innerHTML = html + '</tbody></table></div>';

        document.getElementById('uploadCsvBtn').onclick = () => {
            const fileInput = document.getElementById('csvFileInput');
            const statusDiv = document.getElementById('uploadStatus');
            if (!fileInput.files.length) return Toast.error('Select a CSV file.');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const rows = e.target.result.split('\n').map(r => r.split(',').map(c => c.trim()));
                const batch = db.batch();
                let count = 0;
                let skippedEmails = 0;
                let invalidDivisions = [];
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                for (let i = 0; i < rows.length; i++) {
                    let [email, div] = rows[i];
                    if (!email) continue;

                    // 1. Validate Email
                    if (!emailRegex.test(email)) {
                        if (!email.toLowerCase().includes('email')) skippedEmails++;
                        continue;
                    }

                    // 2. Validate Division
                    // Find a case-insensitive match in our official divisions list
                    const officialDiv = divisions.find(d => d.toLowerCase() === (div || '').toLowerCase());
                    
                    if (officialDiv) {
                        const ref = db.collection(PARTICIPANTS_COLLECTION).doc(email.toLowerCase());
                        batch.set(ref, { 
                            email: email.toLowerCase(), 
                            division: officialDiv,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        count++;
                    } else {
                        invalidDivisions.push(`Row ${i+1}: "${div}" is not a valid division for ${email}`);
                    }
                }
                
                if (count > 0 || invalidDivisions.length > 0) {
                    let statusHtml = '';
                    if (count > 0) {
                        await batch.commit();
                        statusHtml += `<div style="color:#27ae60; font-weight:bold;">Authorized ${count} users successfully.</div>`;
                    }
                    if (skippedEmails > 0) {
                        statusHtml += `<div style="color:#7f8c8d;">Skipped ${skippedEmails} non-email rows (headers/empty).</div>`;
                    }
                    if (invalidDivisions.length > 0) {
                        statusHtml += `<div style="color:#e74c3c; margin-top:10px;"><strong>Errors (${invalidDivisions.length}):</strong><br>` + 
                                      `<ul style="max-height:100px; overflow-y:auto; margin:5px 0; padding-left:20px;">` + 
                                      invalidDivisions.map(err => `<li>${err}</li>`).join('') + 
                                      `</ul></div>`;
                    }
                    statusDiv.innerHTML = statusHtml;
                    if (count > 0) setTimeout(renderParticipantsTab, 5000); // Wait longer if there are errors to read
                } else {
                    statusDiv.innerHTML = `<span style="color:#e74c3c">No valid data found in file.</span>`;
                }
            };
            reader.readAsText(fileInput.files[0]);
        };

        document.querySelectorAll('.change-division-select').forEach(sel => {
            sel.onchange = async (e) => {
                const email = e.target.dataset.email;
                const newDiv = e.target.value;
                await db.collection(PARTICIPANTS_COLLECTION).doc(email).update({ division: newDiv });
                const solverSnap = await db.collection(SOLVERS_COLLECTION).where('email', '==', email).get();
                if (!solverSnap.empty) {
                    const b = db.batch();
                    solverSnap.forEach(d => b.update(d.ref, { division: newDiv }));
                    await b.commit();
                }
            };
        });

        document.querySelectorAll('.delete-participant-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Remove ' + btn.dataset.email + '?')) {
                    await db.collection(PARTICIPANTS_COLLECTION).doc(btn.dataset.email).delete();
                    renderParticipantsTab();
                }
            };
        });
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}

/* ==========================================
   PUZZLES TAB: Manage individual puzzle meta
   ========================================== */

async function renderPuzzlesTab() {
    try {
        adminContent.innerHTML = `
            <div id="index-check-status"></div>
            <div class="admin-section-header">
                <h2>Manage Puzzles</h2>
                <button id="addPuzzleBtn" class="primary-btn">Add New Puzzle</button>
            </div>
            <div id="puzzles-list-container"></div>
        `;

        const indexCheckContainer = document.getElementById('index-check-status');
        const listContainer = document.getElementById('puzzles-list-container');

        // PROACTIVE INDEX CHECK: Run queries that require composite indices to surface any missing links
        const checkQueries = [
            db.collection(PUZZLES_COLLECTION).where('status', 'in', ['available', 'locked']).orderBy('puzzleNumber', 'asc').limit(1).get(),
            db.collection(PUZZLES_COLLECTION).where('isWarmup', '==', false).orderBy('puzzleNumber', 'asc').limit(1).get()
        ];

        Promise.all(checkQueries).catch(err => {
            if (err.message && err.message.includes('index')) {
                indexCheckContainer.innerHTML = `<div class="admin-card" style="border: 2px solid #e74c3c;">
                    <h3 style="color:#e74c3c; border-bottom-color:#e74c3c;">Database Index Missing</h3>
                    ${TournamentLeaderboard.formatError(err)}
                </div>`;
            }
        });

        const querySnapshot = await db.collection(PUZZLES_COLLECTION).orderBy('puzzleNumber', 'asc').get();
        const puzzles = [];
        querySnapshot.forEach(doc => puzzles.push({ id: doc.id, ...doc.data() }));

        let listHtml = `<div class="admin-list">`;

        if (puzzles.length === 0) {
            listHtml += '<div class="empty-state">No puzzles found.</div>';
        } else {
            puzzles.forEach(puzzle => {
                listHtml += `
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
        listContainer.innerHTML = listHtml + '</div>';

        document.getElementById('addPuzzleBtn').onclick = () => renderPuzzleForm();
        document.querySelectorAll('.edit-puzzle-btn').forEach(btn => {
            btn.onclick = () => {
                const p = puzzles.find(p => p.id === btn.dataset.id);
                renderPuzzleForm(p);
            };
        });
        document.querySelectorAll('.delete-puzzle-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Delete this puzzle?')) {
                    await db.collection(PUZZLES_COLLECTION).doc(btn.dataset.id).delete();
                    renderPuzzlesTab();
                }
            };
        });
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
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
                    <div class="form-group"><label>Puzzle Name</label><input type="text" name="name" value="${puzzle?.name || ''}" required></div>
                    <div class="form-group"><label>Author</label><input type="text" name="author" value="${puzzle?.author || ''}" required></div>
                </div>
                <div class="form-row" style="margin-top:15px">
                    <div class="form-group"><label>Puzzle Number</label><input type="number" name="puzzleNumber" value="${puzzle?.puzzleNumber || 0}" required></div>
                    <div class="form-group"><label>Time Limit (s)</label><input type="number" name="timeLimitSeconds" value="${puzzle?.timeLimitSeconds || 900}" required></div>
                </div>
                <div class="form-row" style="margin-top:15px">
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="available" ${puzzle?.status === 'available' ? 'selected' : ''}>Available</option>
                            <option value="locked" ${puzzle?.status === 'locked' ? 'selected' : ''}>Locked</option>
                            <option value="hidden" ${puzzle?.status === 'hidden' ? 'selected' : ''}>Hidden</option>
                        </select>
                    </div>
                    <div class="form-group" style="display:flex; align-items:center; padding-top:20px; gap:10px;">
                        <input type="checkbox" name="isWarmup" id="isWarmup" ${puzzle?.isWarmup ? 'checked' : ''}>
                        <label for="isWarmup">Warm-up</label>
                    </div>
                </div>
                <div class="form-group" style="margin-top:15px">
                    <label>Puzzle Filenames</label>
                    <div class="mapping-help">
                        Enter only the <strong>filename</strong> (e.g., <code>puzzle1.ipuz</code>).
                        Make sure the file is uploaded to the <code>tournament/puzzles/</code> folder.
                        The <strong>default</strong> filename is used for all divisions unless overridden.
                    </div>
                    <div class="division-mapping">
                        ${divisions.map(div => `
                            <div class="mapping-row ${div === 'default' ? 'default-row' : ''}">
                                <label>${div}:</label>
                                <input type="text" id="input_${div}" name="file_${div}" value="${puzzle?.filesByDivision?.[div] || (div === 'default' ? (puzzle?.filePath || puzzle?.fileName || '') : '')}" placeholder="filename.ipuz">
                                <button type="button" class="secondary-btn btn-sm check-path-btn" data-input="input_${div}">Check</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="action-row"><button type="button" id="cancelPuzzleBtn" class="secondary-btn">Cancel</button><button type="submit" class="primary-btn">${isEdit ? 'Update' : 'Create'}</button></div>
            </form>
        </div>
    `;
    adminContent.innerHTML = html;

    document.querySelectorAll('.check-path-btn').forEach(btn => {
        btn.onclick = async () => {
            let filename = document.getElementById(btn.dataset.input).value.trim();
            if (!filename) return;
            
            // Automatically prepend directory if not already present
            let path = filename;
            if (!path.startsWith('./') && !path.startsWith('../')) {
                path = './puzzles/' + filename;
            }

            btn.textContent = '...';
            try {
                const res = await fetch(path, { method: 'HEAD' });
                if (res.ok) { btn.textContent = 'Found!'; btn.className = 'secondary-btn btn-sm check-path-btn path-valid'; }
                else { btn.textContent = 'Missing'; btn.className = 'secondary-btn btn-sm check-path-btn path-invalid'; }
            } catch (e) { btn.textContent = 'Error'; btn.className = 'secondary-btn btn-sm check-path-btn path-invalid'; }
        };
    });

    document.getElementById('cancelPuzzleBtn').onclick = () => renderPuzzlesTab();
    document.getElementById('puzzleForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const files = {};
        divisions.forEach(d => { const v = fd.get(`file_${d}`); if (v) files[d] = v; });
        const data = {
            name: fd.get('name'), author: fd.get('author'), puzzleNumber: parseInt(fd.get('puzzleNumber')),
            timeLimitSeconds: parseInt(fd.get('timeLimitSeconds')), status: fd.get('status'), isWarmup: fd.get('isWarmup') === 'on',
            filesByDivision: files, filePath: files.default || Object.values(files)[0] || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (isEdit) await db.collection(PUZZLES_COLLECTION).doc(puzzle.id).update(data);
        else await db.collection(PUZZLES_COLLECTION).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        renderPuzzlesTab();
    };
}

/* ==========================================
   DIVISIONS TAB: Define tournament categories
   ========================================== */

async function renderDivisionsTab() {
    try {
        const doc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
        let list = doc.exists ? doc.data().list : ['Easier', 'Harder', 'Pairs'];
        let html = `<div class="admin-card"><h3>Manage Divisions</h3><div id="divisionList" class="admin-list" style="box-shadow:none; border:1px solid #eee">
            ${list.map(div => `<div class="list-item"><span>${div}</span><button class="secondary-btn btn-sm btn-danger remove-div-btn" data-name="${div}">Remove</button></div>`).join('')}
            </div><div class="form-group" style="margin-top:20px; display:flex; gap:10px;"><input type="text" id="newDivisionName" placeholder="New name"><button id="addDivisionBtn" class="primary-btn">Add</button></div>
            <div class="action-row"><button id="saveDivisionsBtn" class="primary-btn btn-success">Save Changes</button></div></div>`;
        adminContent.innerHTML = html;
        document.getElementById('addDivisionBtn').onclick = () => {
            const n = document.getElementById('newDivisionName').value.trim();
            if (n && !list.includes(n)) { list.push(n); renderDivisionsTab(); }
        };
        document.querySelectorAll('.remove-div-btn').forEach(btn => {
            btn.onclick = () => { list = list.filter(d => d !== btn.dataset.name); renderDivisionsTab(); };
        });
        document.getElementById('saveDivisionsBtn').onclick = async () => {
            await db.collection(CONFIG_COLLECTION).doc('divisions').set({ list });
            Toast.success('Divisions saved!');
        };
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}

/* ==========================================
   SETTINGS TAB: Meta-data and Scoring Rules
   ========================================== */

async function renderSettingsTab() {
    try {
        const metaDoc = await db.collection(CONFIG_COLLECTION).doc('metadata').get();
        const metadata = metaDoc.exists ? metaDoc.data() : { tournamentName: 'Crossword Tournament' };
        const scoreDoc = await db.collection(CONFIG_COLLECTION).doc('scoring').get();
        const rules = scoreDoc.exists ? scoreDoc.data() : { pointsPerWord: 10, timeBonusPerSecond: 1, completionBonus: 180, overtimePenaltyPer4Seconds: 1, minCorrectPercentageForTimeBonus: 0.5 };

        let html = `
            <div class="admin-card"><h3>Tournament Title</h3><form id="metadataForm"><div class="form-group"><input type="text" name="tournamentName" value="${metadata.tournamentName}"></div><div class="action-row"><button type="submit" class="primary-btn btn-success">Save Title</button></div></form></div>
            <div class="admin-card"><h3>Scoring Rules</h3><form id="scoringForm">
                <div class="form-row"><div class="form-group"><label>Points Per Word</label><input type="number" name="pointsPerWord" value="${rules.pointsPerWord}"></div><div class="form-group"><label>Completion Bonus</label><input type="number" name="completionBonus" value="${rules.completionBonus}"></div></div>
                <div class="form-row" style="margin-top:15px"><div class="form-group"><label>Time Bonus (pts/sec)</label><input type="number" name="timeBonusPerSecond" value="${rules.timeBonusPerSecond}"></div><div class="form-group"><label>Overtime Penalty</label><input type="number" name="overtimePenaltyPer4Seconds" value="${rules.overtimePenaltyPer4Seconds}"></div></div>
                <div class="form-group" style="margin-top:15px"><label>Min Accuracy for Time Bonus</label><input type="number" step="0.1" name="minCorrectPercentageForTimeBonus" value="${rules.minCorrectPercentageForTimeBonus}"></div>
                <div class="action-row"><button type="submit" class="primary-btn btn-success">Save Rules</button></div></form></div>
        `;
        adminContent.innerHTML = html;
        document.getElementById('metadataForm').onsubmit = async (e) => {
            e.preventDefault();
            await db.collection(CONFIG_COLLECTION).doc('metadata').set({ tournamentName: new FormData(e.target).get('tournamentName') });
            Toast.success('Title updated!');
        };
        document.getElementById('scoringForm').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await db.collection(CONFIG_COLLECTION).doc('scoring').set({
                pointsPerWord: parseInt(fd.get('pointsPerWord')), completionBonus: parseInt(fd.get('completionBonus')),
                timeBonusPerSecond: parseInt(fd.get('timeBonusPerSecond')), overtimePenaltyPer4Seconds: parseInt(fd.get('overtimePenaltyPer4Seconds')),
                minCorrectPercentageForTimeBonus: parseFloat(fd.get('minCorrectPercentageForTimeBonus'))
            });
            Toast.success('Scoring rules updated!');
        };
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}

/* ==========================================
   RESULTS TAB: Monitoring and Export
   ========================================== */

async function renderResultsTab() {
    try {
        const querySnapshot = await db.collection(SCORES_COLLECTION).orderBy('submittedAt', 'desc').limit(150).get();
        let html = `<div class="admin-section-header"><h2>Recent Results</h2><button id="exportResultsBtn" class="secondary-btn btn-sm">Export CSV</button></div><div class="admin-card" style="padding:0"><table class="results-table"><thead><tr><th>Solver</th><th>Division</th><th>Puzzle</th><th>Score</th><th>Correct</th><th>Time</th></tr></thead><tbody>`;
        const results = [];
        querySnapshot.forEach(doc => {
            const data = doc.data(); results.push(data);
            html += `<tr><td><strong>${data.solverName}</strong><br><small>${data.submittedAt?.toDate().toLocaleString() || 'N/A'}</small></td><td>${data.division}</td><td>#${data.puzzleNumber}: ${data.puzzleName}</td><td><strong class="score-cell">${data.totalScore}</strong></td><td>${data.correctWords}/${data.totalWords}</td><td>${Math.floor(data.timeTaken/60)}m ${data.timeTaken%60}s</td></tr>`;
        });
        if (results.length === 0) html += '<tr><td colspan="6" class="empty-state">No results.</td></tr>';
        adminContent.innerHTML = html + '</tbody></table></div>';
        document.getElementById('exportResultsBtn').onclick = () => {
            const headers = ['Solver', 'Division', 'Puzzle ID', 'Puzzle Name', 'Score', 'Correct', 'Total', 'Time', 'Submitted'];
            const csv = [headers.join(','), ...results.map(r => [`"${r.solverName}"`,`"${r.division}"`,`"${r.puzzleId}"`,`"${r.puzzleName}"`,r.totalScore,r.correctWords,r.totalWords,r.timeTaken,r.submittedAt?.toDate().toISOString()||''].join(','))].join('\n');
            const b = new Blob([csv], { type: 'text/csv' });
            const u = window.URL.createObjectURL(b);
            const a = document.createElement('a'); a.href = u; a.download = 'results.csv'; a.click();
        };
    } catch (e) { adminContent.innerHTML = `<p class="error">${e.message}</p>`; }
}
