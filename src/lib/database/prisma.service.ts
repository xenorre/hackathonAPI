import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL').trim();
    if (!connectionString) {
      throw new Error('DATABASE_URL must not be empty');
    }

    let url: URL;
    try {
      url = new URL(connectionString);
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error(
        'DATABASE_URL must use postgres:// or postgresql:// with the PostgreSQL adapter',
      );
    }

    super({
      adapter: new PrismaPg({
        connectionString,
        connectionTimeoutMillis: 10_000,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
