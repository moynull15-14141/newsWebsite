import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { LanguagesModule } from '../languages/languages.module';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

@Module({ imports: [PublicModule, LanguagesModule], controllers: [HomepageController], providers: [HomepageService], exports: [HomepageService] })
export class HomepageModule {}
