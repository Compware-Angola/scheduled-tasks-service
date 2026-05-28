import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class InfoAcademicService {
    private readonly logger = new Logger(InfoAcademicService.name);

    constructor(private readonly dataSource: DataSource) { }

    async processFinalAverage(codigoGradeAluno: number) {

        //AQUI VAI PROCESSAR A MEDIA FINAL DO ALUNO
        //DEPOIS VAI ATUALIZAR A NOTA
        //DEPOIS VAI ATUALIZAR O STATUS DA NOTA
        const { mediaFinal, codigoStatusGrade } = await this.calcularMediaFinal(codigoGradeAluno);
        await this.updateGrade(codigoGradeAluno, mediaFinal, codigoStatusGrade);

    }
    private async updateGrade(codigoGradeAluno: number, mediaFinal: number, codigoStatusGrade: number) {
        try {
            const grade = await this.getGrade(codigoGradeAluno);
            if (!grade) {
                return;
            }
            const sql = `UPDATE FK2_TB_GRADE_CURRICULAR_ALUNO SET NOTA = :nota, CODIGO_STATUS_GRADE_CURRICULAR = :status WHERE codigo = :codigoGradeAluno`;
            const result = await this.dataSource.query(sql, { codigoGradeAluno, nota: mediaFinal, status: codigoStatusGrade } as any);
            return result;

        } catch (err) {
            this.logger.error('Erro ao atualizar nota', err.stack);
            throw err;
        }
    }
    private async getGrade(codigoGradeAluno: number) {
        try {
            const sql = `select * FROM FK2_TB_GRADE_CURRICULAR_ALUNO WHERE codigo = :codigoGradeAluno`;
            const result = await this.dataSource.query(sql, { codigoGradeAluno } as any);
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

        //1.Obter dados da gradecurricular aluno  
        //2.Calcular média
        //3.Calcular status da nota
        return {
            mediaFinal: 17.5,
            codigoStatusGrade: 1
        }

    }
}