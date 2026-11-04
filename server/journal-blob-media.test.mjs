import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBlobMedia,MAX_IMAGE_BYTES,UPLOAD_CHUNK_BYTES,initializeBlobEnvironment,verifyBlobEnvironment,BLOB_ENVIRONMENT_MARKER} from './journal-blob-media.mjs';
function fakeSDK(environment='preview:test'){
 const files=new Map(environment?[[BLOB_ENVIRONMENT_MARKER,Buffer.from(JSON.stringify({kind:'periovox-journal-blob',version:1,environment}))]]:[]),writes=[];
 return {files,writes,
  async put(pathname,bytes,options){assert.equal(options.access,'private');assert.equal(options.addRandomSuffix,false);if(options.allowOverwrite===false&&files.has(pathname))throw new Error('Blob exists');writes.push({pathname,size:bytes.length,allowOverwrite:options.allowOverwrite});files.set(pathname,Buffer.from(bytes));return {pathname}},
  async get(pathname,options){assert.equal(options.access,'private');const bytes=files.get(pathname);return bytes?{statusCode:200,blob:{size:bytes.length},stream:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close()}})}:null},
  async list(){return {blobs:[...files.keys()].map(pathname=>({pathname,url:pathname})),hasMore:false}},
  async del(paths){for(const path of paths)files.delete(path)}
 };
}
const png=size=>{const data=Buffer.alloc(size,7);Buffer.from([137,80,78,71,13,10,26,10]).copy(data);return data};
async function stage(media,bytes,owner='session-a'){
 const {ticket,chunkBytes}=media.begin({size:bytes.length},owner);const receipts=[];
 for(let i=0;i<Math.ceil(bytes.length/chunkBytes);i++)receipts.push((await media.chunk(ticket,i,bytes.subarray(i*chunkBytes,(i+1)*chunkBytes),owner)).receipt);
 return {ticket,receipts};
}
test('8 MiB crosses four bounded requests, durable across instances, immutable completion retries',async()=>{
 const sdk=fakeSDK(),media=await createBlobMedia({expectedEnvironment:'preview:test',token:'test-token-not-a-credential',sdk});
 const bytes=png(MAX_IMAGE_BYTES),{ticket,receipts}=await stage(media,bytes);
 assert.equal(sdk.writes.length,4);assert.ok(sdk.writes.every(write=>write.size===UPLOAD_CHUNK_BYTES));
 const restarted=await createBlobMedia({expectedEnvironment:'preview:test',token:'test-token-not-a-credential',sdk});
 const completed=await restarted.complete(ticket,receipts,'session-a');
 assert.match(completed.url,/^\/journal-media\/[a-f0-9]{64}\.png$/);
 assert.deepEqual(await restarted.complete(ticket,receipts,'session-a'),completed);
 const image=await media.readImage(completed.url);assert.equal(image.mimeType,'image/png');assert.deepEqual(Buffer.from(image.data,'base64'),bytes);
});
test('size, index, incomplete manifest and content signatures are enforced',async()=>{
 const sdk=fakeSDK(),media=await createBlobMedia({expectedEnvironment:'preview:test',token:'test-token',sdk});
 for(const size of [0,-1,MAX_IMAGE_BYTES+1,1.1,'2'])assert.throws(()=>media.begin({size},'session-a'),{status:413});
 const {ticket}=media.begin({size:12},'session-a');
 await assert.rejects(media.chunk(ticket,1,png(12),'session-a'),{status:400});
 await assert.rejects(media.chunk(ticket,0,png(11),'session-a'),{status:413});
 await assert.rejects(media.complete(ticket,[],'session-a'),{status:400});
 const invalid=await stage(media,Buffer.from('<html>NOT IMAGE</html>'));
 await assert.rejects(media.complete(invalid.ticket,invalid.receipts,'session-a'),{status:415});
 assert.equal([...sdk.files.keys()].filter(path=>path.startsWith('journal-media/')).length,0);
});
test('tickets and receipts reject cross-session, tampering, cross-upload and expiry',async()=>{
 let now=1000;const sdk=fakeSDK(),media=await createBlobMedia({expectedEnvironment:'preview:test',token:'test-token',sdk,now:()=>now});
 const first=await stage(media,png(20)),second=await stage(media,png(20));
 await assert.rejects(media.chunk(first.ticket,0,png(20),'session-b'),{status:403});
 await assert.rejects(media.complete(first.ticket,first.receipts,'session-b'),{status:403});
 await assert.rejects(media.complete(first.ticket,second.receipts,'session-a'),{status:403});
 await assert.rejects(media.complete(first.ticket+'a',first.receipts,'session-a'),{status:403});
 const pathname=[...sdk.files.keys()].find(path=>path.startsWith('journal-staging/'));sdk.files.set(pathname,png(21));
 await assert.rejects(media.complete(first.ticket,first.receipts,'session-a'),{status:413});
 now+=31*60_000;
 await assert.rejects(media.complete(second.ticket,second.receipts,'session-a'),{status:403});
});
test('public read rejects staging/traversal; cleanup only deletes expired staging after grace',async()=>{
 let now=1000;const sdk=fakeSDK(),media=await createBlobMedia({expectedEnvironment:'preview:test',token:'test-token',sdk,now:()=>now});
 const staged=await stage(media,png(20));await media.complete(staged.ticket,staged.receipts,'session-a');
 for(const path of ['../journal-staging/foo','x.svg','../../secret.png'])await assert.rejects(media.read(path),{status:404});
 assert.equal((await media.cleanupExpired()).deleted,0);
 now+=91*60_000;assert.equal((await media.cleanupExpired()).deleted,1);
 assert.equal(sdk.files.size,2);assert.ok([...sdk.files.keys()].some(path=>path.startsWith('journal-media/')));
});

