import {
  ARCJET,
  ArcjetAllowDecision,
  ArcjetDenyDecision,
  type ArcjetNest,
  ArcjetRateLimitReason,
  ArcjetReason,
  ArcjetShieldReason,
} from '@arcjet/nest';
import { jest } from '@jest/globals';
import {
  Body,
  Controller,
  Logger,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/lib/database/prisma.service.js';

@Controller('body-probe')
class BodyProbeController {
  @Post()
  @AllowAnonymous()
  post(@Body() body: { message: string }) {
    return body;
  }
}

type Row = Record<string, unknown>;
const createRow = () =>
  jest
    .fn<(args: { data: Row }) => Promise<Row>>()
    .mockImplementation(({ data }) => Promise.resolve(data));

describe('Better Auth integration (e2e)', () => {
  let app: INestApplication<Server>;
  const protect = jest.fn<ArcjetNest['protect']>();
  const prisma = {
    user: {
      findFirst: jest.fn<() => Promise<Row | null>>(),
      create: createRow(),
      update: createRow(),
    },
    account: {
      findMany: jest.fn<() => Promise<Row[]>>(),
      create: createRow(),
    },
    session: {
      findFirst: jest.fn<() => Promise<Row | null>>(),
      findMany: jest.fn<() => Promise<Row[]>>(),
      create: createRow(),
      deleteMany: jest.fn<() => Promise<{ count: number }>>(),
    },
  };
  const origin = 'http://localhost:3000';
  const signupBody = {
    name: 'Participant',
    email: 'participant@example.com',
    password: 'a_secure_test_password_123',
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [BodyProbeController],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: (key: string) =>
          ({
            ARCJET_KEY: 'ajkey_test',
            BETTER_AUTH_SECRET: 'test_secret_with_at_least_32_characters',
            BETTER_AUTH_URL: origin,
          })[key],
        get: (_key: string, defaultValue: unknown) => defaultValue,
      })
      .overrideProvider(ARCJET)
      .useValue({ protect })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(Logger)
      .useValue({ warn: jest.fn() })
      .compile();

    app = fixture.createNestApplication({ bodyParser: false });
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    protect.mockReset().mockResolvedValue(
      new ArcjetAllowDecision({
        ttl: 0,
        results: [],
        reason: new ArcjetReason(),
      }),
    );
    prisma.user.findFirst.mockReset().mockResolvedValue(null);
    prisma.account.findMany.mockReset().mockResolvedValue([]);
    prisma.session.findFirst.mockReset().mockResolvedValue(null);
    prisma.session.findMany.mockReset().mockResolvedValue([]);
    prisma.session.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function signup(extra: Row = {}) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({ ...signupBody, ...extra })
      .expect(200);
  }

  function loadCreatedSession() {
    prisma.user.findFirst.mockResolvedValue(
      prisma.user.create.mock.calls[0][0].data,
    );
    prisma.account.findMany.mockResolvedValue([
      prisma.account.create.mock.calls[0][0].data,
    ]);
    prisma.session.findFirst.mockResolvedValue(
      prisma.session.create.mock.calls.at(-1)![0].data,
    );
    prisma.session.findMany.mockResolvedValue([
      prisma.session.create.mock.calls.at(-1)![0].data,
    ]);
  }

  it.each([undefined, 'ADMIN', 'UNKNOWN'])(
    'creates a PARTICIPANT even when signup sends role %s',
    async (role) => {
      const response = await signup(role === undefined ? {} : { role });

      expect((response.body as { user: { role: string } }).user.role).toBe(
        'PARTICIPANT',
      );
      expect(prisma.user.create.mock.calls[0][0].data.role).toBe('PARTICIPANT');
      expect(protect).toHaveBeenCalledTimes(1);
      expect(prisma.account.create.mock.calls[0][0].data.password).not.toBe(
        signupBody.password,
      );
    },
  );

  it('signs in, exposes the role through a protected route, and revokes the session', async () => {
    await signup();
    loadCreatedSession();
    const signedIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({ email: signupBody.email, password: signupBody.password })
      .expect(200);
    loadCreatedSession();
    const cookies = (signedIn.headers['set-cookie'] as unknown as string[]).map(
      (cookie) => cookie.split(';')[0],
    );

    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookies)
      .expect(200);
    expect((profile.body as { user: { role: string } }).user.role).toBe(
      'PARTICIPANT',
    );

    await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Origin', origin)
      .set('Cookie', cookies)
      .expect(200);
    expect(prisma.session.deleteMany).toHaveBeenCalledTimes(1);
    prisma.session.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookies)
      .expect(401);
  });

  it('rejects unauthenticated access to the profile', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('rejects an incorrect password', async () => {
    await signup();
    loadCreatedSession();
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({ email: signupBody.email, password: 'incorrect_password' })
      .expect(401);
  });

  it('rejects attempts to change the role through the user update endpoint', async () => {
    const signedUp = await signup();
    loadCreatedSession();
    await request(app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Origin', origin)
      .set('Cookie', signedUp.headers['set-cookie'] as unknown as string[])
      .send({ role: 'ADMIN' })
      .expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('retains body parsing for normal Nest controllers', async () => {
    await request(app.getHttpServer())
      .post('/body-probe')
      .send({ message: 'parsed' })
      .expect(201)
      .expect({ message: 'parsed' });
  });

  it('rejects an untrusted origin on a signup request with cookies', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'https://untrusted.example')
      .set('Cookie', 'better-auth.session_token=untrusted')
      .send(signupBody)
      .expect(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('serves the auth health check without a session', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/ok')
      .expect(200)
      .expect({ ok: true });
    expect(protect).toHaveBeenCalledTimes(1);
  });

  it('applies Arcjet Shield to the auth middleware endpoints', async () => {
    protect.mockResolvedValue(
      new ArcjetDenyDecision({
        ttl: 60,
        results: [],
        reason: new ArcjetShieldReason({ shieldTriggered: true }),
      }),
    );
    await request(app.getHttpServer()).get('/api/auth/ok').expect(403);
    expect(protect).toHaveBeenCalledTimes(1);
  });

  it('rate limits auth endpoints with a retry delay', async () => {
    protect.mockResolvedValue(
      new ArcjetDenyDecision({
        ttl: 30,
        results: [],
        reason: new ArcjetRateLimitReason({
          max: 100,
          remaining: 0,
          reset: 30,
          window: 60,
        }),
      }),
    );
    await request(app.getHttpServer())
      .get('/api/auth/ok')
      .expect(429)
      .expect('Retry-After', '30');
    expect(protect).toHaveBeenCalledTimes(1);
  });
});
