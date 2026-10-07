import type { ConfigService } from '@nestjs/config';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaService } from '../database/prisma.service.js';

export const authOptions = {
  emailAndPassword: { enabled: true },
  advanced: { disableOriginCheck: false, disableCSRFCheck: false },
  user: {
    additionalFields: {
      role: {
        type: ['PARTICIPANT', 'ADMIN'] as ['PARTICIPANT', 'ADMIN'],
        required: false,
        defaultValue: 'PARTICIPANT',
        input: false,
      },
    },
  },
} satisfies BetterAuthOptions;

export function createAuth(prisma: PrismaService, config: ConfigService) {
  const secret = config.getOrThrow<string>('BETTER_AUTH_SECRET').trim();
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  }

  const baseURL = config.getOrThrow<string>('BETTER_AUTH_URL').trim();
  try {
    const url = new URL(baseURL);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error('BETTER_AUTH_URL must be a valid HTTP or HTTPS URL');
  }

  const trustedOrigins = config
    .get<string>('BETTER_AUTH_TRUSTED_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        const url = new URL(origin);
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== '/'
        ) {
          throw new Error();
        }
        return url.origin;
      } catch {
        throw new Error(
          'BETTER_AUTH_TRUSTED_ORIGINS must contain comma separated HTTP or HTTPS origins',
        );
      }
    });

  return betterAuth({
    ...authOptions,
    secret,
    baseURL,
    trustedOrigins,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
