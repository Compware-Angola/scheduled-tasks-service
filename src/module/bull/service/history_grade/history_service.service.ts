import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";



@Injectable()
export class HistoryGradeService {

    constructor(private readonly dataSource: DataSource) { }

    async processHistoryGrade(codigoGradeAluno: number) {



    }

}