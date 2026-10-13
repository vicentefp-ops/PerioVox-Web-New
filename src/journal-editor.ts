import type {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import {safeImage,safeLink} from './journal-format.ts';

const JournalImage=Image.extend({
 parseHTML(){return [{tag:'img[src]',getAttrs:element=>safeImage(element.getAttribute('src')||'')?null:false}]},
 parseMarkdown(token,helpers){
  if(!safeImage(token.href||''))return helpers.createNode('paragraph',{},[{type:'text',text:token.raw||token.text||''}]);
  return helpers.createNode('image',{src:token.href,alt:token.text||'',title:token.title||null});
 },
 renderMarkdown(node){
  const alt=String(node.attrs?.alt||'').replace(/[\\\[\]]/g,'\\$&').replace(/\r?\n/g,' ');
  return `![${alt}](${node.attrs?.src||''})`;
 },
 addInputRules(){return []},
});

export function journalEditorExtensions(){return [
 StarterKit.configure({heading:{levels:[2,3]},underline:false,strike:false,link:{openOnClick:false,autolink:false,linkOnPaste:false,isAllowedUri:url=>!!safeLink(url),HTMLAttributes:{rel:'noreferrer'}}}),
 JournalImage.configure({allowBase64:false}),
 Markdown.configure({markedOptions:{gfm:false},indentation:{style:'space',size:2}}),
]}

export type JournalCommand='heading'|'subheading'|'bold'|'italic'|'bulletList'|'orderedList'|'blockquote'|'undo'|'redo';
export function runJournalCommand(editor:Editor,command:JournalCommand){
 const chain=editor.chain().focus();
 switch(command){
  case 'heading':return chain.toggleHeading({level:2}).run();
  case 'subheading':return chain.toggleHeading({level:3}).run();
  case 'bold':return chain.toggleBold().run();
  case 'italic':return chain.toggleItalic().run();
  case 'bulletList':return chain.toggleBulletList().run();
  case 'orderedList':return chain.toggleOrderedList().run();
  case 'blockquote':return chain.toggleBlockquote().run();
  case 'undo':return chain.undo().run();
  case 'redo':return chain.redo().run();
 }
}
