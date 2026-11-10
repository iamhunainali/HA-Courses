import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private db: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers.authorization as string;
    const token = h && h.startsWith('Bearer ') ? h.slice(7) : (req.query.token as string);
    if (!token) throw new UnauthorizedException('Login required');
    let p: any;
    try { p = this.jwt.verify(token); } catch { throw new UnauthorizedException('Session expired'); }
    const u = await this.db.user.findUnique({ where: { id: p.sub } });
    if (!u) throw new UnauthorizedException('User not found');
    let user = u;
    // 1 ghante (ya admin ka set kiya hua time) guzarne par account khud normal
    if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil <= new Date())
      user = await this.db.user.update({ where: { id: u.id }, data: { status: 'ACTIVE', suspendedUntil: null, suspendReason: null, failedStreak: 0 } });
    if (user.status === 'SUSPENDED')
      throw new ForbiddenException({ statusCode: 403, message: 'Your account is suspended.', code: 'SUSPENDED', until: user.suspendedUntil, reason: user.suspendReason });
    req.user = user;
    if (!u.lastSeen || Date.now() - u.lastSeen.getTime() > 30000) this.db.user.update({ where: { id: u.id }, data: { lastSeen: new Date() } }).catch(() => {});
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const u = ctx.switchToHttp().getRequest().user;
    if (!u || u.role !== 'SUPER_ADMIN') throw new ForbiddenException('Admin only');
    return true;
  }
}

@Injectable()
export class TeacherGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const u = ctx.switchToHttp().getRequest().user;
    if (!u || (u.role !== 'TEACHER' && u.role !== 'SUPER_ADMIN')) throw new ForbiddenException('Teachers only');
    return true;
  }
}
