import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { PrismaService } from './prisma.service';
import { AdminGuard, AuthGuard } from './guards';

const UP = process.env.UPLOAD_DIR || '/data/uploads';
const store = (sub: string) => ({
  storage: diskStorage({
    destination: (_r, _f, cb) => cb(null, join(UP, sub)),
    filename: (_r, f, cb) => cb(null, randomUUID() + extname(f.originalname)),
  }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});
const rm = (sub: string, name?: string | null) => (name ? unlink(join(UP, sub, name)).catch(() => {}) : Promise.resolve());

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private db: PrismaService) {}

  @Get('stats')
  async stats() {
    const [users, courses, enrollments, reviews] = await Promise.all([
      this.db.user.count({ where: { role: 'USER' } }), this.db.course.count(), this.db.enrollment.count(), this.db.review.count(),
    ]);
    return { users, courses, enrollments, reviews };
  }

  // ----- Categories -----
  @Post('categories')
  addCategory(@Body() b: any) {
    if (!String(b.name || '').trim()) throw new BadRequestException('Name required');
    return this.db.category.create({ data: { name: b.name.trim() } });
  }
  @Delete('categories/:id') async delCategory(@Param('id') id: string) { await this.db.category.delete({ where: { id } }); return { ok: true }; }

  // ----- Courses -----
  @Get('courses') courses() { return this.db.course.findMany({ orderBy: { createdAt: 'desc' }, include: { category: true, _count: { select: { lessons: true, enrollments: true } } } }); }

  @Post('courses') @UseInterceptors(FileInterceptor('thumbnail', store('public')))
  createCourse(@Body() b: any, @UploadedFile() f: any) {
    if (!b.title || !b.description) throw new BadRequestException('Title and description required');
    return this.db.course.create({
      data: { title: b.title, description: b.description, price: parseFloat(b.price) || 0, published: b.published !== 'false', categoryId: b.categoryId || null, thumbnail: f?.filename },
    });
  }

  @Patch('courses/:id') @UseInterceptors(FileInterceptor('thumbnail', store('public')))
  async updateCourse(@Param('id') id: string, @Body() b: any, @UploadedFile() f: any) {
    const c = await this.db.course.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    if (f) await rm('public', c.thumbnail);
    return this.db.course.update({
      where: { id },
      data: {
        title: b.title ?? c.title, description: b.description ?? c.description,
        price: b.price !== undefined ? parseFloat(b.price) || 0 : c.price,
        published: b.published !== undefined ? b.published !== 'false' : c.published,
        categoryId: b.categoryId !== undefined ? b.categoryId || null : c.categoryId,
        ...(f ? { thumbnail: f.filename } : {}),
      },
    });
  }

  @Delete('courses/:id')
  async delCourse(@Param('id') id: string) {
    const c = await this.db.course.findUnique({ where: { id }, include: { lessons: { include: { files: true } } } });
    if (!c) throw new NotFoundException();
    await this.db.course.delete({ where: { id } });
    await rm('public', c.thumbnail);
    for (const l of c.lessons) { await rm('private', l.video); for (const x of l.files) await rm('private', x.path); }
    return { ok: true };
  }

  // ----- Lessons (video) + files -----
  @Get('courses/:id/lessons')
  lessons(@Param('id') id: string) { return this.db.lesson.findMany({ where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { files: true } }); }

  @Post('courses/:id/lessons') @UseInterceptors(FileInterceptor('video', store('private')))
  async addLesson(@Param('id') id: string, @Body() b: any, @UploadedFile() f: any) {
    if (!f) throw new BadRequestException('Video file required');
    const count = await this.db.lesson.count({ where: { courseId: id } });
    return this.db.lesson.create({ data: { courseId: id, title: b.title || f.originalname, video: f.filename, order: parseInt(b.order) || count + 1 } });
  }

  @Delete('lessons/:id')
  async delLesson(@Param('id') id: string) {
    const l = await this.db.lesson.findUnique({ where: { id }, include: { files: true } });
    if (!l) throw new NotFoundException();
    await this.db.lesson.delete({ where: { id } });
    await rm('private', l.video);
    for (const x of l.files) await rm('private', x.path);
    return { ok: true };
  }

  @Post('lessons/:id/files') @UseInterceptors(FileInterceptor('file', store('private')))
  addFile(@Param('id') id: string, @UploadedFile() f: any) {
    if (!f) throw new BadRequestException('File required');
    return this.db.lessonFile.create({ data: { lessonId: id, name: f.originalname, path: f.filename } });
  }

  @Delete('files/:id')
  async delFile(@Param('id') id: string) {
    const f = await this.db.lessonFile.findUnique({ where: { id } });
    if (f) { await this.db.lessonFile.delete({ where: { id } }); await rm('private', f.path); }
    return { ok: true };
  }

  // ----- Slides -----
  @Get('slides') slides() { return this.db.slide.findMany({ orderBy: { order: 'asc' } }); }

  @Post('slides') @UseInterceptors(FileInterceptor('image', store('public')))
  async addSlide(@Body() b: any, @UploadedFile() f: any) {
    if (!f) throw new BadRequestException('Image required');
    const count = await this.db.slide.count();
    return this.db.slide.create({ data: { image: f.filename, caption: b.caption || null, order: count + 1 } });
  }

  @Delete('slides/:id')
  async delSlide(@Param('id') id: string) {
    const s = await this.db.slide.findUnique({ where: { id } });
    if (s) { await this.db.slide.delete({ where: { id } }); await rm('public', s.image); }
    return { ok: true };
  }

  // ----- Reviews (full control) -----
  @Get('reviews') reviews() { return this.db.review.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } }); }

  @Patch('reviews/:id')
  editReview(@Param('id') id: string, @Body() b: any) {
    return this.db.review.update({
      where: { id },
      data: { ...(b.comment !== undefined ? { comment: b.comment } : {}), ...(b.rating ? { rating: Math.min(5, Math.max(1, +b.rating)) } : {}), ...(b.status ? { status: b.status } : {}) },
    });
  }
  @Delete('reviews/:id') async delReview(@Param('id') id: string) { await this.db.review.delete({ where: { id } }); return { ok: true }; }

  // ----- Users -----
  @Get('users')
  users(@Query('q') q?: string) {
    return this.db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, warnings: true, createdAt: true, lastLogin: true, _count: { select: { enrollments: true } } },
    });
  }

  @Patch('users/:id/action')
  async userAction(@Param('id') id: string, @Body() b: any) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    if (u.role === 'SUPER_ADMIN') throw new ForbiddenException('Cannot act on super admin');
    const note = (title: string, message: string) => this.db.notification.create({ data: { userId: id, title, message } });
    switch (b.action) {
      case 'warn':
        await this.db.user.update({ where: { id }, data: { status: u.status === 'SUSPENDED' ? 'SUSPENDED' : 'WARNED', warnings: { increment: 1 } } });
        await note('Warning from admin', b.reason || 'Please follow the portal rules.');
        break;
      case 'suspend':
        await this.db.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
        await note('Account suspended', b.reason || 'Your account has been suspended.');
        break;
      case 'activate':
        await this.db.user.update({ where: { id }, data: { status: 'ACTIVE' } });
        await note('Account activated', 'Your account is active.');
        break;
      case 'clear_warnings':
        await this.db.user.update({ where: { id }, data: { status: 'ACTIVE', warnings: 0 } });
        break;
      case 'reset_password': {
        const temp = randomBytes(5).toString('hex');
        await this.db.user.update({ where: { id }, data: { password: await bcrypt.hash(temp, 10) } });
        await note('Password reset', 'Your password was reset by admin. Contact admin for the new password.');
        return { ok: true, tempPassword: temp };
      }
      case 'delete':
        await this.db.user.delete({ where: { id } });
        break;
      default:
        throw new BadRequestException('Unknown action');
    }
    return { ok: true };
  }

  // ----- Messages (notifications) -----
  @Post('message')
  async message(@Body() b: any) {
    if (!b.title || !b.message) throw new BadRequestException('Title and message required');
    if (b.email) {
      const u = await this.db.user.findUnique({ where: { email: String(b.email).trim().toLowerCase() } });
      if (!u) throw new NotFoundException('No user with this email');
      await this.db.notification.create({ data: { userId: u.id, title: b.title, message: b.message } });
      return { sent: 1 };
    }
    const all = await this.db.user.findMany({ where: { role: 'USER' }, select: { id: true } });
    await this.db.notification.createMany({ data: all.map((u) => ({ userId: u.id, title: b.title, message: b.message })) });
    return { sent: all.length };
  }
}
