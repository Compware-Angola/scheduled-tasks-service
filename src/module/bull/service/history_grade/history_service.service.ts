import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { AnoLectivoUtil } from 'src/module/util/current-academic-year';

export interface ScheduleOptions {
    cron?: string;
    everyMs?: number;
}

@Injectable()
export class HistoryGradeJobService {
    private readonly logger = new Logger(HistoryGradeJobService.name);

    constructor(
        @InjectQueue('history_grade_processor')
        private readonly queue: Queue,
        private readonly dataSource: DataSource,
        private readonly anoLectivoUtil: AnoLectivoUtil,
    ) { }

    async startOnce() {
        const codigoAnoLectivo = await this.anoLectivoUtil.getAnoAtualId();
        const job = await this.queue.add(
            'processHistoryGrade',
            { codigoAnoLectivo },
            { removeOnComplete: true, removeOnFail: false },
        );
        return { jobId: job.id, status: 'queued', codigoAnoLectivo };
    }

    async scheduleJob(options: ScheduleOptions = {}) {
        const codigoAnoLectivo = await this.anoLectivoUtil.getAnoAtualId();

        // Se passar cron usa cron, senão usa everyMs, senão default 10 segundos
        const repeat = options.cron
            ? { pattern: options.cron }
            : { every: options.everyMs ?? 10000 };

        const job = await this.queue.add(
            'processHistoryGrade',
            { codigoAnoLectivo },
            { repeat, removeOnComplete: true },
        );

        return {
            jobId: job.id,
            status: 'scheduled',
            codigoAnoLectivo,
            repeat: options.cron
                ? { type: 'cron', value: options.cron }
                : { type: 'interval', value: `${options.everyMs ?? 10000}ms` },
        };
    }

    async stopScheduled(options: ScheduleOptions = {}) {
        const repeat = options.cron
            ? { pattern: options.cron }
            : { every: options.everyMs ?? 10000 };

        await this.queue.removeRepeatable('processHistoryGrade', repeat);
        return { status: 'stopped', repeat };
    }

    async removeJob(jobId: string) {
        const job = await this.queue.getJob(jobId);
        if (!job) return { status: 'not_found' };
        await job.remove();
        return { status: 'removed', jobId };
    }

    async listScheduled() {
        return this.queue.getRepeatableJobs();
    }

    async getAllStudentsWithInvalidGrades(codigoAnoLectivo: number): Promise<any[]> {
        const sql = `
            SELECT 
                M.CODIGO,
                M.CODIGO_ANO_LECTIVO,
                M.CODIGO_STATUS_GRADE_CURRICULAR,
                M.CODIGO_GRADE_CURRICULAR,
                M.CODIGO_MATRICULA
            FROM FK2_TB_GRADE_CURRICULAR_ALUNO M
            LEFT JOIN FK2_TB_GRADE_CURRICULAR C ON M.CODIGO_GRADE_CURRICULAR = C.CODIGO
            WHERE M.CODIGO_STATUS_GRADE_CURRICULAR = 2
            AND (
                M.CODIGO_ANO_LECTIVO < :codigoAnoLectivo
                OR (
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

    async clearQueue(status: 'completed' | 'failed' | 'wait' | 'active' | 'delayed') {
        await this.queue.clean(0, 100, status);
        return { status: 'cleared', type: status };
    }

    async obliterateQueue() {
        await this.queue.obliterate({ force: true });
        return { status: 'queue_obliterated' };
    }

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