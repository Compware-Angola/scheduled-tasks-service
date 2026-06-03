import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { HistoryGradeJobService } from '../../service/history_grade/history_service.service';

@Processor('history_grade_processor')
export class HistoryGradeProcessor extends WorkerHost {
    private readonly logger = new Logger(HistoryGradeProcessor.name);

    constructor(
        @InjectQueue('final_average')
        private readonly finalAverageQueue: Queue,
        private readonly historyGradeJobService: HistoryGradeJobService,
    ) { super(); }

    async process(job: Job) {
        this.logger.log(`Processando job ${job.id} — tipo: ${job.name}`);

        if (job.name === 'processHistoryGrade') {
            // 1. Busca todos os alunos com notas inválidas
            const alunos = await this.historyGradeJobService.getAllStudentsWithInvalidGrades();

            if (!alunos.length) {
                this.logger.log('Nenhum aluno com nota inválida encontrado.');
                return { success: true, total: 0 };
            }

            // 2. Dispara um job de média final para cada aluno na fila final_average
            await this.finalAverageQueue.addBulk(
                alunos.map(aluno => ({
                    name: 'processFinalAverage',
                    data: { codigoGradeAluno: aluno.codigo },
                    opts: {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 2000 },
                        removeOnComplete: true,
                        removeOnFail: false,
                    },
                }))
            );

            this.logger.log(`${alunos.length} alunos enfileirados para recálculo.`);
            return { success: true, total: alunos.length };
        }

        this.logger.warn(`Tipo de job desconhecido: ${job.name}`);
        return { success: false, message: 'Unknown job type' };
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`Job ${job.id} finalizado. Total enfileirado: ${job.returnvalue?.total}`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} falhou: ${error.message}`);
    }
}