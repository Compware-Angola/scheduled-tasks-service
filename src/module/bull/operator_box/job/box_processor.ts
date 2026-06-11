import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OperatorBoxService } from '../service/operator_box_service.service';
@Processor('operator_box')
export class BoxProcessor extends WorkerHost {
    constructor(
        private readonly operatorBoxService: OperatorBoxService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>) {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        if (job.name === 'processOperatorBox') {
            console.log('ESTOU AQUI NO BOX');

            const { codigoUtilizador } = job.data;
            await this.operatorBoxService.processOperatorBox(codigoUtilizador);
        }
        return { success: true };

    }
    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        console.log(`Job ${job.id} has completed!`);
    }
}
