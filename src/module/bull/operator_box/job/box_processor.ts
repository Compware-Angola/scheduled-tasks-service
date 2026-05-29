import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OperatorBoxService } from '../service/operator_box_service.service';
@Processor('operator_box')
export class BoxProcessor extends WorkerHost {
    private readonly logger = new Logger(BoxProcessor.name);
    constructor(

        private readonly operatorBoxService: OperatorBoxService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>) {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        if (job.name === 'processOperatorBox') {
            const { codigoUtilizador } = job.data;


            await this.operatorBoxService.processOperatorBox(codigoUtilizador);
            console.log(`Job ${job.id} completed successfully.`);
            return { success: true };
        }

        console.log(`Job ${job.id} has an unknown type: ${job.name}`);
        return { success: false, "message": 'Unknown job type' };

    }
    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        console.log(`Job ${job.id} has completed!`);
    }
}
