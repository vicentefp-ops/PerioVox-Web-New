export function safeLink(url:string){return /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url)&&!/[\u0000-\u0020<>"\\]/.test(url)?url:null}
export const safeImage=(url:string)=>/^\/(?:media|journal-media)\/[a-zA-Z0-9._-]+$/.test(url);
