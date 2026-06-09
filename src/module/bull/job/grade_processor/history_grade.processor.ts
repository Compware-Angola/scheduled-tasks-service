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
            const { codigoAnoLectivo } = job.data;

            if (codigoAnoLectivo === undefined) {
                this.logger.error('Parâmetro codigoAnoLectivo ausente no job');
                return {
                    success: false,
                    message: 'codigoAnoLectivo ausente',
                };
            }

            const alunos =
                await this.historyGradeJobService.getAllStudentsWithInvalidGrades(
                    codigoAnoLectivo,
                );

            this.logger.log(
                `Total de alunos com nota inválida: ${alunos.length}`,
            );

            if (!alunos.length) {
                this.logger.log(
                    'Nenhum aluno com nota inválida encontrado.',
                );
                return { success: true, total: 0 };
            }

            const processJobs: any[] = [];
            const recalculateJobs: any[] = [];

            for (const aluno of alunos) {
                console.log('Aluno', aluno);

                const possuiNota = aluno.NOTA != 0;


                if (possuiNota) {
                    recalculateJobs.push({
                        name: 'UpdateStatusGrade',
                        data: {
                            codigoGradeAluno: aluno.CODIGO,
                            nota: aluno.NOTA,
                        },
                        opts: {
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 2000,
                            },
                            removeOnComplete: true,
                            removeOnFail: false,
                        },
                    });
                } else {
                    processJobs.push({
                        name: 'processFinalAverage',
                        data: {
                            codigoGradeAluno: aluno.CODIGO,
                        },
                        opts: {
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 2000,
                            },
                            removeOnComplete: true,
                            removeOnFail: false,
                        },
                    });
                }
            }

            if (processJobs.length) {
                await this.finalAverageQueue.addBulk(processJobs);
            }

            if (recalculateJobs.length) {
                await this.finalAverageQueue.addBulk(recalculateJobs);
                // ou outra fila:
                // await this.recalculateQueue.addBulk(recalculateJobs);
            }

            this.logger.log(
                `${processJobs.length} alunos para cálculo e ${recalculateJobs.length} para recálculo.`,
            );

            return {
                success: true,
                total: alunos.length,
                processados: processJobs.length,
                recalculados: recalculateJobs.length,
            };
        }

        this.logger.warn(`Tipo de job desconhecido: ${job.name}`);

        return {
            success: false,
            message: 'Unknown job type',
        };
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