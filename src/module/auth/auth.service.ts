


import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) { }


  /**
   * (Opcional) Limpar sessões antigas / inativas
   * Exemplo: marcar como deslogado tudo que não atualizou há mais de 24h
   */
  async ClearOldSessions(): Promise<void> {

    await this.dataSource.query(
      `
    UPDATE FK2_TB_CONTROLE_ACESSO_UTILIZADOR
    SET LOGADO = 0
    WHERE LOGADO = 1 
    `
    );
  }







}