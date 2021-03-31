import { bootstrapCli } from 'nestjs-eclih';
import { AppModule } from '../src/app.module';

bootstrapCli(AppModule, { logger: false });
