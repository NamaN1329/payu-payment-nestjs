import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Res,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PayuResponseDto } from './dto/payu-response.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.createPayment(createPaymentDto);
  }

  @Post('success')
  async paymentSuccess(@Res() res: Response, @Body() payuResponse: any) {
    try {
      // Map query params to our DTO format
      const responseDto: PayuResponseDto = {
        status: 'success',
        txnid: payuResponse.txnid,
        amount: payuResponse.amount,
        productinfo: payuResponse.productinfo,
        firstname: payuResponse.firstname,
        email: payuResponse.email,
        hash: payuResponse.hash,
        mihpayid: payuResponse.mihpayid,
      };

      const payment = await this.paymentService.handlePayuResponse(responseDto);
      // Redirect to the frontend success page with transaction ID
      return res
        .status(HttpStatus.FOUND)
        .redirect(
          `http://localhost:5173/payment/success?txnid=${payment.txnId}`,
        );
    } catch (error) {
      return res
        .status(HttpStatus.FOUND)
        .redirect(
          `http://localhost:5173/payment/error?message=${error.message}`,
        );
    }
  }

  @Get('failure')
  async paymentFailure(@Res() res: Response, @Query() payuResponse: any) {
    try {
      // Map query params to our DTO format
      const responseDto: PayuResponseDto = {
        status: 'failure',
        txnid: payuResponse.txnid,
        amount: payuResponse.amount,
        productinfo: payuResponse.productinfo,
        firstname: payuResponse.firstname,
        email: payuResponse.email,
        hash: payuResponse.hash,
        error: payuResponse.error,
        error_Message: payuResponse.error_Message,
      };

      const payment = await this.paymentService.handlePayuResponse(responseDto);
      // Redirect to the frontend failure page with error info
      return res
        .status(HttpStatus.FOUND)
        .redirect(
          `http://localhost:8080/payment/failed?txnid=${payment.txnId}&error=${payuResponse.error_Message || 'Payment failed'}`,
        );
    } catch (error) {
      return res
        .status(HttpStatus.FOUND)
        .redirect(
          `http://localhost:8080/payment/error?message=${error.message}`,
        );
    }
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    return this.paymentService.getPaymentById(id);
  }
}
