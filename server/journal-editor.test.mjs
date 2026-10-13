import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// These tests use fictional documents in memory, without opening or fetching any website.
const dom=new JSDOM('<!doctype html><html><body></body></html>',{pretendToBeVisual:true});
for(const key of ['window','document','navigator','Node','HTMLElement','Element','DocumentFragment','MutationObserver','DOMParser','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(globalThis,key,{configurable:true,value:typeof dom.window[key]==='function'&&['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
const {Editor}=await import('@tiptap/core');
const {journalEditorExtensions,runJournalCommand}=await import('../src/journal-editor.ts');
function create(t,content='Texto de prueba'){
 const element=document.createElement('div');document.body.append(element);
 const editor=new Editor({element,extensions:journalEditorExtensions(),content,contentType:'markdown',editorProps:{handleScrollToSelection:()=>true}});
 t.after(()=>{editor.destroy();element.remove()});return editor;
}

test('toolbar commands visibly format selected text and can be undone',t=>{
 const editor=create(t);editor.commands.setTextSelection({from:1,to:6});
 assert.equal(runJournalCommand(editor,'bold'),true);
 assert.equal(editor.view.dom.querySelector('strong').textContent,'Texto');
 assert.equal(editor.view.dom.textContent,'Texto de prueba');
 assert.equal(editor.isActive('bold'),true);assert.match(editor.getMarkdown(),/\*\*Texto\*\*/);
 runJournalCommand(editor,'undo');assert.equal(editor.view.dom.querySelector('strong'),null);
 runJournalCommand(editor,'redo');assert.equal(editor.view.dom.querySelector('strong').textContent,'Texto');
 runJournalCommand(editor,'italic');assert.equal(editor.view.dom.querySelector('em').textContent,'Texto');
});

test('headings, lists and quotes operate on the paragraph rather than showing syntax',async t=>{
 for(const [command,selector] of [['heading','h2'],['subheading','h3'],['bulletList','ul li'],['orderedList','ol li'],['blockquote','blockquote']])await t.test(command,t=>{
  const editor=create(t);editor.commands.setTextSelection(3);runJournalCommand(editor,command);
  assert.equal(editor.view.dom.querySelector(selector).textContent,'Texto de prueba');
  assert.equal(editor.view.dom.textContent,'Texto de prueba');
 });
});

test('saved Markdown retains formatted text, nested lists, links and local images after reloading',t=>{
 const content='## Título existente\n\nTexto **importante** y *cursiva* con [un enlace](https://periovox.ai/).\n\n- Primero\n  - Segundo\n\n> Una cita\n\n![Captura de ejemplo](/media/example.png)';
 const editor=create(t,content);
 assert.equal(editor.view.dom.querySelector('h2').textContent,'Título existente');
 assert.equal(editor.view.dom.querySelector('strong').textContent,'importante');
 assert.equal(editor.view.dom.querySelector('ul ul li').textContent,'Segundo');
 assert.equal(editor.view.dom.querySelector('img').getAttribute('src'),'/media/example.png');
 const saved=editor.getMarkdown();const loaded=create(t,saved);
 assert.deepEqual(loaded.getJSON(),editor.getJSON());
 assert.equal(loaded.view.dom.querySelector('a').getAttribute('href'),'https://periovox.ai/');
});

test('pasted formatting and inserted links and images remain editable',t=>{
 const editor=create(t,'');
 editor.commands.insertContent('<h2>Título pegado</h2><p>Texto <strong>en negrita</strong>.</p>');
 assert.equal(editor.view.dom.querySelector('h2').textContent,'Título pegado');
 assert.equal(editor.view.dom.querySelector('strong').textContent,'en negrita');
 editor.commands.selectAll();editor.commands.setLink({href:'https://periovox.ai/'});
 assert.equal(editor.view.dom.querySelector('a').getAttribute('href'),'https://periovox.ai/');
 editor.commands.setTextSelection(editor.state.doc.content.size-1);editor.commands.setImage({src:'/journal-media/ab12-cd34.png',alt:'Una imagen'});
 assert.equal(editor.view.dom.querySelector('img').getAttribute('alt'),'Una imagen');
 assert.match(editor.getMarkdown(),/!\[Una imagen\]\(\/journal-media\/ab12-cd34.png\)/);
});

test('unsafe links, remote images and pasted executable HTML are not activated',t=>{
 const editor=create(t,'[Malicioso](javascript:alert%281%29)\n\n![Remota](https://example.test/track.png)');
 assert.equal(editor.view.dom.querySelector('a[href^="javascript:"]'),null);
 assert.equal(editor.view.dom.querySelector('img'),null);
 editor.commands.insertContent('<p>Texto</p><script>alert(1)</script><img src="https://example.test/track.png" onerror="alert(1)">');
 assert.equal(editor.view.dom.querySelector('script'),null);assert.equal(editor.view.dom.querySelector('img'),null);
});
