import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { AuthInstance } from '../../lib/auth/auth.config.js';

@Controller('users')
export class UsersController {
  @Get('me')
  getProfile(@Session() session: UserSession<AuthInstance>) {
    return { user: session.user };
  }
}
