/**
 * Shared Leaderboard Logic
 * This file is used by both the Participant Solver and the Admin Dashboard.
 */

window.TournamentLeaderboard = {
    /**
     * Helper to format error messages and linkify Firebase index URLs.
     */
    formatError(error) {
        const msg = typeof error === 'string' ? error : (error.message || 'An unknown error occurred');
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        // Linkify URLs and add explicit instruction
        return msg.replace(urlRegex, (url) => {
            return `<br><br><strong>Action Required:</strong> Click the link below and then click <strong>"Create Index"</strong> (or "Save") in the Firebase Console:<br><br>` +
                   `<a href="${url}" target="_blank" style="color: #3498db; font-weight: bold; text-decoration: underline; word-break: break-all;">${url}</a>`;
        });
    },

    /**
     * Renders a live leaderboard into the specified container.
     */
    async render(container, db, division, tournamentPuzzles, isMeCallback) {
        container.innerHTML = `<p>Loading standings for <strong>${division}</strong>...</p>`;

        // LIVE LISTENER: Aggregate scores into a grid
        return db.collection('scores')
            .where('division', '==', division)
            .onSnapshot((scoresSnapshot) => {
                const solverScores = {};
                scoresSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!solverScores[data.uid]) {
                        solverScores[data.uid] = { 
                            name: data.solverName, 
                            totalScore: 0, 
                            totalTime: 0, 
                            puzzles: {} 
                        };
                    }
                    solverScores[data.uid].totalScore += data.totalScore;
                    solverScores[data.uid].totalTime += data.timeTaken;
                    solverScores[data.uid].puzzles[data.puzzleId] = {
                        score: data.totalScore,
                        time: data.timeTaken
                    };
                });

                const leaderboardData = Object.values(solverScores).sort((a, b) => {
                    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                    return a.totalTime - b.totalTime;
                });

                if (leaderboardData.length === 0) {
                    container.innerHTML = `<p>No submissions for <strong>${division}</strong> yet.</p>`;
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
                    const isMe = isMeCallback ? isMeCallback(entry) : false;
                    tableHtml += `
                        <tr class="${isMe ? 'current-user' : ''}">
                            <td class="rank">${index + 1}</td>
                            <td style="white-space: nowrap;">
                                ${isMe ? `<strong>${entry.name} (You)</strong>` : entry.name}
                            </td>
                            ${tournamentPuzzles.map(p => {
                                const pResult = entry.puzzles[p.id];
                                return pResult ? 
                                    `<td><div style="font-weight:bold;color:#e67e22">${pResult.score}</div><div style="font-size:0.85em;color:#666">${Math.floor(pResult.time/60)}m ${pResult.time%60}s</div></td>` : 
                                    `<td style="color:#ccc">—</td>`;
                            }).join('')}
                            <td class="score-cell">${entry.totalScore}</td>
                            <td style="white-space: nowrap;">${Math.floor(entry.totalTime / 60)}m ${entry.totalTime % 60}s</td>
                        </tr>
                    `;
                });

                container.innerHTML = tableHtml + '</tbody></table>';

            }, (error) => {
                console.error('Leaderboard error:', error);
                // Use the linkifier for the internal snapshot error
                container.innerHTML = `<div class="error-message" style="display:block; text-align:left;">${this.formatError(error)}</div>`;
            });
    }
};
