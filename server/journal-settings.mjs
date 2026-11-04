import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
export function createEncryptedSettings(store,{key,env=process.env}={}){
 const encryptionKey=key&&/^[a-f0-9]{64}$/i.test(key)?Buffer.from(key,'hex'):null;
 const unavailable=()=>Object.assign(new Error('Configura el almacenamiento cifrado de Gemini antes de guardar ajustes.'),{status:409});
 return {
  async apiKey(){
   if(env.GEMINI_API_KEY)return env.GEMINI_API_KEY;
   const value=await store.getSetting('gemini-key');if(!value)return '';
   if(!encryptionKey)throw unavailable();
   const {iv,tag,data}=JSON.parse(value);const decipher=createDecipheriv('aes-256-gcm',encryptionKey,Buffer.from(iv,'hex'));
   decipher.setAAD(Buffer.from('periovox:gemini-key:v1'));decipher.setAuthTag(Buffer.from(tag,'hex'));
   return Buffer.concat([decipher.update(Buffer.from(data,'hex')),decipher.final()]).toString('utf8');
  },
  async model(){return env.GEMINI_MODEL||await store.getSetting('gemini-model')||'gemini-3.8-flash'},
  async save(value,model){
   // All configuration must be checked before writing anything.
   if(!encryptionKey)throw unavailable();
   if(value&&env.GEMINI_API_KEY)throw Object.assign(new Error('La clave está gestionada en Vercel. Actualízala allí para evitar ajustes contradictorios.'),{status:409});
   if(env.GEMINI_MODEL&&env.GEMINI_MODEL!==model)throw Object.assign(new Error('El modelo está gestionado en Vercel. Actualízalo allí.'),{status:409});
   if(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);cipher.setAAD(Buffer.from('periovox:gemini-key:v1'));const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);await store.setSetting('gemini-key',JSON.stringify({iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('hex')}))}
   await store.setSetting('gemini-model',model);
  }
 };
}
