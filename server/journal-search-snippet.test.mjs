import assert from 'node:assert/strict';
import test from 'node:test';
import {applySearchSnippet,searchSnippets} from './journal-search-snippets.mjs';
const snippet=searchSnippets['choosing-voice-periodontal-charting-software'];
const storedTitle='Voice Periodontal Charting: Choosing Software | PerioVox';
const storedDescription='Seven criteria for choosing voice periodontal charting: probe, languages, corrections, follow-up, and cost. Discover PerioVox, free today and forever.';
const page=`<!doctype html><html lang="en"><head><title>${storedTitle}</title><meta name="description" content="${storedDescription}"/><meta property="og:title" content="${storedTitle}"/><meta property="og:description" content="${storedDescription}"/><meta name="twitter:title" content="${storedTitle}"/><meta name="twitter:description" content="${storedDescription}"/><script type="application/ld+json">{"@graph":[{"@type":"WebPage","name":${JSON.stringify(storedTitle)},"description":${JSON.stringify(storedDescription)}},{"@type":"BlogPosting","headline":"Voice Periodontal Charting: 7 Criteria for Choosing Software","description":"Standard probe, languages, corrections, follow-up, and cost."}]}</script></head><body><h1>Voice Periodontal Charting: 7 Criteria for Choosing Software</h1><p>${storedDescription}</p></body></html>`;
test('the public snippet replaces the stored Journal title without touching the article',()=>{
 const html=applySearchSnippet(page,snippet);
 assert.match(html,/<title>Choose Free Voice Perio Charting Software \| PerioVox<\/title>/);
 assert.match(html,/name="description" content="Seven criteria for hygienists and dentists choosing voice perio charting: probe, languages, corrections and cost. PerioVox is free today and forever."/);
 assert.match(html,/property="og:title" content="Choose Free Voice Perio Charting Software \| PerioVox"/);
 assert.match(html,/name="twitter:description" content="Seven criteria for hygienists and dentists choosing voice perio charting: probe, languages, corrections and cost. PerioVox is free today and forever."/);
 assert.match(html,/<h1>Voice Periodontal Charting: 7 Criteria for Choosing Software<\/h1>/);
 assert.match(html,/<p>Seven criteria for choosing voice periodontal charting/);
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(schema['@graph'].find(node=>node['@type']==='WebPage').name,snippet.title);
 assert.equal(schema['@graph'].find(node=>node['@type']==='BlogPosting').headline,'Voice Periodontal Charting: 7 Criteria for Choosing Software');
});
test('applying the snippet again leaves the intended title in place',()=>{
 const once=applySearchSnippet(page,snippet);
 const twice=applySearchSnippet(once,snippet);
 assert.equal(twice.match(/<title>([^<]*)<\/title>/)[1],snippet.title);
});
