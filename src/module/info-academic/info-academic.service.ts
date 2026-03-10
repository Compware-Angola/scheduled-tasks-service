import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AnoLectivoUtil } from "../util/current-academic-year";
export enum EstadoAvaliacaoEnum {
    FREQUENCIA_2 = "2ª Frequência",
    EXAME = "Exame",
    RECURSO = "Recurso",
    APROVADO = "Aprovado",
    REPROVADO = "Reprovado",
    AGUARDA_PRATICA = "Aguarda Nota da Prática",
    AGUARDA_ORAL = "Aguarda Nota da Oral",
    AGUARDA_ORAL_RECURSO = "Aguarda Nota da Oral do Recurso",
    AGUARDA_ORAL_EXAME_ESPECIAL = "Aguarda Nota da Oral Exame Especial",
    PENDENTE = "Sem Avaliações"
}

@Injectable()
export class InfoAcademicService {
    private anoAtualPrincipal: number;
    private semestreAtual: {
        anoId: number;
        semestre: number | null;
        descricao: string;
        dataFim: Date | null
    }
    private readonly logger = new Logger(InfoAcademicService.name);

    constructor(private readonly dataSource: DataSource, private readonly anoLectivoUtil: AnoLectivoUtil) { this.initAnoAtual(); }
    private async initAnoAtual() {
        this.anoAtualPrincipal = await this.anoLectivoUtil.getAnoAtualId();
        this.semestreAtual = await this.anoLectivoUtil.getSemestreAtual();

    }

    async findEstudantesByHorarioAndAnoLectivo(

        ano_lectivo: number,

        page: number = 1,
        limit: number = 20,
    ): Promise<any[]> {
        const offset = (page - 1) * limit;
        const students = await this.dataSource.query(
            `
    SELECT *
     FROM (
      SELECT
        tm.Codigo AS numero_matricula,
        tp2.Nome_Completo AS nome,
        tc.Designacao AS curso,
        tp3.Designacao AS periodo
      FROM FK2_TB_MATRICULAS tm
      INNER JOIN FK2_TB_ADMISSAO ta2 ON ta2.codigo = tm.Codigo_Aluno
      INNER JOIN FK2_TB_PREINSCRICAO tp2 ON tp2.Codigo = ta2.pre_incricao
      INNER JOIN FK2_TB_CURSOS tc ON tc.Codigo = tm.Codigo_Curso
      INNER JOIN FK2_TB_PERIODOS tp3 ON tp3.Codigo = tp2.Codigo_Turno
   --   WHERE tc.codigo = :curso
        AND tm.estado_matricula = 'activo'  
        AND tm.Codigo IN (
          SELECT DISTINCT tgca.codigo_matricula
          FROM FK2_MGH_TB_HORARIO mth
          INNER JOIN FK2_TB_GRADE_CURRICULAR_ALUNO tgca 
            ON JSON_VALUE(tgca.ref_horario, '$.pk') = mth.pk_horario
          WHERE mth.active_state = 1 
            AND mth.fk_estado_horario_wf != 4
            AND tgca.codigo_ano_lectivo = :ano_lectivo
            AND tgca.Codigo_Status_Grade_Curricular IN (1,2,3)
          ---  AND mth.pk_horario = :pk_horario
        )
      ORDER BY tp2.Nome_Completo ASC
    )
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `,
            {
                //  curso,
                ano_lectivo,
                // pk_horario,
                offset,
                limit,
            } as any
        );

        return students;
    }

