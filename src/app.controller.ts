import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Jobs Overview')
@Controller('jobs')
export class AppController {

  constructor(
    @InjectQueue('history_grade_processor') private readonly historyQueue: Queue,
    @InjectQueue('final_average') private readonly finalAverageQueue: Queue,
    @InjectQueue('schedule_events') private readonly scheduleQueue: Queue,
    @InjectQueue('operator_box') private readonly operatorBoxQueue: Queue,
  ) { }

  @Get('overview')
  @ApiOperation({ summary: 'Visão geral de todas as filas e seus jobs' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        history_grade_processor: { waiting: 0, active: 0, completed: 10, failed: 1, delayed: 0, repeatableJobs: [] },
        final_average: { waiting: 5, active: 2, completed: 80, failed: 0, delayed: 0, repeatableJobs: [] },
        schedule_events: { waiting: 0, active: 0, completed: 3, failed: 0, delayed: 0, repeatableJobs: [] },
        operator_box: { waiting: 0, active: 0, completed: 12, failed: 0, delayed: 0, repeatableJobs: [] },
      },
    },
  })
  async getOverview() {
    const [history, finalAverage, schedule, operatorBox] = await Promise.all([
      this.getQueueInfo(this.historyQueue),
      this.getQueueInfo(this.finalAverageQueue),
      this.getQueueInfo(this.scheduleQueue),
      this.getQueueInfo(this.operatorBoxQueue),
    ]);

    return {
      history_grade_processor: history,
      final_average: finalAverage,
      schedule_events: schedule,
      operator_box: operatorBox,
    };
  }

  private async getQueueInfo(queue: Queue) {
    const [waiting, active, completed, failed, delayed, repeatableJobs] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getRepeatableJobs(),
      ]);

    return { waiting, active, completed, failed, delayed, repeatableJobs };
  }
}