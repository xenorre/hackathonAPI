import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ArcjetService } from '../../lib/arcjet/arcjet.service.js';

@Injectable()
export class ArcjetGuard implements CanActivate {
  constructor(private readonly arcjet: ArcjetService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const http = context.switchToHttp();
    await this.arcjet.enforce(
      http.getRequest<Request>(),
      http.getResponse<Response>(),
    );

    return true;
  }
}
