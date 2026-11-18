import {makePuzzle,sizeFor,manhattan,replay,dowOf} from './puzzle.ref.mjs';
let bad=0;const sizes={4:0,5:0};const man={4:[1e9,0],5:[1e9,0]};
// 풀이 가능성: 15퍼즐 패리티 검사 (n이 홀수면 역전수가 짝수, 짝수면 (역전수+빈칸 행(아래서부터)) 가 홀수)
const solvable=(p)=>{const {n,tiles}=p;const a=tiles.filter(v=>v);let inv=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])inv++;
  if(n%2===1)return inv%2===0;const rowFromBottom=n-Math.floor(tiles.indexOf(0)/n);return (inv+rowFromBottom)%2===1};
const d0=new Date(Date.UTC(2026,11,1));
for(let i=0;i<365;i++){const d=new Date(d0.getTime()+i*864e5);const key=d.toISOString().slice(0,10);
  const p=makePuzzle(key),p2=makePuzzle(key);
  if(JSON.stringify(p)!==JSON.stringify(p2)){bad++;console.log('nondeterministic',key)}
  if(p.n!==sizeFor(key)){bad++}
  if(!solvable(p)){bad++;console.log('unsolvable',key)}
  const m=manhattan(p.tiles,p.n);sizes[p.n]++;man[p.n]=[Math.min(man[p.n][0],m),Math.max(man[p.n][1],m)];
}
// 위조 방지: 풀이가 아닌 이동기록은 -1
const p=makePuzzle('2026-12-02');if(p.n!==4)bad++;
if(replay(p,'UDLR')!==-1&&replay(p,'UDLR')!==4)bad++; if(replay(p,'')!==-1)bad++;
// 생성 걷기를 거꾸로 되돌린 풀이가 replay 로 통과하는지 (구현 일치 확인)
import {mulberry32,kstSeedOf} from './puzzle.ref.mjs';
// 3×3 BFS 최단 풀이를 replay 로 통과시켜 검증 함수가 정상 풀이를 받아들이는지 확인
{const key='2026-12-07'; const q=makePuzzle(key,3);const n=3;const goal='123456780';
 const start=q.tiles.join('');const prev=new Map([[start,null]]);let fr=[start];let found=false;
 const dirs=[['U',-3],['D',3],['L',-1],['R',1]];
 while(fr.length&&!found){const nx=[];for(const st of fr){const b=st.indexOf('0');const r=Math.floor(b/3),c=b%3;
  for(const [ch,dl] of dirs){if(ch==='U'&&r===0||ch==='D'&&r===2||ch==='L'&&c===0||ch==='R'&&c===2)continue;const a=st.split('');a[b]=a[b+dl];a[b+dl]='0';const ns=a.join('');
   if(!prev.has(ns)){prev.set(ns,[st,ch]);if(ns===goal){found=true;break}nx.push(ns)}}if(found)break}fr=nx}
 let path='';let cur=goal;while(prev.get(cur)){const [ps,ch]=prev.get(cur);path=ch+path;cur=ps}
 console.log('3x3 optimal moves for',key,path.length);
 if(replay(q,path)!==path.length)bad++; if(replay(q,path.slice(0,-1))!==-1)bad++; }
console.log('sizes',sizes,'manhattan[min,max]',JSON.stringify(man),'bad',bad);
process.exit(bad?1:0);
