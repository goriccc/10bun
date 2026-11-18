// 오늘의 슬라이드 퍼즐 기준 구현 (lib/games/puzzle.ts 의 참고용). 클라이언트·서버 공용 순수 함수.
export function mulberry32(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const kstSeedOf=(key)=>{const [y,m,d]=key.split('-').map(Number);return y*10000+m*100+d};
export const dowOf=(key)=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).getUTCDay()}; // 0=일
export const sizeFor=(key)=>{const w=dowOf(key);if(w===0||w===6)return 4;const [y,m,d]=key.split('-').map(Number);return (y*10000+m*100+d)%2===0?3:4}; // 평일 격일 3/4, 주말 4
const MIN_MANHATTAN={3:14,4:34,5:60};   // 너무 쉬운 판 제외 (개발 중 조정 가능)
const WALK={3:80,4:160,5:300};
export function manhattan(t,n){let s=0;for(let i=0;i<t.length;i++){const v=t[i];if(!v)continue;const g=v-1;s+=Math.abs(Math.floor(i/n)-Math.floor(g/n))+Math.abs(i%n-g%n)}return s}
export function makePuzzle(dateKey,size){   // size 는 테스트·연습용 (공식 판은 생략)
  const n=size||sizeFor(dateKey), rnd=mulberry32(kstSeedOf(dateKey)*97+15*7919);
  const t=Array.from({length:n*n},(_,i)=>(i+1)%(n*n));   // 1..n²-1, 마지막 칸이 빈칸(0)
  let b=n*n-1,prev=-1,steps=0;
  while(steps<WALK[n]||manhattan(t,n)<MIN_MANHATTAN[n]){
    const nb=[];const r=Math.floor(b/n),c=b%n;
    if(r>0)nb.push(b-n);if(r<n-1)nb.push(b+n);if(c>0)nb.push(b-1);if(c<n-1)nb.push(b+1);
    const cand=nb.filter(x=>x!==prev);const x=cand[Math.floor(rnd()*cand.length)];
    t[b]=t[x];t[x]=0;prev=b;b=x;steps++;if(steps>5000)throw new Error('gen fail');
  }
  if(t.every((v,i)=>v===(i+1)%(n*n)))throw new Error('solved');
  return {n,tiles:t};
}
// 이동 기록: 문자열, 한 글자 = 빈칸이 움직인 방향 U/D/L/R. 풀렸으면 이동 횟수, 아니면 -1
export function replay(p,moves){
  const n=p.n,t=p.tiles.slice();let b=t.indexOf(0);
  for(const ch of moves){const r=Math.floor(b/n),c=b%n;let x;
    if(ch==='U'&&r>0)x=b-n;else if(ch==='D'&&r<n-1)x=b+n;else if(ch==='L'&&c>0)x=b-1;else if(ch==='R'&&c<n-1)x=b+1;else return -1;
    t[b]=t[x];t[x]=0;b=x}
  return t.every((v,i)=>v===(i+1)%(n*n))?moves.length:-1;
}
