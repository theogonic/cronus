import { toAST } from 'ohm-js/extras';
import {
  grammar,
  Ohm2Tsca,
  ohmAST2Imports,
  ohmAST2RawZeusDef,
  semantics,
  ZeusOhmDef,
} from './ohm';
import { RawTscaDef, TscaDef, TscaSchema } from './types';
import { GConfig } from './config';

describe('ohm', () => {
  it('parse import', () => {
    const input = `
        import "abc.zeus"
        import "./def-sdf.zeus"
        `;

    const m = grammar.match(input);
    if (m.failed()) {
      console.error(m.message);
    }
    expect(m.succeeded()).toBeTruthy();
  });

  it('parse global option to raw zeus def', () => {
    const input = `
        @ts({
            "a":"b",
            "c":["d","e"]
        });
        `;
    const m = grammar.match(input);
    if (m.failed()) {
      console.error(m.message);
    }

    expect(m.succeeded()).toBeTruthy();

    const rawDef: RawTscaDef = {
      types: {},
      usecases: {},
      schemas: {},
    };
    const gconfig: GConfig = {
      defs: [],
      generators: {},
    };
    const defs: Record<string, any>[] = semantics(m).parse();
    ohmAST2RawZeusDef(defs, rawDef, gconfig);
    expect(gconfig.generators.ts).not.toBeUndefined();
  });

  it('parse basic def to raw zeus def', () => {
    const input = `
        import "abc.zeus"

        @someglobalconfig;

        @todosetting
        service Todo {
            count {}
            createTodo {
                request {
                    string id;
                    string name;
                }

                return {
                    string id;
                }
            }
            deleteTodo {
                request {
                    string id;
                }
            }
        }

        struct Todo {
            string id;
            string todo;
        }
        `;
    const m = grammar.match(input);
    if (m.failed()) {
      console.error(m.message);
    }
    expect(m.succeeded()).toBeTruthy();

    const rawDef: RawTscaDef = {
      types: {},
      usecases: {},
      schemas: {},
    };
    const gconfig: GConfig = {
      defs: [],
      generators: {},
    };
    const defs: Record<string, any>[] = semantics(m).parse();
    ohmAST2RawZeusDef(defs, rawDef, gconfig);
    expect(rawDef.usecases.Todo.methods.createTodo).not.toBeNull();
    expect(
      rawDef.usecases.Todo.methods.createTodo.req.properties.id,
    ).not.toBeNull();
    expect(
      rawDef.usecases.Todo.methods.createTodo.req.properties.name,
    ).not.toBeNull();
    expect(
      rawDef.usecases.Todo.methods.createTodo.res.properties.id,
    ).not.toBeNull();
  });
});
