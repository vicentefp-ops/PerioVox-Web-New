// The editorial calendar is always Europe/Madrid, independent of the editor's device.
export const journalTimeZone='Europe/Madrid';
export function madridInput(instant:string|number):string{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:journalTimeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
 const value=(type:string)=>parts.find(part=>part.type===type)!.value;
 return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}
export function madridToUTC(local:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new Error('Elige la fecha y la hora de publicación.');
 const base=Date.parse(local+'Z');const matches=[base-3600_000,base-7200_000].filter(time=>Number.isFinite(time)&&madridInput(time)===local);
 if(matches.length!==1)throw new Error(matches.length?'Esa hora se repite por el cambio horario. Elige otra hora.':'Esa fecha u hora no existe en España peninsular.');
 return new Date(matches[0]).toISOString();
}
export function scheduleLabel(instant:string):string{
 return new Intl.DateTimeFormat('es-ES',{timeZone:journalTimeZone,dateStyle:'long',timeStyle:'short'}).format(new Date(instant));
}
