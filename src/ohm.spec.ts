import * as ohm from 'ohm-js';
import { toAST } from "ohm-js/extras"
import { ohmAST2RawZeusDef, ZeusOhmDef } from './ohm';

describe('ohm', () => {
    const grammar = ohm.grammar(ZeusOhmDef);

    it('basic def', () => {
        const input = `
        import ./abc/def

        optoin a
        option b {}
        struct MyRequest {
            option a
            int b
            int c
        }
        service Hello {
            method1
            method2 {
                option abc
            }
            method3 {
                in {
                    string name
                }
            }
            method4 {
                in {
                    int a
                    option a
                    
                }
                out {
                    string name
                }
            }
        }
        `
        const m = grammar.match(input);
        expect(m.succeeded).toBeTruthy();
    });

    it('basic def', () => {
        const input = `
        service Todo {
            createTodo {
                in {
                    string name
                }

                out Todo
            }
        }

        struct Todo {
            string id
            string todo
        }
        `
        const m = grammar.match(input);
        const ast = toAST(m);
        const rawDef = ohmAST2RawZeusDef(ast);
        expect( Object.keys(rawDef.usecases).length ).toBe(1);
        const todoDef = rawDef.usecases["Todo"];
        expect(todoDef).not.toBeNull();
        expect(Object.keys(todoDef.methods).length).toBe(1);
        const createTodoMtd = todoDef.methods["createTodo"];
        expect(createTodoMtd).not.toBeNull();


        expect( Object.keys(rawDef.types).length ).toBe(1);
        console.log(JSON.stringify(ast, null, 2))
        
    });
})
