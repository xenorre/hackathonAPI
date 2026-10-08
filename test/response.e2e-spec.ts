import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type INestApplication,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { ResponseMessage } from '../src/common/decorators/response-message.decorator.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

@Controller('response')
class ResponseController {
  @Get()
  get() {
    return { id: 'example' };
  }

  @Post()
  @ResponseMessage('Created successfully')
  create() {
    return { id: 'created' };
  }

  @Post('accepted')
  @HttpCode(HttpStatus.ACCEPTED)
  accepted() {
    return 'queued';
  }

  @Get('value/:value')
  value(@Param('value') value: string) {
    const values: Record<string, unknown> = {
      false: false,
      zero: 0,
      empty: '',
      null: null,
      undefined: undefined,
    };
    return values[value];
  }

  @Get('error')
  error() {
    throw new NotFoundException('Resource not found');
  }
}

@Controller('messages')
@ResponseMessage('Controller message')
class MessageController {
  @Get()
  get() {
    return 'inherited';
  }

  @Get('custom')
  @ResponseMessage('Method message')
  custom() {
    return 'overridden';
  }
}

describe('Global response interceptor (e2e)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [ResponseController, MessageController],
      providers: [ResponseInterceptor],
    }).compile();

    app = fixture.createNestApplication();
    app.useGlobalInterceptors(app.get(ResponseInterceptor));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps a GET response with the default message', async () => {
    await request(app.getHttpServer())
      .get('/response')
      .expect(200)
      .expect({
        statusCode: 200,
        message: 'Success',
        data: { id: 'example' },
      });
  });

  it('preserves POST status and uses the custom message', async () => {
    await request(app.getHttpServer())
      .post('/response')
      .expect(201)
      .expect({
        statusCode: 201,
        message: 'Created successfully',
        data: { id: 'created' },
      });
  });

  it('preserves a status set with HttpCode', async () => {
    await request(app.getHttpServer())
      .post('/response/accepted')
      .expect(202)
      .expect({ statusCode: 202, message: 'Success', data: 'queued' });
  });

  it.each([
    ['/messages', 'Controller message', 'inherited'],
    ['/messages/custom', 'Method message', 'overridden'],
  ])('resolves message metadata for %s', async (path, message, data) => {
    await request(app.getHttpServer())
      .get(path)
      .expect(200)
      .expect({ statusCode: 200, message, data });
  });

  it.each([
    ['false', false],
    ['zero', 0],
    ['empty', ''],
    ['null', null],
    ['undefined', null],
  ])('keeps the data field for %s payloads', async (value, data) => {
    await request(app.getHttpServer())
      .get(`/response/value/${value}`)
      .expect(200)
      .expect({ statusCode: 200, message: 'Success', data });
  });

  it('preserves Nest exception responses', async () => {
    await request(app.getHttpServer())
      .get('/response/error')
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Resource not found',
        error: 'Not Found',
      });
  });
});
