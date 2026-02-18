import { Injectable, Logger } from '@nestjs/common';
import { InfoAcademicService } from './info-academic.service';

@Injectable()
export class ManualGradeCorrectionService {

  private readonly logger = new Logger(ManualGradeCorrectionService.name);

  constructor(
    private readonly infoAcademicService: InfoAcademicService
  ) {}

  /**
   * Corrige grades de um range de anos e semestres
   * @param anosLectivos - array de anos letivos (ex: [20,21,22,23])
   * @param semestres - array de semestres (ex: [1,2])
   */
  async corrigirGradesPorRange(
    anosLectivos: number[],
    semestres: number[]
  ) {
    this.logger.log(`⏳ Início da correção de grades para anos ${anosLectivos.join(', ')} e semestres ${semestres.join(', ')}`);

    let totalGeral = 0;

    for (const ano of anosLectivos) {
      for (const semestre of semestres) {
        let page = 1;
        const limit = 20;
        let totalProcessados = 0;

        this.logger.log(`🔹 Processando ano ${ano}, semestre ${semestre}...`);

        while (true) {
          const result = await this.infoAcademicService.retornarGradeAvaliadaByAno(
            ano,
            semestre,
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
                ano,
                data.obs
              );

              totalProcessados++;
            }
          }

          page++;
        }

        totalGeral += totalProcessados;
        this.logger.log(`✅ Ano ${ano}, semestre ${semestre} concluído. Total processado: ${totalProcessados}`);
      }
    }

    this.logger.log(`🎯 Correção completa! Total geral de grades processadas: ${totalGeral}`);
  }
}
