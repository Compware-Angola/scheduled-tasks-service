import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonthlyFeePenaltyService } from '../payment-monthly-fee.service';

@Injectable()
export class MonthlyFeePenaltyCron {
  private readonly logger = new Logger(MonthlyFeePenaltyCron.name);


  constructor(private readonly serive: MonthlyFeePenaltyService) {}


  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expirePendingReferences() {
    this.logger.log('⏳ Início da verificação');

   

    try {
       await this.serive.applyProgressiveLate();
       await this.serive.applyprogressiveToInvoice()

      this.logger.log('✅ Verificação concluída com sucesso');
    } catch (error) {
      this.logger.error('❌ Erro ao verificar', error);
    }
  }
}
