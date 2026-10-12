/** Executed inside the exact production image, after timed request/browser work. */
export const artifactInspectionScript = `
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
const started = performance.now();
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, {withFileTypes:true})) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) walk(path);
    else if (/\\.(js|css|wasm)$/.test(entry.name)) {
      const content = readFileSync(path);
      files.push({path: path.replace('/app/dist/', ''), rawBytes: content.byteLength,
        gzipBytes: gzipSync(content, {level:9}).byteLength,
        brotliBytes: brotliCompressSync(content, {params:{[constants.BROTLI_PARAM_QUALITY]:5}}).byteLength});
    }
  }
}
walk('/app/dist');
files.sort((a,b) => b.rawBytes-a.rawBytes);
const totals = {};
for (const extension of ['js','css','wasm']) {
  const selected = files.filter(file => file.path.endsWith('.'+extension));
  totals[extension] = {files:selected.length};
  for (const field of ['rawBytes','gzipBytes','brotliBytes'])
    totals[extension][field] = selected.reduce((sum,file) => sum+file[field], 0);
}
console.log(JSON.stringify({status:'passed', totals, files, inspectionMs:performance.now()-started,
  compression:{gzipLevel:9,brotliQuality:5},
  limitations:['Whole dist artifact inventory includes unfetched lazy/demo chunks; not initial-route transfer.',
    'Computed compression is a reproducible size proxy, not evidence that the server applies Content-Encoding.']}));
`
