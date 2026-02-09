import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT as any;
  if(port== null || port ==undefined){
    throw new Error("Porta Não definida !")
  }
  await app.listen(port);

  console.log(`🚀 API Listening on port ${port}.`);

}

bootstrap();
