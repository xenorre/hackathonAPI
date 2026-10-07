import { Injectable } from '@nestjs/common';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import type { AuthInstance } from './auth.config.js';

@Injectable()
export class AuthService {
  constructor(private readonly auth: BetterAuthService<AuthInstance>) {}

  getSession(headers: Headers) {
    return this.auth.api.getSession({ headers });
  }
}
