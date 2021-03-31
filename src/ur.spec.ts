import { Test, TestingModule } from '@nestjs/testing';
import { UsecaseReader } from './ur';

describe('Activity Controller', () => {
  let reader: UsecaseReader;

  beforeEach(async () => {
    reader = new UsecaseReader();
  });

  it('should be defined', () => {});
});
