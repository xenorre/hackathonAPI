import { PartialType } from '@nestjs/mapped-types';
import { CreateHackathonDto } from './create-hackathon.dto.js';

export class UpdateHackathonDto extends PartialType(CreateHackathonDto, {
  skipNullProperties: false,
}) {}
