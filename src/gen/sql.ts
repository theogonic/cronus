import { GContext } from "../context";
import { TscaDef, TscaSchema } from "../types";
import { BaseGeneratorConfig } from "../config";
import { Register } from "../decorators";
import { Generator } from './base';
import { isPrimitiveType } from "./utils";
import * as path from "path";


interface SQLGeneratorConfig extends BaseGeneratorConfig {
    defaultIDType:string
}

@Register('sql')
export class SQLGenerator extends Generator<SQLGeneratorConfig> {

    private readonly DEFAULT_VERSION = 0;
    getDefaultIDType() {
        return this.config.defaultIDType || "uuid";
    }

    writeToSqlWithVersion(ctx: GContext, version:number, content:string) {
        ctx.addStrToTextFile(this.getSqlFileByVersion(version), content);
    }

    getSqlFileByVersion(ver: number): string {
        return path.join(this.config.output, `v${ver}.sql`);
    }
    
    protected genTscaDef(ctx: GContext, def: TscaDef) {
        def.types.filter(ty => ty.gen.sql != null)
        .forEach(ty => this.genTscaSchema(ctx, ty));
    }



    genTscaSchema(ctx: GContext, schema: TscaSchema) {
        const ext = ctx.genExt['sql'] as any;
        const generatedTables = ext.generatedTables;

        const tableName = getSchemaSqlTableName(schema);
        if(tableName in generatedTables){
            return;
        }

        let content = `CREATE TABLE ${tableName} (\n`;
        for (const prop of schema.properties) {
            if(isPrimitiveType(prop.type) && prop.type != "array") {
                const sqlType = prop.gen?.sql?.type || toSqlType(prop.type);
                const isPrimary = prop.gen?.sql?.primary;
                content += `${prop.name}`;
                 // if the column has reference, change type to id type, create referenced table if needed
                 if(prop.gen?.sql?.ref) {
                    const {type} = prop.gen.sql.ref;
                    const tySchema = ctx.getTypeSchemaByName(type);
                    this.genTscaSchema(ctx, tySchema);
                    content += ` ${this.getDefaultIDType()}`;
                } else {
                    content += ` ${sqlType}`;
                }
                if(isPrimary){
                    content += " PRIMARY KEY"
                }
                content += ";\n";
                
               
            } else {
                let propTy = null;

                
                if(prop.type == "array") {
                    propTy = prop.items.type;
                } else {
                    propTy = prop.type;
                }

                const propTyIsStruct = !isPrimitiveType(propTy);
                
                if(prop.type == "array") {
                    // simple type can be placed in array
                    if(!propTyIsStruct){
                        const sqlType = toSqlType(propTy);
                        content += `${prop.name} ${sqlType}[];\n`
                        continue;
                    } else {
                        // struct type array need to be placed in another table used to join
                        const tySchema = ctx.getTypeSchemaByName(propTy);
                        const tyTableName = getSchemaSqlTableName(tySchema);
                        const denomTableSql = `CREATE TABLE ${tableName}_${tyTableName}s (
                            ${tableName}Id uuid;
                            ${tyTableName}Id uuid;
                        )`
                        this.writeToSqlWithVersion(ctx, this.DEFAULT_VERSION, denomTableSql);
                    }
                }

                // now the property type is not array and primitive

                // check whether it is enum
                const tySchema = ctx.getTypeSchemaByName(propTy);
                if(tySchema.enum){
                    content += `${prop.name} smallint;\n`
                    continue;
                }


                if(propTy in generatedTables) {
                    continue;
                }
                

                content += `${prop.name}Id ${this.getDefaultIDType()};\n`
                this.genTscaSchema(ctx, tySchema);
                
                

            }
        }
        content += ");\n";
        generatedTables[tableName] = true;


        // create indexes if any
        for (const prop of schema.properties) {
            if(prop.gen?.sql){
                const {ref, search} = prop.gen.sql;

                // add fk constraint and index
                if(ref){
                    const {field, type} = ref;
                    const tySchema = ctx.getTypeSchemaByName(type);
                    const tyTableName = getSchemaSqlTableName(tySchema);

                    const fk_sql = `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_${prop.name}_fk FOREIGN KEY (${prop.name}) REFERENCES ${tyTableName}(${field});\n`
                    const index_content = `CREATE INDEX ${tableName}_${prop.name}_idx ON ${tableName}(${prop.name});\n`
                    const version = ref.new || this.DEFAULT_VERSION;
                    content += index_content
                    content += fk_sql
                }
                if(search){
                    const fulltext_sql = `CREATE INDEX ${tableName}_${prop.name}_idx ON ${tableName} USING GIST (${prop.name});\n`
                    content += fulltext_sql;

                }

            }

        }




        let version = schema.gen?.new?.version || this.DEFAULT_VERSION;
        this.writeToSqlWithVersion(ctx, version, content);

        // if we found deprecated, means we need to generate sql to remove it
        if(schema.gen?.deprecated) {
            // TODO
        }

        

    }

    public before(ctx: GContext) {
        ctx.genExt['sql'] = { 
            generatedTables: {}
        }
       
    }
    public after(ctx: GContext) {
    }

}

function getSchemaSqlTableName(schema: TscaSchema):string{
    return schema.gen?.sql?.tableName || schema.name;
}

function toSqlType(ty: string): string {
    switch(ty) {
        case 'string': return "text";
        case 'int32': return 'integer';
        case 'bool': return 'boolean';
        case 'float': return 'real';
    }

    throw new Error(`unknown type ${ty} to sql type`)
}