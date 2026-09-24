import fs from 'node:fs/promises';
import { build } from 'esbuild';
const result=await build({entryPoints:['src/app.js'],bundle:true,write:false,format:'iife',minify:true,target:['es2022']});
const template=await fs.readFile('src/template.html','utf8');
const style=await fs.readFile('src/style.css','utf8');
const html=template.replace('/*STYLE*/',()=>style).replace('/*APP*/',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.writeFile('马特洪峰.html',html);
console.log('Built self-contained Matterhorn viewer.');
