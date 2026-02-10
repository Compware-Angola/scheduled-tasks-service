import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from '../payment.service';

@Injectable()
export class PaymentExpirationCron {
  private readonly logger = new Logger(PaymentExpirationCron.name);

  constructor(private readonly serive: PaymentsService) {}


  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expirePendingReferences() {
    this.logger.log('⏳ Início da verificação de referências expiradas');

   

    try {
       await this.serive.expireOverduePaymentReferences();

      this.logger.log('✅ Verificação concluída com sucesso');
      this.logger.log(`🔁 Referências expiradas atualizadas`);
    } catch (error) {
      this.logger.error('❌ Erro ao expirar referências de pagamento', error);
    }
  }
}
