import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Injectable } from "@nestjs/common";

@Injectable()
export class OperatorBoxService {
    private readonly logger = new Logger(OperatorBoxService.name);
    constructor(private readonly dataSource: DataSource) { }
    async processOperatorBox(codigoUtilizador: number) {
        try {
            const result = await this.dataSource.query(
    `
    UPDATE FK2_TB_CAIXAS
    SET BLOQUEIO = :blocked
    WHERE OPERADOR_ID = :operatorId
      AND DELETED_AT IS NULL
    `,
    {
      blocked: 'S',
      operatorId:codigoUtilizador,
    } as any,
  );

  return result;

        }
        catch (err) {
            this.logger.error('Erro ao processar caixa do operador', err.stack);
            throw err;
        }

    }
}