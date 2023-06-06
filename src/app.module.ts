import { Module } from '@nestjs/common';
import { CommanderModule } from 'nestjs-eclih';
import { GenCmdProvider } from './cmd/gen';
import { DumpCmdProvider } from './cmd/dump';

@Module({
  imports: [CommanderModule],
  providers: [GenCmdProvider, DumpCmdProvider],
})
export class AppModule {}
