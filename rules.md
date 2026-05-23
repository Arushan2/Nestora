# Nestora Project Rules

## Tech Stack
- Backend: PHP
- Database: MySQL
- Frontend: React (Vite) with shadcn/ui components

## Workflow Rules
- For any workflow-specific request, first look for the matching file in docs/workflow and use that file as the source of truth.
- If the matching workflow file is missing, ask the user a clear and specific follow-up question before assuming details, then save the confirmed workflow context.

- For every code or documentation change, add a detailed markdown note in docs/changes describing what changed and why.
- Name change notes in docs/changes using the format {date}-{changes}.md.
