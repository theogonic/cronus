use crate::{utils::{get_path_from_optional_parent, get_request_name, get_usecase_name}, Ctxt, Generator};
use anyhow::{ bail, Result};
use convert_case::Casing;
use cronus_spec::{PythonFastApiGeneratorOption, PythonRedisGeneratorOption};
use serde::ser;




pub struct PythonRedisGenerator {
    
}

impl PythonRedisGenerator {
    pub fn new() -> Self {
        Self {}
    }
}

impl PythonRedisGenerator {
    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a PythonRedisGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| {
            go.generator
                .as_ref()
                .and_then(|gen| gen.python_redis.as_ref())
        })
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "generated.py";

        self.get_gen_option(ctx)
            .and_then(|gen| {
            Some(get_path_from_optional_parent(
                gen.def_loc.file.parent(),
                gen.file.as_ref(),
                default_file,
            ))
            })
            .unwrap_or_else(|| default_file.into())
    }

    
}


fn async_sender_str(service_name:&str, methods: &Vec<(&String, &cronus_spec::RawUsecaseMethod, &cronus_spec::RawUsecaseMethodRedisOption)>) -> String {
    let mut method_strs = String::new();

    for (method_name, method, option) in methods {
        
        let queue_name = option.queue_name.clone().unwrap_or_else(|| {
            let snaked_name = service_name.to_case(convert_case::Case::Snake);
            let method_name = method_name.to_case(convert_case::Case::Snake);
            format!("{snaked_name}_{method_name}")
        });
        let method_str = format!(
            r#"
    async def {method_name}(self, request):
        task_data = json.dumps(asdict(request))
        await self._redis.rpush("{queue_name}", task_data)
        "#);
        method_strs.push_str(&method_str);
    }

    format!(
        r#"
class {service_name}RedisSender({service_name}):
    def __init__(self, redis: Redis):
        self._redis = redis
    
    {method_strs}
    "#
    )
}

fn async_receiver_str(ctx: &crate::Ctxt, service_name:&str, methods: &Vec<(&String, &cronus_spec::RawUsecaseMethod, &cronus_spec::RawUsecaseMethodRedisOption)>) -> String {
    let mut method_strs = String::new();
    let mut listen_methods = vec![];
    for (method_name, method, option) in methods {
        let method_name = method_name.to_case(convert_case::Case::Snake);
        let queue_name = option.queue_name.clone().unwrap_or_else(|| {
            let snaked_name = service_name.to_case(convert_case::Case::Snake);
            format!("{snaked_name}_{method_name}")
        });
        let ack_queue_name = option.ack_queue_name.clone().unwrap_or_else(|| {
            format!("{queue_name}_ack")
        });
        let listen_method_name = format!("_listen_{method_name}");
        
        let request_ty = get_request_name(ctx, &method_name);

        listen_methods.push(listen_method_name.clone());
        let method_str = format!(
            r#"
    async def _listen_{method_name}(self, request):
        while True:
            try:
                task_item = await self._redis.brpoplpush(
                    "{queue_name}",
                    "{ack_queue_name}",
                )
                if task_item:
                    task_data = json.loads(task_item)
                    request = {request_ty}(**task_data)
                    await self._service.{method_name}(request)
                    await self._redis.lrem(
                        "{ack_queue_name}", 1, task_item
                    )
            except Exception as e:
                logger.error(f"Error processing send_reset_password task: {{e}}")
                await asyncio.sleep(5)
        "#);
        method_strs.push_str(&method_str);
    }
    
    let create_task_stmts = listen_methods.iter().map(|method| {
        format!("self.{method}()")
    }).collect::<Vec<_>>().join(",\n");
    let start_method_str = format!(
        r#"
    async def start(self):
        tasks = [{create_task_stmts}]
        for task in tasks:
            self._tasks.append(asyncio.create_task(task))
        "#);

    
    format!(
        r#"
class {service_name}RedisReceiver({service_name}):
    def __init__(self, redis: Redis, service: {service_name}):
        self._redis = redis
        self._service = service
        self._tasks = []

    {start_method_str}
    
    {method_strs}
    "#
    )
}

impl Generator for PythonRedisGenerator {
    fn name(&self) -> &'static str {
        return "python_redis"
    }


    
    fn before_all(&self, ctx: &crate::Ctxt) -> Result<()> {
        let gen_opt = self.get_gen_option(ctx);

        
        let mut common_imports = vec![
            "import json",
            "from dataclasses import asdict",
            "import logging",
        ];

        let async_flag = gen_opt
            .and_then(|gen_opt| gen_opt.async_flag)
            .unwrap_or(false);
        let redis_import = if async_flag {
            "from redis.asyncio import Redis"
        } else {
            "from redis import Redis"
        };
        if async_flag {
            common_imports.push("import asyncio");
        }
        common_imports.push(redis_import);
        common_imports.push("logger = logging.getLogger(__name__)");

        let common_imports_str = common_imports.join("\n") + "\n";
        ctx.append_file(self.name(), &self.dst(ctx), &common_imports_str);
        Ok(())
    
    }
    
    
    fn generate_usecase(&self, ctx: &crate::Ctxt, usecase_name: &str, usecase: &cronus_spec::RawUsecase) -> Result<()> {
        let usecase_from = self.get_gen_option(ctx)
            .and_then(|gen_opt| gen_opt.usecase_from.as_ref())
            .ok_or(anyhow::anyhow!("usecase_from option is not set"))?;

        let redis_methods: Vec<(&String, &cronus_spec::RawUsecaseMethod, &cronus_spec::RawUsecaseMethodRedisOption)> = usecase.methods.iter().filter_map(|(method_name, method)| {
            let redis_option = method
                .option
                .as_ref()
                .and_then(|opt| opt.redis.as_ref());
            if redis_option.is_some() {
                Some((method_name, method, redis_option.unwrap()))
            } else {
                None
            }
            
        }).collect::<Vec<_>>();

        if redis_methods.is_empty() {
            return Ok(());
        }

        let service_name = get_usecase_name(ctx, usecase_name);

        let  sender_str = async_sender_str(&service_name, &redis_methods);
        let  receiver_str = async_receiver_str(&ctx, &service_name, &redis_methods);
        let mut types_import_from_interfaces = vec![service_name.clone()];
        for (method_name, method, option) in &redis_methods {
            if method.req.is_some() {
                let request_ty = get_request_name(ctx, method_name);
                types_import_from_interfaces.push(request_ty);
            }
        }
        let import_items = types_import_from_interfaces.join(", ");
        let import_str = format!("from {usecase_from} import {import_items}");
        
        ctx.append_file(
            self.name(),
            &self.dst(ctx),
            &import_str,
        );

        ctx.append_file(
            self.name(),
            &self.dst(ctx),
            &receiver_str,
        );
        ctx.append_file(
            self.name(),
            &self.dst(ctx),
            &sender_str,
        );

        Ok(())
    }
}