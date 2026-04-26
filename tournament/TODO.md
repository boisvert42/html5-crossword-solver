# Tournament Dashboard TODO

## ✅ Completed (March 2026)
- **Admin Custom Branding:** Allow admins to configure the solver's primary/secondary color scheme from the Settings tab.
- **Persistent Admin Tab:** Ensure the Admin dashboard stays on the same tab when the page is refreshed (e.g., via localStorage or URL hash).
- **Manual Participant Entry:** Added a UI to authorize individual users manually (email + division) without requiring a CSV upload.
- **Custom Domain Auth:** Documented Google Cloud Console verification for custom domains.
- **Robust Security Rules:** Implemented verified production-ready Firestore rules.
- **Modern UI Feedback:** Replaced all browser `alert()` calls with a non-intrusive Toast notification system.
- **Persistent Footer:** Added attribution, logout link, and dark mode toggle.
- **Dark Mode:** Implemented a persistent dark mode toggle for the participant dashboard.
- **Leaderboard UX:** Moved division filter to a more prominent left-aligned position.
- **Sign-Out Flow:** Added a stable "Log Out" link to both Admin and Participant views.

## 🚀 Near-Term Tasks
- **Admin Custom Branding:** Allow admins to configure the solver's primary/secondary color scheme from the Settings tab.
- **Leaderboard Export:** Add a button to export the final leaderboard as a CSV for official archiving.

## 🛠 Maintenance
- **Dependency Audit:** Check if Firebase SDK v9+ (Modular) should be adopted (currently using v8 compatibility mode).
- **Mobile Styling:** Further refine the leaderboard grid for very narrow mobile screens.
