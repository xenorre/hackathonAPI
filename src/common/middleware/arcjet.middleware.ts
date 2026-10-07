import { HttpException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ArcjetService } from '../../lib/arcjet/arcjet.service.js';

@Injectable()
export class ArcjetMiddleware implements NestMiddleware {
  constructor(private readonly arcjet: ArcjetService) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    try {
      await this.arcjet.enforce(req, res);
    } catch (error) {
      if (error instanceof HttpException) {
        res.status(error.getStatus()).json(error.getResponse());
        return;
      }
      throw error;
    }
    next();
  }
}
