import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, TeacherGuard } from './guards';
import { labData, rm, store } from './admin.controller';
import { PrismaService } from './prisma.service';

// Teacher portal: sirf wo courses jo admin ne is teacher ko assign kiye hain
@Controller('teacher')
@UseGuards(AuthGuard, TeacherGuard)
export class TeacherController {
  constructor(private db: PrismaService) {}

  private async own(user: any, courseId: string) {
    const c = await this.db.course.findUnique({ where: { id: courseId } });
    if (!c) throw new NotFoundException('Course not found');
    if (user.role !== 'SUPER_ADMIN' && c.teacherId !== user.id) throw new ForbiddenException('This course is not assigned to you');
    return c;
  }
  private async ownLesson(user: any, id: string) {
    const l = await this.db.lesson.findUnique({ where: { id }, include: { files: true } });
    if (!l) throw new NotFoundException();
    await this.own(user, l.courseId);
    return l;
  }
  private async ownLab(user: any, id: string) {
    const l = await this.db.lab.findUnique({ where: { id } });
    if (!l) throw new NotFoundException();
    await this.own(user, l.courseId);
    return l;
  }

  @Get('courses')
  courses(@Req() req: any) {
    return this.db.course.findMany({ where: req.user.role === 'SUPER_ADMIN' ? {} : { teacherId: req.user.id }, orderBy: { createdAt: 'desc' }, include: { category: true, _count: { select: { lessons: true, enrollments: true, labs: true } } } });
  }

  // ----- lectures -----
  @Get('courses/:id/lessons')
  async lessons(@Param('id') id: string, @Req() req: any) { await this.own(req.user, id); return this.db.lesson.findMany({ where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { files: true } }); }

  @Post('courses/:id/lessons') @UseInterceptors(FileInterceptor('video', store('private')))
  async addLesson(@Param('id') id: string, @Body() b: any, @UploadedFile() f: any, @Req() req: any) {
    await this.own(req.user, id);
    if (!f) throw new BadRequestException('Video file required');
    const count = await this.db.lesson.count({ where: { courseId: id } });
    return this.db.lesson.create({ data: { courseId: id, title: b.title || f.originalname, video: f.filename, order: parseInt(b.order) || count + 1, section: b.section || null, description: b.description || null } });
  }

  @Post('courses/:id/lessons-link')
  async addLink(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    await this.own(req.user, id);
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new BadRequestException('Paste a valid link starting with http:// or https://');
    const count = await this.db.lesson.count({ where: { courseId: id } });
    return this.db.lesson.create({ data: { courseId: id, title: b.title || 'Lecture', video: '', videoUrl: url, order: count + 1, section: b.section || null, description: b.description || null } });
  }

  @Patch('lessons/:id')
  async editLesson(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    await this.ownLesson(req.user, id);
    return this.db.lesson.update({ where: { id }, data: { ...(b.title ? { title: b.title } : {}), ...(b.order !== undefined && b.order !== '' ? { order: parseInt(b.order) || 0 } : {}), ...(b.section !== undefined ? { section: b.section || null } : {}), ...(b.description !== undefined ? { description: b.description || null } : {}) } });
  }

  @Delete('lessons/:id')
  async delLesson(@Param('id') id: string, @Req() req: any) {
    const l = await this.ownLesson(req.user, id);
    await this.db.lesson.delete({ where: { id } });
    await rm('private', l.video);
    for (const x of l.files) await rm('private', x.path);
    return { ok: true };
  }

  @Post('lessons/:id/files') @UseInterceptors(FileInterceptor('file', { ...store('private'), fileFilter: (_r, f, cb) => cb(null, /\.pdf$/i.test(f.originalname) && f.mimetype === 'application/pdf') }))
  async addFile(@Param('id') id: string, @UploadedFile() f: any, @Req() req: any) {
    await this.ownLesson(req.user, id);
    if (!f) throw new BadRequestException('Only PDF files are allowed in resources');
    return this.db.lessonFile.create({ data: { lessonId: id, name: f.originalname, path: f.filename } });
  }

  @Delete('files/:id')
  async delFile(@Param('id') id: string, @Req() req: any) {
    const f = await this.db.lessonFile.findUnique({ where: { id } });
    if (f) { await this.ownLesson(req.user, f.lessonId); await this.db.lessonFile.delete({ where: { id } }); await rm('private', f.path); }
    return { ok: true };
  }

  // ----- labs -----
  @Get('courses/:id/labs')
  async labs(@Param('id') id: string, @Req() req: any) { await this.own(req.user, id); return this.db.lab.findMany({ where: { courseId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { _count: { select: { attempts: true } } } }); }

  @Post('courses/:id/labs')
  async addLab(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    await this.own(req.user, id);
    const count = await this.db.lab.count({ where: { courseId: id } });
    return this.db.lab.create({ data: { courseId: id, ...labData(b), order: count + 1 } });
  }

  @Patch('labs/:id') async editLab(@Param('id') id: string, @Body() b: any, @Req() req: any) { await this.ownLab(req.user, id); return this.db.lab.update({ where: { id }, data: labData(b) }); }
  @Delete('labs/:id') async delLab(@Param('id') id: string, @Req() req: any) { await this.ownLab(req.user, id); await this.db.lab.delete({ where: { id } }); return { ok: true }; }

  @Get('labs/:id/attempts')
  async attempts(@Param('id') id: string, @Req() req: any) {
    await this.ownLab(req.user, id);
    return this.db.labAttempt.findMany({ where: { labId: id }, orderBy: { createdAt: 'desc' }, take: 200, include: { user: { select: { name: true, email: true } } } });
  }

  // ----- students of my course (with progress) -----
  @Get('courses/:id/students')
  async students(@Param('id') id: string, @Req() req: any) {
    await this.own(req.user, id);
    const [enr, prog, total] = await Promise.all([
      this.db.enrollment.findMany({ where: { courseId: id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      this.db.lessonProgress.findMany({ where: { lesson: { courseId: id } }, select: { userId: true } }),
      this.db.lesson.count({ where: { courseId: id } }),
    ]);
    return enr.map((e) => ({ id: e.id, user: e.user, since: e.createdAt, expiresAt: e.expiresAt, revoked: !!e.revokedAt, completed: prog.filter((p) => p.userId === e.userId).length, total }));
  }
}
