// backend/src/payment/payment.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Payment } from '../models/payment.model';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PayuResponseDto } from './dto/payu-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment)
    private paymentModels: typeof Payment,
    private configService: ConfigService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto): Promise<any> {
    const txnId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Create payment record in the database
    const payment = await this.paymentModels.create({
      ...createPaymentDto,
      txnId,
      status: 'pending',
    });

    // Generate hash for PayU
    const merchantKey = this.configService.get<string>('PAYU_MERCHANT_KEY');
    const merchantSalt = this.configService.get<string>('PAYU_MERCHANT_SALT');
    const successUrl = this.configService.get<string>('PAYU_SUCCESS_URL');
    const failureUrl = this.configService.get<string>('PAYU_FAILURE_URL');

    // String for hashing
    const hashString = `${merchantKey}|${txnId}|${createPaymentDto.amount}|${createPaymentDto.productInfo}|${createPaymentDto.firstName}|${createPaymentDto.email}|||||||||||${merchantSalt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    // Return data needed for PayU hosted checkout redirection
    return {
      payuFormData: {
        key: merchantKey,
        txnid: txnId,
        amount: createPaymentDto.amount,
        productinfo: createPaymentDto.productInfo,
        firstname: createPaymentDto.firstName,
        lastname: createPaymentDto.lastName || '',
        email: createPaymentDto.email,
        phone: createPaymentDto.phone || '',
        surl: successUrl,
        furl: failureUrl,
        hash: hash,
      },
      paymentId: payment.id,
      // Return PayU hosted checkout URL
      payuUrl: this.configService.get<string>('PAYU_BASE_URL'),
    };
  }

  async handlePayuResponse(payuResponse: PayuResponseDto): Promise<Payment> {
    // Verify the hash returned by PayU
    const merchantSalt = this.configService.get<string>('PAYU_MERCHANT_SALT');
    const status = payuResponse.status;
    const txnId = payuResponse.txnid;

    let paymentStatus = 'pending';

    // Set status based on PayU response
    if (status === 'success') {
      paymentStatus = 'success';
    } else if (status === 'failure') {
      paymentStatus = 'failure';
    }
    // Update the payment record
    const payment = await this.paymentModels.findOne({
      where: { txnId },
    });

    console.log(
      paymentStatus,
      payuResponse.mihpayid,
      JSON.stringify(payuResponse),
      'payment data',
    );

    if (payment) {
      payment.status = paymentStatus;
      payment.payuId = payuResponse.mihpayid || '';
      payment.responseData = JSON.stringify(payuResponse);
      await payment.save();
      return payment;
    }

    throw new Error('Payment not found');
  }

  async getPaymentById(id: string): Promise<Payment> {
    console.log(id);

    const payment = await this.paymentModels.findByPk(id);
    if (!payment) {
      throw new Error('Payment not found');
    }
    return payment;
  }
}
