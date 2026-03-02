// Tournament Admin Logic
const SOLVERS_COLLECTION = 'solvers';
const PUZZLES_COLLECTION = 'puzzles';
const CONFIG_COLLECTION = 'tournament_config';
const SCORES_COLLECTION = 'scores';

let db;
let currentTab = 'puzzles';
const adminContent = document.getElementById('admin-content');

document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined') {
        db = firebase.firestore();
        initTabs();
        loadTab(currentTab);
    } else {
        adminContent.innerHTML = '<p class="error">Firebase SDK not loaded.</p>';
    }
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            loadTab(currentTab);
        });
    });
}

async function loadTab(tab) {
    adminContent.innerHTML = '<div class="loading">Loading section...</div>';
    switch (tab) {
        case 'puzzles':
            renderPuzzlesTab();
            break;
        case 'divisions':
            renderDivisionsTab();
            break;
        case 'scoring':
            renderScoringTab();
            break;
        case 'results':
            renderResultsTab();
            break;
    }
}

/* PUZZLES TAB */
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

        // Event listeners
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
    
    // Fetch divisions to allow per-division file mapping
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
                            <option value="available" ${puzzle?.status === 'available' ? 'selected' : ''}>Available</option>
                            <option value="hidden" ${puzzle?.status === 'hidden' ? 'selected' : ''}>Hidden</option>
                            <option value="locked" ${puzzle?.status === 'locked' ? 'selected' : ''}>Locked</option>
                        </select>
                    </div>
                    <div class="form-group" style="display:flex; align-items:center; padding-top:20px; gap:10px;">
                        <input type="checkbox" name="isWarmup" id="isWarmup" ${puzzle?.isWarmup ? 'checked' : ''}>
                        <label for="isWarmup">Mark as Warm-up</label>
                    </div>
                </div>

                <div class="form-group" style="margin-top:15px">
                    <label>Puzzle Files (Storage Paths)</label>
                    <p style="font-size:0.8em; color:#666; margin-bottom:10px">Enter the path in Firebase Storage (e.g., <code>puzzles/my-puzzle.puz</code>) or a local path starting with <code>../</code></p>
                    <div class="division-mapping">
                        ${divisions.map(div => `
                            <div class="mapping-row">
                                <label>${div}:</label>
                                <input type="text" name="file_${div}" value="${puzzle?.filesByDivision?.[div] || (div === 'default' ? puzzle?.filePath || '' : '')}" placeholder="path/to/file.puz">
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
            if (isEdit) {
                await db.collection(PUZZLES_COLLECTION).doc(puzzle.id).update(puzzleData);
            } else {
                await db.collection(PUZZLES_COLLECTION).add({
                    ...puzzleData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            renderPuzzlesTab();
        } catch (err) {
            alert('Error saving puzzle: ' + err.message);
        }
    };
}

/* DIVISIONS TAB */
async function renderDivisionsTab() {
    try {
        const doc = await db.collection(CONFIG_COLLECTION).doc('divisions').get();
        let list = doc.exists ? doc.data().list : ['Easier', 'Harder', 'Pairs'];

        let html = `
            <div class="admin-card">
                <h3>Manage Divisions</h3>
                <p>Define the divisions available for participants. Each division can have its own puzzle files.</p>
                <div id="divisionList" class="admin-list" style="box-shadow:none; border:1px solid #eee">
                    ${list.map(div => `
                        <div class="list-item">
                            <span>${div}</span>
                            <button class="secondary-btn btn-sm btn-danger remove-div-btn" data-name="${div}">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <div class="form-group" style="margin-top:20px; display:flex; gap:10px;">
                    <input type="text" id="newDivisionName" placeholder="New division name">
                    <button id="addDivisionBtn" class="primary-btn">Add Division</button>
                </div>
                <div class="action-row">
                    <button id="saveDivisionsBtn" class="primary-btn btn-success">Save Changes</button>
                </div>
            </div>
        `;
        adminContent.innerHTML = html;

        document.getElementById('addDivisionBtn').onclick = () => {
            const name = document.getElementById('newDivisionName').value.trim();
            if (name && !list.includes(name)) {
                list.push(name);
                document.getElementById('newDivisionName').value = '';
                refreshDivList();
            }
        };

        function refreshDivList() {
            document.getElementById('divisionList').innerHTML = list.map(div => `
                <div class="list-item">
                    <span>${div}</span>
                    <button class="secondary-btn btn-sm btn-danger remove-div-btn" data-name="${div}">Remove</button>
                </div>
            `).join('');
            attachRemoveEvents();
        }

        function attachRemoveEvents() {
            document.querySelectorAll('.remove-div-btn').forEach(btn => {
                btn.onclick = () => {
                    list = list.filter(d => d !== btn.dataset.name);
                    refreshDivList();
                };
            });
        }
        attachRemoveEvents();

        document.getElementById('saveDivisionsBtn').onclick = async () => {
            await db.collection(CONFIG_COLLECTION).doc('divisions').set({ list });
            alert('Divisions saved!');
            renderDivisionsTab();
        };

    } catch (e) {
        adminContent.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}

/* SCORING TAB */
async function renderScoringTab() {
    try {
        const doc = await db.collection(CONFIG_COLLECTION).doc('scoring').get();
        const rules = doc.exists ? doc.data() : {
            pointsPerWord: 10,
            timeBonusPerSecond: 1,
            completionBonus: 180,
            overtimePenaltyPer4Seconds: 1,
            minCorrectPercentageForTimeBonus: 0.5
        };

        let html = `
            <div class="admin-card">
                <h3>Scoring Rules</h3>
                <form id="scoringForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Points Per Correct Word</label>
                            <input type="number" name="pointsPerWord" value="${rules.pointsPerWord}">
                        </div>
                        <div class="form-group">
                            <label>Completion Bonus (100% Correct)</label>
                            <input type="number" name="completionBonus" value="${rules.completionBonus}">
                        </div>
                    </div>
                    <div class="form-row" style="margin-top:15px">
                        <div class="form-group">
                            <label>Time Bonus (Points/Sec)</label>
                            <input type="number" name="timeBonusPerSecond" value="${rules.timeBonusPerSecond}">
                        </div>
                        <div class="form-group">
                            <label>Overtime Penalty (Points/4 Sec)</label>
                            <input type="number" name="overtimePenaltyPer4Seconds" value="${rules.overtimePenaltyPer4Seconds}">
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:15px">
                        <label>Min Accuracy for Time Bonus (0.0 - 1.0)</label>
                        <input type="number" step="0.1" name="minCorrectPercentageForTimeBonus" value="${rules.minCorrectPercentageForTimeBonus}">
                    </div>
                    <div class="action-row">
                        <button type="submit" class="primary-btn btn-success">Save Scoring Rules</button>
                    </div>
                </form>
            </div>
        `;
        adminContent.innerHTML = html;

        document.getElementById('scoringForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newRules = {
                pointsPerWord: parseInt(formData.get('pointsPerWord')),
                completionBonus: parseInt(formData.get('completionBonus')),
                timeBonusPerSecond: parseInt(formData.get('timeBonusPerSecond')),
                overtimePenaltyPer4Seconds: parseInt(formData.get('overtimePenaltyPer4Seconds')),
                minCorrectPercentageForTimeBonus: parseFloat(formData.get('minCorrectPercentageForTimeBonus'))
            };
            await db.collection(CONFIG_COLLECTION).doc('scoring').set(newRules);
            alert('Scoring rules updated!');
        };
    } catch (e) {
        adminContent.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}

/* RESULTS TAB */
async function renderResultsTab() {
    try {
        const querySnapshot = await db.collection(SCORES_COLLECTION).orderBy('submittedAt', 'desc').limit(100).get();
        
        let html = `
            <div class="admin-section-header">
                <h2>Recent Results</h2>
                <button id="exportResultsBtn" class="secondary-btn btn-sm">Export CSV</button>
            </div>
            <div class="admin-card" style="padding:0">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Solver</th>
                            <th>Division</th>
                            <th>Puzzle</th>
                            <th>Score</th>
                            <th>Correct</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const results = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            results.push(data);
            const date = data.submittedAt?.toDate().toLocaleString() || 'N/A';
            html += `
                <tr>
                    <td><strong>${data.solverName}</strong><br><small>${date}</small></td>
                    <td>${data.division}</td>
                    <td>#${data.puzzleNumber}: ${data.puzzleName}</td>
                    <td><strong class="score-cell">${data.totalScore}</strong></td>
                    <td>${data.correctWords} / ${data.totalWords}</td>
                    <td>${Math.floor(data.timeTaken / 60)}m ${data.timeTaken % 60}s</td>
                </tr>
            `;
        });

        if (results.length === 0) {
            html += '<tr><td colspan="6" class="empty-state">No results yet.</td></tr>';
        }

        html += '</tbody></table></div>';
        adminContent.innerHTML = html;

        document.getElementById('exportResultsBtn').onclick = () => {
            if (results.length === 0) return;
            const headers = ['Solver', 'Division', 'Puzzle ID', 'Puzzle Name', 'Score', 'Correct Words', 'Total Words', 'Time Taken', 'Submitted At'];
            const csvContent = [
                headers.join(','),
                ...results.map(r => [
                    `"${r.solverName}"`,
                    `"${r.division}"`,
                    `"${r.puzzleId}"`,
                    `"${r.puzzleName}"`,
                    r.totalScore,
                    r.correctWords,
                    r.totalWords,
                    r.timeTaken,
                    r.submittedAt?.toDate().toISOString() || ''
                ].join(','))
            ].join('
');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', 'tournament_results.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

    } catch (e) {
        adminContent.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}
