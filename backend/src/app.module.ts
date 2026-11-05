import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AdminController } from './admin.controller';
import { PrismaService } from './prisma.service';
import { AdminGuard, AuthGuard } from './guards';

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'dev_secret', signOptions: { expiresIn: '7d' } })],
  controllers: [AppController, AdminController],
  providers: [PrismaService, AuthGuard, AdminGuard],
})
export class AppModule {}
