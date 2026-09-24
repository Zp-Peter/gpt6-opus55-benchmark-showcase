import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({entryPoints:['src/main.js'],bundle:true,format:'iife',write:false,minify:true,legalComments:'inline',target:'es2020'});
let html=await readFile('index.html','utf8');
html=html.replace('<link rel="stylesheet" href="./src/style.css">','<style>'+await readFile('src/style.css','utf8')+'</style>');
html=html.replace('<script type="module" src="./src/main.js"></script>',()=>'<script>'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>');
await writeFile('播放小城.html',html);
console.log('Created offline standalone: 播放小城.html');
