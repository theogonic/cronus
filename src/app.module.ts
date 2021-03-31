import { Module } from '@nestjs/common';
import { CommanderModule } from 'nestjs-eclih';
import { GenCmdProvider } from './cmd/gen';

@Module({
  imports: [CommanderModule],
  providers: [GenCmdProvider],
})
export class AppModule {}
