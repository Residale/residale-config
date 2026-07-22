# Hermes Assistant Slider Plan

## Goal

Add a right-side in-app helper for Residale Config after the editor/export foundation is stable.

## Safe architecture

Do **not** expose a raw Hermes gateway or tool-capable agent to browser users.

Use this boundary:

```text
Browser assistant drawer
  -> Residale Config app API route authenticates/validates request
  -> app builds scoped JSON context from the current plan/project only
  -> private project shim on Residale VPS
  -> project-specific Hermes profile API-only on loopback
  -> answer/suggestions returned to app
```

## Profile shape on Residale VPS

- Runtime user: `hermes` if available/owned; otherwise explicitly document why root is used.
- Profile name: `residale-config`.
- Disable messaging tokens and broad toolsets for the user-facing profile.
- Keep only completion capability unless explicit action endpoints are later designed.
- Bind Hermes API to `127.0.0.1:<unique-port>`.
- Put a small app-facing shim on a private bridge/loopback route requiring a bearer token.
- Coolify env names should be explicit, e.g. `HERMES_AGENT_URL`, `HERMES_AGENT_TOKEN`, `HERMES_AGENT_TIMEOUT_MS`.

## First assistant capabilities

1. Explain what a selected wall/window/door preset means.
2. Suggest PMR/European sizing improvements from the current plan context.
3. Explain why the architectural PDF export scaled to a given denominator.
4. Produce non-destructive suggestions only; no direct project mutation in phase 1.

## Verification before calling it live

- `hermes -p residale-config chat -q "Reply exactly PROFILE_OK" -Q` succeeds as the intended runtime user.
- Shim `/health` works from host and from the app container.
- Public app shows assistant connected, not fallback.
- A live assistant request includes only scoped plan JSON and no VPS/filesystem/secrets.

## Deferred

This phase did not create the Hermes profile because the user requested it as a follow-up thought after the editor/PDF foundation. Creating profile services and secrets is an infrastructure side effect that should be done as a separate, verified deploy slice.
