import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { PaymentMethod } from "./cash-register-status.enum";

@Injectable()
export class CashRegistersService {
    private readonly logger = new Logger(CashRegistersService.name);

    constructor(private readonly dataSource: DataSource) { }

    async closeCashRegisters() {
        const openCashRegisters = await this.findOpenCashRegisters();

        this.logger.log(`Caixas abertas: ${openCashRegisters.length}`);

        await Promise.all(
            openCashRegisters.map((cashRegister) =>
                this.processCashRegister(cashRegister),
            ),
        );
    }

    private async processCashRegister(params: {
        operatorId: number;
        cashRegisterId: number;
    }) {
        return this.dataSource.transaction(async (manager) => {
            try {
                const movements = await this.findMovementByCashRegisterId(
                    manager,
                    params,
                );

                if (!movements.length) {
                    this.logger.warn(
                        `Sem movimentos pendentes caixa ${params.cashRegisterId}`,
                    );
                    return;
                }

                for (const movement of movements) {
                    await this.closeMovement(manager, {
                        operatorId: params.operatorId,
                        cashRegisterId: params.cashRegisterId,
                        movementId: movement.movementId,
                        openingAmount: movement.amountOpen,
                        createdAt: movement.createdAt,
                    });
                }
            } catch (error) {
                this.logger.error(
                    `Erro ao fechar caixa ${params.cashRegisterId}`,
                    error,
                );
                throw error;
            }
        });
    }


    private async closeMovement(
        manager: any,
        params: {
            operatorId: number;
            cashRegisterId: number;
            movementId: number;
            openingAmount: number;
            createdAt: Date;
        },
    ) {
        const summary = await this.calculateCashRegisterSummary(manager, {
            operatorId: params.operatorId,
            cashRegisterId: params.cashRegisterId,
            createdAt: params.createdAt,
        });

        const closingDate = new Date();

        await manager.query(
            `
      UPDATE FK2_TB_MOVIMENTOS_CAIXAS
      SET
        STATUS_ = 'fechado',
        STATUS_FINAL = 'fechado',
        STATUS_ADMIN = 'pendente',
        DATA_FECHO = :1,
        HORA_FECHO = :2,
        VALOR_ARRECADADO_PAGAMENTO = :3,
        VALOR_ARRECADADO_TPA = :4,
        VALOR_ARRECADADO_TOTAL = :5
      WHERE CODIGO = :6
      `,
            [
                closingDate,
                this.formatTime(closingDate),
                summary.totalCash,
                summary.totalCard,
                params.openingAmount + summary.totalCash + summary.totalCard,
                params.movementId,
            ],
        );

        await manager.query(
            `
      UPDATE FK2_TB_CAIXAS
      SET
        STATUS_ = 'fechado',
        OPERADOR_ID = NULL,
        CODE = NULL,
        UPDATED_AT = SYSDATE
      WHERE CODIGO = :1
      `,
            [params.cashRegisterId],
        );
    }

    private async findMovementByCashRegisterId(
        manager: any,
        params: {
            operatorId: number;
            cashRegisterId: number;
        },
    ) {
        const result = await manager.query(
            `
      SELECT
        CODIGO,
        CREATED_AT,
        VALOR_ABERTURA
      FROM FK2_TB_MOVIMENTOS_CAIXAS
      WHERE OPERADOR_ID = :1
        AND CAIXA_ID = :2
        AND STATUS_FINAL = 'pendente'
      `,
            [params.operatorId, params.cashRegisterId],
        );

        return result.map((row: any) => ({
            movementId: Number(row.CODIGO),
            createdAt: new Date(row.CREATED_AT),
            amountOpen: Number(row.VALOR_ABERTURA || 0),
        }));
    }

    // ==============================
    // CAIXAS ABERTAS
    // ==============================
    private async findOpenCashRegisters() {
        const result = await this.dataSource.query(
            `
      SELECT OPERADOR_ID, CODIGO
      FROM FK2_TB_CAIXAS
      WHERE STATUS_ = 'aberto'
        AND DELETED_AT IS NULL
      `,
        );

        return result.map((row: any) => ({
            operatorId: Number(row.OPERADOR_ID),
            cashRegisterId: Number(row.CODIGO),
        }));
    }


    private async calculateCashRegisterSummary(
        manager: any,
        params: {
            operatorId: number;
            cashRegisterId: number;
            createdAt: Date;
        },
    ) {
        const result = await manager.query(
            `
      SELECT
        SUM(CASE WHEN FORMA_PAGAMENTO = ${PaymentMethod.CASH}
          THEN VALOR_DEPOSITADO ELSE 0 END) AS TOTAL_CASH,

        SUM(CASE WHEN FORMA_PAGAMENTO = ${PaymentMethod.CARD}
          THEN VALOR_DEPOSITADO ELSE 0 END) AS TOTAL_CARD

      FROM FK2_TB_PAGAMENTOS
      WHERE FK_UTILIZADOR = :1
        AND CAIXA_ID = :2
        AND ESTADO = 2
        AND CREATED_AT >= :3
      `,
            [params.operatorId, params.cashRegisterId, params.createdAt],
        );

        return {
            totalCash: Number(result[0]?.TOTAL_CASH || 0),
            totalCard: Number(result[0]?.TOTAL_CARD || 0),
        };
    }

    formatTime(date: Date = new Date()) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

}