'use strict';
// Execute the real inline canvas animation in a controlled, deterministic 2D context.
// A wrapped fast particle must never draw a streak across opposite canvas edges.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const match = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .find(m => m[1].includes('igrotekaParticleFlow') && m[1].includes('function draw(now)'));
assert.ok(match, 'inline particle renderer must exist');
const source = match[1];
assert.ok(source.includes('let wrapped=false;'), 'particle wrap flag missing');
assert.ok(source.includes('if(p.fast&&r>1.05&&!wrapped)'), 'fast streak must skip a wrapped frame');
assert.ok(source.includes('if(p.x<-.05){p.x=1.05;wrapped=true;}'), 'left wrap missing');
assert.ok(source.includes('if(p.x>1.05){p.x=-.05;wrapped=true;}'), 'right wrap missing');
assert.ok(source.includes('if(p.y<-.05){p.y=1.05;wrapped=true;}'), 'top wrap missing');
assert.ok(source.includes('if(p.y>1.05){p.y=-.05;wrapped=true;}'), 'bottom wrap missing');

function simulate(particle) {
  const w = 1600, h = 900;
  const strokes = [];
  let pathSegments = [], currentFrom = null, scheduled = null;
  const ctx = {
    clearRect() {}, setTransform() {}, beginPath() {pathSegments=[];currentFrom=null;},
    moveTo(x,y) {currentFrom=[x,y];},
    lineTo(x,y) {
      assert.ok(currentFrom, 'lineTo without moveTo in test');
      pathSegments.push({from:currentFrom, to:[x,y]});currentFrom=[x,y];
    },
    stroke() {strokes.push(...pathSegments);},fill() {},ellipse() {},arc() {},closePath() {}
  };
  const canvas = {
    width:0,height:0,
    getBoundingClientRect() {return {width:w,height:h};},
    getContext() {return ctx;}
  };
  const context = {
    Math, console, __edgeWrapTestParticles:[particle],
    document: {
      hidden:false,
      documentElement:{clientWidth:w,clientHeight:h,dataset:{igrotekaStartup:'ready'}},
      getElementById(id) {return id==='igrotekaParticleFlow'?canvas:null;},
      addEventListener() {}
    },
    window:{devicePixelRatio:1,addEventListener() {}},
    innerWidth:w,innerHeight:h,performance:{now:()=>0},
    requestAnimationFrame(cb) {scheduled=cb;return 1;},
    cancelAnimationFrame() {}
  };
  const needle = 'for(const p of particles){';
  assert.equal(source.split(needle).length-1,1,'particle drawing loop must remain unique');
  const injected = source.replace(needle,'for(const p of __edgeWrapTestParticles){')
    .replace('for(const s of stars){','for(const s of []){')
    .replace('for(const g of glints){','for(const g of []){');
  vm.runInNewContext(injected, context, {filename:'app/index.html:particle-loop',timeout:5000});
  assert.equal(typeof scheduled,'function','particle frame must be scheduled');
  scheduled(32); // 32-ms first frame: movement sufficient to cross a wrap boundary.
  return {particle,strokes};
}

function makeParticle(x,y,vx,vy) {
  return {x,y,vx,vy,drift:0,phase:0,phase2:0,size:2,alpha:.85,hue:160,
    shape:'round',wobble:0,fast:true,twinkle:1,seed:20};
}
const boundaryCases = [
  ['right',makeParticle(1.049,.5,.0001,0),{x:-.05,y:.5}],
  ['left',makeParticle(-.049,.5,-.0001,0),{x:1.05,y:.5}],
  ['bottom',makeParticle(.5,1.049,0,.0001),{x:.5,y:-.05}],
  ['top',makeParticle(.5,-.049,0,-.0001),{x:.5,y:1.05}]
];
for (const [name,p,expected] of boundaryCases) {
  const {strokes} = simulate(p);
  assert.equal(strokes.length,0,`${name} edge must not draw an across-screen streak`);
  assert.ok(Math.abs(p.x-expected.x)<.002,`${name} edge x coordinate must wrap offscreen`);
  assert.ok(Math.abs(p.y-expected.y)<.002,`${name} edge y coordinate must wrap offscreen`);
}
const normal = simulate(makeParticle(.5,.5,.0001,0));
assert.equal(normal.strokes.length,1,'fast particle in normal motion must keep short streak');
const dx=normal.strokes[0].to[0]-normal.strokes[0].from[0];
const dy=normal.strokes[0].to[1]-normal.strokes[0].from[1];
assert.ok(Math.hypot(dx,dy)>0 && Math.hypot(dx,dy)<40,'short streak must stay local');
console.log('IGROTEKA Particle Edge Wrap: PASS');
console.log('- Four boundaries wrap outside canvas without cross-screen streaks');
console.log('- Normal fast-particle local streak remains visible');
