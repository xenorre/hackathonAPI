import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserController } from './user.controller.js';

@Module({
  controllers: [UsersController, UserController],
  providers: [UsersService],
})
export class UsersModule {}
