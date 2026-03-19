
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AnoLectivoUtil } from 'src/module/util/current-academic-year';
import { DataSource } from 'typeorm';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly dataSource: DataSource, private readonly anoLectivoUtil: AnoLectivoUtil) { }

  async scheduleClass(scheduleId: number, userId: number | null = null) {
    try {
      if (!scheduleId || scheduleId <= 0) {
        throw new BadRequestException('ID do horário inválido');
      }

      // 1) OBTER O HORÁRIO
      const horarios = await this.dataSource.query(
        `
      SELECT *
      FROM "FK2_MGH_TB_HORARIO"
      WHERE "PK_HORARIO" = :scheduleId
        AND "ACTIVE_STATE" = 1
      `,
        { scheduleId } as any,
      );
      console.log(horarios);
      

      if (horarios.length === 0) {
        throw new NotFoundException(`Horário ${scheduleId} não encontrado ou inativo`);
      }

      const gradeCurricular = horarios[0].FK_GRADE_CURRICULAR;

      // 2) SABER SE A GRADE CURRICULAR É ANUAL OU SEMESTRAL
      const gradeInfo = await this.dataSource.query(
        `
      SELECT dr.CODIGO, dr.DESIGNACAO, gc.CODIGO_SEMESTRE
      FROM FK2_TB_GRADE_CURRICULAR gc
      INNER JOIN FK2_TB_DISCIPLINAS dc ON gc.CODIGO_DISCIPLINA = dc.CODIGO
      INNER JOIN FK2_TB_DURACAO dr ON dc.DURACAO = dr.CODIGO
      WHERE gc.CODIGO = :gradeCurricular
      `,
        { gradeCurricular } as any,
      );

      if (!gradeInfo[0]) {
        throw new NotFoundException(`Grade curricular ${gradeCurricular} não encontrada`);
      }

      const isSemestral = gradeInfo[0].CODIGO === 1;

      // 3) PEGAR O SEMESTRE CONFIGURADO
      const semestreInfo = await this.anoLectivoUtil.getSemestresConfigurados();
      if (!semestreInfo.primeiroSemestre || !semestreInfo.segundoSemestre) {
        this.logger.warn('⚠ Semestre não definido ou data de fim inexistente. Processo interrompido.');
        return;
      }

      // 4) DEFINIR PERÍODO DE AGENDAMENTO
      let dataInicio: Date;
      let dataFim: Date;

      if (isSemestral) {
        // Semestral → apenas primeiro semestre
        dataInicio = new Date(semestreInfo.primeiroSemestre.dataInicio);
        dataFim = new Date(semestreInfo.primeiroSemestre.dataFim);
      } else {
        // Anual → do início do primeiro semestre até o fim do segundo semestre
        dataInicio = new Date(semestreInfo.primeiroSemestre.dataInicio);
        dataFim = new Date(semestreInfo.segundoSemestre.dataFim);
      }

      // 5) BUSCAR AS AULAS
      const aula = await this.getAulas(scheduleId);
      console.log(aula);
      
      if (!aula) {
        throw new NotFoundException(`Nenhuma aula encontrada para o horário ${scheduleId}`);
      }

      // 6) PEGAR OS DIAS ISENTOS
      const diasIsentos = await this.dataSource.query(
        `
      SELECT DATA_INICIO, DATA_FIM
      FROM FK2_TB_DIAS_ISENTOS
      WHERE ESTADO = 1
      `,
      );

      // 7) GERAR DATAS PARA O DIA DA SEMANA DA AULA
      const diaSemanaAula = aula?.FK_DIA_DA_SEMANA; // 0 = domingo, 1 = segunda...
      const datasAgendamento: Date[] = [];
      let current = new Date(dataInicio);
   
      while (current <= dataFim) {
        if (current.getDay() === diaSemanaAula) {
          const isIsento = diasIsentos.some(
            (di) =>
              new Date(di.DATA_INICIO) <= current &&
              current <= new Date(di.DATA_FIM),
          );
          if (!isIsento) {
            datasAgendamento.push(new Date(current));
          }
        }
        current.setDate(current.getDate() + 1);
      }
      const escapeQuotes = (str: string) => (str ? str.replace(/"/g, '\\"') : '');
      const docenteObj = JSON?.parse(aula?.REF_DOCENTE);
      const gradeObj = JSON?.parse(horarios[0]?.REF_GRADE_CURRICULAR);
      const v_json_aula = `{
    "pkAula": ${aula.PK_AULA},
    "pkGrade": ${horarios[0].FK_GRADE_CURRICULAR},
    "pkDocente": ${docenteObj.pkDocente || 0},
    "pkTipoAula": ${aula.FK_TIPO_AULA || 0},
    "nomeDocente": "${escapeQuotes(docenteObj.nomeAbreviado || '')}",
    "designacaoGrade": "${escapeQuotes(gradeObj.desc || '')}"
  }`;
      // 8) INSERIR AULAS AGENDADAS COM NAMED PARAMETERS
      for (const data of datasAgendamento) {

        await this.dataSource.query(
          `
        INSERT INTO FK2_MSA_TB_AGENDAMENTO_AULA (
          FK_ESTADO_AGENDAMENTO,
          REF_AULA,
          DATA_AULA,
          HORA_DE_INICIO,
          FIM_DA_AULA,
          CREATED_AT,
          UPDATED_AT,
          ACTIVE_STATE,
          REF_UTILIZADOR,
          FK_AULA,
          FK_DOCENTE,
          FK_GRADE_CURRICULAR
        ) VALUES (
          :estadoAgendamento,
          :refAula,
          :dataAula,
          :horaInicio,
          :horaFim,
          SYSDATE,
          SYSDATE,
          :activeState,
          :userId,
          :fkAula,
          :fkDocente,
          :fkGradeCurricular
        )
        `,
          {
            estadoAgendamento: 1,
            refAula: v_json_aula,
            dataAula: data,
            horaInicio: aula.HORA_DE_INICIO,
            horaFim: aula.FIM_DA_AULA,
            activeState: 1,
            userId,
            fkAula: aula.PK_AULA,
            fkDocente: docenteObj?.pkDocente,
            fkGradeCurricular: gradeCurricular,
          } as any,
        );
      }

      this.logger.warn(`Agendamento concluído. Total de aulas agendadas: ${datasAgendamento.length}`);
    } catch (err) {
      this.logger.error('Erro no agendamento de aulas', err.stack);
      throw err;
    }
  }
  private async getAulas(scheduleId: number) {
    if (!scheduleId || scheduleId <= 0) {
      throw new Error('ID do horário inválido');
    }

    const aulas = await this.dataSource.query(
      `
      SELECT *
      FROM FK2_MGH_TB_AULA
      WHERE FK_HORARIO =:scheduleId
     
    `,
      [scheduleId],
    );


    return aulas?.[0] ?? null;
  }
}
