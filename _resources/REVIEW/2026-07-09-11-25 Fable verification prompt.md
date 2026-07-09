# Fable Verification Prompt — Floor Whisper

You are Claude Code Fable, acting as the single orchestrator/captain.

Runtime/user/workspace:
- Run as normal Linux user `hermes`.
- Worktree: `/home/hermes/workspace/residale/floor-whisper`.
- Repo: `Residale/floor-whisper`.
- Production URL: `https://config.residale.com`.

Context:
- Hermes/controller already completed and pushed commit `08707f7 Modernize Floor Whisper and add architect sheet export`.
- The user explicitly wants you to re-check that work, not redo from scratch.
- The goal is to independently verify Hermes/controller's work, make necessary fixes if you find issues, and continue until the work is properly shipped and verified.

Instruction from Jacques:
- Launch Fable as orchestrator.
- Use the maximum helpers where useful; target exactly 5 Agent Team helpers unless the tooling refuses.
- Helpers should be Sonnet by default; use Opus only for a genuinely hard architecture/security/product-review role if available/useful.
- Re-verify the work Hermes did, make changes if needed, and continue through test/build/commit/push/deploy/live verification.

Scope to verify:
1. Lovable removal is safe and complete enough:
   - no broken imports from Lovable removed files/config
   - Vite/TanStack/Nitro config is owned and correct for Coolify
   - package/package-lock/Dockerfile remain deployable
2. Floor Whisper branding is consistent enough for this slice.
3. Architectural sheet export is functional and not just a button:
   - `src/lib/editor/sheet-export.ts`
   - `Plan architecte` top-bar flow
   - PDF export with project/company/version/scale/paper inputs
   - sane output for empty/non-empty plan cases
4. Built-in wall/window/door/terrace/large-opening presets are correctly wired:
   - drag/drop payloads still match the editor canvas expectations
   - wall preset buttons apply correct active wall settings
5. `_resources` artifacts are accurate and useful.
6. Deployment is actually live on Coolify and `https://config.residale.com` serves the new version.

Allowed actions:
- Inspect repo, run tests/builds, add missing tests/smokes if useful.
- Edit code/config/artifacts if you find issues.
- Commit and push fixes to `main` if needed.
- Let Coolify auto-deploy and verify the live site.

Do NOT do without explicit controller/user approval:
- destructive production data actions
- credential rotation
- billing changes
- force-push
- irreversible migrations
- unrelated project work

Required artifacts:
- Write a review report under `_resources/REVIEW/YYYY-MM-DD-HH-mm Fable verification review.md`.
- If you change code, write/update an implementation report under `_resources/IMPLEMENTATION/YYYY-MM-DD-HH-mm Fable verification fixes.md`.

Required verification gates:
- `npm run build`
- any existing lint/test command that is reasonable; if lint is known noisy, record exact failure instead of hiding it
- Docker/Coolify deployment check if code is pushed
- live browser or curl check of `https://config.residale.com`

Report requirements:
- State actual helper count, roles, and model levels if visible.
- Separate Fable-reviewed conclusions from Hermes/controller assertions.
- If everything is OK, say exactly what was verified and why no changes were needed.
- If fixes were needed, list commits and live verification.

Completion marker:
When complete and only when complete, print a final line exactly:
FABLE_FLOOR_WHISPER_VERIFY_DONE

If blocked, print a final line exactly:
FABLE_FLOOR_WHISPER_VERIFY_BLOCKED: <short reason>
