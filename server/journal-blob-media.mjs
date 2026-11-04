import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

export const MAX_IMAGE_BYTES=8*1024*1024;
export const UPLOAD_CHUNK_BYTES=2*1024*1024;
const LIFETIME=30*60_000;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(value).digest('hex');
export function imageType(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {ext:'png',mimeType:'image/png'};
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {ext:'jpg',mimeType:'image/jpeg'};
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return {ext:'webp',mimeType:'image/webp'};
 throw fail('Sube una imagen PNG, JPG o WebP.',415);
}
async function boundedBytes(stream,limit){
 const chunks=[];let size=0;
 for await(const chunk of stream){size+=chunk.length;if(size>limit)throw fail('El archivo supera el tamaño permitido.',413);chunks.push(Buffer.from(chunk))}
 return Buffer.concat(chunks);
}

export const BLOB_ENVIRONMENT_MARKER='journal-environment.json';
function requireEnvironment(environment){
 if(typeof environment!=='string'||environment.length>200||!/^(preview|production):[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(environment))throw new Error('Explicit isolated Journal Blob environment required.');
}
async function readEnvironment(sdk,token){
 const result=await sdk.get(BLOB_ENVIRONMENT_MARKER,{token,access:'private',useCache:false});
 if(!result)return null;
 if(result.statusCode!==200||!result.stream)throw new Error('Journal Blob environment marker unavailable.');
 let marker;try{marker=JSON.parse((await boundedBytes(result.stream,4096)).toString('utf8'))}catch{throw new Error('Journal Blob environment marker invalid.')}
 if(marker?.kind!=='periovox-journal-blob'||marker.version!==1||typeof marker.environment!=='string'||Object.keys(marker).sort().join(',')!=='environment,kind,version')throw new Error('Journal Blob environment marker invalid.');
 return marker;
}
/** Read-only guard. Used before runtime initialization and by approved import tooling. */
export async function verifyBlobEnvironment({sdk,token,expectedEnvironment}){
 requireEnvironment(expectedEnvironment);
 if(!token)throw new Error('A private Journal Blob store token is required.');
 sdk??=await import('@vercel/blob');
 const marker=await readEnvironment(sdk,token);
 if(!marker||marker.environment!==expectedEnvironment)throw new Error('Journal Blob environment mismatch or missing marker.');
 return marker;
}
/** Explicit setup only, never called by the runtime. Does not overwrite existing markers. */
export async function initializeBlobEnvironment({sdk,token,environment}){
 requireEnvironment(environment);
 if(!token)throw new Error('A private Journal Blob store token is required.');
 sdk??=await import('@vercel/blob');
 const marker=await readEnvironment(sdk,token);
 if(marker){if(marker.environment!==environment)throw new Error('Journal Blob environment mismatch.');return marker}
 const contents=await sdk.list({token,limit:1});
 if(contents.blobs.length||contents.hasMore)throw new Error('Cannot label a nonempty unmarked Journal Blob store.');
 try{
  await sdk.put(BLOB_ENVIRONMENT_MARKER,JSON.stringify({kind:'periovox-journal-blob',version:1,environment}),{token,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60});
 }catch(error){
  // Resolve a racing setup or uncertain write by reading; never retry the write.
  const actual=await readEnvironment(sdk,token);
  if(!actual||actual.environment!==environment)throw error;
 }
 return verifyBlobEnvironment({sdk,token,expectedEnvironment:environment});
}

/** All objects, including staging, use a PRIVATE Blob store. No client receives storage credentials.
 * Each request is below the Vercel 4.5MB body limit. Tickets and receipts are session-bound.
 * SDK injection is only for contract tests; production defaults to the real @vercel/blob SDK.
 */
export async function createBlobMedia({token=process.env.BLOB_READ_WRITE_TOKEN,sdk,expectedEnvironment,now=()=>Date.now()}={}){
 if(!token)throw new Error('A private Journal Blob store token is required.');
 sdk??=await import('@vercel/blob');
 await verifyBlobEnvironment({sdk,token,expectedEnvironment});
 const options={token,access:'private'};
 const signingKey=createHmac('sha256',token).update('periovox-journal-upload-v1').digest();
 const sign=value=>{const body=Buffer.from(JSON.stringify(value)).toString('base64url');return body+'.'+createHmac('sha256',signingKey).update(body).digest('base64url')};
 function verify(value,kind,owner){
  if(typeof value!=='string'||value.length>2048||!owner)throw fail('La subida no es válida.',403);
  const [body,signature,...rest]=value.split('.');
  const expected=createHmac('sha256',signingKey).update(body||'').digest();
  const actual=Buffer.from(signature||'','base64url');
  if(rest.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw fail('La subida no es válida.',403);
  let data;try{data=JSON.parse(Buffer.from(body,'base64url').toString())}catch{throw fail('La subida no es válida.',403)}
  if(data.kind!==kind||data.owner!==hash(owner)||!Number.isFinite(data.expires)||data.expires<=now())throw fail('La subida ha caducado. Vuelve a subir la imagen.',403);
  return data;
 }
 function ticketData(ticket,owner){
  const data=verify(ticket,'upload',owner);
  if(!/^[a-f0-9-]{36}$/.test(data.id)||!Number.isInteger(data.size)||data.size<1||data.size>MAX_IMAGE_BYTES)throw fail('La subida no es válida.',403);
  return data;
 }
 const stagingPath=(data,index,digest)=>`journal-staging/${data.expires}/${data.id}/${index}-${digest}`;
 const write=(pathname,bytes,contentType)=>sdk.put(pathname,bytes,{...options,contentType,addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60});
 return {
  mode:'chunks',chunkBytes:UPLOAD_CHUNK_BYTES,
  begin({size},owner){
   if(!owner)throw fail('Inicia sesión para subir imágenes.',401);
   if(!Number.isInteger(size)||size<1||size>MAX_IMAGE_BYTES)throw fail('La imagen debe pesar entre 1 byte y 8 MB.',413);
   const data={kind:'upload',id:randomUUID(),size,owner:hash(owner),expires:now()+LIFETIME};
   return {ticket:sign(data),chunkBytes:UPLOAD_CHUNK_BYTES,expires:data.expires};
  },
  async chunk(ticket,index,bytes,owner){
   const data=ticketData(ticket,owner),count=Math.ceil(data.size/UPLOAD_CHUNK_BYTES);
   if(!Number.isInteger(index)||index<0||index>=count)throw fail('Parte de imagen no válida.');
   const expected=Math.min(UPLOAD_CHUNK_BYTES,data.size-index*UPLOAD_CHUNK_BYTES);
   if(!Buffer.isBuffer(bytes)||bytes.length!==expected)throw fail('Parte de imagen incompleta o demasiado grande.',413);
   const digest=hash(bytes);
   await write(stagingPath(data,index,digest),bytes,'application/octet-stream');
   return {receipt:sign({kind:'chunk',id:data.id,index,digest,size:bytes.length,owner:data.owner,expires:data.expires})};
  },
  async complete(ticket,receipts,owner){
   const data=ticketData(ticket,owner),count=Math.ceil(data.size/UPLOAD_CHUNK_BYTES);
   if(!Array.isArray(receipts)||receipts.length!==count)throw fail('Faltan partes de la imagen.');
   const chunks=[];
   for(let index=0;index<count;index++){
    const receipt=verify(receipts[index],'chunk',owner);
    const expected=Math.min(UPLOAD_CHUNK_BYTES,data.size-index*UPLOAD_CHUNK_BYTES);
    if(receipt.id!==data.id||receipt.index!==index||receipt.expires!==data.expires||receipt.size!==expected||!/^[a-f0-9]{64}$/.test(receipt.digest))throw fail('Las partes de la imagen no coinciden.',403);
    const blob=await sdk.get(stagingPath(data,index,receipt.digest),{...options,useCache:false});
    if(!blob||blob.statusCode!==200||!blob.stream)throw fail('La subida está incompleta. Vuelve a intentarlo.',409);
    const bytes=await boundedBytes(blob.stream,expected);
    if(bytes.length!==expected||hash(bytes)!==receipt.digest)throw fail('La imagen recibida no coincide. Vuelve a subirla.',409);
    chunks.push(bytes);
   }
   const bytes=Buffer.concat(chunks),{ext,mimeType}=imageType(bytes);
   // Content address makes retry/concurrent completion immutable even if responses are lost.
   const filename=hash(bytes)+'.'+ext;
   await write('journal-media/'+filename,bytes,mimeType);
   return {url:'/journal-media/'+filename};
  },
  async read(filename){
   if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(filename))throw fail('Imagen no encontrada.',404);
   const blob=await sdk.get('journal-media/'+filename,{...options,useCache:false});
   if(!blob||blob.statusCode!==200||!blob.stream)throw fail('Imagen no encontrada.',404);
   if(!Number.isInteger(blob.blob.size)||blob.blob.size<1||blob.blob.size>MAX_IMAGE_BYTES){await blob.stream.cancel();throw fail('Imagen no válida.',404)}
   return {stream:blob.stream,size:blob.blob.size,mimeType:'image/'+(filename.endsWith('.jpg')?'jpeg':filename.split('.').pop())};
  },
  async readImage(cover){
   if(typeof cover!=='string'||!cover.startsWith('/journal-media/'))throw fail('Utiliza una imagen subida al Journal.');
   const {stream,size}=await this.read(cover.slice('/journal-media/'.length));
   const bytes=await boundedBytes(stream,MAX_IMAGE_BYTES);
   if(bytes.length!==size)throw fail('La imagen todavía no está disponible.',503);
   return {mimeType:imageType(bytes).mimeType,data:bytes.toString('base64')};
  },
  // Call from approved maintenance only. Keep chunks after completion for idempotent retries.
  // A cursor bounds each invocation; never delete final media or imported legacy objects.
  async cleanupExpired(cursor){
   const page=await sdk.list({token,prefix:'journal-staging/',limit:1000,...(cursor?{cursor}:{})});
   const expired=page.blobs.filter(blob=>{
    const match=blob.pathname.match(/^journal-staging\/(\d+)\/[a-f0-9-]{36}\/[0-3]-[a-f0-9]{64}$/);
    return match&&Number(match[1])+3600_000<now();
   });
   if(expired.length)await sdk.del(expired.map(blob=>blob.url),{token});
   return {deleted:expired.length,cursor:page.hasMore?page.cursor:undefined};
  }
 };
}
