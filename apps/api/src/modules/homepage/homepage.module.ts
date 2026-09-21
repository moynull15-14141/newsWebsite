import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

@Module({ imports: [PublicModule], controllers: [HomepageController], providers: [HomepageService], exports: [HomepageService] })
export class HomepageModule {}
