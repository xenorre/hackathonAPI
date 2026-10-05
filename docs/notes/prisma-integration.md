# Prisma integration

Completed on 2026-10-05. The user asked to fix the Prisma setup and confirmed
they use a Prisma cloud database. The existing ignored `.env` already contained
its PostgreSQL `DATABASE_URL`; credentials were not changed or recorded here.

## Diagnosis and implementation

- The installed `prisma` 8.0.0-rc.20 CLI rejects `prisma generate` with
  `CLI.UNKNOWN_COMMAND`. The installed Client and PostgreSQL adapter are 7.10.0.
  Preserve the user's Prisma 8 CLI and `prisma.config.ts` for platform commands
  and existing optional skill synchronization.
- Added the officially supported `@prisma/prisma7` 7.10.0 CLI. ORM commands use
  `prisma7` and `prisma7.config.ts`, with configuration imported from
  `@prisma/prisma7/config`.
- Added `prisma/schema.prisma` with a PostgreSQL datasource and ESM TypeScript
  client generator targeting `src/generated/prisma`. It has no application
  models. Prisma 7.10 supports generating a client without models.
- Used Nest CLI to generate the module and service in `src/lib/database/`.
  `PrismaModule` is global, imports `ConfigModule`, exports `PrismaService`, and
  is imported once in `AppModule`. The injectable service extends the generated
  client, reads configuration through injected `ConfigService`, validates the
  URL, configures `PrismaPg`, and connects/disconnects through Nest lifecycle
  hooks. Shutdown hooks are enabled in `main.ts`.
- The PostgreSQL adapter requires a `postgres://` or `postgresql://` URL.
  `prisma+postgres://` URLs require a different integration and are rejected.
- Build, development startup, and test scripts generate the client first.
  Generation also works without database credentials. The production flow is
  full dependency installation, build, prune dev dependencies, then
  `pnpm start:prod`. The original optional postinstall skills-sync command is
  preserved; it does not require the development ORM CLI in production.
- Build compilation includes only `src`, preserving `dist/main.js` instead of
  compiling root CLI config files into the application. Generated source is
  ignored by Git and ESLint. README and `.env.example` explain setup and commands.
- HTTP e2e tests override `PrismaService` to avoid cloud access. Four new Nest
  tests prove global singleton injection and reject blank, malformed, and
  incompatible connection URLs without creating services directly.

## Verification and next steps

Passed schema validation, client generation, application build, full TypeScript
checking, ESLint, changed-file formatting, five unit tests, six HTTP e2e tests,
and `git diff --check`. A read-only smoke check obtained the actual compiled
service from a Nest application context, successfully ran `SELECT 1`, and counted
zero application tables in the current cloud database schema. It closed its
context and its temporary script was removed. No tables, migrations, cloud data,
deployment, or commit were created.

Initial engine download, package installation, local HTTP sockets, and the cloud
query required approved access outside the sandbox. The working environment is
Node 24.11.1 and pnpm 10.24.0. No background app was left running.

Run `pnpm start:dev` to start development. Add application models to
`prisma/schema.prisma`, then use `pnpm db:migrate --name <name>` and
`pnpm prisma:generate`. Other scripts are `prisma:validate`, `db:pull`,
`db:deploy`, and `db:studio`. Do not provision another database or replace the
existing `.env` when continuing.

## Session continuity

The required `/remember` skill remains unavailable in the configured skill
catalog and searched project/user skill locations. Existing repository notes
provided the restore fallback; this note provides the save fallback. Neither
`/remember restore` nor `/remember save` could be invoked.

The package and lockfile already contained uncommitted Prisma dependencies at
session start. Existing platform skills/config were retained. Untracked
`.claude`, `.cursor`, and `.devin` skill folders were present initially and absent
at completion; no task edit removed them. A read-only check found no Prisma 7
generation cleanup that explains the change. Do not restore unrelated concurrent
state without establishing its ownership.

## Sources

- [Official Prisma 7/8 compatibility guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql)
- [Prisma 7.10 release and version-specific CLI](https://github.com/prisma/orm/releases/tag/7.10.0)
- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma)
