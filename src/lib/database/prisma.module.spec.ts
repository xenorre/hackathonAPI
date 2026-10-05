import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
class DatabaseConsumer {
  constructor(readonly prisma: PrismaService) {}
}

@Module({ providers: [DatabaseConsumer] })
class FeatureModule {}

function createModule(connectionString: string) {
  return Test.createTestingModule({
    imports: [PrismaModule, FeatureModule],
  })
    .overrideProvider(ConfigService)
    .useValue({ getOrThrow: () => connectionString })
    .compile();
}

describe('PrismaModule', () => {
  it('injects the same generated client into another feature module globally', async () => {
    const module = await createModule(
      'postgresql://test:test@localhost:5432/test',
    );
    try {
      const prisma = module.get(PrismaService);
      expect(module.get(DatabaseConsumer).prisma).toBe(prisma);
      expect(typeof prisma.$queryRaw).toBe('function');
    } finally {
      await module.close();
    }
  });

  it.each([
    ['   ', 'DATABASE_URL must not be empty'],
    ['invalid', 'DATABASE_URL must be a valid PostgreSQL connection URL'],
    [
      'prisma+postgres://accelerate.prisma-data.net/?api_key=test',
      'DATABASE_URL must use postgres:// or postgresql://',
    ],
  ])('rejects an incompatible database URL (%s)', async (url, message) => {
    await expect(createModule(url)).rejects.toThrow(message);
  });
});
