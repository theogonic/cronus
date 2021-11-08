import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  CreateExampleResponse,
  ExampleService,
  EXAMPLE_SERVICE,
} from './generated/types';
import {
  CreateExampleRequestDto,
  ExampleServiceController,
} from './generated/controllers';
import { GraphQLModule, GraphQLTimestamp } from '@nestjs/graphql';
import { ExampleServiceResolver } from './generated/resolvers';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let mockSvc: jest.Mocked<ExampleService>;
  let controller: ExampleServiceController;

  beforeEach(async () => {
    mockSvc = {
      createExample: jest.fn(),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExampleServiceController],
      providers: [
        {
          provide: EXAMPLE_SERVICE,
          useValue: mockSvc,
        },
        ExampleServiceResolver,
      ],
      imports: [
        GraphQLModule.forRoot({
          typePaths: ['./test/generated/schema.graphql', './test/ext.graphql'],
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    controller = app.get(ExampleServiceController);
    expect(controller).not.toBeNull();
  });

  it('/examples (POST)', async () => {
    const mockReq: CreateExampleRequestDto = {
      numProp: 123,
      strProp: 'abcde',
    };
    const mockRes: CreateExampleResponse = {
      example: {
        numProp: 123,
        strProp: 'abcde',
      },
    };
    mockSvc.createExample.mockResolvedValue(mockRes);
    await request(app.getHttpServer())
      .post('/examples')
      .send(mockReq)
      .expect(201)
      .expect(mockRes);

    expect(mockSvc.createExample).toBeCalledWith(mockReq);
  });
});
