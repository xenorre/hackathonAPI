# Memory — User module endpoints

Last updated: 2026-10-08 11:40 Europe/Warsaw

## What was built

Added `src/module/users/user.controller.ts` and `users.service.ts`, registered them in `users.module.ts`, and added `test/users.e2e-spec.ts`. The requested user endpoints are complete.

## Decisions made

The existing Better Auth integration registers AuthGuard globally. The new controller relies on that guard and uses `@Roles([UserRole.ADMIN])` for GET `/user/all`; GET `/user/:id` accepts any authenticated role. Kept the existing GET `/users/me` route working.

## Problems solved

HTTP tests require a temporary localhost listener, which the sandbox blocks with `listen EPERM`. Running `pnpm test:e2e --runInBand` with approved escalation succeeded.

## Current state

Build, ESLint for changed source and the new test, formatting, and diff whitespace checks passed. All 5 unit tests and 26 HTTP tests passed. The new HTTP tests exercise the real integration AuthGuard with mocked session resolution and Prisma access; no live database was used. Changes remain uncommitted.

## Next session starts with

Restore this memory, then follow the next user request. No implementation follow-up remains for these endpoints.

## Open questions

None.
