import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AuthService } from "../auth.service";


@Injectable()
export class AuthCronService {
  private readonly logger = new Logger(AuthCronService.name);
  constructor(private readonly auth: AuthService) {

  }


  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleAuth() {
    this.logger.log("⏰ Cron rodou: ClearOldSessions");
    await this.auth.ClearOldSessions()

  }
}
