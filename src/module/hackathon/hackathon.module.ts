import { Module } from '@nestjs/common';
import { HackathonService } from './hackathon.service.js';
import { HackathonController } from './hackathon.controller.js';

@Module({
  controllers: [HackathonController],
  providers: [HackathonService],
})
export class HackathonModule {}
