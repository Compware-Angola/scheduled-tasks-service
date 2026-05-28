import { Processor } from "@nestjs/bullmq";
import { WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HistoryGradeService } from "../../service/history_grade/history_service.service";



@Processor('history_grade_processor')
export class HistoryGradeProcessor extends WorkerHost {
    constructor(
        private readonly historyGradeService: HistoryGradeService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>) {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        if (job.name === 'processFinalAverage') {
            const { codigoGradeAluno } = job.data;


            console.log(`Job ${job.id} completed successfully.`);
            return { success: true };
        }

        console.log(`Job ${job.id} has an unknown type: ${job.name}`);
        return { success: false, "message": 'Unknown job type' };

    }
}