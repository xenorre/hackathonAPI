import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinDate,
  MinLength,
} from 'class-validator';

export class CreateHackathonDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description?: string;

  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(Date.now() + 1), {
    message: 'startAt must be in the future',
  })
  startAt!: Date;

  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(Date.now() + 1), {
    message: 'endsAt must be in the future',
  })
  endsAt!: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
