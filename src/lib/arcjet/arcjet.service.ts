import { ARCJET, type ArcjetNest, type ArcjetNestRequest } from '@arcjet/nest';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class ArcjetService {
  constructor(@Inject(ARCJET) private readonly client: ArcjetNest) {}

  protect(request: ArcjetNestRequest) {
    return this.client.protect(request);
  }
}
