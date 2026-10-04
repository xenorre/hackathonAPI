import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArcjetGuard } from './common/guards/arcjet.guard.js';
import { ArcjetModule } from './lib/arcjet/arcjet.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ArcjetModule],
  controllers: [AppController],
  providers: [
    AppService,
    Logger,
    { provide: APP_GUARD, useClass: ArcjetGuard },
  ],
})
export class AppModule {}
