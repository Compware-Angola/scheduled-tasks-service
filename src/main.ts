import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT as any;
  if (port == null || port == undefined) {
    throw new Error('Porta Não definida!');
  }
  // ✅ Permitir todas as origens CORS
  app.enableCors({
    origin: '*', // permite todas as origens
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Prefixo global
  app.setGlobalPrefix('api');
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
2. **/schedule** — agenda o job com cron ou intervalo em ms
3. O job busca todos os alunos com notas inválidas e delega o recálculo para a fila \`final_average\`
4. **/schedule/stop** — cancela o agendamento
5. **/clear/:status** — limpa jobs por estado (completed, failed, etc.)

---

### Exemplos de agendamento

\`\`\`
// Roda a cada 10 segundos (teste)
POST /jobs/schedule
{}

// Roda a cada 30 segundos
POST /jobs/schedule
{ "everyMs": 30000 }

// Roda todo dia às 06h
POST /jobs/schedule
{ "cron": "0 6 * * *" }

// Para o agendamento de 10s
DELETE /jobs/schedule/stop
{}

// Para o agendamento de cron
DELETE /jobs/schedule/stop
{ "cron": "0 6 * * *" }
\`\`\`

---

### Referência de expressões cron
| Expressão | Descrição |
|-----------|-----------|
| \`0 6 * * *\` | Todo dia às 06:00 |
| \`0 */2 * * *\` | A cada 2 horas |
| \`0 8 * * 1\` | Toda segunda às 08:00 |
| \`*/5 * * * *\` | A cada 5 minutos |

### Referência de intervalos (everyMs)
| Valor | Descrição |
|-------|-----------|
| \`10000\` | A cada 10 segundos |
| \`30000\` | A cada 30 segundos |
| \`60000\` | A cada 1 minuto |
| \`3600000\` | A cada 1 hora |
      `
    )
    .setVersion('1.0')
    .addTag('History Grade Jobs', 'Correção em lote de notas antigas — orquestra a fila final_average')
    .addTag('Jobs Overview', 'Visão geral do estado de todas as filas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  console.log(`🚀 API Listening on port ${port}.`);
  console.log(`📄 Swagger disponível em http://localhost:${port}/docs`);
}

bootstrap();