    async retornarGradeAvaliadaByAno(
        anoLectivo: number,
        semestre: number,
        page: number = 1,
        limit: number = 10,
        obs: string = '%Migração%',
    ): Promise<any> {

        const offset = (page - 1) * limit;

        try {

            const grades = await this.dataSource.query(
                `
      SELECT *
      FROM (
        SELECT 
            ftgca.CODIGO_GRADE_CURRICULAR,
            ftgca.TURMA,
            ftgca.CODIGO_CONFIRMACAO,
            ftgca.CODIGO_MATRICULA,
            ftgca.ESTADO,
            ftgca.NOTA,
            ftgca.CREATED_AT,
            ftgca.CODIGO_STATUS_GRADE_CURRICULAR,
            ftgca.CODIGO_ANO_LECTIVO,
            ftgca.EPOCA,
            ftgca.OBSERVACAO,
            ftgca.CODIGO_UTILIZADOR,
            ftgca.UPDATED_AT,
            ftgca.EQUIVALENCIA,
            ftgca.CODIGO,
            ftgca.REF_HORARIO,

            ftgc.CODIGO_CURSO,
            ftgc.CODIGO_DISCIPLINA,
            ftgc.CODIGO_CLASSE,
            ftgc.CODIGO_SEMESTRE,

            dc.DESIGNACAO AS DISCIPLINA,
            cl.DESIGNACAO AS CLASSE,
            sm.DESIGNACAO AS SEMESTRE,

            ROW_NUMBER() OVER (ORDER BY ftgca.CODIGO_GRADE_CURRICULAR ASC) rn

        FROM FK2_TB_GRADE_CURRICULAR_ALUNO ftgca

        LEFT JOIN FK2_TB_GRADE_CURRICULAR ftgc 
            ON ftgc.CODIGO = ftgca.CODIGO_GRADE_CURRICULAR 

        LEFT JOIN FK2_TB_DISCIPLINAS dc
            ON dc.CODIGO = ftgc.CODIGO_DISCIPLINA

        LEFT JOIN FK2_TB_CLASSES cl
            ON cl.CODIGO = ftgc.CODIGO_CLASSE

        LEFT JOIN FK2_TB_SEMESTRES sm 
            ON sm.CODIGO = ftgc.CODIGO_SEMESTRE

        WHERE ftgca.CODIGO_STATUS_GRADE_CURRICULAR IN (2)
          AND ftgca.CODIGO_ANO_LECTIVO = :anoLectivo
          AND ftgca.OBSERVACAO NOT LIKE :obs
          AND sm.CODIGO = :semestre
      )
      WHERE rn BETWEEN :startRow AND :endRow
      `,
                {
                    anoLectivo,
                    semestre,
                    obs,
                    startRow: offset + 1,
                    endRow: offset + limit,
                } as any,
            );

            return {
                data: grades,
                page,
                limit,
                totalItems: grades.length
            };

        } catch (error) {
            console.error('Erro ao buscar grades:', error);
            throw new Error(`Falha ao consultar grades: ${error.message}`);
        }
    }


