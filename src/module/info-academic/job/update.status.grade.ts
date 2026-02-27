import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InfoAcademicService } from '../info-academic.service';
import { AnoLectivoUtil } from 'src/module/util/current-academic-year';

@Injectable()
export class GradeSituationCron {

  private readonly logger = new Logger(GradeSituationCron.name);

  constructor(
    private readonly infoAcademicService: InfoAcademicService,
    private readonly anoLectivoUtil: AnoLectivoUtil
  ) {}
 /*
  @Cron(CronExpression.EVERY_DAY_AT_2AM) 
  async expirePendingReferences() {

    this.logger.log('⏳ Início da verificação de grades');

    try {

      // 🔥 Atualiza ano e semestre
      const anoLectivo = await this.anoLectivoUtil.getAnoAtualId();
      const semestreInfo = await this.anoLectivoUtil.getSemestreAtual();

      if (!semestreInfo.semestre || !semestreInfo.dataFim) {
        this.logger.warn('⚠ Semestre não definido ou data de fim inexistente. Processo interrompido.');
        return;
      }

      // 🔥 Verifica se estamos dentro dos 3 dias antes do fim do semestre
      const hoje = new Date();
      const tresDiasAntes = new Date(semestreInfo.dataFim);
      tresDiasAntes.setDate(tresDiasAntes.getDate() - 3);

      if (hoje < tresDiasAntes) {
        this.logger.log(`⏳ Ainda não estamos nos 3 dias finais do semestre (${semestreInfo.descricao}). Processo interrompido.`);
        return;
      }

 
      let page = 1;
      const limit = 20;
      let totalProcessados = 0;

      while (true) {
        const result = await this.infoAcademicService.retornarGradeAvaliadaByAno(
          anoLectivo,
          semestreInfo.semestre,
          page,
          limit
        );

        if (!result?.data || result.data.length === 0) {
          break; // termina quando não houver mais registros
        }

        for (const grade of result.data) {
          const data = await this.infoAcademicService.processarNotas(grade);

          if (data) {
            const media = Number(data.media ?? 0);
            const estado = media < 10 ? 1 : 3;

            await this.infoAcademicService.updateStatusGrade(
              data.codigoGradeAluno,
              estado,
              media,
              anoLectivo,
              data.obs
            );

            totalProcessados++;
          }
        }

        page++;
      }

      this.logger.log(`✅ Processo concluído. Total processado: ${totalProcessados}`);

    } catch (error) {
      this.logger.error('❌ Erro ao processar grades', error);
    }
  }
    */
}
