import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { AnoLectivoUtil } from 'src/module/util/current-academic-year';

@Injectable()
export class HistoryGradeJobService {
    private readonly logger = new Logger(HistoryGradeJobService.name);
    constructor(
        @InjectQueue('history_grade_processor')
        private readonly queue: Queue,
        private readonly dataSource: DataSource,
        private readonly anoLectivoUtil: AnoLectivoUtil,
    ) { }

    // Dispara UMA VEZ agora — o processor vai buscar os alunos e delegar
    async startOnce() {
        const codigoAnoLectivo = await this.anoLectivoUtil.getAnoAtualId();
        const job = await this.queue.add(
            'processHistoryGrade',
            { codigoAnoLectivo },
            { removeOnComplete: true, removeOnFail: false },
        );
        return { jobId: job.id, status: 'queued' };
    }

    // Agenda para rodar todo dia em um horário
    async scheduleDaily(cronExpression = '0 6 * * *') {
        const codigoAnoLectivo = await this.anoLectivoUtil.getAnoAtualId();
        const job = await this.queue.add(
            'processHistoryGrade',
            { codigoAnoLectivo },
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
    async getAllStudentsWithInvalidGrades(codigoAnoLectivo: number): Promise<any[]> {
        const sql = `
        SELECT 
            M.CODIGO,
            M.CODIGO_ANO_LECTIVO,
            M.CODIGO_STATUS_GRADE_CURRICULAR,
            M.CODIGO_GRADE_CURRICULAR,
            M.CODIGO_MATRICULA
           -- C.*
        FROM FK2_TB_GRADE_CURRICULAR_ALUNO M
        LEFT JOIN FK2_TB_GRADE_CURRICULAR C ON M.CODIGO_GRADE_CURRICULAR = C.CODIGO
        WHERE M.CODIGO_STATUS_GRADE_CURRICULAR = 2
        AND (
            -- Ano lectivo passado: traz independente do semestre
            M.CODIGO_ANO_LECTIVO < :codigoAnoLectivo

            OR

            -- Ano lectivo actual: só traz se estivermos no 2º semestre e a UC for do 1º
            (
                M.CODIGO_ANO_LECTIVO = :codigoAnoLectivo
                AND (
                    SELECT MAX(C2.CODIGO_SEMESTRE)
                    FROM FK2_TB_GRADE_CURRICULAR_ALUNO M2
                    LEFT JOIN FK2_TB_GRADE_CURRICULAR C2 ON M2.CODIGO_GRADE_CURRICULAR = C2.CODIGO
                    WHERE M2.CODIGO_ANO_LECTIVO = :codigoAnoLectivo
                ) = 2
                AND C.CODIGO_SEMESTRE = 1
            )
        )
        FETCH FIRST 10 ROWS ONLY
    `;
        return this.dataSource.query(sql, { codigoAnoLectivo } as any);
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