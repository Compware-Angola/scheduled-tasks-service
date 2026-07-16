


import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AcademicYearCronService } from '../service/anoLectivoCron.service';

@Injectable()
export class AcademicYearCron {
    constructor(private readonly serive: AcademicYearCronService) { }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async activarAnoLectivoPendente() {
        await this.serive.activarAnoLectivoPendente();
    }
}