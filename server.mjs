import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg' };
createServer(async (req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';
    let file=normalize(join(root,pathname));if(!file.startsWith(root))throw new Error('forbidden');
    try { if((await stat(file)).isDirectory())file=join(file,'index.html'); } catch {}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
  } catch { res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Файл не найден'); }
}).listen(8080,'127.0.0.1',()=>console.log('Browser Strike: http://127.0.0.1:8080'));
