import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  @RequirePermissions('user.manage')
  getRoles() {
    return this.usersService.getRoles();
  }

  @Get('authors')
  findAuthors() {
    return this.usersService.findAuthors();
  }

  @Get()
  @RequirePermissions('user.manage')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll({
      page: page ? parsePage(page) : undefined,
      limit: limit ? parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT) : undefined,
      search,
      roleId,
      status,
    });
  }

  @Get(':id')
  @RequirePermissions('user.manage')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions('user.manage')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('user.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('userId') currentUserId: string,
  ) {
    return this.usersService.update(id, dto, currentUserId);
  }

  @Delete(':id')
  @RequirePermissions('user.manage')
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') currentUserId: string,
  ) {
    return this.usersService.remove(id, currentUserId);
  }
}
