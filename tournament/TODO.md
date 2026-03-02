# Tournament System TODO

This list tracks potential improvements and features for the Crossword Tournament Solver.

## 🔒 Security & Integrity
- [ ] **Firestore Security Rules:** Implement robust rules to ensure participants can only write their own scores and cannot read others' private data (except via the leaderboard).
- [ ] **Puzzle Scrambling:** Implement a simple "XOR" or "Base64 + Key" scramble for local puzzle files to prevent tech-savvy users from peeking at the `.ipuz` JSON in the network tab.
- [ ] **Admin Authorization:** Instead of just checking if a user is logged in, verify their UID against a specific `admins` collection in Firestore.

## 🏆 Leaderboard & Standings
- [ ] **Detailed Breakdowns:** Allow clicking a user on the leaderboard to see their individual scores/times for every puzzle.
- [ ] **Live Ranking Animations:** Use GSAP or similar to animate rows when they swap positions on the live leaderboard.
- [ ] **Division Standings Toggle:** Add a "Combined View" vs "Division Only" view for the admin dashboard.

## 🛠️ Admin Features
- [ ] **Manual Override:** Add the ability for an admin to edit or delete a specific submission (e.g., if a user's browser crashed and they need a reset).
- [ ] **Bulk Puzzle Import:** Allow uploading a ZIP of puzzles or a batch of metadata.
- [ ] **Tournament Scheduling:** Add "Release Date/Time" to puzzles so they unlock automatically without admin intervention.

## 🕹️ Solver Experience
- [ ] **Connection Heartbeat:** If the WebSocket connection drops during a solve, show a subtle "reconnecting" indicator so the user knows if their final score might not report.
- [ ] **Offline Resilience:** If the internet drops at the moment of completion, retry the `postMessage` every 5 seconds until the dashboard acknowledges receipt.
- [ ] **Tournament Themes:** Allow the admin to set a custom color scheme (primary/secondary) that flows through both the dashboard and the `solve.html` banner.

## 📺 Twitch Integration
- [ ] **Twitch Bot Integration:** A specialized webhook that posts to Twitch chat whenever someone finishes a puzzle ("User XYZ just finished Puzzle #3 in 4:20!").
- [ ] **"On Stream" Overlay:** A simplified, high-contrast leaderboard view designed specifically to be used as a Browser Source in OBS.
