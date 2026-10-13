import {useEffect,useRef,useState,type FormEvent} from 'react';
import {EditorContent,useEditor,useEditorState} from '@tiptap/react';
import {Undo2,Redo2,ImagePlus,Link2} from 'lucide-react';
import {journalEditorExtensions,runJournalCommand,type JournalCommand} from './journal-editor';
import {safeImage,safeLink} from './journal-format';

type Props={value:string;language:'es'|'en';disabled:boolean;onChange:(value:string)=>void;onUpload:(file:File)=>Promise<string|undefined>};
export default function JournalRichText({value,language,disabled,onChange,onUpload}:Props){
 const source=useRef(value),uploadRef=useRef<HTMLInputElement>(null);
 const [extensions]=useState(journalEditorExtensions);
 const [linkOpen,setLinkOpen]=useState(false),[href,setHref]=useState(''),[linkError,setLinkError]=useState('');
 const spanish=language==='es';
 const editor=useEditor({
  extensions,content:value,contentType:'markdown',editable:!disabled,immediatelyRender:false,shouldRerenderOnTransaction:false,
  editorProps:{attributes:{id:'article-body',class:'editor-rich-content',role:'textbox','aria-multiline':'true','aria-labelledby':'article-body-label','aria-describedby':'article-body-help',spellcheck:'true'}},
  onUpdate:({editor:instance})=>{const markdown=instance.getMarkdown();if(markdown===source.current)return;source.current=markdown;onChange(markdown)},
 });
 useEffect(()=>{if(editor&&value!==source.current){source.current=value;editor.commands.setContent(value,{contentType:'markdown',emitUpdate:false})}},[editor,value]);
 // Locking the editor during a request changes UI state, not the article content.
 useEffect(()=>{editor?.setEditable(!disabled,false)},[editor,disabled]);
 const state=useEditorState({editor,selector:({editor:instance})=>({
  heading:instance?.isActive('heading',{level:2})||false,subheading:instance?.isActive('heading',{level:3})||false,
  bold:instance?.isActive('bold')||false,italic:instance?.isActive('italic')||false,bulletList:instance?.isActive('bulletList')||false,
  orderedList:instance?.isActive('orderedList')||false,blockquote:instance?.isActive('blockquote')||false,
  link:instance?.isActive('link')||false,image:instance?.isActive('image')||false,imageAlt:String(instance?.getAttributes('image').alt||''),
  undo:instance?.can().undo()||false,redo:instance?.can().redo()||false,
 })});
 const commands:{command:JournalCommand;label:string}[]=[
  {command:'heading',label:spanish?'Título':'Heading'},{command:'subheading',label:spanish?'Subtítulo':'Subheading'},
  {command:'bold',label:spanish?'Negrita':'Bold'},{command:'italic',label:spanish?'Cursiva':'Italic'},
  {command:'bulletList',label:spanish?'Lista':'List'},{command:'orderedList',label:spanish?'Lista numerada':'Numbered list'},
  {command:'blockquote',label:spanish?'Cita':'Quote'},
 ];
 function openLink(){if(!editor)return;setHref(editor.getAttributes('link').href||'');setLinkError('');setLinkOpen(true)}
 function applyLink(event:FormEvent){
  event.preventDefault();if(!editor||disabled)return;
  const url=href.trim();if(!safeLink(url)){setLinkError(spanish?'Introduce un enlace completo, por ejemplo https://periovox.ai.':'Enter a complete link, for example https://periovox.ai.');return}
  if(editor.state.selection.empty&&!editor.isActive('link'))editor.chain().focus().insertContent({type:'text',text:url,marks:[{type:'link',attrs:{href:url}}]}).run();
  else editor.chain().focus().extendMarkRange('link').setLink({href:url}).run();
  setLinkOpen(false);
 }
 async function insertImage(file?:File){
  if(!file||!editor)return;const url=await onUpload(file);
  if(url&&safeImage(url)&&!editor.isDestroyed)editor.chain().focus().setImage({src:url,alt:''}).run();
 }
 return <div className={'editor-rich-text'+(disabled?' is-disabled':'')} aria-busy={disabled}>
  <div className="editor-toolbar" role="group" aria-label={spanish?'Formato del texto':'Text formatting'}>
   {commands.map(({command,label})=><button type="button" key={command} aria-pressed={state?.[command]||false} disabled={disabled||!editor} onMouseDown={event=>event.preventDefault()} onClick={()=>editor&&runJournalCommand(editor,command)}>{command==='bold'?<strong>{label}</strong>:command==='italic'?<em>{label}</em>:label}</button>)}
   <button type="button" aria-pressed={state?.link||linkOpen} disabled={disabled||!editor} onMouseDown={event=>event.preventDefault()} onClick={openLink}><Link2 size={14}/>{spanish?'Enlace':'Link'}</button>
   <button type="button" disabled={disabled||!editor} onMouseDown={event=>event.preventDefault()} onClick={()=>uploadRef.current?.click()}><ImagePlus size={14}/>{spanish?'Imagen':'Image'}</button>
   <input ref={uploadRef} className="sr-only" type="file" tabIndex={-1} aria-label={spanish?'Subir imagen al texto':'Upload article image'} accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event=>{void insertImage(event.target.files?.[0]);event.target.value=''}}/>
   <span className="editor-toolbar-separator" aria-hidden="true"/>
   {(['undo','redo'] as const).map(command=><button type="button" key={command} disabled={disabled||!state?.[command]} aria-label={command==='undo'?(spanish?'Deshacer':'Undo'):(spanish?'Rehacer':'Redo')} title={command==='undo'?(spanish?'Deshacer':'Undo'):(spanish?'Rehacer':'Redo')} onMouseDown={event=>event.preventDefault()} onClick={()=>editor&&runJournalCommand(editor,command)}>{command==='undo'?<Undo2 size={16}/>:<Redo2 size={16}/>}</button>)}
  </div>
  {linkOpen&&<form className="editor-link-panel" onSubmit={applyLink}><label>{spanish?'Dirección del enlace':'Link address'}<input type="url" autoFocus placeholder="https://" value={href} disabled={disabled} onChange={event=>{setHref(event.target.value);setLinkError('')}}/></label><button type="submit" disabled={disabled}>{spanish?'Aplicar':'Apply'}</button>{state?.link&&<button type="button" disabled={disabled} onClick={()=>{editor?.chain().focus().extendMarkRange('link').unsetLink().run();setLinkOpen(false)}}>{spanish?'Quitar enlace':'Remove link'}</button>}<button type="button" onClick={()=>setLinkOpen(false)}>{spanish?'Cancelar':'Cancel'}</button>{linkError&&<p role="alert">{linkError}</p>}</form>}
  <EditorContent editor={editor}/>
  {state?.image&&<label className="editor-inline-image-alt">{spanish?'Descripción de esta imagen':'Description of this image'}<input value={state.imageAlt} maxLength={300} disabled={disabled} onChange={event=>editor?.commands.updateAttributes('image',{alt:event.target.value})}/></label>}
  <p id="article-body-help" className="editor-format-help">{spanish?'Selecciona el texto y aplica el formato. Los títulos, las listas y las citas se aplican al párrafo.':'Select text to format it. Headings, lists and quotes apply to the paragraph.'}</p>
 </div>;
}
