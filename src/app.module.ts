import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { ConfigModule, ConfigService } from '@nestjs/config';

import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './module/auth/auth.service';
import { CronService } from './module/auth/job/cron';
import { PaymentExpirationCron } from './module/finance/job/payment-expiration.cron';
import { PaymentsService } from './module/finance/payment.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
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
  providers: [AuthService,CronService,PaymentExpirationCron,PaymentsService],
})
export class AppModule {}