    async processarNotas(gradeAluno: any): Promise<any> {
        let media = 0;
        let descricao = '';
        const anoCorrente = this.anoAtualPrincipal;
        let resultado = gradeAluno.CODIGO_ANO_LECTIVO === anoCorrente ? EstadoAvaliacaoEnum.PENDENTE : EstadoAvaliacaoEnum.REPROVADO;

        // Inicialização correta da pauta
        const pauta: any = {
            obs: [],
            formula: [],
            nota1f: '', nota2f: '', notaEx: '', notaRec: '', notaPra: '',
            notaOr: '', notaOrRec: '', notaMel: '', notaEE: '', notaOEE: ''
        };

        try {
            console.log(`\nCADEIRA a verificar -----> `, gradeAluno.DISCIPLINA);

            // Busca dos planos curriculares
            const planoCurricularCurso = await this.findOnePlanoByCursoAndAnoLectivo(
                gradeAluno.CODIGO_CURSO,
                gradeAluno.CODIGO_ANO_LECTIVO
            );

            const planoCurricularGrade = await this.findByPlanoAndUnidadeCurricular(
                planoCurricularCurso.CODIGO,
                gradeAluno.CODIGO_GRADE_CURRICULAR
            );

            // Cache das verificações mais usadas
            const hasPratica = await this.temPratica(planoCurricularGrade);
            const hasOral = await this.temOral(gradeAluno.CODIGO_GRADE_CURRICULAR);

            // Busca TODAS as notas em paralelo (grande otimização!)
            const avaliacoes = await this.buscarAvaliacoes(gradeAluno.CODIGO);

            const getNota = (tipo: number) =>
                avaliacoes.find(a => a.TIPO_AVALIACAO === tipo) || null;

            const nota1f = getNota(2);
            const nota2f = getNota(3);
            const notaEx = getNota(6);
            const notaRec = getNota(7);
            const notaPra = getNota(4);
            const notaOr = getNota(9);
            const notaOrRec = getNota(23);
            const notaMel = getNota(22);
            const notaEE = getNota(11);
            const notaOEE = getNota(24);

            // Helper local para evitar chamadas repetidas
            const temNota = (nota: any): boolean =>
                nota !== null && nota !== undefined && nota.NOTA !== null && nota.NOTA !== undefined;

            // Cache para temNotaLancadaNoHorario (chamado várias vezes)
            const lancadaCache: { [key: number]: boolean } = {};
            const getLancada = async (tipo: number): Promise<boolean> => {
                if (!(tipo in lancadaCache)) {
                    lancadaCache[tipo] = await this.temNotaLancadaNoHorario(gradeAluno, tipo);
                }
                return lancadaCache[tipo];
            };

            console.log('notaMel--->', notaMel, notaPra);

            // === REPROVAÇÃO DIRETA POR FALTA DE LANÇAMENTO OBRIGATÓRIO ===
            if (hasPratica && await getLancada(4) && !temNota(notaPra)) {
                resultado = EstadoAvaliacaoEnum.REPROVADO;
                descricao = "O docente não fez o lançamento da nota da Prática para o estudante. O que leva a reprovação directa!";
                pauta.obs.push(descricao);
                console.log(descricao);
            }
            else if (hasOral && await getLancada(9) && (!temNota(notaOr) && !temNota(notaOrRec))) {
                resultado = EstadoAvaliacaoEnum.REPROVADO;
                descricao = "O docente não fez o lançamento da nota da Oral para o estudante. O que leva a reprovação directa!";
                pauta.obs.push(descricao);
                console.log(descricao);
            }
            // === NENHUMA NOTA LANÇADA ===
            else if (
                !temNota(nota1f) && !temNota(nota2f) && !temNota(notaEx) && !temNota(notaRec) &&
                !temNota(notaPra) && !temNota(notaOr) && !temNota(notaOrRec) && !temNota(notaMel) &&
                !temNota(notaEE)
            ) {
                if (gradeAluno.CODIGO_ANO_LECTIVO === anoCorrente) {
                    const semestre = gradeAluno.CODIGO_SEMESTRE;
                    const dataActual = new Date();

                    if (semestre === 1) {
                        if (dataActual > await this.getDataFimPrimeiroSemestre(gradeAluno.CODIGO_ANO_LECTIVO)) {
                            resultado = EstadoAvaliacaoEnum.REPROVADO;
                            descricao = "O estudante não teve nenhuma nota lançada;";
                        } else {
                            resultado = EstadoAvaliacaoEnum.PENDENTE;
                            descricao = "Sem avaliações;";
                        }
                    } else {
                        if (dataActual > await this.getDataFimSegundoSemestre(gradeAluno.CODIGO_ANO_LECTIVO)) {
                            resultado = EstadoAvaliacaoEnum.REPROVADO;
                            descricao = "O estudante não teve nenhuma nota lançada;";
                        } else {
                            resultado = EstadoAvaliacaoEnum.PENDENTE;
                            descricao = "Sem avaliações;";
                        }
                    }
                } else {
                    resultado = EstadoAvaliacaoEnum.REPROVADO;
                    descricao = "O estudante não teve nenhuma nota lançada;";
                }
                pauta.obs.push(descricao);
                console.log(descricao);
            }
            // === MELHORIA DE NOTA (notaMel >= 10) ===
            else if (temNota(notaMel) && notaMel.NOTA! >= 10) {
                media = notaMel.NOTA!;
                resultado = EstadoAvaliacaoEnum.APROVADO;
                descricao = "A média das duas Freqências é suficiente para aprovação!";
                pauta.obs.push(descricao);
                console.log(descricao);
            }
            // === LÓGICA NORMAL DE AVALIAÇÃO ===
            else {
                // 1ª Frequência
                if (await getLancada(2)) {
                    if (!temNota(nota1f)) {
                        resultado = EstadoAvaliacaoEnum.EXAME;
                        descricao = "Não possui nota na 1ª Frequência, deve fazer a prova de Exame!";
                    } else if (nota1f!.NOTA! < planoCurricularGrade.NOTA_MIN_PRIMEIRA_FREQ) {
                        resultado = EstadoAvaliacaoEnum.EXAME;
                        descricao = "A nota da 1ª Frequência é inferior a nota minína definida. (Consultar a fórmula)!";
                    } else {
                        resultado = EstadoAvaliacaoEnum.FREQUENCIA_2;
                        descricao = "Apto para a prova da 2ª Frequência. (Aguardar avaliação...)!";
                    }
                    pauta.obs.push(descricao);
                    console.log(descricao);
                } else {
                    resultado = gradeAluno.CODIGO_ANO_LECTIVO === anoCorrente
                        ? EstadoAvaliacaoEnum.PENDENTE
                        : EstadoAvaliacaoEnum.EXAME;
                    descricao = gradeAluno.CODIGO_ANO_LECTIVO === anoCorrente
                        ? "Aguarda avaliação 1ª Frequência"
                        : "Exame";
                    pauta.obs.push(descricao);
                    console.log(descricao);
                }

                // 2ª Frequência (só se passou na 1ª)
                if (resultado === EstadoAvaliacaoEnum.FREQUENCIA_2 && await getLancada(3)) {
                    if (!temNota(nota2f)) {
                        resultado = EstadoAvaliacaoEnum.EXAME;
                        descricao = "Não possui nota na 2ª Frequência!";
                    } else if (nota2f!.NOTA! < planoCurricularGrade.NOTA_MIN_SEGUNDA_FREQ) {
                        resultado = EstadoAvaliacaoEnum.RECURSO;
                        descricao = "A nota da 2ª Frequência é inferior a nota minína definida. (Consultar a fórmula)!";
                    } else {
                        const mediaFreq = this.round(
                            (nota1f!.NOTA! * (planoCurricularGrade.PESO_PRIMEIRA_FREQ / 100)) +
                            (nota2f!.NOTA! * (planoCurricularGrade.PESO_SEGUNDA_FREQ / 100))
                        );

                        if (hasPratica) {
                            media = this.round((nota1f!.NOTA! + nota2f!.NOTA!) / 2);
                            if (media >= 9.5) {
                                resultado = EstadoAvaliacaoEnum.AGUARDA_PRATICA;
                                descricao = `Media (${media}) suficiente para aprovação. Aguardar nota da Prática!`;
                            } else {
                                resultado = EstadoAvaliacaoEnum.RECURSO;
                                descricao = "A média das duas Frequências é insuficiêncte para aprovação, deve fazer a prova de Recurso!";
                            }
                        } else if (hasOral) {
                            if (mediaFreq >= 8) {
                                resultado = EstadoAvaliacaoEnum.AGUARDA_ORAL;
                                descricao = `Media (${mediaFreq}) suficiente para aprovação. Aguardar nota da Prova Oral!`;
                            } else {
                                resultado = EstadoAvaliacaoEnum.RECURSO;
                                descricao = "A média das duas Frequências é insuficiêncte para aprovação, deve fazer a prova de Recurso!";
                            }
                            media = mediaFreq;
                        } else {
                            media = mediaFreq;
                            if (media >= 10) {
                                resultado = EstadoAvaliacaoEnum.APROVADO;
                                descricao = "A média das duas Freqências é suficiente para aprovação!";
                            } else {
                                resultado = EstadoAvaliacaoEnum.RECURSO;
                                descricao = "A média das duas Frequências é insuficiêncte para aprovação, deve fazer a prova de Recurso!";
                            }
                        }
                    }
                    pauta.obs.push(descricao);
                    console.log(descricao);
                }

                // Exame
                if ([EstadoAvaliacaoEnum.EXAME, EstadoAvaliacaoEnum.RECURSO, EstadoAvaliacaoEnum.FREQUENCIA_2].includes(resultado)) {
                    if (await getLancada(6)) {
                        if (!temNota(notaEx)) {
                            resultado = EstadoAvaliacaoEnum.RECURSO;
                            descricao = "O docente não fez o lançamento da nota do exame para o estudante, deve fazer a prova de recurso!";
                        } else {
                            if (hasPratica) {
                                if (notaEx!.NOTA! >= 10) {
                                    resultado = EstadoAvaliacaoEnum.AGUARDA_PRATICA;
                                    descricao = `A nota do Exame (${notaEx!.NOTA!}) suficiente para aprovação. Aguardar nota da Prática!`;
                                } else {
                                    resultado = EstadoAvaliacaoEnum.RECURSO;
                                    descricao = "A nota do Exame é insuficiêncte para aprovação, deve fazer a prova de Recurso!";
                                }
                            } else if (hasOral) {
                                if (notaEx!.NOTA! >= 8) {
                                    resultado = EstadoAvaliacaoEnum.AGUARDA_ORAL;
                                    descricao = `A nota do Exame (${notaEx!.NOTA!}) suficiente para aprovação. Aguardar nota da prova Oral de Recurso!`;
                                } else {
                                    resultado = EstadoAvaliacaoEnum.RECURSO;
                                    descricao = "A média é insuficiente para aprovação directa!";
                                }
                            } else {
                                media = notaEx!.NOTA!;
                                if (notaEx!.NOTA! >= 10) {
                                    resultado = EstadoAvaliacaoEnum.APROVADO;
                                    descricao = "A nota do Exame é suficiente para aprovação. OBS: A nota do Exame é seca para esta avaliação!";
                                } else {
                                    resultado = EstadoAvaliacaoEnum.RECURSO;
                                    descricao = "A nota do Exame é insuficiênte para aprovação, deve fazer a prova de recurso!";
                                }
                            }
                        }
                        pauta.obs.push(descricao);
                        console.log(descricao);
                    }
                }

                // Recurso
                if (resultado === EstadoAvaliacaoEnum.RECURSO) {
                    if (await getLancada(7)) {
                        if (!temNota(notaRec)) {
                            resultado = EstadoAvaliacaoEnum.REPROVADO;
                            descricao = "O docente não fez o lançamento da nota do recurso para o estudante!";
                        } else {
                            if (hasPratica) {
                                if (notaRec!.NOTA! >= 10) {
                                    media = notaRec!.NOTA!;
                                    resultado = EstadoAvaliacaoEnum.AGUARDA_PRATICA;
                                    descricao = `A nota do Recurso (${notaRec!.NOTA!}) suficiente para aprovação. Aguardar nota da Prática!`;
                                } else {
                                    media = notaRec!.NOTA!;
                                    resultado = EstadoAvaliacaoEnum.REPROVADO;
                                    descricao = `A nota do Recurso (${notaRec!.NOTA!}) é insuficiente para aprovação directa!`;
                                }
                            } else if (hasOral) {
                                if (notaRec!.NOTA! >= 8) {
                                    media = notaRec!.NOTA!;
                                    resultado = EstadoAvaliacaoEnum.AGUARDA_ORAL_RECURSO;
                                    descricao = `A nota do Recurso (${notaRec!.NOTA!}) suficiente para aprovação. Aguardar nota da Prova Oral de Recurso!`;
                                } else {
                                    resultado = EstadoAvaliacaoEnum.REPROVADO;
                                    descricao = `A nota do Recurso (${notaRec!.NOTA!}) é insuficiente para aprovação directa!`;
                                }
                            } else {
                                media = notaRec!.NOTA!;
                                if (notaRec!.NOTA! >= 10) {
                                    resultado = EstadoAvaliacaoEnum.APROVADO;
                                    descricao = "A nota do Recurso é suficiente para aprovação. OBS: A nota do Recurso é seca para esta avaliação!";
                                } else {
                                    resultado = EstadoAvaliacaoEnum.REPROVADO;
                                    descricao = `A nota do Recurso (${notaRec!.NOTA!}) é insuficiente para aprovação directa!`;
                                }
                            }
                        }
                        pauta.obs.push(descricao);
                        console.log(descricao);
                    }
                }

                // Prática (quando em AGUARDA_PRATICA)
                if (resultado === EstadoAvaliacaoEnum.AGUARDA_PRATICA && await getLancada(4)) {
                    if (!temNota(notaPra)) {
                        resultado = EstadoAvaliacaoEnum.REPROVADO;
                        descricao = "O docente não fez o lançamento da nota da Prática para o estudante!";
                    } else if (notaPra!.NOTA! >= 10) {
                        let notaTeorica = 0;
                        if (temNota(notaRec)) notaTeorica = notaRec!.NOTA!;
                        else if (temNota(notaEx)) notaTeorica = notaEx!.NOTA!;
                        else notaTeorica = this.round((nota1f!.NOTA! + nota2f!.NOTA!) / 2);

                        media = this.round(
                            (notaTeorica * ((100 - planoCurricularGrade.PESO_PRATICA) / 100)) +
                            (notaPra!.NOTA! * (planoCurricularGrade.PESO_PRATICA / 100))
                        );

                        if (media >= 10) {
                            resultado = EstadoAvaliacaoEnum.APROVADO;
                            descricao = `A média (${media}) é suficiente para a aprovação!`;
                        } else {
                            resultado = EstadoAvaliacaoEnum.REPROVADO;
                            descricao = `A média (${media}) é insuficiente para a aprovação!`;
                        }
                    } else {
                        resultado = EstadoAvaliacaoEnum.RECURSO;
                        descricao = `A nota da Prática (${notaPra!.NOTA!}) é insuficiente para aprovação directa!`;
                    }
                    pauta.obs.push(descricao);
                    console.log(descricao);
                }

                // Oral Normal
                if (resultado === EstadoAvaliacaoEnum.AGUARDA_ORAL && await getLancada(9)) {
                    if (!temNota(notaOr)) {
                        resultado = EstadoAvaliacaoEnum.APROVADO; // Nota: conforme original, parece intencional
                        descricao = "O docente não fez o lançamento da nota a Prova Oral para o estudante!";
                    } else {
                        media = notaOr!.NOTA!;
                        if (notaOr!.NOTA! >= 10) {
                            resultado = EstadoAvaliacaoEnum.APROVADO;
                            descricao = "A nota da Prova Oral é suficiente para Aprovação. Att: A nota da prova oral sobrepõe as notas anteriores tornando-se a média.";
                        } else {
                            resultado = EstadoAvaliacaoEnum.RECURSO;
                            descricao = "A nota da Prova Oral é insuficiente para aprovação!!";
                        }
                    }
                    pauta.obs.push(descricao);
                    console.log(descricao);
                }

                // Oral de Recurso
                if (resultado === EstadoAvaliacaoEnum.AGUARDA_ORAL_RECURSO && await getLancada(23)) {
                    if (!temNota(notaOrRec)) {
                        resultado = EstadoAvaliacaoEnum.REPROVADO;
                        descricao = "O docente não fez o lançamento da nota a Prova Oral de Recurso para o estudante!";
                    } else {
                        media = notaOrRec!.NOTA!;
                        if (notaOrRec!.NOTA! >= 10) {
                            resultado = EstadoAvaliacaoEnum.APROVADO;
                            descricao = `A nota da Prova Oral de Recurso (${notaOrRec!.NOTA!}) é suficiente para Aprovação. Att: A nota da prova oral sobrepõe as notas anteriores tornando-se a média.`;
                        } else {
                            resultado = EstadoAvaliacaoEnum.REPROVADO;
                            descricao = `A nota da Prova Oral de Recurso (${notaOrRec!.NOTA!}) é insuficiente para aprovação directa!`;
                        }
                    }
                    pauta.obs.push(descricao);
                    console.log(descricao);
                }

                // Melhoria após aprovação normal
                if (resultado === EstadoAvaliacaoEnum.APROVADO && temNota(notaMel) && notaMel!.NOTA! > media) {
                    descricao = `Aprovado com média (${media}) Porém o estudante fez a melhoria da nota onde conseguiu superar esta média conseguindo assim (${notaMel!.NOTA!})`;
                    pauta.obs.push(descricao);
                    console.log(descricao);
                    media = notaMel!.NOTA!;
                }
            }

            // === EXAME ESPECIAL ===
            if (temNota(notaEE)) {
                media = notaEE!.NOTA!;
                if (hasOral) {
                    if (media >= 8) {
                        resultado = EstadoAvaliacaoEnum.AGUARDA_ORAL_EXAME_ESPECIAL;
                        descricao = `A nota do Exame Especial (${media}) é insuficiente para aprovação. Aguardar nota da Prova Oral!`;
                    } else {
                        resultado = EstadoAvaliacaoEnum.REPROVADO;
                        descricao = `A nota do Exame Especial (${media}) é insuficiente para aprovação directa!`;
                    }
                } else {
                    if (media >= 10) {
                        resultado = EstadoAvaliacaoEnum.APROVADO;
                        descricao = `A nota do Exame Especial (${media}) é suficiente para aprovação directa!`;
                    } else {
                        resultado = EstadoAvaliacaoEnum.REPROVADO;
                        descricao = `A nota do Exame Especial (${media}) é insuficiente para aprovação directa!`;
                    }
                }
                pauta.obs.push(descricao);
                console.log(descricao);
            }

            // === ORAL DO EXAME ESPECIAL ===
            if (temNota(notaOEE)) {
                media = notaOEE!.NOTA!;
                if (media >= 10) {
                    resultado = EstadoAvaliacaoEnum.APROVADO;
                    descricao = `A nota da Prova Oral do Exame Especial (${media}) é suficiente para aprovação directa!`;
                } else {
                    resultado = EstadoAvaliacaoEnum.REPROVADO;
                    descricao = `A nota da Prova Oral do Exame Especial (${media}) é insuficiente para aprovação directa!`;
                }
                pauta.obs.push(descricao);
                console.log(descricao);
            }

            // === PREENCHIMENTO FINAL DA PAUTA ===
            pauta.ano = gradeAluno.CLASSE;
            pauta.codigoGradeAluno = gradeAluno.CODIGO;
            pauta.disciplina = gradeAluno.DISCIPLINA;
            pauta.duracao = gradeAluno.DURACAO_PLANO;
            pauta.gradeCurricula = gradeAluno.CODIGO_GRADE_CURRICULA;
            pauta.matricula = gradeAluno.CODIGO_MATRICULA;
            pauta.media = media.toString();
            pauta.nome_completo = gradeAluno.NOME_COMPLETO;
            pauta.num_matricula = gradeAluno.CODIGO_MATRICULA.toString();
            pauta.resultado = resultado;
            pauta.semestre = gradeAluno.SEMESTRE;
            pauta.unidadeCurricular = gradeAluno.DISCIPLINA;

            // Fórmulas
            let formula = `${planoCurricularGrade.PESO_PRIMEIRA_FREQ}% 1ªFreq (${planoCurricularGrade.NOTA_MIN_PRIMEIRA_FREQ})`;
            formula += `     +     ${planoCurricularGrade.PESO_SEGUNDA_FREQ}% 2ªFreq (${planoCurricularGrade.NOTA_MIN_SEGUNDA_FREQ})`;
            if (planoCurricularGrade.PESO_PRATICA > 0) {
                formula += `     +     ${planoCurricularGrade.PESO_PRATICA}% Prática (${planoCurricularGrade.NOTA_MIN_PRATICA})`;
            }
            pauta.formula.push(formula);

            if (planoCurricularGrade.PESO_PRATICA > 0) {
                formula = `${(100 - planoCurricularGrade.PESO_PRATICA)}% Recurso (10)`;
                formula += `     +     ${planoCurricularGrade.PESO_PRATICA}% Prática (${planoCurricularGrade.NOTA_MIN_PRATICA})`;
            } else {
                formula = "Nota mínima de 10 valores, sendo que para está unidade curricular a nota é seca.";
            }
            pauta.formula.push(formula);

            // Regra final: tudo que não for APROVADO ou PENDENTE vira REPROVADO
            if (pauta.resultado !== EstadoAvaliacaoEnum.APROVADO && pauta.resultado !== EstadoAvaliacaoEnum.PENDENTE) {
                pauta.resultado = EstadoAvaliacaoEnum.REPROVADO;
            }

            // Notas individuais
            pauta.nota1f = nota1f?.NOTA?.toString() ?? '';
            pauta.nota2f = nota2f?.NOTA?.toString() ?? '';
            pauta.notaEx = notaEx?.NOTA?.toString() ?? '';
            pauta.notaRec = notaRec?.NOTA?.toString() ?? '';
            pauta.notaPra = notaPra?.NOTA?.toString() ?? '';
            pauta.notaOr = notaOr?.NOTA?.toString() ?? '';
            pauta.notaOrRec = notaOrRec?.NOTA?.toString() ?? '';
            pauta.notaMel = notaMel?.NOTA?.toString() ?? '';
            pauta.notaEE = notaEE?.NOTA?.toString() ?? '';
            pauta.notaOEE = notaOEE?.NOTA?.toString() ?? '';

            console.log(resultado);
            console.log(media);
            console.log(descricao);
            console.log("\n");

            return pauta;

        } catch (error) {
            console.error("----> NÃO FOI POSSÍVEL ACTUALIZAR <-----", error);
            throw error; // ou return null / objeto de erro
        }
    }

