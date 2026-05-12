import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AnoLectivoUtil } from 'src/module/util/current-academic-year';

@Injectable()
export class MonthlyFeePenaltyService {
  private readonly logger = new Logger(MonthlyFeePenaltyService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly anoLectivoUtil: AnoLectivoUtil
  ) { }


  async applyFixedPenalty() {
    this.logger.log('⚠️ Início da aplicação de multa fixa de 10%');

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const anoLectivo = await this.anoLectivoUtil.getAnoAtualId();
      if (!anoLectivo) {
        this.logger.warn('⚠ Ano lectivo não encontrado. Processo interrompido.');
        return;
      }

      // ====================== 1. Aplicar Multa Fixa de 10% ======================
      await qr.query(`
        UPDATE FK2_FACTURA_ITEMS fi
        SET 
          fi.MULTA = ROUND((fi.PRECO * fi.QUANTIDADE) * 0.1, 2),
          fi.TOTAL = (fi.PRECO * fi.QUANTIDADE) 
                    + ROUND((fi.PRECO * fi.QUANTIDADE) * 0.1, 2) 
                    - NVL(fi.DESCONTOPRODUTO, 0)
        WHERE fi.ESTADO = 0
         AND (fi.MULTA IS NULL OR fi.MULTA = 0)                    -- Ainda não tem multa
          AND EXISTS (
            SELECT 1 
            FROM FK2_FACTURA f
            JOIN FK2_MES_TEMP mt ON fi.MES_TEMP_ID = mt.ID
            WHERE f.CODIGO = fi.CODIGOFACTURA
              AND mt.ANO_LECTIVO = ${anoLectivo}
              AND f.ESTADO = 0
              AND TRUNC(SYSDATE) > TRUNC(mt.DATA_LIMITE)           -- Passou da data limite
          )
      `);

      this.logger.log('✅ Multa fixa de 10% aplicada com sucesso.');
      console.log(qr);


      // ====================== 2. Atualizar totais da factura ======================
      await this.updateInvoiceTotals(qr, anoLectivo);

      await qr.commitTransaction();
      this.logger.log('✅ Processo de multa concluído com sucesso.');
    } catch (error) {
      await qr.rollbackTransaction();
      this.logger.error('❌ Erro ao aplicar multa fixa', error);
    } finally {
      await qr.release();
    }
  }

  private async updateInvoiceTotals(qr: any, anoLectivo: number) {
    await qr.query(`
      UPDATE FK2_FACTURA f
      SET (
        f.TOTALMULTA,
        f.DESCONTO,
        f.TOTALIVA,
        f.TOTALPRECO,
        f.VALORAPAGAR
      ) = (
        SELECT 
          NVL(SUM(fi.MULTA), 0),
          NVL(SUM(fi.DESCONTOPRODUTO), 0),
          NVL(SUM(fi.VALOR_IVA), 0),
          NVL(SUM(fi.PRECO * fi.QUANTIDADE), 0),
          NVL(SUM((fi.PRECO * fi.QUANTIDADE) 
                + NVL(fi.MULTA, 0) 
                + NVL(fi.VALOR_IVA, 0) 
                - NVL(fi.DESCONTOPRODUTO, 0) 
                - NVL(fi.RETENCAO, 0)), 0)
        FROM FK2_FACTURA_ITEMS fi 
        WHERE fi.CODIGOFACTURA = f.CODIGO 
          AND fi.ESTADO = 0
      )
      WHERE f.ESTADO = 0 
        AND f.ANO_LECTIVO = ${anoLectivo}
        AND EXISTS (
          SELECT 1 FROM FK2_FACTURA_ITEMS fi 
          WHERE fi.CODIGOFACTURA = f.CODIGO 
            AND fi.ESTADO = 0 
            AND fi.MULTA > 0
        )
    `);
  }
}