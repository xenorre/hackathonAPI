import type { ArcjetDecision } from '@arcjet/nest';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ArcjetService } from '../../lib/arcjet/arcjet.service.js';

@Injectable()
export class ArcjetGuard implements CanActivate {
  constructor(
    private readonly arcjet: ArcjetService,
    private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const http = context.switchToHttp();
    let decision: ArcjetDecision;
    try {
      decision = await this.arcjet.protect(http.getRequest<Request>());
    } catch {
      this.logger.warn(
        'Arcjet protection failed, allowing the request',
        ArcjetGuard.name,
      );
      return true;
    }

    if (decision.isErrored()) {
      this.logger.warn(
        'Arcjet returned an error decision, allowing the request',
        ArcjetGuard.name,
      );
      return true;
    }

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        http
          .getResponse<Response>()
          .setHeader(
            'Retry-After',
            Math.max(1, Math.ceil(decision.reason.reset)),
          );
        throw new HttpException(
          'Too many requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ForbiddenException('Request blocked by Arcjet');
    }

    return true;
  }
}