    private async findOnePlanoByCursoAndAnoLectivo(codigoCurso: number, codigoAnoLectivo: number): Promise<any> {
        const planoCurso = await this.dataSource.query(`
        SELECT * 
        FROM FK2_TB_PLANO_CURRICULAR_CURSO plano
        WHERE plano.CODIGO_CURSO =:codigoCurso  OR 0 =:codigoCurso
          AND plano.CODIGO_ANO_LECTIVO = :codigoAnoLectivo OR 0 = :codigoAnoLectivo
    `, {
            codigoCurso,
            codigoAnoLectivo
        } as any);

        return planoCurso[0];
    }
    private async findByPlanoAndUnidadeCurricular(plano: number, codigoUnidadeCurricular: number): Promise<any> {


        const planoUnidade = await this.dataSource.query(`SELECT *  from
     FK2_TB_PLANO_CURRICULAR_GRADE grade
     WHERE grade.CODIGO_PLANO_CURRICULAR_CURSO = :plano 
     AND grade.CODIGO_GRADE_CURRICULAR = :codigoUnidadeCurricular`, [plano, codigoUnidadeCurricular])
        return planoUnidade[0]

    }

    private async temPratica(plano: any): Promise<boolean> {
        return plano?.PESO_PRATICA > 0;
    }

