import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExameService } from "../service/exame.service";

@Processor('results_final_exam')
export class ProcessorExam extends WorkerHost {


    constructor(
        private readonly exameService: ExameService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>) {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        if (job.name === 'processResultsFinalExam') {
            console.log('ESTOU AQUI NO RESULTS FINAL EXAM');
            const result = await this.exameService.corrigirTodasAsProvas();
            console.log(result);
        }
        return { success: true };

    }
    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        console.log(`Job ${job.id} has completed!`);
    }
    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        console.log(`Job ${job.id} has failed! Error: ${error.message}`);
    }

}