import { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { InfoAcademicService } from "../../service/info_academic.service";


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
            console.log("ESTOU AQUI");



            await this.infoAcademicService.processFinalAverage(codigoGradeAluno, 'Calculado automaticamente:BY_SYSTEM');
            console.log(`Job ${job.id} completed successfully.`);
            return { success: true };
        }
        if (job.name === 'UpdateStatusGrade') {
            const { codigoGradeAluno, nota } = job.data;
            let status = nota >= 10 ? 3 : 1;
            console.log("ESTOU AQUI NO UPDATE");

            await this.infoAcademicService.updateGradeStatus(codigoGradeAluno, status, `Atualizado automaticamente:BY_SYSTEM`);
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