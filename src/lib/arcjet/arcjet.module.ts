import {
  ArcjetModule as ArcjetSdkModule,
  fixedWindow,
  shield,
} from '@arcjet/nest';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArcjetMiddleware } from '../../common/middleware/arcjet.middleware.js';
import { ArcjetService } from './arcjet.service.js';

@Global()
@Module({
  imports: [
    ArcjetSdkModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const key = config.getOrThrow<string>('ARCJET_KEY').trim();
        if (!key) {
          throw new Error('ARCJET_KEY must not be empty');
        }

        return {
          key,
          characteristics: ['ip.src'],
          rules: [
            shield({ mode: 'LIVE' }),
            fixedWindow({ mode: 'LIVE', window: '60s', max: 100 }),
          ],
        };
      },
    }),
  ],
  providers: [ArcjetService, ArcjetMiddleware, Logger],
  exports: [ArcjetService, ArcjetMiddleware],
})
export class ArcjetModule {}
