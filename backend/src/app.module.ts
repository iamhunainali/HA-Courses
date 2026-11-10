import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AdminController } from './admin.controller';
import { ExtraAdminController, ExtraController } from './extra.controller';
import { PaymentsController } from './payments.controller';
import { TeacherController } from './teacher.controller';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { AdminGuard, AuthGuard, TeacherGuard } from './guards';

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'dev_secret', signOptions: { expiresIn: '7d' } })],
  controllers: [AppController, AdminController, ExtraController, ExtraAdminController, TeacherController, PaymentsController],
  providers: [PrismaService, MailService, AuthGuard, AdminGuard, TeacherGuard],
})
export class AppModule {}
