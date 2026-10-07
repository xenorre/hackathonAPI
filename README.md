<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Prisma and Prisma Postgres

Set `DATABASE_URL` in `.env` to the `postgres://` or `postgresql://` connection
string from your Prisma cloud database. Keep credentials in the ignored `.env`;
`.env.example` contains only a placeholder.

This project uses Prisma ORM 7.10 through `@prisma/prisma7`, alongside the Prisma 8
CLI already installed for platform commands and skill synchronization. ORM
commands use the `prisma7` binary and `prisma7.config.ts`. The existing
`prisma.config.ts` belongs to Prisma 8. Running `pnpm exec prisma generate` with
that CLI fails because it does not provide the Prisma 7 `generate` command.
See the [official compatibility guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql).

```bash
# Validate the schema and regenerate the ESM TypeScript client
$ pnpm prisma:validate
$ pnpm prisma:generate

# If the database already has application tables, import their schema first
$ pnpm db:pull
$ pnpm prisma:generate

# After adding or changing models in prisma/schema.prisma
$ pnpm db:migrate --name describe_your_change
$ pnpm prisma:generate

# Apply committed migrations in a deployment
$ pnpm db:deploy

# Browse the database
$ pnpm db:studio
```

The schema includes Better Auth's user, session, account, and verification
models, plus a `UserRole` enum. Apply committed migrations with `pnpm db:deploy`
on a fresh database. `pnpm build`, development startup, and the test scripts
generate the client into `src/generated/prisma`, which is ignored by Git.
Client generation works without a database URL; starting the app and database
commands require one. For production, install development
dependencies, build, then prune them and start the compiled application with
`pnpm start:prod`.

`PrismaModule` is global and imported once in `AppModule`. Inject `PrismaService`
into feature services; Nest owns the single client and its lifecycle:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service.js';

@Injectable()
export class ExampleService {
  constructor(private readonly prisma: PrismaService) {}
}
```

Use the generated model delegates on `this.prisma` after adding models and
regenerating. The service reads the connection URL through `ConfigService`,
uses the PostgreSQL adapter, and disconnects on application shutdown. HTTP e2e
tests override the provider so they do not access the cloud database.

## Better Auth

Email and password authentication uses Better Auth 1.7.7 and the community
NestJS integration, `@thallesp/nestjs-better-auth` 2.8.0. The global `AuthModule`
lives in `src/lib/auth` and is imported once in `AppModule`. Its async factory
receives the existing `PrismaService` and `ConfigService` through Nest injection.
Feature services can inject the local `AuthService` to read sessions.

Set `BETTER_AUTH_SECRET` to a random value of at least 32 characters and set
`BETTER_AUTH_URL` to the auth server's URL. Both are required at startup. Generate
a secret with `openssl rand -base64 32` and keep it in the ignored `.env`.
If your frontend has a different origin, list it in
`BETTER_AUTH_TRUSTED_ORIGINS`, separated by commas. Better Auth also trusts its
own server origin. Origin and CSRF checks remain enabled.

| Method | Endpoint                  | Purpose                                             |
| ------ | ------------------------- | --------------------------------------------------- |
| GET    | `/api/auth/ok`            | Auth health check                                   |
| POST   | `/api/auth/sign-up/email` | Register with `name`, `email`, and `password`       |
| POST   | `/api/auth/sign-in/email` | Sign in with `email` and `password`                 |
| GET    | `/api/auth/get-session`   | Read the current cookie session                     |
| POST   | `/api/auth/sign-out`      | Revoke the current session                          |
| GET    | `/users/me`               | Return the authenticated user, including their role |

Sessions are stored in PostgreSQL and use Better Auth's default lifetime of
seven days. Browser clients should send cookies with authenticated requests.
The Nest integration's auth guard protects controller routes by default. Use
its `@AllowAnonymous()` or `@OptionalAuth()` decorators when needed. The existing
`GET /` greeting remains public.

`User.role` is required and restricted by the database enum to `PARTICIPANT` or
`ADMIN`, defaulting to `PARTICIPANT`. Better Auth also defaults the field to
`PARTICIPANT` and sets `input: false`. Sending `role: "ADMIN"` during sign up is
ignored, and changing the role through `/api/auth/update-user` is rejected.
ADMIN roles must be assigned through trusted server code or database
administration. No public role assignment endpoint is exposed.

Bootstrap sets `bodyParser: false`, as required by the NestJS integration guide.
The integration handles auth request bodies and registers parsing for normal
Nest controller routes. Auth endpoints run as middleware, so they use an
injected Arcjet middleware check before the Better Auth handler. The existing
Arcjet guard continues to protect Nest controller routes.

See [integration notes](docs/notes/better-auth-integration.md) for schema
generation and source references. Email verification and password reset mail
are not configured in this initial integration.

## Compile and run the project

Arcjet protects every registered HTTP route with Shield and a fixed window limit
of 100 requests per 60 seconds per client IP. Both rules enforce in `LIVE` mode.
Configuration is in `src/lib/arcjet/arcjet.module.ts`, and the global guard is
registered in `AppModule`.

The installed integrations require ESM and Node.js 22.22.1 or later in the 22
series, or Node.js 24.5 or later. This project uses ESM for both the application
and Jest tests.

For a fresh checkout, copy `.env.example` to `.env` and set `ARCJET_KEY` to the
key for your Arcjet site. The local `.env` is ignored by Git. Use
`ARCJET_ENV=development` for localhost, and set it to `production` when deployed.
The application refuses to start without a nonempty key.

Shield denials return HTTP 403. Rate limit denials return HTTP 429 with a
`Retry-After` header. If Arcjet returns an error or request protection fails, the
guard logs a warning and allows the request. Configure trusted proxy addresses
in the SDK options if deployment uses a reverse proxy or load balancer.

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
