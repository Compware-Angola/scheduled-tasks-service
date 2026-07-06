import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { CLOSE_CASH_QUEUE } from "./queue.constants";

@Injectable()
export class CashRegistersCron {
    constructor(
        @InjectQueue(CLOSE_CASH_QUEUE)
        private readonly queue: Queue,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handle() {
        await this.queue.add(
            CLOSE_CASH_QUEUE,
            {},
            {
                removeOnComplete: true,
                removeOnFail: 50,
            },
        );
    }
}