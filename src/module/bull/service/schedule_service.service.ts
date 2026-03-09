
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly dataSource: DataSource) {}

  async scheduleClass(scheduleId:number){


    try {
   this.logger.warn("AQUI VOU AGENDAR AS AULAS")
      
    } catch (err) {
      this.logger.error('Erro na expiração de referências', err.stack);
      throw err;
    }
  }
}