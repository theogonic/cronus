import { toAST } from "ohm-js/extras"
import { grammar, Ohm2Tsca, ohmAST2Imports, ohmAST2RawZeusDef, semantics, ZeusOhmDef } from './ohm';
import { RawTscaDef, TscaDef, TscaSchema } from './types';
import { GConfig } from "./config";

describe('ohm', () => {

    it('parse import', () => {
        const input = `
        import "abc.zeus"
        import "./def-sdf.zeus"
        `

        const m = grammar.match(input);
        if(m.failed()){
            console.error(m.message)
        }
        expect(m.succeeded()).toBeTruthy();
    })

    it('parse option to raw zeus def', ()=>{
        const input = `
        @zbc.def({
            "a":"b",
            "c":["d","e"]
        });
        `
        const m = grammar.match(input);
        if(m.failed()){
            console.error(m.message)
        }
        
        expect(m.succeeded()).toBeTruthy();
        const res = semantics(m).parse();

        
    })
    
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
        `
        const m = grammar.match(input);
        if(m.failed()){
            console.error(m.message)
        }
        expect(m.succeeded()).toBeTruthy();

        const rawDef: RawTscaDef = {
            types: {},
            usecases: {},
            schemas: {}
        };
        const gconfig: GConfig = {
            defs: [],
            generators: {}
        }
        const defs:Record<string, any>[] = semantics(m).parse();
        ohmAST2RawZeusDef(defs, rawDef, gconfig)
        expect(rawDef.usecases.Todo.methods.createTodo).not.toBeNull();
        // console.log(JSON.stringify(rawDef, null, 2))
        // expect( Object.keys(rawDef.usecases).length ).toBe(1);
        // const todoDef = rawDef.usecases["Todo"];
        // expect(todoDef).not.toBeNull();
        // expect(Object.keys(todoDef.methods).length).toBe(2);
        // const createTodoMtd = todoDef.methods["createTodo"];
        // expect(createTodoMtd).not.toBeNull();


        // expect( Object.keys(rawDef.types).length ).toBe(1);
        
    });
})
