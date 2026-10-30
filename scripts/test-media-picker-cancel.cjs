const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
class Input extends EventTarget { type='file'; files=[]; }
const document=new EventTarget();
const sandbox={exports:{},document,HTMLInputElement:Input};
vm.runInNewContext(ts.transpile(fs.readFileSync('src/utils/mediaPickerCancel.ts','utf8'),{module:ts.ModuleKind.CommonJS}),sandbox);
const watch=sandbox.exports.watchMediaPickerCancel;
function open(){const input=new Input();const event=new Event('click');Object.defineProperty(event,'target',{value:input});document.dispatchEvent(event);return input;}
let cancelled=0;
watch(()=>cancelled++);open().dispatchEvent(new Event('cancel'));assert.equal(cancelled,1);
watch(()=>cancelled++);open().dispatchEvent(new Event('cancel'));assert.equal(cancelled,2);
watch(()=>cancelled++);const selected=open();selected.files=[{}];selected.dispatchEvent(new Event('change'));document.dispatchEvent(new Event('pointerdown'));assert.equal(cancelled,2);
watch(()=>cancelled++);open();document.dispatchEvent(new Event('pointerdown'));assert.equal(cancelled,3);
const dispose=watch(()=>cancelled++);const closed=open();dispose();closed.dispatchEvent(new Event('cancel'));assert.equal(cancelled,3);
console.log('PASS picker cancel: repeat selection, successful selection stays locked for processing, legacy fallback, unmount cleanup');
