import { Module } from '@nestjs/common';
import { EditorialController, PublicSettingsController } from './editorial.controller';
import { EditorialService } from './editorial.service';

@Module({ controllers: [EditorialController, PublicSettingsController], providers: [EditorialService], exports: [EditorialService] })
export class EditorialModule {}
