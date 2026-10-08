import {
  ARCJET,
  ArcjetAllowDecision,
  type ArcjetNest,
  ArcjetReason,
} from '@arcjet/nest';
import { jest } from '@jest/globals';
import { Logger, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AuthService as BetterAuthService,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import type { User } from '../src/generated/prisma/client.js';
import type { AuthInstance } from '../src/lib/auth/auth.config.js';
import { PrismaService } from '../src/lib/database/prisma.service.js';

describe('User endpoints (e2e)', () => {
  let app: INestApplication<Server>;
  let getSession: jest.SpiedFunction<AuthInstance['api']['getSession']>;
  const protect = jest.fn<ArcjetNest['protect']>();
  const prisma = {
    user: {
      findMany: jest.fn<() => Promise<User[]>>(),
      findUnique:
        jest.fn<(args: { where: { id: string } }) => Promise<User | null>>(),
    },
  };
  const createdAt = new Date('2026-10-01T12:00:00.000Z');
  const participant: User = {
    id: 'participant-id',
    name: 'Participant',
    email: 'participant@example.com',
    emailVerified: true,
    image: null,
    createdAt,
    updatedAt: createdAt,
    role: 'PARTICIPANT',
  };
  const admin: User = {
    ...participant,
    id: 'admin-id',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  function authenticate(user: User) {
    const session: UserSession<AuthInstance> = {
      user,
      session: {
        id: 'session-id',
        token: 'session-token',
        userId: user.id,
        expiresAt: new Date('2026-11-01T12:00:00.000Z'),
        createdAt,
        updatedAt: createdAt,
        ipAddress: null,
        userAgent: null,
      },
    };
    getSession.mockResolvedValue(session);
  }

  function serializedUser(user: User) {
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: (key: string) =>
          ({
            ARCJET_KEY: 'ajkey_test',
            BETTER_AUTH_SECRET: 'test_secret_with_at_least_32_characters',
            BETTER_AUTH_URL: 'http://localhost:3000',
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
    app.useGlobalInterceptors(app.get(ResponseInterceptor));
    await app.init();
    getSession = jest.spyOn(
      app.get<BetterAuthService<AuthInstance>>(BetterAuthService).api,
      'getSession',
    );
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
    getSession.mockReset().mockResolvedValue(null);
    prisma.user.findMany.mockReset().mockResolvedValue([]);
    prisma.user.findUnique.mockReset().mockResolvedValue(null);
  });

  afterAll(async () => {
    getSession.mockRestore();
    await app.close();
  });

  it.each(['/user/all', '/user/participant-id'])(
    'rejects unauthenticated access to %s before querying users',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects a participant listing users before querying the database', async () => {
    authenticate(participant);

    await request(app.getHttpServer()).get('/user/all').expect(403);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns all users for an administrator and treats all as a static route', async () => {
    authenticate(admin);
    prisma.user.findMany.mockResolvedValue([participant, admin]);

    await request(app.getHttpServer())
      .get('/user/all')
      .expect(200)
      .expect({
        statusCode: 200,
        message: 'Success',
        data: [serializedUser(participant), serializedUser(admin)],
      });

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns an empty list when an administrator lists an empty database', async () => {
    authenticate(admin);

    await request(app.getHttpServer())
      .get('/user/all')
      .expect(200)
      .expect({ statusCode: 200, message: 'Success', data: [] });
  });

  it.each([participant, admin])(
    'returns a user by ID for a $role session',
    async (currentUser) => {
      authenticate(currentUser);
      prisma.user.findUnique.mockResolvedValue(participant);

      await request(app.getHttpServer())
        .get(`/user/${participant.id}`)
        .expect(200)
        .expect({
          statusCode: 200,
          message: 'Success',
          data: serializedUser(participant),
        });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: participant.id },
      });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );

  it('returns a Nest 404 response when the requested user does not exist', async () => {
    authenticate(participant);

    const response = await request(app.getHttpServer())
      .get('/user/missing-id')
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-id' },
    });
  });
});
