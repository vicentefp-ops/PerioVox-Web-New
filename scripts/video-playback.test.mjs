import assert from 'node:assert/strict';
import {test} from 'node:test';
import {manageVideoPlayback} from '../src/video-playback.ts';

class Video extends EventTarget {
  paused = true;
  muted = false;
  defaultMuted = false;
  autoplay = false;
  playsInline = false;
  preload = 'metadata';
  currentTime = 0;
  readyState = 0;
  error = null;
  calls = 0;
  loads = 0;
  playResult = () => Promise.resolve();
  play() { this.calls++; return this.playResult(); }
  pause() { this.paused = true; }
  load() { this.loads++; this.error = null; }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function setup(t, playResult) {
  t.mock.timers.enable({apis:['setTimeout']});
  const video = new Video();
  if (playResult) video.playResult=()=>playResult(video);
  const states = [];
  let allowed = true;
  const controller = manageVideoPlayback(video,{canPlay:()=>allowed,onState:s=>states.push(s)});
  t.after(()=>controller.dispose());
  return {video,states,controller,allow:value=>{allowed=value;controller.sync();}};
}

test('cold start keeps one pending request across canplay and loadeddata', async t => {
  const {video,states} = setup(t);
  video.dispatchEvent(new Event('loadeddata'));
  video.dispatchEvent(new Event('canplay'));
  assert.equal(video.calls,1);
  assert.equal(video.muted,true);
  assert.equal(video.defaultMuted,true);
  assert.equal(video.playsInline,true);
  assert.equal(video.preload,'auto');
  assert.equal(states.at(-1),'starting');
  video.paused=false;video.readyState=2;
  video.dispatchEvent(new Event('playing'));
  await flush();
  assert.equal(states.at(-1),'playing');
});

test('an interrupted startup retries without needing a second readiness event', async t => {
  const {video,states} = setup(t,()=>Promise.reject(new DOMException('load interrupted','AbortError')));
  await flush();
  const calls=video.calls;
  video.playResult=()=>{video.paused=false;video.readyState=2;return Promise.resolve()};
  t.mock.timers.tick(300);
  await flush();
  assert.equal(video.calls,calls+1);
  assert.equal(states.at(-1),'playing');
  assert.equal(video.loads,0);
});

test('an unresolved cold-load play promise has bounded recovery and a play fallback', async t => {
  const {video,states} = setup(t,()=>new Promise(()=>{}));
  for(let i=0;i<4;i++) t.mock.timers.tick(3500);
  assert.equal(video.calls,4);
  assert.equal(states.at(-1),'blocked');
  t.mock.timers.tick(60000);
  assert.equal(video.calls,4);
  assert.equal(video.loads,0);
});

test('manual pause cancels recovery and ignores a late rejected play request', async t => {
  const {video,states,controller,allow} = setup(t);
  await flush();
  let reject;
  video.playResult=()=>new Promise((_,r)=>{reject=r});
  controller.resume();
  const calls=video.calls;
  allow(false);
  reject(new DOMException('paused','AbortError'));
  await flush();
  t.mock.timers.tick(60000);
  assert.equal(video.calls,calls);
  assert.equal(video.autoplay,false);
  assert.equal(states.at(-1),'paused');
});

test('a browser policy refusal waits for an explicit user play action', async t => {
  const {video,states,controller} = setup(t);
  await flush();
  video.playResult=()=>Promise.reject(new DOMException('user gesture required','NotAllowedError'));
  controller.resume();
  await flush();
  const calls=video.calls;
  video.dispatchEvent(new Event('canplay'));
  t.mock.timers.tick(60000);
  assert.equal(video.calls,calls);
  assert.equal(states.at(-1),'blocked');
  video.playResult=()=>{video.paused=false;video.readyState=2;return Promise.resolve()};
  controller.resume();
  await flush();
  assert.equal(states.at(-1),'playing');
});

test('hidden, offscreen or reduced-motion playback stays paused until permitted', async t => {
  const {video,states,allow} = setup(t);
  allow(false);
  const calls=video.calls;
  video.dispatchEvent(new Event('canplay'));
  t.mock.timers.tick(60000);
  assert.equal(video.calls,calls);
  assert.equal(states.at(-1),'paused');
  allow(true);
  assert.equal(video.calls,calls+1);
  await flush();
});

test('disposing cancels timers, listeners and stale promise updates', async t => {
  const {video,states,controller} = setup(t);
  const before=states.length;
  controller.dispose();
  await flush();
  video.dispatchEvent(new Event('playing'));
  t.mock.timers.tick(60000);
  assert.equal(video.calls,1);
  assert.equal(states.length,before);
});
