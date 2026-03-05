/**
 * Shared Leaderboard Logic
 * This file is used by both the Participant Solver and the Admin Dashboard.
 */

window.TournamentLeaderboard = {
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
                container.innerHTML = `<p class="error">Error loading standings.</p>`;
            });
    }
};
