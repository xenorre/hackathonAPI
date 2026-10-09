import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  Hackathon,
  HackathonParticipant,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../lib/database/prisma.service.js';
import { CreateHackathonDto } from './dto/create-hackathon.dto.js';
import { UpdateHackathonDto } from './dto/update-hackathon.dto.js';
import { HackathonService } from './hackathon.service.js';

describe('HackathonService', () => {
  let service: HackathonService;
  const prisma = {
    hackathon: {
      create: jest.fn<
        (args: {
          data: {
            name: string;
            description?: string;
            startDate: Date;
            endDate: Date;
            isActive?: boolean;
            authorId: string;
          };
        }) => Promise<Hackathon>
      >(),
      findMany: jest.fn<() => Promise<Hackathon[]>>(),
      findUnique:
        jest.fn<
          (args: { where: { id: string } }) => Promise<Hackathon | null>
        >(),
      update: jest.fn<
        (args: {
          where: { id: string };
          data: {
            name?: string;
            description?: string | null;
            startDate?: Date;
            endDate?: Date;
            isActive?: boolean;
          };
        }) => Promise<Hackathon>
      >(),
      delete:
        jest.fn<(args: { where: { id: string } }) => Promise<Hackathon>>(),
    },
    hackathonParticipant: {
      create:
        jest.fn<
          (args: {
            data: { hackathonId: string; userId: string };
          }) => Promise<HackathonParticipant>
        >(),
    },
  };

  const startAt = new Date('2027-01-10T10:00:00.000Z');
  const endsAt = new Date('2027-01-12T10:00:00.000Z');
  const row: Hackathon = {
    id: 'hackathon-id',
    name: 'Build weekend',
    description: 'A weekend for building useful things.',
    startDate: startAt,
    endDate: endsAt,
    isActive: true,
    createdAt: new Date('2026-10-09T10:00:00.000Z'),
    updatedAt: new Date('2026-10-09T10:00:00.000Z'),
    authorId: 'admin-id',
  };
  const participant: HackathonParticipant = {
    id: 'participation-id',
    hackathonId: row.id,
    userId: 'participant-id',
    joinedAt: new Date('2026-10-09T10:00:00.000Z'),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HackathonService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(HackathonService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps create fields explicitly and takes authorId from the session argument', async () => {
    prisma.hackathon.create.mockResolvedValue(row);
    const dto = Object.assign(new CreateHackathonDto(), {
      name: 'Build weekend',
      description: 'A weekend for building useful things.',
      startAt,
      endsAt,
      isActive: true,
      id: 'attacker-controlled-id',
      authorId: 'attacker-controlled-author',
    });

    await expect(service.create(dto, 'admin-id')).resolves.toBe(row);
    expect(prisma.hackathon.create).toHaveBeenCalledWith({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: startAt,
        endDate: endsAt,
        isActive: true,
        authorId: 'admin-id',
      },
    });
  });

  it('omits null isActive on create so the database default applies', async () => {
    prisma.hackathon.create.mockResolvedValue(row);
    const dto = Object.assign(new CreateHackathonDto(), {
      name: 'Build weekend',
      startAt,
      endsAt,
      isActive: null,
    });

    await service.create(dto, 'admin-id');

    expect(prisma.hackathon.create).toHaveBeenCalledWith({
      data: {
        name: 'Build weekend',
        startDate: startAt,
        endDate: endsAt,
        authorId: 'admin-id',
      },
    });
  });

  it('lists all records and finds one by route ID', async () => {
    prisma.hackathon.findMany.mockResolvedValue([row]);
    prisma.hackathon.findUnique.mockResolvedValue(row);

    await expect(service.findAll()).resolves.toEqual([row]);
    await expect(service.findOne(row.id)).resolves.toBe(row);
    expect(prisma.hackathon.findMany).toHaveBeenCalledWith();
    expect(prisma.hackathon.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  it('throws NotFoundException when a read target does not exist', async () => {
    prisma.hackathon.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps only supplied update fields and does not change authorId', async () => {
    prisma.hackathon.update.mockResolvedValue(row);
    const dto = Object.assign(new UpdateHackathonDto(), {
      description: null,
      startAt,
      authorId: 'attacker-controlled-author',
      id: 'attacker-controlled-id',
    });

    await expect(service.update(row.id, dto)).resolves.toBe(row);
    expect(prisma.hackathon.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { description: null, startDate: startAt },
    });
  });

  it('treats null isActive as omitted during an update', async () => {
    prisma.hackathon.update.mockResolvedValue(row);

    await service.update(
      row.id,
      Object.assign(new UpdateHackathonDto(), { isActive: null }),
    );

    expect(prisma.hackathon.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: {},
    });
  });

  it.each([
    ['update', () => service.update('missing-id', { name: 'New name' })],
    ['delete', () => service.remove('missing-id')],
  ])(
    'maps a concurrent missing record during %s to 404',
    async (_operation, run) => {
      const error = new Prisma.PrismaClientKnownRequestError('Missing record', {
        code: 'P2025',
        clientVersion: '7.10.0',
      });
      prisma.hackathon.update.mockRejectedValue(error);
      prisma.hackathon.delete.mockRejectedValue(error);

      await expect(run()).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it.each([
    ['update', () => service.update(row.id, { name: 'Updated name' })],
    ['delete', () => service.remove(row.id)],
  ])(
    'propagates unrelated database errors from %s',
    async (_operation, run) => {
      const error = new Error('Database unavailable');
      prisma.hackathon.update.mockRejectedValue(error);
      prisma.hackathon.delete.mockRejectedValue(error);

      await expect(run()).rejects.toBe(error);
    },
  );

  it('returns the deleted row', async () => {
    prisma.hackathon.delete.mockResolvedValue(row);

    await expect(service.remove(row.id)).resolves.toBe(row);
    expect(prisma.hackathon.delete).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  describe('join', () => {
    beforeEach(() => {
      const now = Date.now();
      prisma.hackathon.findUnique.mockResolvedValue({
        ...row,
        startDate: new Date(now + 3_600_000),
        endDate: new Date(now + 86_400_000),
      });
      prisma.hackathonParticipant.create.mockResolvedValue(participant);
    });

    it('looks up the hackathon, creates participation, and returns the row', async () => {
      await expect(service.join(row.id, participant.userId)).resolves.toBe(
        participant,
      );

      expect(prisma.hackathon.findUnique).toHaveBeenCalledWith({
        where: { id: row.id },
      });
      expect(prisma.hackathonParticipant.create).toHaveBeenCalledWith({
        data: { hackathonId: row.id, userId: participant.userId },
      });
    });

    it('returns 404 for a missing hackathon without creating participation', async () => {
      prisma.hackathon.findUnique.mockResolvedValue(null);

      await expect(
        service.join('missing-id', participant.userId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.hackathonParticipant.create).not.toHaveBeenCalled();
    });

    it('rejects inactive hackathons before creating participation', async () => {
      prisma.hackathon.findUnique.mockResolvedValue({
        ...row,
        isActive: false,
      });

      await expect(service.join(row.id, participant.userId)).rejects.toThrow(
        new BadRequestException('Hackathon is not active'),
      );
      expect(prisma.hackathonParticipant.create).not.toHaveBeenCalled();
    });

    it.each([
      ['past', new Date('2026-10-08T10:00:00.000Z')],
      ['exactly now', new Date('2026-10-09T10:00:00.000Z')],
    ])(
      'rejects a hackathon ending %s before creating participation',
      async (_label, endDate) => {
        const now = new Date('2026-10-09T10:00:00.000Z').getTime();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        prisma.hackathon.findUnique.mockResolvedValue({ ...row, endDate });

        try {
          await expect(
            service.join(row.id, participant.userId),
          ).rejects.toThrow(
            new BadRequestException('Hackathon has already ended'),
          );
          expect(prisma.hackathonParticipant.create).not.toHaveBeenCalled();
        } finally {
          nowSpy.mockRestore();
        }
      },
    );

    it('checks the current time on each join attempt', async () => {
      const endDate = new Date('2030-01-01T00:00:00.000Z');
      let currentTime = new Date('2029-12-31T23:59:59.000Z').getTime();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => currentTime);
      prisma.hackathon.findUnique.mockResolvedValue({ ...row, endDate });

      try {
        await expect(service.join(row.id, participant.userId)).resolves.toBe(
          participant,
        );
        currentTime = endDate.getTime();

        await expect(service.join(row.id, participant.userId)).rejects.toThrow(
          new BadRequestException('Hackathon has already ended'),
        );
        expect(prisma.hackathonParticipant.create).toHaveBeenCalledTimes(1);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('maps Prisma P2002 to the duplicate-participation error', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '7.10.0' },
      );
      prisma.hackathonParticipant.create.mockRejectedValue(error);

      await expect(service.join(row.id, participant.userId)).rejects.toThrow(
        new BadRequestException('You have already joined this hackathon'),
      );
    });

    it('propagates unrelated participation database errors', async () => {
      const error = new Error('Database unavailable');
      prisma.hackathonParticipant.create.mockRejectedValue(error);

      await expect(service.join(row.id, participant.userId)).rejects.toBe(
        error,
      );
    });
  });
});
