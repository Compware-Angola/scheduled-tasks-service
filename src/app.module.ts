import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { ConfigModule, ConfigService } from '@nestjs/config';

import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './module/auth/auth.service';
import { CronService } from './module/auth/job/cron';
import { PaymentExpirationCron } from './module/finance/job/payment-expiration.cron';
import { PaymentsService } from './module/finance/payment.service';
import { GradeSituationCron } from './module/info-academic/job/update.status.grade';
import { InfoAcademicService } from './module/info-academic/info-academic.service';
import { AcademicYear } from './module/entities/academic.year.entity';
import { AnoLectivoUtil } from './module/util/current-academic-year';
import { MonthlyFeePenaltyService } from './module/finance/payment-monthly-fee.service';
import { MonthlyFeePenaltyCron } from './module/finance/job/payment-monthly-fee.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([AcademicYear]),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (() => {
        switch (process.env.NODE_ENV) {
          case 'production':
            return '.env.prod';
          case 'preprod':
            return '.env.preprod';
          default:
            return '.env.dev';
        }
      })(),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isSSL = config.get<string>('DB_SSL') === 'true';

        return {
          type: 'oracle' as const,
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT', 1521),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          sid: config.get<string>('DB_SID'),

          entities: [`${__dirname}/**/*.entity{.ts,.js}`],
          synchronize: false,
          logging: ['query', 'error'],

          extra: {
            disableInsertDefaultValues: true,
            ...(isSSL ? { ssl: { rejectUnauthorized: true } } : {}),
          },
        };
      },
    }),
  ],
  controllers: [],
  providers: [AuthService, CronService,
    PaymentExpirationCron, PaymentsService, 
     InfoAcademicService,
   AnoLectivoUtil, MonthlyFeePenaltyService,MonthlyFeePenaltyCron],
})
export class AppModule { }
