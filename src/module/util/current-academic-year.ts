// src/utils/ano-lectivo.util.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AcademicYear } from '../entities/academic.year.entity';

@Injectable()
export class AnoLectivoUtil {
  private readonly FALLBACK_ANO_ID = 23;
  private static cachedAnoId: number | null = null;
  private static lastFetched = 0;
  private static readonly CACHE_TTL = 10 * 60 * 1000;

  constructor(
    @InjectRepository(AcademicYear)
    private readonly anoLectivoRepo: Repository<AcademicYear>,
  ) { }

  async getAnoAtualId(tipo_cand: number = 1): Promise<number> {
    const now = Date.now();

    if (
      AnoLectivoUtil.cachedAnoId !== null &&
      now - AnoLectivoUtil.lastFetched < AnoLectivoUtil.CACHE_TTL
    ) {
      return AnoLectivoUtil.cachedAnoId;
    }

    try {
      const anoAtivo = await this.anoLectivoRepo.findOne({
        where: { estado: 'Ativo', status: 1, codigoTipoCandidatura: tipo_cand },
        select: ['codigo'],
        cache: {
          id: 'ano_letivo_ativo',
          milliseconds: 60_000,
        },
      });

      const anoId = anoAtivo?.codigo ?? this.FALLBACK_ANO_ID;

      AnoLectivoUtil.cachedAnoId = anoId;
      AnoLectivoUtil.lastFetched = now;

      return anoId;
    } catch (error) {
      console.warn(
        'Erro ao buscar ano letivo ativo:',
        error instanceof Error ? error.message : error,
      );

      return AnoLectivoUtil.cachedAnoId ?? this.FALLBACK_ANO_ID;
    }
  }

  /**
   * 🔥 Retorna o semestre atual baseado na data de hoje
   */
  async getSemestreAtual(tipo_cand: number = 1): Promise<{
    anoId: number;
    semestre: number | null;
    descricao: string;
    dataFim: Date | null
  }> {
    const anoId = await this.getAnoAtualId(tipo_cand);

    const ano = await this.anoLectivoRepo.findOne({
      where: { codigo: anoId },
      select: [
        'codigo',
        'dataInicioPrimeiroSemestre',
        'dataFimPrimeiroSemestre',
        'dataInicioSegundoSemestre',
        'dataFimSegundoSemestre',
      ],
    });

    if (!ano) {
      throw new Error('Ano lectivo não encontrado');
    }

    const hoje = new Date();

    if (
      !ano.dataInicioPrimeiroSemestre ||
      !ano.dataFimPrimeiroSemestre ||
      !ano.dataInicioSegundoSemestre ||
      !ano.dataFimSegundoSemestre
    ) {
      throw new Error('Datas do semestre não configuradas no ano lectivo');
    }

    const inicio1 = new Date(ano.dataInicioPrimeiroSemestre);
    const fim1 = new Date(ano.dataFimPrimeiroSemestre);
    const inicio2 = new Date(ano.dataInicioSegundoSemestre);
    const fim2 = new Date(ano.dataFimSegundoSemestre);


    if (hoje >= inicio1 && hoje <= fim1) {
      return {
        anoId,
        semestre: 1,
        dataFim: fim1,
        descricao: 'PRIMEIRO_SEMESTRE',
      };
    }

    if (hoje >= inicio2 && hoje <= fim2) {
      return {
        anoId,
        semestre: 2,
        dataFim: fim2,
        descricao: 'SEGUNDO_SEMESTRE',
      };
    }

    return {
      anoId,
      semestre: null,
      dataFim: null,
      descricao: 'FORA_DO_PERIODO',
    };
  }

  /**
   * 🔥 Retorna os dois semestres configurados do ano letivo atual
   */
  async getSemestresConfigurados(tipo_cand: number = 1): Promise<{
    anoId: number;
    primeiroSemestre: { dataInicio: Date; dataFim: Date; descricao: string } | null;
    segundoSemestre: { dataInicio: Date; dataFim: Date; descricao: string } | null;
  }> {
    const anoId = await this.getAnoAtualId(tipo_cand);

    const ano = await this.anoLectivoRepo.findOne({
      where: { codigo: anoId },
      select: [
        'codigo',
        'dataInicioPrimeiroSemestre',
        'dataFimPrimeiroSemestre',
        'dataInicioSegundoSemestre',
        'dataFimSegundoSemestre',
      ],
    });

    if (!ano) {
      throw new Error('Ano lectivo não encontrado');
    }

    const primeiroSemestre =
      ano.dataInicioPrimeiroSemestre && ano.dataFimPrimeiroSemestre
        ? {
          dataInicio: new Date(ano.dataInicioPrimeiroSemestre),
          dataFim: new Date(ano.dataFimPrimeiroSemestre),
          descricao: 'PRIMEIRO_SEMESTRE',
        }
        : null;

    const segundoSemestre =
      ano.dataInicioSegundoSemestre && ano.dataFimSegundoSemestre
        ? {
          dataInicio: new Date(ano.dataInicioSegundoSemestre),
          dataFim: new Date(ano.dataFimSegundoSemestre),
          descricao: 'SEGUNDO_SEMESTRE',
        }
        : null;

    return {
      anoId,
      primeiroSemestre,
      segundoSemestre,
    };
  }

  static clearCache() {
    this.cachedAnoId = null;
    this.lastFetched = 0;
  }
}
