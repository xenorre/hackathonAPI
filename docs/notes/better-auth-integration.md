# Better Auth integration

Implemented on 2026-10-06 with Better Auth 1.7.7 and
`@thallesp/nestjs-better-auth` 2.8.0, using NestJS 11 and Prisma Client 7.10.0.

The Nest integration uses its async module factory so Nest injects the existing
database service. The local global auth module and service follow the project's
infrastructure pattern. Auth routes use the integration's handler at
`/api/auth`; `GET /users/me` uses its session decorator and default global guard.

The shared options in `src/lib/auth/auth.config.ts` enable email and password
and add a server controlled role. `input: false` prevents client role assignment
through sign up and user updates. The database adds a nonnullable `UserRole`
enum with `PARTICIPANT` and `ADMIN`, defaulting to `PARTICIPANT`.

The CLI configuration in `src/lib/auth/auth.schema.ts` imports the same options
without instantiating a database client. To regenerate the base auth models:

```bash
pnpm dlx auth@1.7.7 generate --config src/lib/auth/auth.schema.ts --adapter prisma --dialect postgresql --output /tmp/better-auth-schema.prisma --yes
```

Review and merge that output into `prisma/schema.prisma`, preserving the ESM
client generator and the custom `UserRole` enum and default. The CLI emits the
additional role field as a nullable string, so its output should not replace
the project's schema directly. Use `pnpm db:migrate --name describe_your_change`
for later schema changes, followed by `pnpm prisma:generate`.

The initial target database was confirmed empty. The initial migration was
generated with `prisma7 migrate diff --from-empty --to-schema prisma/schema.prisma
--script`. It adds four tables, the role enum, indexes, and foreign keys. Apply
committed migrations with `pnpm db:deploy`; no database reset is needed.

Migration `20261006000000_add_better_auth` was applied to the configured database,
and Prisma Client was regenerated afterward. Build and lint checks passed, along
with five unit tests and eighteen HTTP integration tests. A check against the
live database confirmed the four tables, role enum and default, registration
with a rejected ADMIN choice, sign in, protected profile access, server assigned
ADMIN roles, blocked client role updates, origin checks, and session revocation.
The temporary verification account and its related records were removed.

Arcjet protection is shared by the existing controller guard and auth
middleware. Auth endpoints are handled outside the Nest controller pipeline,
so the integration's middleware option runs Arcjet before its handler. Shield
denials return 403, and rate limit denials return 429 with `Retry-After`. Arcjet
errors retain the existing behavior of logging a warning and allowing the
request. Body parsing follows the integration guide, with Nest's parser disabled
and the integration parsing requests outside the auth path.

## References

- [Better Auth NestJS integration](https://better-auth.com/docs/integrations/nestjs)
- [Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Additional user fields](https://better-auth.com/docs/concepts/database#extending-core-schema)
- [CLI generation without a database connection](https://better-auth.com/docs/concepts/cli#generate-without-a-database-connection)
- [Nest integration module and middleware](https://github.com/ThallesP/nestjs-better-auth/blob/master/src/auth-module.ts)
