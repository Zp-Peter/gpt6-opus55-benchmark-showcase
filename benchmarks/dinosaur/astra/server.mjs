import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{try {const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const p=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!p.startsWith(root+path.sep))throw Error();const data=await readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT)||4178,'127.0.0.1',()=>console.log('Small Hours: http://127.0.0.1:'+(process.env.PORT||4178)));
