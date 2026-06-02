# Nestora Project Rules — Antigravity Edition

## Tech Stack Rules
- **Backend**: Pure vanilla PHP with PDO database instances and native session states. Keep it lightweight and performant.
- **Database**: MySQL. Auto-migrate schema updates via `backend/src/bootstrap.php` and update the master schema in `backend/schema.sql`.
- **Frontend**: React.js with TypeScript and Vite. Utilize shadcn/ui custom components and Tailwind CSS utilities.

## Agent Operations & Workflows
- **Planning Pre-requisite**: Write a complete implementation plan and set up a task list before starting any major backend, database, or UI flows.
- **Role Separation**: Ensure Customer, Provider, and Seller pathways remain modular and decoupled.

## Change Logging & Documentation
- **Mandatory Change-Log**: Every single code, configuration, or documentation change must be followed by a detailed markdown note in `docs/changes/`.
- **Naming Standard**: Files must be named `docs/changes/{YYYY-MM-DD}-{short-description}.md`.
- **Structure**: Include "What Changed", "Why", and "Files Updated" headers exactly as defined in the project structure.
