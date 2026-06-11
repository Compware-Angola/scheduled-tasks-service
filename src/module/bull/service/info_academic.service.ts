import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StudentNoteService } from './sudents-notes.service';
import { EstadoAvaliacaoEnum } from 'src/module/types/types';

@Injectable()
export class InfoAcademicService {
  private readonly logger = new Logger(InfoAcademicService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly studentsNoteService: StudentNoteService,
  ) { }

  async processFinalAverage(codigoGradeAluno: number, observacao: string) {
    //AQUI VAI PROCESSAR A MEDIA FINAL DO ALUNO
    //DEPOIS VAI ATUALIZAR A NOTA
    //DEPOIS VAI ATUALIZAR O STATUS DA NOTA

    const pauta = await this.calcularMediaFinal(codigoGradeAluno);
    console.log('Analista');
    console.log('Analista', pauta);
    if (pauta) {
      const { mediaFinal, codigoStatusGrade } = pauta;
      await this.updateGrade(codigoGradeAluno, mediaFinal, codigoStatusGrade, observacao);
    }
  }
  private async updateGrade(
    codigoGradeAluno: number,
    mediaFinal: number,
    codigoStatusGrade: number,
    observacao: string
  ) {
    try {
      const grade = await this.getGrade(codigoGradeAluno);
      if (!grade) {
        return;
      }
      const nota = Math.round(mediaFinal);

      const sql = `UPDATE FK2_TB_GRADE_CURRICULAR_ALUNO SET NOTA = :nota, CODIGO_STATUS_GRADE_CURRICULAR = :status, OBSERVACAO = :observacao  WHERE codigo = :codigoGradeAluno`;
      const result = await this.dataSource.query(sql, {
        codigoGradeAluno,
        nota,
        status: codigoStatusGrade,
        observacao
      } as any);
      return result;
    } catch (err) {
      this.logger.error('Erro ao atualizar nota', err.stack);
      throw err;
    }
  }
  public async updateGradeStatus(codigoGradeAluno: number, status: number, observacao: string) {
    try {
      const grade = await this.getGrade(codigoGradeAluno);
      if (!grade) {
        return;
      }

      const sql = `UPDATE FK2_TB_GRADE_CURRICULAR_ALUNO SET CODIGO_STATUS_GRADE_CURRICULAR = :status, OBSERVACAO = :observacao WHERE codigo = :codigoGradeAluno`;
      const result = await this.dataSource.query(sql, {
        codigoGradeAluno,
        status: status,
        observacao
      } as any);
      return result;
    } catch (err) {
      this.logger.error('Erro ao atualizar nota', err.stack);
      throw err;
    }
  }
  private async getGrade(codigoGradeAluno: number) {
    try {
      const sql = `select * FROM FK2_TB_GRADE_CURRICULAR_ALUNO WHERE codigo = :codigoGradeAluno`;
      const result = await this.dataSource.query(sql, {
        codigoGradeAluno,
      } as any);
      if (!result || result.length === 0) {
        return null;
      }
      return result;
    } catch (err) {
      this.logger.error('Erro ao obter nota', err.stack);
      throw err;
    }
  }
  private async calcularMediaFinal(codigoGradeAluno: number) {
    const pauta = await this.studentsNoteService.find(codigoGradeAluno);
    if (!pauta) return null;
    let codigoStatusGrade = 2;
    switch (pauta.resultado) {
      case EstadoAvaliacaoEnum.REPROVADO:
        codigoStatusGrade = 1;
        break;

      case EstadoAvaliacaoEnum.APROVADO:
        codigoStatusGrade = 3;
        break;

      default:
        codigoStatusGrade = 2;
        break;
    }
    return {
      mediaFinal: pauta.media,
      codigoStatusGrade: codigoStatusGrade,
    };
  }
}
