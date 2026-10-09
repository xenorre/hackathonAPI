import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Hackathon,
  type HackathonParticipant,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../lib/database/prisma.service.js';
import type { CreateHackathonDto } from './dto/create-hackathon.dto.js';
import type { UpdateHackathonDto } from './dto/update-hackathon.dto.js';

@Injectable()
export class HackathonService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHackathonDto, authorId: string): Promise<Hackathon> {
    return this.prisma.hackathon.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startAt,
        endDate: dto.endsAt,
        isActive: dto.isActive ?? undefined,
        authorId,
      },
    });
  }

  findAll(): Promise<Hackathon[]> {
    return this.prisma.hackathon.findMany();
  }

  async findOne(id: string): Promise<Hackathon> {
    const hackathon = await this.prisma.hackathon.findUnique({ where: { id } });

    if (!hackathon) {
      throw new NotFoundException(`Hackathon with ID "${id}" not found`);
    }

    return hackathon;
  }

  async join(
    hackathonId: string,
    userId: string,
  ): Promise<HackathonParticipant> {
    const hackathon = await this.findOne(hackathonId);

    if (!hackathon.isActive) {
      throw new BadRequestException('Hackathon is not active');
    }

    if (hackathon.endDate.getTime() <= Date.now()) {
      throw new BadRequestException('Hackathon has already ended');
    }

    try {
      return await this.prisma.hackathonParticipant.create({
        data: { hackathonId, userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('You have already joined this hackathon');
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateHackathonDto): Promise<Hackathon> {
    try {
      return await this.prisma.hackathon.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          startDate: dto.startAt,
          endDate: dto.endsAt,
          isActive: dto.isActive ?? undefined,
        },
      });
    } catch (error) {
      this.handleMutationError(error, id);
    }
  }

  async remove(id: string): Promise<Hackathon> {
    try {
      return await this.prisma.hackathon.delete({ where: { id } });
    } catch (error) {
      this.handleMutationError(error, id);
    }
  }

  private handleMutationError(error: unknown, id: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(`Hackathon with ID "${id}" not found`);
    }

    throw error;
  }
}
