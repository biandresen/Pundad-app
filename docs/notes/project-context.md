Project: Pundad capstone fullstack app

Tech stack:

- Frontend: React + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Auth: access token + refresh token flow
- Deployment: Raspberry Pi, Cloudflare, Nginx, and systemd-managed PM2 release runtimes; see [the master guide](https://github.com/biandresen/Pundad-api/blob/main/docs/development-deployment-guide.md)
- UI includes sidebars, header/navbar, profile/dashboard, joke pages, featured pages, legal pages

Core app concept:

- Users can register, login, manage profile
- Create, edit, delete jokes
- Save drafts and publish later
- Comment on jokes
- Like jokes
- View daily joke, random joke, popular jokes, all jokes, search
- Hall of Fame / badges / featured joke systems
- Admin page for admin users

Important architecture decisions:

- User/profile is shared globally across languages
- dailyJokeStreak is global across languages by choice
- Content is language-separated between NO and EN
- App behaves like two separate apps/sites for content, except shared user/profile
- Language implemented in backend, database schema, and frontend

Database / backend language architecture:

- Added Language enum with NO and EN
- language-aware models include content-related entities
- languageMiddleware resolves request language from frontend
- routes under /api/v1 use language middleware
- services/controllers were updated to respect language
- language isolation is important: NO content should not leak into EN and vice versa
- featured jokes, tags, hall of fame, comments, likes, etc. were updated for language scoping
- streak remains global

Frontend language architecture:

- translations.ts contains NO and EN content
- LanguageContext provides current language and t()/tf()-style translation usage
- app language can come from localStorage, and user.preferredLanguage should be prioritized when logged in
- many pages/components already converted from hardcoded text to translations:
  - Home
  - About
  - Register
  - Login
  - ForgotPassword
  - ResetPassword
  - Profile
  - Admin
  - Drafts
  - MyJokes
  - NewJoke
  - Search
  - AllJokes
  - Popular
  - DailyJoke
  - RandomJoke
  - HallOfFame
  - featured pages
  - Navbar
  - Header
  - LeftSidebar / LeftSidebar2
  - RightSidebar
  - LegalMenu
  - UserMenu
  - MobileNavHint
  - Layout report modal/button
  - CommentForm
  - Comment
  - JokeCard
  - AvatarWithBadges
  - Modal
  - legal pages (terms/privacy/cookies/rules)
