# Arcjet integration assessment

## Setup completed on 2026-10-04

The user subsequently authorized creating `hackathon-api`, obtaining its key,
writing `.env`, and configuring global Shield and rate limiting. That setup is
complete.

- Created site `site_01m421vwqwe18ttt4eb8rtk6xv` in the connected Personal team.
  Used the key returned by `create-site`; the key is not recorded in this note.
- Saved `ARCJET_KEY` and `ARCJET_ENV=development` in the Git ignored `.env`, with
  owner only file permissions (0600). Added `.env.example` for fresh checkouts.
- Installed `@arcjet/nest` 1.14.0 and `@nestjs/config` 12.0.1, whose peer dependency
  supports NestJS 11. Added `@jest/globals` 30.5.2 for the ESM test runner.
- Used Nest CLI to generate the global infrastructure module and injectable
  service in `src/lib/arcjet/`, and the custom guard in `src/common/guards/`.
- Registered the SDK through async Nest configuration and injected the SDK
  client into the service. Imported the infrastructure module once in
  `AppModule`, with one `APP_GUARD` registration and one `protect()` call per
  registered HTTP request.
- Enabled Shield and a fixed window rate limit in `LIVE` mode. The limit is
  100 requests per 60 seconds, identified by `ip.src`. Independent review of the
  installed SDK confirmed that the rule fingerprint is shared across paths and
  HTTP methods for the same IP, and changes for another IP.
- Shield denials return 403. Rate limit denials return 429 with `Retry-After`.
  SDK error decisions and unexpected protection failures log a warning and
  allow the request. Missing or blank keys reject startup.
- Enabled ESM in package configuration, added local `.js` import suffixes,
  updated production startup, and migrated unit/e2e Jest and ESLint settings.
  README records the runtime requirements and operational behavior.

Verification passed: application build, full TypeScript checking, ESLint,
formatting, existing unit test, and six HTTP e2e tests using an injected mock
Arcjet client. The HTTP tests cover allowed requests, Shield denial, rate limit
denial and retry headers, error handling, and global protection on another
controller/HTTP method. Separate compiled startup checks confirmed rejection
of missing and blank keys. Independent code review found no blockers.

The real Arcjet request smoke test needed permission for local sockets and
network access. It was interrupted before completion, and the user explicitly
requested skipping it. Real remote decisions and actual cloud enforcement have
therefore not been verified. No background application was intentionally left
running. No deployment or commit was performed.

The `/remember` skill remains unavailable. This update is the session save
fallback; do not recreate the site or obtain another key when continuing.

## Original assessment

Checked on 2026-10-04. The user requested an integration check using Arcjet MCP, not implementation. Application code, dependencies, and Arcjet account configuration were not changed. No tests were run for this assessment.

## Session continuity

The required `/remember` skill was absent from the available skill catalog and searched local skill locations. Repository instructions and source were read directly instead. This note saves the findings for the next session; neither `/remember restore` nor `/remember save` could be executed.

## Arcjet MCP findings

Called `list-teams`, then `list-sites` for the returned team. The connected session has the default Personal team, which has no sites. No site was created and no key was requested. SDK setup will require a site and an `ARCJET_KEY`, using the MCP sequence `list-teams` → `list-sites` or `create-site` → `get-site-key`. Do not print or commit the key.

The exposed Arcjet MCP tools manage account setup, remote rules, and request decisions. Integration details were checked against official documentation and SDK source. Remote HTTP rules only run when the application calls `protect()`; configuring rules alone does not integrate the app.

## Repository fit

This is a NestJS starter with the Express adapter and a single `GET /` route. No configuration module, auth, guards, proxy configuration, or Arcjet dependency exists. The project uses pnpm. Inspected runtime: Node 24.11.1, pnpm 10.24.0. The lockfile resolves NestJS 11.2.7.

Arcjet's current Nest package supports NestJS 10/11. Its package engine range is `>=22.21.0 <23 || >=24.5.0`, so the inspected runtime qualifies. Arcjet documents CommonJS as unsupported. `tsconfig.json` already uses NodeNext for modules and resolution, but `package.json` lacks `type: module`, so the application currently compiles as CommonJS.

## Proposed integration

Use the Nest SDK, `@arcjet/nest`, plus `@nestjs/config`. Follow repository architecture:

- Generate `src/lib/arcjet/arcjet.module.ts` and `arcjet.service.ts` with Nest CLI. Mark the infrastructure wrapper `@Global()` and import it once in `AppModule`.
- Register the SDK through `ArcjetModule.forRootAsync`, with `isGlobal: true` at the top level and `ConfigService` injected into `useFactory`. Read `ARCJET_KEY` with `getOrThrow`; load and validate environment configuration at startup.
- Inject the SDK client using `@Inject(ARCJET)` and the `ArcjetNest` type in the wrapper service. Keep a single root client.
- Register request protection through `APP_GUARD`. A custom application guard belongs in `src/common/guards/` and receives the wrapper service through constructor injection.
- Start Shield and an appropriately chosen IP rate limit in `DRY_RUN`, inspect real decisions, then enable enforcement. Choose bot protection by endpoint/client requirements; ordinary API clients such as curl may be detected as bots.
- If using the SDK's built-in `ArcjetGuard`, denials become Nest's generic 403. Use a custom guard to return 429 for rate limits and 403 for other denials, and explicitly handle/log error decisions. The built-in guard allows error decisions.
- `WithArcjetRules` adds route/controller metadata read by the built-in guard; the decorator alone does not attach a guard. Do not combine multiple protection calls on the same request accidentally, especially when rate limiting.
- Configure trusted proxy addresses/services once the deployment topology is known.

## ESM migration and verification

Add `type: module` to `package.json` and `.js` suffixes to relative imports in source and tests. Use `node dist/main.js` for the production script. Retain the existing NodeNext compiler settings and change ESLint's source type to module.

Both the unit Jest configuration in `package.json` and `test/jest-e2e.json` need ESM support, including ts-jest ESM transformation, `.ts` treatment, local `.js` import mapping, and the appropriate Jest runtime configuration. Update the CommonJS-based `test:debug` command as well.

Implementation verification should cover startup/build, existing unit and e2e behavior, allowed requests, 403 denials, 429 rate limits if customized, and the chosen error behavior. Override the injected client/service for deterministic automated tests. Verify real SDK decisions separately with MCP `list-requests` and decision details after traffic reaches the integrated app.

## Sources

- [Official NestJS setup](https://docs.arcjet.com/sdk/nest/get-started)
- [Official NestJS SDK reference](https://docs.arcjet.com/reference/nestjs)
- [Official example module, including async configuration](https://github.com/arcjet/example-nestjs/blob/main/src/app.module.ts)
- [SDK source, DI tokens and guard behavior](https://github.com/arcjet/arcjet-js/blob/main/arcjet-nest/src/index.ts)
- [SDK package metadata and runtime support](https://github.com/arcjet/arcjet-js/blob/main/arcjet-nest/package.json)
