import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ScheduleService } from '../service/schedule_service.service';

@Processor('schedule_service')
export class ScheduleConsumer extends WorkerHost {
  constructor(
    private readonly scheduleService: ScheduleService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>) {
    console.log(`Processing job ${job.id} of type ${job.name}`);
   if (job.name === 'scheduleClass') {
      const { scheduleId } = job.data;
      console.log("2",scheduleId);
      

    await this.scheduleService.scheduleClass(scheduleId);
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