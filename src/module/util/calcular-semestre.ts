import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export async function calcularSemestreByAnoLectivo(
  dataSource: DataSource,
  anoLectivo: number,
) {
  const sqlAnoLectivo = `
        SELECT
          DESIGNACAO,
          DATAINICIOPRIMEIROSEMESTRE,
          DATAFIMPRIMEIROSEMESTRE,
          DATAINICIOSEGUNDOSEMESTRE,
          DATAINICIOSEGUNDOSEMESTRE,
          DATAFIMSEGUNDOSEMESTRE,
          CODIGO
        FROM FK2_TB_ANO_LECTIVO WHERE CODIGO  = :anoLectivo
      `;

  const resultAnoLectivo = await dataSource.query(sqlAnoLectivo, {
    anoLectivo,
  } as any);
  const rowAnoLectivo = resultAnoLectivo[0];
  if (!rowAnoLectivo) {
    throw new BadRequestException('AnoLectivo não encontrado: ');
  }
  const semestre = definirSemestre({
    DATAINICIOPRIMEIROSEMESTRE: rowAnoLectivo?.DATAINICIOPRIMEIROSEMESTRE,
    DATAFIMPRIMEIROSEMESTRE: rowAnoLectivo?.DATAFIMPRIMEIROSEMESTRE,
    DATAFIMSEGUNDOSEMESTRE: rowAnoLectivo?.DATAFIMSEGUNDOSEMESTRE,
    DATAINICIOSEGUNDOSEMESTRE: rowAnoLectivo?.DATAINICIOSEGUNDOSEMESTRE,
  });
  return semestre;
}

type SemestreDatas = {
  DATAINICIOPRIMEIROSEMESTRE: string | Date;
  DATAFIMPRIMEIROSEMESTRE: string | Date;
  DATAINICIOSEGUNDOSEMESTRE: string | Date;
  DATAFIMSEGUNDOSEMESTRE: string | Date;
};

function definirSemestre(
  datas: SemestreDatas,
  dataReferencia: Date = new Date(),
): 1 | 2 | null {
  const ref = new Date(dataReferencia);

  const inicio1 = new Date(datas.DATAINICIOPRIMEIROSEMESTRE);
  const fim1 = new Date(datas.DATAFIMPRIMEIROSEMESTRE);

  const inicio2 = new Date(datas.DATAINICIOSEGUNDOSEMESTRE);
  const fim2 = new Date(datas.DATAFIMSEGUNDOSEMESTRE);

  if (ref >= inicio1 && ref <= fim1) {
    return 1;
  }

  if (ref >= inicio2 && ref <= fim2) {
    return 2;
  }

  return 2; // fora do período letivo
}
