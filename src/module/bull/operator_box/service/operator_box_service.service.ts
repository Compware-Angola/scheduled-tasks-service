import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";


export class OperatorBoxService {
    private readonly logger = new Logger(OperatorBoxService.name);

    constructor(private readonly dataSource: DataSource) { }
    async processOperatorBox(codigoUtilizador: number) {
        console.log(`Processing operator box for operator: ${codigoUtilizador}`);

        try {
            //VERIFICAR SE È OPERADOR  E PROCESSGUIR .....

        }
        catch (err) {
            this.logger.error('Erro ao processar caixa do operador', err.stack);
            throw err;
        }

    }
}