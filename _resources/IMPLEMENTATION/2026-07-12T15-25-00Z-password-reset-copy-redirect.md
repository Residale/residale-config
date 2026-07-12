# Floor Whisper password reset copy + redirect correction

## Issue

User reported the password-reset experience was confusing and wrong:

- UI said `Email CRM` / `Mot de passe CRM` even though this is Floor Whisper.
- Reset email redirected to the CRM instead of Floor Whisper.
- Logging in with CRM credentials showed an incorrect-password error.

## Changes

- Removed CRM wording from the Floor Whisper login/reset UI:
  - `Email CRM` → `Email`
  - `Mot de passe CRM` → `Mot de passe`
  - `Connexion avec votre compte CRM Residale` → `Connexion à Floor Whisper`
  - reset text no longer mentions CRM.
- Changed the reset redirect target to the explicit Floor Whisper origin root:
  - `new URL("/", window.location.origin).toString()`
  - This emits `https://config.residale.com/` in production rather than relying on the current path/query.
- Recovery URL detection now accepts access tokens in either hash or query parameters.

## Important remaining backend setting

If Supabase still redirects reset emails to the CRM after this deploy, then Supabase Auth settings are overriding/rejecting the app-provided redirect. The fix is in Supabase Dashboard for project `vvtgwjjsvyyakpuficcq`:

- Authentication → URL Configuration
- Site URL should not force the CRM for this app, or
- Add `https://config.residale.com/*` / `https://config.residale.com/` to Redirect URLs.

The app now sends the correct redirect URL; Supabase must allow it.

## Verification

- `npx prettier --write src/routes/index.tsx src/lib/editor/plan-library.ts`: passed.
- `npx eslint src/routes/index.tsx src/lib/editor/plan-library.ts`: passed.
- `npm run build`: passed.
