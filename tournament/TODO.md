# Tournament System TODO

This list tracks potential improvements and features for the Crossword Tournament Solver.

## 🔒 Security & Integrity
- [ ] **Firestore Security Rules:** (Partially Done) Implement robust rules. We have the draft, but they need to be applied in the Firebase Console.
- [ ] **Puzzle Scrambling:** Implement a simple "XOR" or "Base64 + Key" scramble for local puzzle files to prevent tech-savvy users from peeking at the answers.
- [x] **Admin Authorization:** Verified Google account against a specific `admins` collection in Firestore.

## 🏆 Leaderboard & Standings
- [x] **Detailed Breakdowns:** Grid-based leaderboard now shows individual scores and times for every puzzle per participant.
- [ ] **Live Ranking Animations:** Use GSAP or similar to animate rows when they swap positions on the live leaderboard.
- [x] **Division Standings Toggle:** Admin and participants can switch between divisions to view live standings.

## 🛠️ Admin Features
- [x] **Authorized Participants (CSV):** Bulk upload authorized emails and pre-assign divisions.
- [x] **Strict Validation:** Added email and division validation to CSV uploads with detailed error reporting.
- [x] **Proactive Index Check:** Dashboard now alerts the admin if Firestore indices are missing.
- [ ] **Manual Override:** Add the ability for an admin to edit or delete a specific score entry.
- [ ] **Tournament Scheduling:** Add "Release Date/Time" to puzzles so they unlock automatically.

## 🕹️ Solver Experience
- [x] **Fullscreen Solver:** Siloed solving page with tournament branding and strict rules.
- [x] **Persistent Timing:** Puzzle timer now survives page refreshes and browser restarts.
- [x] **Real-time Puzzle Unlocking:** "Start" buttons appear instantly on solver dashboards when the admin marks a puzzle as Available.
- [ ] **Connection Heartbeat:** Show a "reconnecting" indicator if the live WebSocket connection drops.

## 📺 Twitch Integration
- [ ] **Twitch Bot Integration:** A specialized webhook that posts to Twitch chat whenever someone finishes a puzzle.
- [ ] **"On Stream" Overlay:** A simplified, high-contrast leaderboard view designed specifically to be used as a Browser Source in OBS.
