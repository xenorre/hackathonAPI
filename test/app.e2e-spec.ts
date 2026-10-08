import {
  ARCJET,
  ArcjetAllowDecision,
  ArcjetDenyDecision,
  ArcjetErrorDecision,
  ArcjetErrorReason,
  type ArcjetNest,
  ArcjetRateLimitReason,
  ArcjetReason,
  ArcjetShieldReason,
} from '@arcjet/nest';
import { jest } from '@jest/globals';
import {
  Controller,
  Logger,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AppService } from '../src/app.service.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { PrismaService } from '../src/lib/database/prisma.service.js';

@Controller('probe')
class ProbeController {
  @Post()
  @AllowAnonymous()
  post() {
    return 'Protected';
  }
}

describe('Global Arcjet protection (e2e)', () => {
  let app: INestApplication<Server>;
  const protect = jest.fn<ArcjetNest['protect']>();
  const warn = jest.fn();
  let getHello: jest.SpiedFunction<AppService['getHello']>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
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
      .useValue({})
      .overrideProvider(Logger)
      .useValue({ warn })
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.useGlobalInterceptors(app.get(ResponseInterceptor));
    await app.init();
    getHello = jest.spyOn(app.get(AppService), 'getHello');
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the existing route and protects the actual request once', async () => {
    await request(app.getHttpServer())
      .get('/')
      .set('X-Request-Id', 'arcjet-test')
      .expect(200)
      .expect({ statusCode: 200, message: 'Success', data: 'Hello World!' });

    expect(protect).toHaveBeenCalledTimes(1);
    const protectedRequest = protect.mock.calls[0][0];
    expect(protectedRequest.method).toBe('GET');
    expect(protectedRequest.url).toBe('/');
    expect(protectedRequest.headers?.['x-request-id']).toBe('arcjet-test');
    expect(getHello).toHaveBeenCalledTimes(1);
  });

  it('blocks Shield denials before the handler runs', async () => {
    protect.mockResolvedValue(
      new ArcjetDenyDecision({
        ttl: 60,
        results: [],
        reason: new ArcjetShieldReason({ shieldTriggered: true }),
      }),
    );

    await request(app.getHttpServer()).get('/').expect(403);
    expect(getHello).not.toHaveBeenCalled();
  });

  it('returns 429 with a retry delay for rate limit denials', async () => {
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
      .get('/')
      .expect(429)
      .expect('Retry-After', '30');
    expect(getHello).not.toHaveBeenCalled();
  });

  it('logs and allows an Arcjet error decision', async () => {
    protect.mockResolvedValue(
      new ArcjetErrorDecision({
        ttl: 0,
        results: [],
        reason: new ArcjetErrorReason('Security service unavailable'),
      }),
    );

    await request(app.getHttpServer()).get('/').expect(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(getHello).toHaveBeenCalledTimes(1);
  });

  it('logs and allows requests when the SDK rejects unexpectedly', async () => {
    protect.mockRejectedValue(new Error('Network unavailable'));

    await request(app.getHttpServer()).get('/').expect(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(getHello).toHaveBeenCalledTimes(1);
  });

  it('protects a second controller and HTTP method without route decorators', async () => {
    protect.mockResolvedValue(
      new ArcjetDenyDecision({
        ttl: 60,
        results: [],
        reason: new ArcjetShieldReason({ shieldTriggered: true }),
      }),
    );

    await request(app.getHttpServer()).post('/probe').expect(403);
    expect(protect).toHaveBeenCalledTimes(1);
    expect(protect).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: '/probe' }),
    );
  });
});
