import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { ManualGradeCorrectionService } from '../info-academic/manual-grade-correction.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const correctionService = app.get(ManualGradeCorrectionService);

  // ⚡ Configura os anos e semestres que quer corrigir
  const anos = [20, 21, 22]; // ex: anos letivos antigos
  const semestres = [1, 2];      // ex: semestre 1 e 2

  await correctionService.corrigirGradesPorRange(anos, semestres);

  await app.close();
  console.log('🏁 Script finalizado');
}

bootstrap();
