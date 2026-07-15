import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({
  name: 'FK2_TB_ANO_LECTIVO',
})
export class AcademicYear {
  @PrimaryColumn({
    name: 'CODIGO',
    type: 'number',
  })
  codigo: number;

  @Column({
    name: 'DESIGNACAO',
    type: 'varchar2',
    length: 45,
    nullable: true,
  })
  designacao?: string;

  @Column({
    name: 'DATAINICIOPRIMEIROSEMESTRE',
    type: 'date',
    nullable: true,
  })
  dataInicioPrimeiroSemestre?: Date;

  @Column({
    name: 'DATAFIMPRIMEIROSEMESTRE',
    type: 'date',
    nullable: true,
  })
  dataFimPrimeiroSemestre?: Date;

  @Column({
    name: 'DATAINICIOSEGUNDOSEMESTRE',
    type: 'date',
    nullable: true,
  })
  dataInicioSegundoSemestre?: Date;

  @Column({
    name: 'DATAFIMSEGUNDOSEMESTRE',
    type: 'date',
    nullable: true,
  })
  dataFimSegundoSemestre?: Date;

  @Column({
    name: 'ESTADO',
    type: 'varchar2',
    length: 45,
    nullable: true,
  })
  estado?: string;

  @Column({
    name: 'DATA_ULTIMA_ATUALIZACAO',
    type: 'varchar2',
    length: 45,
    nullable: true,
  })
  dataUltimaAtualizacao?: string;

  @Column({
    name: 'UTILIZADOR',
    type: 'number',
    nullable: true,
  })
  utilizador?: number;

  @Column({
    name: 'STATUS_',
    type: 'number',
    nullable: true,
  })
  status?: number;

  @Column({
    name: 'ORDEM',
    type: 'number',
    nullable: true,
  })
  ordem?: number;

  @Column({
    name: 'EPOCA_EXAME_ACESSO',
    type: 'number',
    nullable: true,
  })
  epocaExameAcesso?: number;

  @Column({
    name: 'CODIGO_TIPO_CANDIDATURA',
    type: 'number',
    nullable: true,
  })
  codigoTipoCandidatura?: number;
}