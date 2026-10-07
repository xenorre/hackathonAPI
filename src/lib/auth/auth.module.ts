import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { ArcjetMiddleware } from '../../common/middleware/arcjet.middleware.js';
import { PrismaService } from '../database/prisma.service.js';
import { createAuth } from './auth.config.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      inject: [PrismaService, ConfigService, ArcjetMiddleware],
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
        arcjet: ArcjetMiddleware,
      ) => ({
        auth: createAuth(prisma, config),
        middleware: (req: Request, res: Response, next: () => void) =>
          arcjet.use(req, res, next),
      }),
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
