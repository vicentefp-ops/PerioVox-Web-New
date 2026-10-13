import path from 'node:path';
import {readFileSync} from 'node:fs';
import {openStore} from './journal-store.mjs';
// Receives JSON through stdin. Never writes or echoes the password.
const {email,password}=JSON.parse(readFileSync(0,'utf8'));
if(typeof email!=='string'||!email.includes('@')||typeof password!=='string'||password.length<12)throw Error('Provide a valid email and a password of at least 12 characters through stdin.');
const store=openStore(process.env.JOURNAL_DATA_DIR||path.resolve('.journal-data'));
try{const created=await store.createUser(email.toLowerCase(),password);console.log(created?'Editorial account created.':'Editorial account already exists; unchanged.')}finally{store.close()}
