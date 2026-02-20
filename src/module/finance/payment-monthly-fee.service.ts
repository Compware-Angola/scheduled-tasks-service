import { Injectable, Logger } from '@nestjs/common';

import { DataSource } from 'typeorm';
import { AnoLectivoUtil } from '../util/current-academic-year';

@Injectable()
export class MonthlyFeePenaltyService {
  private readonly logger = new Logger(MonthlyFeePenaltyService.name);
     constructor(private readonly dataSource: DataSource, private readonly anoLectivoUtil: AnoLectivoUtil) { }
     
  

  async applyProgressiveLate() {
    this.logger.log('⚠️  - Aplicação de multas progressivas (máx 2 por nível)');

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
    const anoLectivo = await this.anoLectivoUtil.getAnoAtualId();

      if (!anoLectivo) {
       this.logger.warn('⚠ Ano lectivo  não definido ou data de fim inexistente. Processo interrompido.');
        return;
      }

      // ==================================================
      // 1. Aplicar 5% — 
      // ==================================================
  await qr.query(`
  UPDATE FK2_FACTURA_ITEMS fi
  SET 
    fi.MULTA = ROUND((fi.PRECO * fi.QUANTIDADE) * 0.05, 2),
   fi.TOTAL = (fi.PRECO * fi.QUANTIDADE)
           + ROUND((fi.PRECO * fi.QUANTIDADE) * 0.05, 2)
           - NVL(fi.DESCONTOPRODUTO, 0)
  WHERE fi.ESTADO = 0
    AND (fi.MULTA IS NULL OR fi.MULTA = 0)
    AND EXISTS (
      SELECT 1 
      FROM FK2_FACTURA f
      JOIN FK2_MES_TEMP mt ON fi.MES_TEMP_ID = mt.ID
      WHERE f.CODIGO = fi.CODIGOFACTURA
        AND mt.ANO_LECTIVO = ${anoLectivo}
        AND f.ESTADO = 0
        AND TRUNC(SYSDATE) >= TRUNC(mt.DATA_LIMITE)
        AND TRUNC(SYSDATE) <= TRUNC(mt.DATA_FINAL)
    )
`);
      // ==================================================
      // 2. Aplicar 7% —
      // ==================================================
      await qr.query(`
        UPDATE FK2_FACTURA_ITEMS fi
        SET 
          fi.MULTA = ROUND((fi.PRECO * fi.QUANTIDADE) * 0.07, 2),
         fi.TOTAL = (fi.PRECO * fi.QUANTIDADE)
           + ROUND((fi.PRECO * fi.QUANTIDADE) * 0.07, 2)
           - NVL(fi.DESCONTOPRODUTO, 0)
        WHERE fi.ESTADO = 0
          AND fi.MULTA > 0 
        --  AND ROUND((fi.MULTA / (fi.PRECO * fi.QUANTIDADE)) * 100, 2) = 5
          AND EXISTS (
            SELECT 1 
            FROM FK2_FACTURA f
            JOIN FK2_MES_TEMP mt ON fi.MES_TEMP_ID = mt.ID
            WHERE f.CODIGO = fi.CODIGOFACTURA
              AND mt.ANO_LECTIVO= ${anoLectivo}
              AND f.ESTADO = 0
              AND TRUNC(SYSDATE) > TRUNC(mt.DATA_FINAL)
              AND TRUNC(SYSDATE) <= ADD_MONTHS(TRUNC(mt.DATA_FINAL), 1)
          )
         
      `);


      // ==================================================
      // 3. Aplicar 10% — max 2 registos
      // ==================================================
      await qr.query(`
        UPDATE FK2_FACTURA_ITEMS fi
        SET 
          fi.MULTA = ROUND((fi.PRECO * fi.QUANTIDADE) * 0.10, 2),
           fi.TOTAL = (fi.PRECO * fi.QUANTIDADE)
           + ROUND((fi.PRECO * fi.QUANTIDADE) * 0.10, 2)
           - NVL(fi.DESCONTOPRODUTO, 0)
        WHERE fi.ESTADO = 0
          AND fi.MULTA > 0
        --  AND ROUND((fi.MULTA / (fi.PRECO * fi.QUANTIDADE)) * 100, 2) IN (5, 7)
          AND EXISTS (
            SELECT 1 
            FROM FK2_FACTURA f
            JOIN FK2_MES_TEMP mt ON fi.MES_TEMP_ID = mt.ID
            WHERE f.CODIGO = fi.CODIGOFACTURA
              AND mt.ANO_LECTIVO=${anoLectivo}
              AND f.ESTADO = 0
              AND TRUNC(SYSDATE) > ADD_MONTHS(TRUNC(mt.DATA_FINAL), 1)
          )
         
      `);

      await qr.commitTransaction();
      this.logger.log('Execução de teste concluída com sucesso.');

    } catch (error) {
      await qr.rollbackTransaction();
      this.logger.error('Erro no teste de aplicação de multas', error);
      this.logger.error(error.stack || error.message);
    } finally {
      await qr.release();
    }
  }
  async applyprogressiveToInvoice(){

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
    const anoLectivo = await this.anoLectivoUtil.getAnoAtualId();
      if (!anoLectivo) {
        this.logger.warn('⚠ Ano lectivo  não definido ou data de fim inexistente. Processo interrompido.');
        return;
      }

  await qr.query(`
UPDATE FK2_FACTURA f
SET 
    (f.TOTALMULTA, f.DESCONTO, f.TOTALIVA, f.TOTALPRECO, f.VALORAPAGAR) = (
        SELECT 
            NVL(SUM(fi.MULTA), 0)                          AS total_multa,
            NVL(SUM(fi.DESCONTOPRODUTO), 0)                AS total_desconto,
            NVL(SUM(fi.VALOR_IVA), 0)                      AS total_iva,
            NVL(SUM(fi.PRECO * fi.QUANTIDADE), 0)          AS total_preco,
            NVL(SUM(
                (fi.PRECO * fi.QUANTIDADE)
                + NVL(fi.MULTA, 0)
                + NVL(fi.VALOR_IVA, 0)
                - NVL(fi.VALOR_DESCONTO, 0)
                - NVL(fi.RETENCAO, 0)
            ), 0)                                           AS valor_apagar
        FROM FK2_FACTURA_ITEMS fi
        WHERE fi.CODIGOFACTURA = f.CODIGO
          AND fi.ESTADO = 0
    )
WHERE f.ESTADO = 0
  AND f.ANO_LECTIVO = ${anoLectivo}
  AND EXISTS (
      SELECT 1
      FROM FK2_FACTURA_ITEMS fi
      WHERE fi.CODIGOFACTURA = f.CODIGO
        AND fi.ESTADO = 0
        AND fi.MULTA IS NOT NULL
        AND fi.MULTA > 0
        AND fi.PRECO > 0
        AND fi.QUANTIDADE > 0
  )
  AND (
      -- Atualiza apenas se houver inconsistência em algum dos campos
      f.TOTALMULTA IS NULL
      OR f.TOTALMULTA = 0
      OR f.TOTALMULTA != NVL((
          SELECT SUM(fi.MULTA)
          FROM FK2_FACTURA_ITEMS fi
          WHERE fi.CODIGOFACTURA = f.CODIGO
            AND fi.ESTADO = 0
      ), 0)
      
      OR f.DESCONTO IS NULL
      OR f.DESCONTO != NVL((
          SELECT SUM(fi.DESCONTOPRODUTO)
          FROM FK2_FACTURA_ITEMS fi
          WHERE fi.CODIGOFACTURA = f.CODIGO
            AND fi.ESTADO = 0
      ), 0)
      
      OR f.TOTALIVA IS NULL
      OR f.TOTALIVA != NVL((
          SELECT SUM(fi.VALOR_IVA)
          FROM FK2_FACTURA_ITEMS fi
          WHERE fi.CODIGOFACTURA = f.CODIGO
            AND fi.ESTADO = 0
      ), 0)
      
      OR f.TOTALPRECO IS NULL
      OR f.TOTALPRECO != NVL((
          SELECT SUM(fi.PRECO * fi.QUANTIDADE)
          FROM FK2_FACTURA_ITEMS fi
          WHERE fi.CODIGOFACTURA = f.CODIGO
            AND fi.ESTADO = 0
      ), 0)
      
      OR f.VALORAPAGAR IS NULL
      OR f.VALORAPAGAR != NVL((
          SELECT SUM(
              (fi.PRECO * fi.QUANTIDADE)
              + NVL(fi.MULTA, 0)
              + NVL(fi.VALOR_IVA, 0)
              - NVL(fi.VALOR_DESCONTO, 0)
              - NVL(fi.RETENCAO, 0)
          )
          FROM FK2_FACTURA_ITEMS fi
          WHERE fi.CODIGOFACTURA = f.CODIGO
            AND fi.ESTADO = 0
      ), 0)
  )
      
`);
    



      await qr.commitTransaction();
      this.logger.log('Execução de teste concluída com sucesso.');

    } catch (error) {
      await qr.rollbackTransaction();
      this.logger.error('Erro no teste de aplicação de multas', error);
      this.logger.error(error.stack || error.message);
    } finally {
      await qr.release();


  }
}
}