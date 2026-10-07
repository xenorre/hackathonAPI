import {
  ARCJET,
  type ArcjetDecision,
  type ArcjetNest,
  type ArcjetNestRequest,
} from '@arcjet/nest';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Injectable()
export class ArcjetService {
  constructor(
    @Inject(ARCJET) private readonly client: ArcjetNest,
    private readonly logger: Logger,
  ) {}

  protect(request: ArcjetNestRequest) {
    return this.client.protect(request);
  }

  async enforce(request: ArcjetNestRequest, response: Response): Promise<void> {
    let decision: ArcjetDecision;
    try {
      decision = await this.protect(request);
    } catch {
      this.logger.warn(
        'Arcjet protection failed, allowing the request',
        ArcjetService.name,
      );
      return;
    }

    if (decision.isErrored()) {
      this.logger.warn(
        'Arcjet returned an error decision, allowing the request',
        ArcjetService.name,
      );
      return;
    }

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        response.setHeader(
          'Retry-After',
          Math.max(1, Math.ceil(decision.reason.reset)),
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ForbiddenException('Request blocked by Arcjet');
    }
  }
}
