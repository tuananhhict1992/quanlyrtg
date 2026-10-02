import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiBackoff, waitFor } from '../src/services/api-backoff';

test('429 pauses reads for Retry-After, notifies once and retries without logging out', async () => {
  let now=10000, calls=0, notices=0;
  const waits:number[]=[];
  const request=createApiBackoff(()=>notices++,()=>now,async(ms)=>{waits.push(ms);now+=ms;});
  const result=await request(async()=>++calls===1 ? new Response('{}',{status:429,headers:{'Retry-After':'8'}}) : Response.json({ok:true}),true);
  assert.equal(result.status,200);assert.equal(calls,2);assert.equal(notices,1);assert.deepEqual(waits,[8000]);
});

test('mutations are not retried; following reads respect the same cooldown and support cancellation',async()=>{
  let now=10000,calls=0;
  const request=createApiBackoff(()=>{},()=>now,async(ms,signal)=>{signal?.throwIfAborted();now+=ms;});
  assert.equal((await request(async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'30'}});},false)).status,429);
  assert.equal(calls,1);
  const abort=new AbortController();abort.abort();
  await assert.rejects(request(async()=>{calls++;return Response.json({});},true,abort.signal));
  assert.equal(calls,1);
  await request(async()=>{calls++;return Response.json({});},true);
  assert.equal(now,40000);assert.equal(calls,2);
  const second=new AbortController();const waiting=waitFor(10000,second.signal);second.abort();await assert.rejects(waiting);
});
