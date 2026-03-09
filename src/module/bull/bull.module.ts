
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleConsumer } from './job/schedule-processor';
import { ScheduleService } from './service/schedule_service.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule,
        BullModule.registerQueue({
          name: 'schedule-events',
        }),


      ],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          //password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
  ],
  exports: [BullModule],
   providers: [ScheduleConsumer,ScheduleService],
})
export class BullConfigModule { }