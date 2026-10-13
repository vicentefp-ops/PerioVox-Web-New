import {Fragment,type ReactNode} from 'react';
import {Lexer,type Token} from 'marked';
import {safeImage,safeLink} from './journal-format';

function renderTokens(tokens:Token[],prefix=''):ReactNode[]{return tokens.map((token,index)=>{
 const key=prefix+index;
 switch(token.type){
  case 'space':return null;
  case 'strong':return <strong key={key}>{renderTokens(token.tokens,key+'.')}</strong>;
  case 'em':return <em key={key}>{renderTokens(token.tokens,key+'.')}</em>;
  case 'codespan':return <code key={key}>{token.text}</code>;
  case 'code':return <pre key={key}><code>{token.text}</code></pre>;
  case 'br':return <br key={key}/>;
  case 'hr':return <hr key={key}/>;
  case 'heading':{const Heading=token.depth<=2?'h2':'h3';return <Heading key={key}>{renderTokens(token.tokens,key+'.')}</Heading>}
  case 'paragraph':{const image=token.tokens.length===1&&token.tokens[0];return image&&image.type==='image'&&safeImage(image.href)?<figure key={key}><img src={image.href} alt={image.text} loading="lazy"/>{image.text&&<figcaption>{image.text}</figcaption>}</figure>:<p key={key}>{renderTokens(token.tokens,key+'.')}</p>}
  case 'blockquote':return <blockquote key={key}>{renderTokens(token.tokens,key+'.')}</blockquote>;
  case 'list':{const entries=token.items.map((item,i)=><li key={i}>{renderTokens(item.tokens,key+'.'+i+'.')}</li>);return token.ordered?<ol key={key} start={typeof token.start==='number'?token.start:undefined}>{entries}</ol>:<ul key={key}>{entries}</ul>}
  case 'link':{const href=safeLink(token.href);const children=renderTokens(token.tokens,key+'.');return href?<a key={key} href={href} rel={href.startsWith('http')?'noreferrer':undefined}>{children}</a>:<Fragment key={key}>{children}</Fragment>}
  case 'image':return safeImage(token.href)?<img key={key} src={token.href} alt={token.text} title={token.title||undefined} loading="lazy"/>:<Fragment key={key}>{token.text}</Fragment>;
  case 'text':case 'escape':return <Fragment key={key}>{'tokens' in token&&token.tokens?renderTokens(token.tokens,key+'.'):token.text}</Fragment>;
  // HTML is displayed as text; it is never injected into the page.
  default:return <Fragment key={key}>{token.raw}</Fragment>;
 }
})}
export default function JournalBody({body}:{body:string}){return <div className="journal-body">{renderTokens(Lexer.lex(body,{gfm:false}))}</div>}
