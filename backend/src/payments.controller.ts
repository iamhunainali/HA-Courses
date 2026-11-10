import { All, BadRequestException, Body, ConflictException, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { createCipheriv, createHmac, timingSafeEqual } from 'crypto';
import { AuthGuard } from './guards';
import { loadGateway } from './gateway.util';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';

const JAZZ = { sandbox: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/', production: 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/' };
const EASY = { sandbox: 'https://easypaystg.easypaisa.com.pk/easypay/Index.jsf', production: 'https://easypay.easypaisa.com.pk/easypay/Index.jsf' };
const pk = (d: Date, sep = '') => { const t = new Date(d.getTime() + 5 * 3600 * 1000).toISOString(); return t.slice(0, 10).replace(/-/g, '') + sep + t.slice(11, 19).replace(/:/g, ''); }; // Pakistan time

@Controller('payments')
export class PaymentsController {
  constructor(private db: PrismaService, private mail: MailService) {}

  @UseGuards(AuthGuard) @Get('methods')
  async methods() {
    const c = await loadGateway(this.db);
    return {
      jazzcash: !!(c.publicUrl && c.jazzcash.enabled && c.jazzcash.merchantId && c.jazzcash.password && c.jazzcash.salt),
      easypaisa: !!(c.publicUrl && c.easypaisa.enabled && c.easypaisa.storeId && c.easypaisa.hashKey),
    };
  }

  private async begin(user: any, courseId: string, gateway: string) {
    const c = await this.db.course.findFirst({ where: { id: courseId, published: true } });
    const enr = await this.db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
    if (!c || (c.plan !== 'PREMIUM' && !enr?.revokedAt)) throw new BadRequestException('This course does not need payment');
    if (enr && !enr.revokedAt && (!enr.expiresAt || enr.expiresAt > new Date())) throw new ConflictException('You already have access to this course');
    if (await this.db.paymentRequest.findFirst({ where: { userId: user.id, courseId, status: 'PENDING', gateway: null } })) throw new ConflictException('You already have a pending manual payment request for this course');
    await this.db.paymentRequest.updateMany({ where: { userId: user.id, courseId, status: 'PENDING', gateway: { not: null } }, data: { status: 'CANCELLED' } });
    const ref = 'T' + Date.now();
    await this.db.paymentRequest.create({ data: { userId: user.id, courseId, answers: [], fatherName: user.fatherName || '', phone: user.phone || '', amount: c.price, days: c.durationDays, dueAt: new Date(Date.now() + 3 * 3600 * 1000), gateway, txnRef: ref } });
    return { course: c, ref };
  }

  private async grant(p: any, title: string) {
    const existing = await this.db.enrollment.findUnique({ where: { userId_courseId: { userId: p.userId, courseId: p.courseId } } });
    const base = existing?.expiresAt && existing.expiresAt > new Date() ? existing.expiresAt : new Date();
    const expiresAt = p.days > 0 ? new Date(base.getTime() + p.days * 86400000) : null;
    if (existing) await this.db.enrollment.update({ where: { id: existing.id }, data: { expiresAt, celebrated: false, revokedAt: null } });
    else await this.db.enrollment.create({ data: { userId: p.userId, courseId: p.courseId, expiresAt, celebrated: false } });
    await this.db.paymentRequest.update({ where: { id: p.id }, data: { status: 'APPROVED', reviewedAt: new Date() } });
    await this.db.notification.create({ data: { userId: p.userId, sender: 'Payments', title: 'Access granted', message: `Your online payment was successful. You now have access to "${title}"${expiresAt ? ` until ${expiresAt.toDateString()}` : ''}.` } });
    const u = await this.db.user.findUnique({ where: { id: p.userId } });
    if (u) this.mail.trigger('payment_approved', u.email, { name: u.name, course: title });
  }

  /* ---------- JazzCash: Hosted Checkout (HMAC-SHA256 secure hash) ---------- */
  private jazzHash(f: Record<string, any>, salt: string) {
    const keys = Object.keys(f).filter((k) => /^pp/.test(k) && k !== 'pp_SecureHash' && f[k] !== '' && f[k] != null).sort();
    return createHmac('sha256', salt).update([salt, ...keys.map((k) => String(f[k]))].join('&')).digest('hex');
  }

  @UseGuards(AuthGuard) @Post('jazzcash/start')
  async jazzStart(@Body() b: any, @Req() req: any) {
    const c = await loadGateway(this.db), j = c.jazzcash;
    if (!c.publicUrl || !j.enabled || !j.merchantId || !j.password || !j.salt) throw new BadRequestException('JazzCash is not configured');
    const { course, ref } = await this.begin(req.user, String(b.courseId), 'JAZZCASH');
    const now = new Date();
    const f: Record<string, string> = {
      pp_Version: '1.1', pp_TxnType: '', pp_Language: 'EN', pp_MerchantID: j.merchantId, pp_SubMerchantID: '', pp_Password: j.password,
      pp_BankID: 'TBANK', pp_ProductID: 'RETL', pp_TxnRefNo: ref, pp_Amount: String(Math.round(course.price * 100)), pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: pk(now), pp_BillReference: 'billRef', pp_Description: course.title.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 60) || 'Course',
      pp_TxnExpiryDateTime: pk(new Date(now.getTime() + 3600 * 1000)), pp_ReturnURL: `${c.publicUrl}/api/payments/jazzcash/return`,
      ppmpf_1: '1', ppmpf_2: '2', ppmpf_3: '3', ppmpf_4: '4', ppmpf_5: '5',
    };
    f.pp_SecureHash = this.jazzHash(f, j.salt);
    return { action: j.checkoutUrl || (j.env === 'production' ? JAZZ.production : JAZZ.sandbox), fields: f };
  }

  // JazzCash browser ko yahan POST karta hai. Hash verify hone aur amount match hone par hi access milta hai.
  @Post('jazzcash/return')
  async jazzReturn(@Body() b: any, @Res() res: any) {
    const c = await loadGateway(this.db);
    const p = await this.db.paymentRequest.findFirst({ where: { txnRef: String(b.pp_TxnRefNo || ''), gateway: 'JAZZCASH' } });
    if (!p) return res.redirect(302, `${c.publicUrl}/dashboard`);
    const back = (q: string) => res.redirect(302, `${c.publicUrl}/checkout/${p.courseId}?${q}`);
    const expected = this.jazzHash(b, c.jazzcash.salt || ''), given = String(b.pp_SecureHash || '').toLowerCase();
    if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return back('failed=1&reason=signature');
    if (p.status !== 'PENDING') return back(p.status === 'APPROVED' ? 'paid=1' : 'failed=1');
    const course = await this.db.course.findUnique({ where: { id: p.courseId } });
    if (b.pp_ResponseCode === '000' && Number(b.pp_Amount) === Math.round(p.amount * 100)) {
      await this.db.paymentRequest.update({ where: { id: p.id }, data: { gatewayInfo: { code: b.pp_ResponseCode, message: b.pp_ResponseMessage, retrieval: b.pp_RetreivalReferenceNo } } });
      await this.grant(p, course?.title || 'course');
      return back('paid=1');
    }
    await this.db.paymentRequest.update({ where: { id: p.id }, data: { status: 'REJECTED', reviewedAt: new Date(), note: String(b.pp_ResponseMessage || 'Payment failed'), gatewayInfo: { code: b.pp_ResponseCode, message: b.pp_ResponseMessage } } });
    return back('failed=1');
  }

  /* ---------- Easypaisa (Easypay hosted page). Verification admin karta hai ---------- */
  @UseGuards(AuthGuard) @Post('easypaisa/start')
  async easyStart(@Body() b: any, @Req() req: any) {
    const c = await loadGateway(this.db), e = c.easypaisa;
    if (!c.publicUrl || !e.enabled || !e.storeId || !e.hashKey) throw new BadRequestException('Easypaisa is not configured');
    const { course, ref } = await this.begin(req.user, String(b.courseId), 'EASYPAISA');
    const params: Record<string, string> = {
      amount: course.price.toFixed(2), autoRedirect: '1', emailAddr: req.user.email, expiryDate: pk(new Date(Date.now() + 3600 * 1000), ' '),
      mobileNum: req.user.phone || '', orderRefNum: ref, paymentMethod: e.paymentMethod || 'InitialRequest',
      postBackURL: `${c.publicUrl}/api/payments/easypaisa/return`, storeId: String(e.storeId),
    };
    const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    const key = Buffer.alloc(16); Buffer.from(String(e.hashKey)).copy(key);
    const ci = createCipheriv('aes-128-ecb', key, null);
    const merchantHashedReq = Buffer.concat([ci.update(str, 'utf8'), ci.final()]).toString('base64');
    return { action: e.checkoutUrl || (e.env === 'production' ? EASY.production : EASY.sandbox), fields: { ...params, merchantHashedReq } };
  }

  @All('easypaisa/return')
  async easyReturn(@Req() req: any, @Res() res: any) {
    const c = await loadGateway(this.db);
    const q = { ...(req.query || {}), ...(req.body || {}) };
    const ref = String(q.orderRefNum || q.orderRefNumber || q.orderId || '');
    const p = ref ? await this.db.paymentRequest.findFirst({ where: { txnRef: ref, gateway: 'EASYPAISA' } }) : null;
    if (!p) return res.redirect(302, `${c.publicUrl}/dashboard`);
    if (p.status === 'PENDING') {
      await this.db.paymentRequest.update({ where: { id: p.id }, data: { gatewayInfo: q, note: 'Returned from Easypaisa. Verify the payment in your Easypay merchant portal, then approve.' } });
      await this.db.notification.create({ data: { userId: p.userId, sender: 'Payments', title: 'Payment submitted', message: 'Your Easypaisa payment was submitted. Access will be granted once it is confirmed.' } });
    }
    return res.redirect(302, `${c.publicUrl}/checkout/${p.courseId}?submitted=1`);
  }
}