    private async temOral(gradeCurricular: any): Promise<boolean> {


        const result = await this.dataSource.query(`
    SELECT * 
    FROM FK2_TB_GRADE_CURRICULAR_DEFINIR_ORAL
    WHERE CODIGOGRADECURRICULAR = :gradeCurricular
`, [gradeCurricular]);

        const oral = result[0];

        return oral ? oral.HABILITAR === true || oral.HABILITAR === 1 : false;

    }

    async temNotaLancadaNoHorario(gradeAluno: any, tipoAvaliacao: number): Promise<boolean> {
        const pk = this.extrairPkDoRefHorario(gradeAluno.REF_HORARIO);
        if (pk === null) {
            return false;
        }

        const query = `
        SELECT 1
        FROM FK2_TB_GRADE_CURRICULAR_ALUNO grade
        INNER JOIN FK2_TB_GRADE_CURRICULAR_ALUNO_AVALIACOES avaliacoes
            ON avaliacoes.GRADE_CURRICULAR_ALUNO = grade.CODIGO
        WHERE avaliacoes.TIPO_AVALIACAO = :tipo
          AND json_value(grade.REF_HORARIO,'$.pk') = :pk
          AND grade.CODIGO_GRADE_CURRICULAR = :gradeCurricular
        FETCH FIRST 1 ROW ONLY
    `;

        try {
            const result = await this.dataSource.query(query, {
                tipo: tipoAvaliacao,
                pk: Number(pk),
                gradeCurricular: gradeAluno.CODIGO_GRADE_CURRICULAR
            } as any);

            return result.length > 0;
        } catch (error: any) {
            console.error('Erro em temNotaLancadaNoHorario:', error);
            return false;
        }
    }
    private extrairPkDoRefHorario(refHorario: string): number | null {
        try {
            if (!refHorario) return null;
            const obj = JSON.parse(refHorario);
            return obj.pk ? Number(obj.pk) : null;
        } catch (e) {
            console.warn('REF_HORARIO inválido ou não é JSON:', refHorario);
            return null;
        }
    }

