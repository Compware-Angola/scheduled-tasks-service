import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleConsumer } from './job/schedule-processor';
import { ScheduleService } from './service/schedule_service.service';
import { AnoLectivoUtil } from '../util/current-academic-year';
import { AcademicYear } from '../entities/academic.year.entity';
import { InfoAcademicService } from './service/info_academic.service';
import { BoxProcessor } from './operator_box/job/box_processor';
import { OperatorBoxService } from './operator_box/service/operator_box_service.service';
import { FinalAverageConsumer } from './job/grade_processor/grade-processor';
import { HistoryGradeJobService } from './service/history_grade/history_service.service';
import { HistoryGradeProcessor } from './job/grade_processor/history_grade.processor';
import { HistoryGradeJobController } from './controller/history-grade-job.controller';
import { StudentNoteService } from './service/sudents-notes.service';
import { CLOSE_CASH_QUEUE } from './cash-registers/queue.constants';
import { CashRegistersService } from './cash-registers/cash-registers.service';
import { CashRegistersCron } from './cash-registers/cash-registers-expiration.cron';
import { CashRegistersProcessor } from './cash-registers/cash-registers.processor';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AcademicYear]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        prefix: config.get<string>('BULL_PREFIX') || 'dev',
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    BullModule.registerQueue({ name: 'schedule-events' }),
    BullModule.registerQueue({ name: 'operator_box' }),
    BullModule.registerQueue({ name: 'final_average' }),
    BullModule.registerQueue({ name: 'history_grade_processor' }),
    BullModule.registerQueue({
      name: CLOSE_CASH_QUEUE,
    }),
  ],
  providers: [
    ScheduleConsumer,
    ScheduleService,
    AnoLectivoUtil,
    FinalAverageConsumer,
    HistoryGradeProcessor,
    HistoryGradeJobService,
    InfoAcademicService,
    BoxProcessor,
    OperatorBoxService,
    StudentNoteService,
    CashRegistersService,
    CashRegistersCron,
    CashRegistersProcessor
  ],
  controllers: [
    HistoryGradeJobController,
  ],
  exports: [AnoLectivoUtil, BullModule],
})
export class BullConfigModule { }
