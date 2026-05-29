import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduleConsumer } from './job/schedule-processor';
import { ScheduleService } from './service/schedule_service.service';
import { AnoLectivoUtil } from '../util/current-academic-year';
import { AcademicYear } from '../entities/academic.year.entity';
import { FinalAverageConsumer } from './job/final-average-processor';
import { InfoAcademicService } from './service/info_academic.service';
import { BoxProcessor } from './operator_box/job/box_processor';
import { OperatorBoxService } from './operator_box/service/operator_box_service.service';

@Module({
  imports: [
    ConfigModule, // necessário para pegar as configs
    TypeOrmModule.forFeature([AcademicYear]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        prefix: config.get<string>('BULL_PREFIX') || 'dev',
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          // password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'schedule-events',
    }),
    BullModule.registerQueue({
      name: 'operator_box',
    }),
  ],
  providers: [
    ScheduleConsumer,
    ScheduleService,
    AnoLectivoUtil,
    FinalAverageConsumer,
    InfoAcademicService,
    BoxProcessor,
    OperatorBoxService
  ],
  exports: [AnoLectivoUtil],
})
export class BullConfigModule { }