# Workflow Context Rule Added

## What Changed
- Added a rule that workflow-specific requests should first use the matching file in `docs/workflow`.
- Added a fallback rule to ask the user a clear follow-up question when no matching workflow file exists.
- Clarified that confirmed workflow context should then be saved.

## Why
- This keeps workflow guidance grounded in the existing documentation structure.
- It reduces guesswork when a workflow document has not been created yet.

## Files Updated
- .git/copilot-instructions.md
- rules.md