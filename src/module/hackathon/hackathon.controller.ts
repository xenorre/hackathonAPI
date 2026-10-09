import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import type {
  Hackathon,
  HackathonParticipant,
} from '../../generated/prisma/client.js';
import type { AuthInstance } from '../../lib/auth/auth.config.js';
import { CreateHackathonDto } from './dto/create-hackathon.dto.js';
import { UpdateHackathonDto } from './dto/update-hackathon.dto.js';
import { HackathonService } from './hackathon.service.js';

@Controller('hackathon')
export class HackathonController {
  constructor(private readonly hackathonService: HackathonService) {}

  @Post()
  @Roles(['ADMIN'])
  @ResponseMessage('Hackathon created successfully')
  create(
    @Body() dto: CreateHackathonDto,
    @Session() session: UserSession<AuthInstance>,
  ): Promise<Hackathon> {
    return this.hackathonService.create(dto, session.user.id);
  }

  @Get()
  findAll(): Promise<Hackathon[]> {
    return this.hackathonService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Hackathon> {
    return this.hackathonService.findOne(id);
  }

  @Post(':id/join')
  @Roles(['PARTICIPANT'])
  @ResponseMessage('Hackathon joined successfully')
  join(
    @Param('id') id: string,
    @Session() session: UserSession<AuthInstance>,
  ): Promise<HackathonParticipant> {
    return this.hackathonService.join(id, session.user.id);
  }

  @Patch(':id')
  @Roles(['ADMIN'])
  @ResponseMessage('Hackathon updated successfully')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHackathonDto,
  ): Promise<Hackathon> {
    return this.hackathonService.update(id, dto);
  }

  @Delete(':id')
  @Roles(['ADMIN'])
  @ResponseMessage('Hackathon deleted successfully')
  remove(@Param('id') id: string): Promise<Hackathon> {
    return this.hackathonService.remove(id);
  }
}
