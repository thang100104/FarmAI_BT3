import assert from 'node:assert/strict';
import {test, afterEach} from 'node:test';
import {canSendMessage, conversationHistory, fetchJson, resolveApiUrl} from '../src/ai-client.js';
const originalFetch = globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});

test('all sending paths must wait for configured capabilities',()=>{
  for (const capabilities of [null,undefined,{configured:false}]) {
    assert.equal(canSendMessage('Có bao nhiêu vật nuôi?',false,capabilities),false);
  }
  assert.equal(canSendMessage('Vật nuôi',true,{configured:true}),false);
  assert.equal(canSendMessage('   ',false,{configured:true}),false);
  assert.equal(canSendMessage('Vật nuôi',false,{configured:true}),true);
});
test('followups include successful exchanges, exclude greeting, failed attempts and pending messages',()=>{
  const history=conversationHistory([
    {role:'user',text:'Câu hỏi bị lỗi',failed:true},
    {role:'assistant',text:'Lỗi',failed:true},
    {role:'user',text:'Có bao nhiêu chuồng?'},
    {role:'assistant',text:'Có 5 chuồng.'},
    {role:'user',text:'Còn các chuồng đó?',pending:true}
  ]);
  assert.deepEqual(history,[{role:'user',content:'Có bao nhiêu chuồng?'},{role:'assistant',content:'Có 5 chuồng.'}]);
  assert.equal(conversationHistory(Array.from({length:20},(_,i)=>({role:'user',text:String(i)}))).length,10);
});
test('503 and 429 preserve useful messages/status',async()=>{
  for(const status of [503,429]) {
    globalThis.fetch=async()=>({ok:false,status,json:async()=>({detail:'Thông báo backend'})});
    await assert.rejects(fetchJson('/api/ai/analyze'),e=>e.status===status&&e.message==='Thông báo backend');
  }
});
test('validation errors show messages rather than sensitive request inputs',async()=>{
  globalThis.fetch=async()=>({ok:false,status:422,json:async()=>({detail:[{msg:'Nội dung quá dài',input:'private-input'}]})});
  await assert.rejects(fetchJson('/api/ai/analyze'),e=>e.message==='Nội dung quá dài'&&!e.message.includes('private-input'));
});
test('network failures and malformed JSON are readable',async()=>{
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
  await assert.rejects(fetchJson('/api'),/Không kết nối được backend/);
  globalThis.fetch=async()=>({ok:true,json:async()=>{throw new SyntaxError('bad');}});
  await assert.rejects(fetchJson('/api'),/dữ liệu không hợp lệ/);
});
test('timeout aborts a hanging request without AbortSignal.timeout support',async()=>{
  globalThis.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
  await assert.rejects(fetchJson('/api/ai/analyze',{},5),/quá thời gian chờ/);
});
test('authenticated requests preserve caller headers and return JSON',async()=>{
  globalThis.fetch=async(_url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer test-only');
    assert.ok(options.signal instanceof AbortSignal);
    return {ok:true,json:async()=>({answer:'Dữ liệu hệ thống',mode:'openai'})};
  };
  assert.equal((await fetchJson('/api/ai/analyze',{headers:{Authorization:'Bearer test-only'}})).mode,'openai');
});

test('system report remains sendable without an OpenAI key',()=>{
  assert.equal(canSendMessage('hãy cho tôi xem báo cáo',false,{configured:false,system_reports:true}),true);
  assert.equal(canSendMessage('hãy cho tôi xem báo cáo',true,{configured:false,system_reports:true}),false);
});

test('typed provider errors remain specific including quota/model/authentication',async()=>{
  for(const code of ['openai_quota','openai_authentication','openai_model','openai_connection']) {
    globalThis.fetch=async()=>({ok:false,status:502,json:async()=>({detail:{code,message:'Thông báo cụ thể '+code,retryable:false}})});
    await assert.rejects(fetchJson('/api/ai/analyze'),e=>e.code===code&&e.message==='Thông báo cụ thể '+code&&!e.retryable);
  }
});

test('frontend resolves backend on the same host unless explicitly configured',()=>{
  assert.equal(resolveApiUrl('',{protocol:'http:',hostname:'127.0.0.1'}),'http://127.0.0.1:8000/api');
  assert.equal(resolveApiUrl(undefined,{protocol:'http:',hostname:'localhost'}),'http://localhost:8000/api');
  assert.equal(resolveApiUrl('https://api.example.test/api/',{}),'https://api.example.test/api');
});
