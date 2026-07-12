# Temporary Floor Whisper access

## Summary

Added a temporary Floor Whisper-only login so the user can access the configurator immediately while Supabase/Auth redirect issues are handled separately.

## Behavior

- Login form is prefilled with the temporary Floor Whisper email.
- Temporary password is validated in the browser against a SHA-256 digest, not stored as plaintext in the source.
- Temporary access sets a local browser session flag.
- While using temporary access, plan CRUD uses the browser's local plan library instead of Supabase tables, avoiding the broken CRM/Supabase Auth path.
- Logout clears the temporary local session.

## Important caveat

This is an emergency browser-local access path. Plans created in this mode are local to the browser until proper Supabase Auth is fixed/migrated.

## Verification

- `npx prettier --write src/routes/index.tsx src/lib/editor/plan-library.ts`: passed.
- `npx eslint src/routes/index.tsx src/lib/editor/plan-library.ts`: passed.
- `npm run build`: passed.
- Local browser verification on `http://127.0.0.1:8083/`:
  - login form prefilled the temporary email,
  - temporary password logged in successfully,
  - `Mes plans` loaded with `Compte : Accès temporaire Floor Whisper`.
