import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT as any;
  if (port == null || port == undefined) {
    throw new Error('Porta Não definida!');
  }

  const config = new DocumentBuilder()
    .setTitle('Job Manager — Correção Académica')
    .setDescription(
      `
## Visão Geral
API de controlo de jobs assíncronos para processamento de dados académicos.

### Filas disponíveis
| Fila | Responsabilidade |
|------|-----------------|
| \`history_grade_processor\` | Orquestra a correção de dados antigos em lote |
| \`final_average\` | Processa e recalcula a média final de cada aluno |

### Como funciona
1. **/start** — dispara o job manualmente uma vez
2. **/schedule** — agenda o job para correr todos os dias (cron)
3. O job busca todos os alunos com notas inválidas e delega o recálculo para a fila \`final_average\`
4. **/schedule/stop** — cancela o agendamento
5. **/clear/:status** — limpa jobs por estado (completed, failed, etc.)
      `
    )
    .setVersion('1.0')
    .addTag('History Grade Jobs', 'Correção em lote de notas antigas — orquestra a fila final_average')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);  // 👈 acessa em /docs

  await app.listen(port);
  console.log(`🚀 API Listening on port ${port}.`);
  console.log(`📄 Swagger disponível em http://localhost:${port}/docs`);
}

bootstrap();