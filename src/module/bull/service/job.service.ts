import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class JobService {
    constructor(
        @InjectQueue('schedule_events')
        private readonly scheduleQueue: Queue,

        @InjectQueue('operator_box')
        private readonly operatorQueue: Queue,

        @InjectQueue('final_average')
        private readonly finalAverageQueue: Queue,

        @InjectQueue('history_grade_processor')
        private readonly historyQueue: Queue,

        @InjectQueue('results_final_exam')
        private readonly examQueue: Queue,
    ) { }

    private getQueue(name: string): Queue {
        const queues = {
            schedule_events: this.scheduleQueue,
            operator_box: this.operatorQueue,
            final_average: this.finalAverageQueue,
            history_grade_processor: this.historyQueue,
            results_final_exam: this.examQueue,
        };

        return queues[name];
    }

    async getJobStatus(queueName: string, id: string) {
        const queue = this.getQueue(queueName);

        if (!queue) {
            return { message: `Queue ${queueName} inválida`, status: 'invalid', queue: queueName, success: false };
        }

        const job = await queue.getJob(id);

        if (!job) {
            return { message: 'Job não encontrado', status: 'notfound', queue: queueName, success: false };
        }

        return {
            queue: queueName,
            message: 'Job encontrado',
            success: true,
            status: await job.getState(),
        };
    }
}