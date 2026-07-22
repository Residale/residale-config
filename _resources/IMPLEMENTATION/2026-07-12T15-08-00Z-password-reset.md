# Residale Config password reset

## Summary

Added a real Supabase password-reset flow to the Residale Config login screen.

## Changes

- Added `Mot de passe oublié ?` action on the login form.
- Added reset request mode:
  - user enters CRM email,
  - app calls `supabase.auth.resetPasswordForEmail`,
  - reset email redirects back to the current app origin.
- Added recovery-link handling:
  - app detects Supabase recovery URL hash/query parameters,
  - keeps the user on the password reset screen instead of jumping into the member area,
  - user enters and confirms a new password,
  - app calls `supabase.auth.updateUser({ password })`.
- Improved login error copy to tell the user to use password reset when password is invalid.

## Files changed

- `src/lib/editor/plan-library.ts`
- `src/routes/index.tsx`

## Verification

- `npx prettier --write src/routes/index.tsx src/lib/editor/plan-library.ts`: passed.
- `npx eslint src/routes/index.tsx src/lib/editor/plan-library.ts`: passed.
- `npm run build`: passed.
- Local browser verification on `http://127.0.0.1:8082/`:
  - login page shows `Mot de passe oublié ?`,
  - forgot-password screen opens,
  - missing-email validation appears,
  - recovery URL `#type=recovery&access_token=...` shows the `Choisir un nouveau mot de passe` form.

## Notes

This requires Supabase Auth email delivery to be configured for the project and the deployed URL to be allowed as a redirect URL in Supabase Auth settings.
