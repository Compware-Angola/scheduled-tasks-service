
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async expireOverduePaymentReferences(){
     const sql = `
      UPDATE FK2_PAGAMENTO_POR_REFERENCIAS
      SET
        STATUS_ = 'Expired',
        UPDATED_AT = SYSDATE
      WHERE
        STATUS_ = 'Pending'
        AND END_DATE IS NOT NULL
        AND END_DATE < TRUNC(SYSDATE)
    `;

    try {
      await this.dataSource.query(sql);
      
    } catch (err) {
      this.logger.error('Erro na expiração de referências', err.stack);
      throw err;
    }
  }
}