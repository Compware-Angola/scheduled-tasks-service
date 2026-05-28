import { Job } from "bullmq";
import { InfoAcademicService } from "../service/info_academic.service";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";


@Processor('final_average')
export class FinalAverageConsumer extends WorkerHost {
    constructor(
        private readonly infoAcademicService: InfoAcademicService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>) {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        if (job.name === 'processFinalAverage') {
            const { codigoGradeAluno } = job.data;


            await this.infoAcademicService.processFinalAverage(codigoGradeAluno);
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