test('runtime refuses missing marker, wrong full environment and alternate token for same production store',async()=>{
 const sdk=fakeSDK('production:live');let deletes=0;sdk.del=async()=>{deletes++};
 for(const token of ['production-token','other-token-same-store']){
  await assert.rejects(createBlobMedia({sdk,token,expectedEnvironment:'preview:test'}),/mismatch/);
  await assert.rejects(verifyBlobEnvironment({sdk,token,expectedEnvironment:'production:different'}),/mismatch/);
 }
 await assert.rejects(createBlobMedia({sdk:fakeSDK(null),token:'test-token',expectedEnvironment:'preview:test'}),/missing/);
 await assert.rejects(createBlobMedia({sdk,token:'test-token'}),/environment required/);
 assert.equal(sdk.writes.length,0);assert.equal(deletes,0);
});
test('explicit setup is idempotent, immutable and fails closed on another environment',async()=>{
 const sdk=fakeSDK(null),token='test-token';
 const marker=await initializeBlobEnvironment({sdk,token,environment:'preview:test'});
 assert.deepEqual(marker,{kind:'periovox-journal-blob',version:1,environment:'preview:test'});
 assert.equal(sdk.writes.length,1);assert.equal(sdk.writes[0].allowOverwrite,false);
 await initializeBlobEnvironment({sdk,token,environment:'preview:test'});assert.equal(sdk.writes.length,1);
 await assert.rejects(initializeBlobEnvironment({sdk,token,environment:'production:live'}),/mismatch/);
 assert.equal(sdk.writes.length,1);
 assert.deepEqual(await verifyBlobEnvironment({sdk,token,expectedEnvironment:'preview:test'}),marker);
});

test('setup refuses nonempty unmarked stores and verifier rejects malformed or oversized marker',async()=>{
 const sdk=fakeSDK(null);sdk.files.set('journal-media/abc.png',png(20));
 await assert.rejects(initializeBlobEnvironment({sdk,token:'test-token',environment:'preview:test'}),/nonempty unmarked/);
 assert.equal(sdk.writes.length,0);
 for(const content of ['{}',JSON.stringify({version:1,environment:'preview:test'}),'x'.repeat(5000)]){
  sdk.files.set(BLOB_ENVIRONMENT_MARKER,Buffer.from(content));
  await assert.rejects(verifyBlobEnvironment({sdk,token:'test-token',expectedEnvironment:'preview:test'}),/marker invalid/);
 }
});