    private round(value: number): number {
        return Math.round(value);
    }

    private async buscarAvaliacao(codigoAvaliacao: number, codigoGradeAluno: number): Promise<any | null> {
        const avaliation = await this.dataSource.query(`
    
    SELECT * FROM FK2_TB_GRADE_CURRICULAR_ALUNO_AVALIACOES avaliacao 
    WHERE avaliacao.GRADE_CURRICULAR_ALUNO = :codigoGradeAluno 
    AND avaliacao.TIPO_AVALIACAO = :codigoAvaliacao
     ORDER BY avaliacao.CREATED_AT ASC
    `, [codigoGradeAluno, codigoAvaliacao])




        return avaliation[0];
    }
    private async buscarAvaliacoes(
        gradeAlunoId: number
    ): Promise<any[]> {

        return await this.dataSource.query(`
    SELECT avaliacao.*
    FROM FK2_TB_GRADE_CURRICULAR_ALUNO_AVALIACOES avaliacao
    WHERE avaliacao.GRADE_CURRICULAR_ALUNO = :1
      AND avaliacao.TIPO_AVALIACAO IN (2,3,6,7,4,9,23,22,11,24)
  `, [gradeAlunoId]);

    }
    private async getDataFimPrimeiroSemestre(ano: number): Promise<Date> {
        const first = await this.dataSource.query(`
        SELECT DATAFIMPRIMEIROSEMESTRE  FROM FK2_TB_ANO_LECTIVO
        WHERE CODIGO =: ano
        `, [ano])
        return first[0].DATAFIMPRIMEIROSEMESTRE
    }

