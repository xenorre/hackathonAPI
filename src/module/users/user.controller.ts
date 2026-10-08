import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { UsersService } from './users.service.js';

@Controller('user')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  @Get('all')
  @Roles(['ADMIN'])
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
