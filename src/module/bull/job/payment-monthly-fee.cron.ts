import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonthlyFeePenaltyService } from '../service/MonthlyFeePenalty.service';

@Injectable()
export class MonthlyFeePenaltyCron {
    private readonly logger = new Logger(MonthlyFeePenaltyCron.name);
    constructor(private readonly serive: MonthlyFeePenaltyService) { }
    //@Cron(CronExpression.EVERY_DAY_AT_3AM)
    //2 seg para teste
    @Cron('*/20 * * * * *')
    async applyFixedPenalty() {
        this.logger.log('⏳ Início da verificação');
        try {
            // await this.serive.applyFixedPenalty()

            this.logger.log('✅ Verificação concluída com sucesso');
        } catch (error) {
            this.logger.error('❌ Erro ao verificar', error);
        }
    }
}