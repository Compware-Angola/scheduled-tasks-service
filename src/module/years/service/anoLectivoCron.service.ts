// academic-year-cron.service.ts
import { Injectable, Logger } from '@nestjs/common';

import { DataSource } from 'typeorm';
import { AcademicYear } from '../../entities/academic.year.entity';

const SYSTEM_USER_ID = 0;
export enum EstadoAnoLectivo {
    RASCUNHO = 'RASCUNHO',         // nada é permitido ainda
    CONFIGURAVEL = 'CONFIGURAVEL', // pode criar horários, NÃO pode matricular
    USAVEL = 'USAVEL',             // pode criar horários E matricular estudantes
    ENCERRADO = 'ENCERRADO',       // fechado, só leitura
    ACTIVO = 'Activo',
    DESACTIVADO = 'Desactivado'
}
@Injectable()
export class AcademicYearCronService {
    private readonly logger = new Logger(AcademicYearCronService.name);

    constructor(private readonly dataSource: DataSource) { }


    async activarAnoLectivoPendente() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const agoraFormatado = this.formatarData(new Date());

        await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(AcademicYear);

            // candidato: 1º semestre já começou e ainda não está marcado como activo
            const candidato = await repo
                .createQueryBuilder('ano')
                .where('ano.dataInicioPrimeiroSemestre <= :hoje', { hoje })
                // .andWhere('ano.codigo_tipo_candidatura = :codigoTipoCandidatura', { codigoTipoCandidatura: 1 })
                .andWhere('ano.faseAnoLectivo = :faseAnoLectivo', { faseAnoLectivo: EstadoAnoLectivo.USAVEL })
                .orderBy('ano.dataInicioPrimeiroSemestre', 'DESC')
                .getOne();



            if (!candidato) {
                this.logger.debug('Nenhum ano lectivo pendente de activação hoje.');
                return;
            }

            // desactiva o(s) que estava(m) activo(s)
            await repo
                .createQueryBuilder()
                .update(AcademicYear)
                .set({
                    status: 0,
                    estado: EstadoAnoLectivo.DESACTIVADO,
                    dataUltimaAtualizacao: agoraFormatado,
                    utilizador: SYSTEM_USER_ID,
                })
                .where('status = :activo', { activo: 1 })
                .execute();

            // activa o novo
            await repo
                .createQueryBuilder()
                .update(AcademicYear)
                .set({
                    status: 1,
                    estado: EstadoAnoLectivo.ACTIVO,
                    dataUltimaAtualizacao: agoraFormatado,
                    utilizador: SYSTEM_USER_ID,
                    faseAnoLectivo: EstadoAnoLectivo.ENCERRADO,
                })
                .where('codigo = :id', { id: candidato.codigo })
                .execute();

            this.logger.log(
                `Ano lectivo "${candidato.designacao}" (código ${candidato.codigo}) activado automaticamente — início 1º semestre: ${candidato.dataInicioPrimeiroSemestre}.`,
            );
        });
    }

    private formatarData(data: Date): string {
        // ajusta ao formato que já usam no resto do sistema para DATA_ULTIMA_ATUALIZACAO
        return data.toISOString();
    }
}