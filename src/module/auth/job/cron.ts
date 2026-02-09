import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AuthService } from "../auth.service";


@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor( private readonly auth: AuthService){

  }


  @Cron(CronExpression.EVERY_DAY_AT_2AM)
 async handleEveryMinute() {
    this.logger.log("⏰ Cron rodou: EVERY_DAY_AT_2AM");
    await this.auth.ClearOldSessions(12)

  }
}
