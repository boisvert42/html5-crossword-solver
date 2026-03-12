# Tournament Dashboard TODO

## ✅ Completed (March 2026)
- **Firebase 2026 Compatibility:** Updated for Blaze plan requirements and new console layout.
- **Custom Domain Auth:** Documented Google Cloud Console verification for custom domains.
- **Robust Security Rules:** Implemented verified production-ready Firestore rules.
- **Modern UI Feedback:** Replaced all browser `alert()` calls with a non-intrusive Toast notification system.
- **Persistent Footer:** Added attribution, logout link, and dark mode toggle.
- **Dark Mode:** Implemented a persistent dark mode toggle for the participant dashboard.
- **Leaderboard UX:** Moved division filter to a more prominent left-aligned position.
- **Sign-Out Flow:** Added a stable "Log Out" link to both Admin and Participant views.

## 🚀 Near-Term Tasks
- **Leaderboard Export:** Add a button to export the final leaderboard as a CSV for official archiving.
- **Puzzle Timers:** Add a "Countdown to Start" feature for live synchronized tournament starts.
- **Admin Real-time View:** Enhance the "Results" tab to show real-time "Words Filled" progress for each participant.
- **Email Whitelist Improvements:** Allow bulk upload of admins via the Admin dashboard itself (currently manual in console).

## 🛠 Maintenance
- **Dependency Audit:** Check if Firebase SDK v9+ (Modular) should be adopted (currently using v8 compatibility mode).
- **Mobile Styling:** Further refine the leaderboard grid for very narrow mobile screens.
