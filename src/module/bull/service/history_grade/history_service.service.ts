import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';

@Injectable()
export class HistoryGradeJobService {
    private readonly logger = new Logger(HistoryGradeJobService.name);

    constructor(
        @InjectQueue('history_grade_processor')
        private readonly queue: Queue,
        private readonly dataSource: DataSource,
    ) { }

    // Dispara UMA VEZ agora — o processor vai buscar os alunos e delegar
    async startOnce() {
        const job = await this.queue.add(
            'processHistoryGrade',
            {},
            { removeOnComplete: true, removeOnFail: false },
        );
        return { jobId: job.id, status: 'queued' };
    }

    // Agenda para rodar todo dia em um horário
    async scheduleDaily(cronExpression = '0 6 * * *') {
        const job = await this.queue.add(
            'processHistoryGrade',
            {},
            {
                repeat: { pattern: cronExpression },
                removeOnComplete: true,
            },
        );
        return { jobId: job.id, cron: cronExpression, status: 'scheduled' };
    }

    // Para/remove o job agendado — precisa passar o mesmo cron usado ao criar
    async stopScheduled(cronExpression = '0 6 * * *') {
        await this.queue.removeRepeatable('processHistoryGrade', {
            pattern: cronExpression,
        });
        return { status: 'stopped', cron: cronExpression };
    }

    // Remove um job específico pelo ID
    async removeJob(jobId: string) {
        const job = await this.queue.getJob(jobId);
        if (!job) return { status: 'not_found' };
        await job.remove();
        return { status: 'removed', jobId };
    }

    // Lista todos os jobs agendados (repeatable)
    async listScheduled() {
        return this.queue.getRepeatableJobs();
    }

    // Busca alunos com notas inválidas — chamado pelo processor
    async getAllStudentsWithInvalidGrades(): Promise<{ codigo: number }[]> {
        //BUSCAR ALUNOS QUE A MEDIA NAO FOI LANCADA OU ESTA INVALIDA E A SUA UC É DO SEMESTRE PASSADO OU ANTERIOR
        //WHERE M.ANO_LETIVO <= (SELECT max(ano_letivo) - 1 FROM FK2_TB_GRADE_CURRICULAR_ALUNO)

        const sql = `SELECT codigo FROM FK2_TB_GRADE_CURRICULAR_ALUNO WHERE CODIGO_STATUS_GRADE_CURRICULAR = 2`;
        return this.dataSource.query(sql);
    }

    // Limpa jobs por status
    async clearQueue(status: 'completed' | 'failed' | 'wait' | 'active' | 'delayed') {
        await this.queue.clean(0, 100, status);
        return { status: 'cleared', type: status };
    }

    // Limpa TUDO da fila (cuidado!)
    async obliterateQueue() {
        await this.queue.obliterate({ force: true });
        return { status: 'queue_obliterated' };
    }

    // Status geral da fila
    async getQueueStatus() {
        const [waiting, active, completed, failed, delayed, repeatableJobs] =
            await Promise.all([
                this.queue.getWaitingCount(),
                this.queue.getActiveCount(),
                this.queue.getCompletedCount(),
                this.queue.getFailedCount(),
                this.queue.getDelayedCount(),
                this.queue.getRepeatableJobs(),
            ]);

        return { waiting, active, completed, failed, delayed, repeatableJobs };
    }
}