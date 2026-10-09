import {
  ARCJET,
  ArcjetAllowDecision,
  type ArcjetNest,
  ArcjetReason,
} from '@arcjet/nest';
import { jest } from '@jest/globals';
import {
  BadRequestException,
  Logger,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
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
import {
  Prisma,
  type Hackathon,
  type HackathonParticipant,
  type User,
} from '../src/generated/prisma/client.js';
import type { AuthInstance } from '../src/lib/auth/auth.config.js';
import { PrismaService } from '../src/lib/database/prisma.service.js';
import { formatValidationErrors } from '../src/utils/formatValidationErrors.js';

describe('Hackathon endpoints (e2e)', () => {
  let app: INestApplication<Server>;
  let getSession: jest.SpiedFunction<AuthInstance['api']['getSession']>;
  const protect = jest.fn<ArcjetNest['protect']>();
  const prisma = {
    hackathon: {
      findMany: jest.fn<() => Promise<Hackathon[]>>(),
      findUnique:
        jest.fn<
          (args: Prisma.HackathonFindUniqueArgs) => Promise<Hackathon | null>
        >(),
      create:
        jest.fn<(args: Prisma.HackathonCreateArgs) => Promise<Hackathon>>(),
      update:
        jest.fn<(args: Prisma.HackathonUpdateArgs) => Promise<Hackathon>>(),
      delete:
        jest.fn<(args: Prisma.HackathonDeleteArgs) => Promise<Hackathon>>(),
    },
    hackathonParticipant: {
      create:
        jest.fn<
          (
            args: Prisma.HackathonParticipantCreateArgs,
          ) => Promise<HackathonParticipant>
        >(),
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
  const startAt = new Date(Date.now() + 86_400_000);
  const endsAt = new Date(Date.now() + 172_800_000);
  const hackathon: Hackathon = {
    id: 'hackathon-id',
    name: 'Build weekend',
    description: 'A weekend for building useful things.',
    startDate: startAt,
    endDate: endsAt,
    isActive: true,
    authorId: admin.id,
    createdAt,
    updatedAt: createdAt,
  };
  const validInput = {
    name: hackathon.name,
    description: hackathon.description,
    startAt: startAt.toISOString(),
    endsAt: endsAt.toISOString(),
    isActive: true,
  };
  const participation: HackathonParticipant = {
    id: 'participation-id',
    hackathonId: hackathon.id,
    userId: participant.id,
    joinedAt: createdAt,
  };

  function authenticate(user: User) {
    const session: UserSession<AuthInstance> = {
      user,
      session: {
        id: 'session-id',
        token: 'session-token',
        userId: user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt,
        updatedAt: createdAt,
        ipAddress: null,
        userAgent: null,
      },
    };
    getSession.mockResolvedValue(session);
  }

  function serializedHackathon(row: Hackathon) {
    return {
      ...row,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  function expectNoDatabaseCalls() {
    for (const delegate of Object.values(prisma)) {
      for (const operation of Object.values(delegate)) {
        expect(operation).not.toHaveBeenCalled();
      }
    }
  }

  function expectValidationErrors(body: unknown, properties: string[]) {
    expect(body).toEqual(
      expect.objectContaining({ statusCode: 400, error: 'Bad Request' }),
    );
    const { message: errors } = body as {
      message: { property: string; message: string }[];
    };
    expect(Array.isArray(errors)).toBe(true);
    for (const property of properties) {
      expect(errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ property })]),
      );
    }
    for (const error of errors) {
      expect(Object.keys(error).sort()).toEqual(['message', 'property']);
      expect(typeof error.message).toBe('string');
    }
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
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
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        exceptionFactory: (errors) =>
          new BadRequestException(formatValidationErrors(errors)),
      }),
    );
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
    prisma.hackathon.findMany.mockReset().mockResolvedValue([]);
    prisma.hackathon.findUnique.mockReset().mockResolvedValue(null);
    prisma.hackathon.create.mockReset().mockResolvedValue(hackathon);
    prisma.hackathon.update.mockReset().mockResolvedValue(hackathon);
    prisma.hackathon.delete.mockReset().mockResolvedValue(hackathon);
    prisma.hackathonParticipant.create
      .mockReset()
      .mockResolvedValue(participation);
  });

  afterAll(async () => {
    getSession.mockRestore();
    await app.close();
  });

  it.each([
    ['get', '/hackathon'],
    ['get', '/hackathon/hackathon-id'],
    ['post', '/hackathon'],
    ['patch', '/hackathon/hackathon-id'],
    ['delete', '/hackathon/hackathon-id'],
  ] as const)(
    'rejects unauthenticated %s %s before database access',
    async (method, path) => {
      await request(app.getHttpServer())
        [method](path)
        .send(validInput)
        .expect(401);

      expectNoDatabaseCalls();
    },
  );

  it.each([
    ['post', '/hackathon'],
    ['patch', '/hackathon/hackathon-id'],
    ['delete', '/hackathon/hackathon-id'],
  ] as const)(
    'rejects a participant calling %s %s before database access',
    async (method, path) => {
      authenticate(participant);

      await request(app.getHttpServer())
        [method](path)
        .send(validInput)
        .expect(403);

      expectNoDatabaseCalls();
    },
  );

  it.each([participant, admin])(
    'lists active and inactive hackathons for a $role session',
    async (user) => {
      authenticate(user);
      const inactive = { ...hackathon, id: 'inactive-id', isActive: false };
      prisma.hackathon.findMany.mockResolvedValue([hackathon, inactive]);

      await request(app.getHttpServer())
        .get('/hackathon')
        .expect(200)
        .expect({
          statusCode: 200,
          message: 'Success',
          data: [serializedHackathon(hackathon), serializedHackathon(inactive)],
        });

      expect(prisma.hackathon.findMany).toHaveBeenCalledWith();
      expect(prisma.hackathon.findUnique).not.toHaveBeenCalled();
    },
  );

  it('returns an empty list when no hackathons exist', async () => {
    authenticate(participant);

    await request(app.getHttpServer())
      .get('/hackathon')
      .expect(200)
      .expect({ statusCode: 200, message: 'Success', data: [] });
  });

  it.each([participant, admin])(
    'returns a hackathon by route ID for a $role session',
    async (user) => {
      authenticate(user);
      prisma.hackathon.findUnique.mockResolvedValue(hackathon);

      await request(app.getHttpServer())
        .get(`/hackathon/${hackathon.id}`)
        .expect(200)
        .expect({
          statusCode: 200,
          message: 'Success',
          data: serializedHackathon(hackathon),
        });

      expect(prisma.hackathon.findUnique).toHaveBeenCalledWith({
        where: { id: hackathon.id },
      });
    },
  );

  it('creates a hackathon with transformed dates and the session author', async () => {
    authenticate(admin);
    const created = { ...hackathon, isActive: false };
    prisma.hackathon.create.mockResolvedValue(created);

    await request(app.getHttpServer())
      .post('/hackathon')
      .send({
        ...validInput,
        isActive: false,
        id: 'spoofed-id',
        authorId: 'spoofed-author',
        author: { connect: { id: 'spoofed-author' } },
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
        startDate: '2000-01-01T00:00:00.000Z',
        endDate: '2000-01-01T00:00:00.000Z',
      })
      .expect(201)
      .expect({
        statusCode: 201,
        message: 'Hackathon created successfully',
        data: serializedHackathon(created),
      });

    expect(prisma.hackathon.create).toHaveBeenCalledWith({
      data: {
        name: validInput.name,
        description: validInput.description,
        startDate: startAt,
        endDate: endsAt,
        isActive: false,
        authorId: admin.id,
      },
    });
  });

  it('allows creation without optional fields and ignores null isActive', async () => {
    authenticate(admin);

    await request(app.getHttpServer())
      .post('/hackathon')
      .send({
        name: validInput.name,
        startAt: validInput.startAt,
        endsAt: validInput.endsAt,
        isActive: null,
      })
      .expect(201);

    expect(prisma.hackathon.create).toHaveBeenCalledWith({
      data: {
        name: validInput.name,
        startDate: startAt,
        endDate: endsAt,
        authorId: admin.id,
      },
    });
  });

  it('partially updates a hackathon while preserving omitted and server fields', async () => {
    authenticate(admin);
    const updated = { ...hackathon, name: 'Updated weekend' };
    prisma.hackathon.update.mockResolvedValue(updated);

    await request(app.getHttpServer())
      .patch(`/hackathon/${hackathon.id}`)
      .send({
        name: updated.name,
        id: 'spoofed-id',
        authorId: 'spoofed-author',
        author: { connect: { id: 'spoofed-author' } },
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
      })
      .expect(200)
      .expect({
        statusCode: 200,
        message: 'Hackathon updated successfully',
        data: serializedHackathon(updated),
      });

    expect(prisma.hackathon.update).toHaveBeenCalledWith({
      where: { id: hackathon.id },
      data: { name: updated.name },
    });
    expect(prisma.hackathon.findUnique).not.toHaveBeenCalled();
  });

  it('transforms supplied update dates and maps the active flag', async () => {
    authenticate(admin);

    await request(app.getHttpServer())
      .patch(`/hackathon/${hackathon.id}`)
      .send({
        startAt: validInput.startAt,
        endsAt: validInput.endsAt,
        isActive: false,
      })
      .expect(200);

    expect(prisma.hackathon.update).toHaveBeenCalledWith({
      where: { id: hackathon.id },
      data: { startDate: startAt, endDate: endsAt, isActive: false },
    });
  });

  it('clears the nullable description and treats null isActive as omitted', async () => {
    authenticate(admin);
    const updated = { ...hackathon, description: null };
    prisma.hackathon.update.mockResolvedValue(updated);

    await request(app.getHttpServer())
      .patch(`/hackathon/${hackathon.id}`)
      .send({ description: null, isActive: null })
      .expect(200)
      .expect({
        statusCode: 200,
        message: 'Hackathon updated successfully',
        data: serializedHackathon(updated),
      });

    expect(prisma.hackathon.update).toHaveBeenCalledWith({
      where: { id: hackathon.id },
      data: { description: null },
    });
  });

  it('deletes a hackathon and returns the deleted row', async () => {
    authenticate(admin);

    await request(app.getHttpServer())
      .delete(`/hackathon/${hackathon.id}`)
      .expect(200)
      .expect({
        statusCode: 200,
        message: 'Hackathon deleted successfully',
        data: serializedHackathon(hackathon),
      });

    expect(prisma.hackathon.delete).toHaveBeenCalledWith({
      where: { id: hackathon.id },
    });
    expect(prisma.hackathon.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['name', 'ab'],
    ['description', 'too short'],
    ['description', 'x'.repeat(1001)],
    ['startAt', 'invalid-date'],
    ['startAt', '2000-01-01T00:00:00.000Z'],
    ['endsAt', '2000-01-01T00:00:00.000Z'],
    ['isActive', 'true'],
  ])('rejects invalid create field %s (%s)', async (property, value) => {
    authenticate(admin);

    const response = await request(app.getHttpServer())
      .post('/hackathon')
      .send({ ...validInput, [property]: value })
      .expect(400);

    expectValidationErrors(response.body, [property]);
    expectNoDatabaseCalls();
  });

  it('rejects creation without required fields', async () => {
    authenticate(admin);

    const response = await request(app.getHttpServer())
      .post('/hackathon')
      .send({})
      .expect(400);

    expectValidationErrors(response.body, ['name', 'startAt', 'endsAt']);
    expectNoDatabaseCalls();
  });

  it.each([
    ['name', null],
    ['startAt', null],
    ['endsAt', null],
    ['name', 'ab'],
    ['description', 'short'],
    ['isActive', 'false'],
    ['startAt', '2000-01-01T00:00:00.000Z'],
  ])('rejects invalid update field %s (%s)', async (property, value) => {
    authenticate(admin);

    const response = await request(app.getHttpServer())
      .patch(`/hackathon/${hackathon.id}`)
      .send({ [property]: value })
      .expect(400);

    expectValidationErrors(response.body, [property]);
    expectNoDatabaseCalls();
  });

  it('returns 404 when a requested hackathon does not exist', async () => {
    authenticate(participant);

    const response = await request(app.getHttpServer())
      .get('/hackathon/missing-id')
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
    );
    expect(prisma.hackathon.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-id' },
    });
  });

  it.each(['patch', 'delete'] as const)(
    'returns 404 for a missing row during %s without an existence check',
    async (method) => {
      authenticate(admin);
      const error = new Prisma.PrismaClientKnownRequestError('Missing record', {
        code: 'P2025',
        clientVersion: '7.10.0',
      });
      prisma.hackathon.update.mockRejectedValue(error);
      prisma.hackathon.delete.mockRejectedValue(error);

      const response = await request(app.getHttpServer())
        [method]('/hackathon/missing-id')
        .send({ name: 'Updated weekend' })
        .expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
      );
      expect(prisma.hackathon.findUnique).not.toHaveBeenCalled();
      const mutation =
        method === 'patch' ? prisma.hackathon.update : prisma.hackathon.delete;
      expect(mutation).toHaveBeenCalledTimes(1);
    },
  );

  describe('joining a hackathon', () => {
    it('rejects unauthenticated requests before database access', async () => {
      await request(app.getHttpServer())
        .post(`/hackathon/${hackathon.id}/join`)
        .expect(401);

      expectNoDatabaseCalls();
    });

    it('rejects an administrator before database access', async () => {
      authenticate(admin);

      await request(app.getHttpServer())
        .post(`/hackathon/${hackathon.id}/join`)
        .expect(403);

      expectNoDatabaseCalls();
    });

    it.each([
      { label: 'without a request body', body: undefined },
      {
        label: 'ignoring spoofed identifiers in the request body',
        body: { userId: 'spoofed-user', hackathonId: 'spoofed-hackathon' },
      },
    ])('joins as the signed in participant $label', async ({ body }) => {
      authenticate(participant);
      prisma.hackathon.findUnique.mockResolvedValue(hackathon);

      await request(app.getHttpServer())
        .post(`/hackathon/${hackathon.id}/join`)
        .send(body)
        .expect(201)
        .expect({
          statusCode: 201,
          message: 'Hackathon joined successfully',
          data: {
            ...participation,
            joinedAt: participation.joinedAt.toISOString(),
          },
        });

      expect(prisma.hackathon.findUnique).toHaveBeenCalledWith({
        where: { id: hackathon.id },
      });
      expect(prisma.hackathon.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.hackathonParticipant.create).toHaveBeenCalledWith({
        data: { hackathonId: hackathon.id, userId: participant.id },
      });
      expect(prisma.hackathonParticipant.create).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for a missing hackathon without creating participation', async () => {
      authenticate(participant);

      await request(app.getHttpServer())
        .post('/hackathon/missing-id/join')
        .expect(404)
        .expect({
          statusCode: 404,
          error: 'Not Found',
          message: 'Hackathon with ID "missing-id" not found',
        });

      expect(prisma.hackathon.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing-id' },
      });
      expect(prisma.hackathonParticipant.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive hackathon without creating participation', async () => {
      authenticate(participant);
      prisma.hackathon.findUnique.mockResolvedValue({
        ...hackathon,
        isActive: false,
      });

      await request(app.getHttpServer())
        .post(`/hackathon/${hackathon.id}/join`)
        .expect(400)
        .expect({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Hackathon is not active',
        });

      expect(prisma.hackathonParticipant.create).not.toHaveBeenCalled();
    });

    it('rejects an ended hackathon without creating participation', async () => {
      authenticate(participant);
      prisma.hackathon.findUnique.mockResolvedValue({
        ...hackathon,
        endDate: new Date(Date.now() - 1),
      });

      await request(app.getHttpServer())
        .post(`/hackathon/${hackathon.id}/join`)
        .expect(400)
        .expect({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Hackathon has already ended',
        });

      expect(prisma.hackathonParticipant.create).not.toHaveBeenCalled();
    });

    it('returns 400 for duplicate participation directly from the unique constraint', async () => {
      authenticate(participant);
      prisma.hackathon.findUnique.mockResolvedValue(hackathon);
      prisma.hackathonParticipant.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Duplicate participation', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );

      await request(app.getHttpServer())
        .post(`/hackathon/${hackathon.id}/join`)
        .expect(400)
        .expect({
          statusCode: 400,
          error: 'Bad Request',
          message: 'You have already joined this hackathon',
        });

      expect(prisma.hackathon.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.hackathonParticipant.create).toHaveBeenCalledTimes(1);
      expect(prisma.hackathonParticipant.create).toHaveBeenCalledWith({
        data: { hackathonId: hackathon.id, userId: participant.id },
      });
    });
  });
});