    private async getDataFimSegundoSemestre(ano: number): Promise<Date> {
        const first = await this.dataSource.query(`
        SELECT DATAFIMSEGUNDOSEMESTRE  FROM FK2_TB_ANO_LECTIVO
        WHERE CODIGO =: ano
        `, [ano])
        return first[0].DATAFIMSEGUNDOSEMESTRE
    }



    async updateStatusGrade(gradeCurricularAluno: number, estado: number, nota: number, ano_lectivo: number, infodata: string) {
        const sql = `
   SELECT dr.CODIGO ,dr.DESIGNACAO ,gc.CODIGO_SEMESTRE  FROM FK2_TB_GRADE_CURRICULAR_ALUNO gcu
INNER JOIN FK2_TB_GRADE_CURRICULAR gc ON gcu.CODIGO_GRADE_CURRICULAR =gc.CODIGO 
INNER JOIN FK2_TB_DISCIPLINAS dc ON gc.CODIGO_DISCIPLINA  =dc.CODIGO 
INNER JOIN FK2_TB_DURACAO dr ON dc.DURACAO  =dr.CODIGO 

WHERE gcu.CODIGO =:gradeCurricularAluno

    `;
        let observacao: any
        try {
            // Verificar a duracao da grade
            const info = await this.dataSource.query(sql, { gradeCurricularAluno } as any);
            observacao = infodata[0] ?? "Selecção automática no Portal"



            if (info[0].CODIGO == 1 && info[0].CODIGO_SEMESTRE == 1 && this.semestreAtual.semestre == 1) {

                await this.updateStatus(gradeCurricularAluno, estado, nota, observacao)

            } else if (info[0].CODIGO == 1 && info[0].CODIGO_SEMESTRE == 2 && this.semestreAtual.semestre == 2) {
                await this.updateStatus(gradeCurricularAluno, estado, nota, observacao)

            } else if (info[0].CODIGO == 2 && info[0].CODIGO_SEMESTRE == 2) {

                await this.updateStatus(gradeCurricularAluno, estado, nota, observacao)
            }






        } catch (err) {
            this.logger.error('Erro na expiração de referências', err.stack);
            throw err;
        }
    }


    private async updateStatus(
        gradeCurricularAluno: number,
        estado: number,
        nota: number,
        info: string
    ) {

        const sql = `
        UPDATE FK2_TB_GRADE_CURRICULAR_ALUNO
        SET 
            ESTADO = :estado,
            NOTA   = :nota,
            OBSERVACAO = :info
        WHERE CODIGO = :gradeCurricularAluno
    `;

        try {
            await this.dataSource.query(sql, {
                estado,
                nota,
                info,
                gradeCurricularAluno
            } as any);

            this.logger.log(`Grade curricular ${gradeCurricularAluno} atualizada com sucesso.`);

        } catch (err) {
            this.logger.error('Erro ao atualizar status da grade curricular', err.stack);
            throw err;
        }
    }


}

