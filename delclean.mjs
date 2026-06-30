import pg from "pg"; import fs from "node:fs";
const cs = fs.readFileSync(".env.local","utf8").match(/PRENODO_DATABASE_URL=(.+)/)[1].trim();
async function run(){const pool=new pg.Pool({connectionString:cs,ssl:{rejectUnauthorized:false},max:2});const T=25;
await pool.query("DELETE FROM client_package_usages WHERE client_package_id=1 AND tenant_id=$1",[T]).catch(()=>{});
await pool.query("DELETE FROM client_package_services WHERE client_package_id=1 AND tenant_id=$1",[T]);
await pool.query("DELETE FROM client_packages WHERE id=1 AND tenant_id=$1",[T]);
console.log("test package cleaned"); await pool.end();}
let ok=false;for(let i=0;i<6&&!ok;i++){try{await run();ok=true;}catch(e){console.log("retry",i,e.code||e.message);await new Promise(r=>setTimeout(r,1500));}}
