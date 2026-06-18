import { DataSource } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AnoLectivoUtil } from 'src/module/util/current-academic-year';
interface ProvaRow {
    PERGUNTAS: string;
}

@Injectable()
export class ExameService {
    private anoAtualPrincipal!: number;

    constructor(
        private readonly dataSource: DataSource,
        private readonly anoLectivoUtil: AnoLectivoUtil
    ) {
        this.initAnoAtual();
    }

    private async initAnoAtual() {
        this.anoAtualPrincipal = await this.anoLectivoUtil.getAnoAtualId();
    }

    async calcularNota(candidatoId: number, provaId: number) {
        const candidatoProvas = await this.dataSource.query<{ PROVA_ID: number; STATUS_: number | null }[]
        >(
            `SELECT PROVA_ID, STATUS_
     FROM FK2_CANDIDATO_PROVAS
    WHERE CANDIDATO_ID = :1
      AND PROVA_ID = :2`,
            [candidatoId, provaId],
        );

        if (!candidatoProvas || candidatoProvas.length === 0) {
            throw new BadRequestException('Prova não encontrada para este candidato');
        }

        const provas = await this.dataSource.query<ProvaRow[]>(
            `SELECT PERGUNTAS FROM FK2_PROVAS WHERE ID = :1`,
            [provaId],
        );

        if (!provas || provas.length === 0) {
            throw new BadRequestException('Prova não encontrada');
        }

        let perguntasIds: number[] = [];
        try {
            const parsed: unknown = JSON.parse(provas[0].PERGUNTAS);
            if (Array.isArray(parsed)) {
                perguntasIds = (parsed as Array<number | { id: number }>).map((p) =>
                    typeof p === 'object' && p !== null ? p.id : p,
                );
            }
        } catch {
            if (typeof provas[0].PERGUNTAS === 'string') {
                perguntasIds = provas[0].PERGUNTAS.split(',')
                    .map((id) => parseInt(id.trim(), 10))
                    .filter((id) => !isNaN(id));
            }
        }

        if (perguntasIds.length === 0) {
            throw new BadRequestException('A prova não possui perguntas cadastradas');
        }

        const placeholders = perguntasIds.map((_, i) => `:${i + 1}`).join(',');
        const perguntas = await this.dataSource.query<{ ID: number; COTACAO: number }[]>(
            `SELECT ID, COTACAO
       FROM FK2_PERGUNTAS
      WHERE ID IN (${placeholders})
        AND DELETED_AT IS NULL`,
            perguntasIds,
        );

        const respostas = await this.dataSource.query<{ PERGUNTA_ID: number; TIPO_RESPOSTA_ID: number }[]>(
            `SELECT CR.PERGUNTA_ID, R.TIPO_RESPOSTA_ID
       FROM FK2_CANDIDATO_RESPOSTAS CR
       JOIN FK2_RESPOSTAS R ON CR.RESPOSTA_ID = R.ID
      WHERE CR.CANDIDATO_ID = :1
        AND CR.PROVA_ID = :2`,
            [candidatoId, provaId],
        );

        const respostasMap = new Map<number, number>(
            respostas.map((r) => [Number(r.PERGUNTA_ID), Number(r.TIPO_RESPOSTA_ID)]),
        );

        let nota = 0;
        for (const pergunta of perguntas) {
            const tipoResposta = respostasMap.get(Number(pergunta.ID));
            if (tipoResposta === 1) {
                nota += Number(pergunta.COTACAO);
            }
        }

        const resultado = nota >= 10 ? 'Admitido(a)' : 'Reprovado(a)';

        await this.dataSource.query(
            `INSERT INTO FK2_TB_ADMISSAO (PRE_INCRICAO, MEDIAFINAL, DATA, RESULTADO, CANAL, POLO_ID)
     VALUES (:1, :2, SYSDATE, :3, 1, 1)`,
            [candidatoId, nota, resultado],
        );

        return {
            candidatoId,
            provaId,
            nota,
            resultado,
        };
    }


    async corrigirTodasAsProvas() {
        console.log('🚀 ~ ExameService ~ corrigirTodasAsProvas ~ this.anoAtualPrincipal:', this.anoAtualPrincipal)
        if (!this.anoAtualPrincipal) {
            throw new BadRequestException('Ano lectivo não encontrado');
        }
        const candidatosProvas = await this.dataSource.query<{ CANDIDATO_ID: number; PROVA_ID: number }[]>
            (
                `SELECT cp.CANDIDATO_ID, cp.PROVA_ID
       FROM FK2_CANDIDATO_PROVAS cp
       JOIN FK2_PROVAS p ON cp.PROVA_ID = p.ID
       WHERE p.STATUS_ = 1
       AND p.ANO_LECTIVO_ID = :1
        AND NOT EXISTS (
          SELECT 1
            FROM FK2_TB_ADMISSAO a
           WHERE a.PRE_INCRICAO = cp.CANDIDATO_ID
        )`,
                [this.anoAtualPrincipal],
            );

        if (!candidatosProvas || candidatosProvas.length === 0) {
            return {
                message: 'Nenhuma prova pendente de correção',
                total: 0,
                corrigidos: 0,
                erros: 0,
                resultados: [],
            };
        }

        const resultados: {
            candidatoId: number;
            provaId: number;
            nota?: number;
            resultado?: string;
            erro?: string;
        }[] = [];

        let corrigidos = 0;
        let erros = 0;

        for (const { CANDIDATO_ID, PROVA_ID } of candidatosProvas) {
            console.log(`
            CANDIDATO_ID: ${CANDIDATO_ID}
            PROVA_ID: ${PROVA_ID}
            `)
            try {
                const resultado = await this.calcularNota(CANDIDATO_ID, PROVA_ID);
                resultados.push(resultado);
                corrigidos++;
            } catch (error) {
                erros++;
                resultados.push({
                    candidatoId: CANDIDATO_ID,
                    provaId: PROVA_ID,
                    erro: error instanceof Error ? error.message : 'Erro desconhecido',
                });
            }
        }

        return {
            message: 'Correção concluída',
            total: candidatosProvas.length,
            corrigidos,
            erros,
            resultados,
        };
    }


}