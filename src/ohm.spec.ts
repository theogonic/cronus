import { toAST } from "ohm-js/extras"
import { grammar, ohmAST2Imports, ohmAST2RawZeusDef, semantics, ZeusOhmDef } from './ohm';
import { RawTscaDef, TscaDef, TscaSchema } from './types';

describe('ohm', () => {

    it('parse import', () => {
        const input = `
        import "abc.zeus";
        import "./def-sdf.zeus";
        @a;
        @b({
            "a": "def"
        });
        
        @adfadf({"a":"df","adsf":"adf"})
        @asc
        service a {
            
            @abc({})
            @rest
            method1(fdfa): asdf;
            method2;
        };

        @adf
        struct MyRequest {

            @fadf
            string a;
            string b;

        };
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
        import "abc.zeus";
        struct CreateTodoRequest {
            string todo;
        };
        struct DeleteTodoRequest {
            string todo;
        };
        struct DeleteTodoResponse {

        };
        service Todo {
            count;
            createTodo(CreateTodoRequest);
            deleteTodo(DeleteTodoRequest):DeleteTodoResponse;
        };

        struct Todo {
            string id;
            string todo;
        };
        `
        const m = grammar.match(input);
        if(m.failed()){
            console.error(m.message)
        }
        expect(m.succeeded()).toBeTruthy();
        const res = semantics(m).parse();
        console.log(JSON.stringify(res, null, 2))
        // const ast = toAST(m);
        // console.log(JSON.stringify(ast, null, 2))

        // const rawDef: RawTscaDef = {
        //     types: {},
        //     usecases: {},
        //     schemas: {}
        // };
        
        // ohmAST2RawZeusDef(ast as any, rawDef);
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
