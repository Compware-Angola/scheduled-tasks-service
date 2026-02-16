import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({
  name: 'UMA_TB_ANO_LECTIVO',  
})
export class AcademicYear {
  @PrimaryGeneratedColumn({ name: 'Codigo', "type": 'int', "unsigned": true })
  Codigo: number;

  @Column({ name: 'Designacao', "type": 'varchar', "length": 45 })
  Designacao: string;

  @Column({ name: 'dataInicioPrimeiroSemestre', "type": 'date', "nullable": true })
  dataInicioPrimeiroSemestre?: string;

  @Column({ name: 'dataFimPrimeiroSemestre', "type": 'date', "nullable": true })
  dataFimPrimeiroSemestre?: string;

  @Column({ name: 'dataInicioSegundoSemestre', "type": 'date', "nullable": true })
  dataInicioSegundoSemestre?: string;

  @Column({ name: 'dataFimSegundoSemestre', "type": 'date', "nullable": true })
  dataFimSegundoSemestre?: string;

  @Column({ name: 'estado', "type": 'varchar', "length": 45, "default": 'Desativo' })
  estado: string;

  @Column({ name: 'data_ultima_atualizacao', "type": 'varchar', "length": 45 })
  data_ultima_atualizacao: string;


  @Column({ name: 'status', "type": 'int', "default": 0 })
  status: number;

  @Column({ name: 'ordem', "type": 'int', "default": 1 })
  ordem: number;

  @Column({ name: 'epoca_exame_acesso', "type": 'int', "default": 0 })
  epoca_exame_acesso: number;
}
