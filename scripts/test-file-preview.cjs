const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const sfc = require('vue/compiler-sfc')
const m = { exports: {} }
new Function('module','exports',ts.transpileModule(fs.readFileSync('src/utils/filePreviewRead.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports)
const { readPreviewBuffer, checkPreviewSignature, PREVIEW_MAX_BYTES } = m.exports
;(async () => {
  const bytes = await readPreviewBuffer(new Response('%PDF-1.7'))
  checkPreviewSignature(bytes, 'pdf')
  assert.throws(() => checkPreviewSignature(bytes,'docx'), /实际格式/)
  await assert.rejects(readPreviewBuffer(new Response('')), /为空/)
  await assert.rejects(readPreviewBuffer(new Response('x',{headers:{'content-length':String(PREVIEW_MAX_BYTES+1)}})), /20 MB/)
  let cancelled = false
  const response = new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(1024*1024))},cancel(){cancelled=true}}))
  await assert.rejects(readPreviewBuffer(response), /20 MB/)
  assert.equal(cancelled,true)
  const source = fs.readFileSync('src/pages/home/components/FilePreviewContent.vue','utf8')
  assert(source.includes('watch(() => [props.file.path, props.file.name]'))
  assert(source.includes('setTimeout(() => request.abort()'))
  assert(source.includes("kind.value === 'xls'"))
  assert(source.includes('sandbox=""'))
  for (const name of ['FilePreviewContent','ContractFilePreview']) {
    const filename = `src/pages/home/components/${name}.vue`
    const {descriptor,errors}=sfc.parse(fs.readFileSync(filename,'utf8'))
    assert.deepEqual(errors,[])
    sfc.compileScript(descriptor,{id:name})
    assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename,id:name}).errors,[])
  }
  console.log('PASS preview bounded streaming, signature, cancellation, file switching guards and Vue compilation')
})().catch(e=>{console.error(e);process.exitCode=1})
