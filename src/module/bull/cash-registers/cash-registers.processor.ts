import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { CashRegistersService } from "./cash-registers.service";
import { Job } from "bullmq";
import { CLOSE_CASH_QUEUE } from "./queue.constants";

@Processor(CLOSE_CASH_QUEUE)
export class CashRegistersProcessor extends WorkerHost {

    private readonly logger = new Logger(CashRegistersProcessor.name);

    constructor(
        private readonly service: CashRegistersService,
    ) {
        super();
    }

    async process(job: Job) {

        this.logger.log(`Executando Job ${job.name}`);

        await this.service.closeCashRegisters();

        this.logger.log('Job finalizado');
    }

}