const N=26, rnd=Math.random;
const gauss=()=>{let u=0,v=0;while(!u)u=rnd();v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const sig=x=>1/(1+Math.exp(-x));
function bt(W,C){ // W[i][j]=times i beat j ; C[i][j]=comparisons; MM with a weak virtual opponent
  let p=Array(N).fill(1);
  for(let it=0;it<60;it++){
    const q=p.map((pi,i)=>{let w=0.5,d=1/(pi+1);for(let j=0;j<N;j++){if(i===j)continue;w+=W[i][j];if(C[i][j])d+=C[i][j]/(pi+p[j]);}return w/d});
    const g=Math.exp(q.reduce((s,x)=>s+Math.log(x),0)/N);p=q.map(x=>x/g);}
  return p;}
const mat=()=>Array.from({length:N},()=>Array(N).fill(0));
function rank(a){const o=a.map((v,i)=>[v,i]).sort((x,y)=>y[0]-x[0]);const r=[];o.forEach(([,i],k)=>r[i]=k);return r;}
function spearman(a,b){const ra=rank(a),rb=rank(b);let d=0;for(let i=0;i<N;i++)d+=(ra[i]-rb[i])**2;return 1-6*d/(N*(N*N-1));}
const topk=(a,b,k=5)=>{const t=x=>new Set(rank(x).map((r,i)=>[r,i]).filter(([r])=>r<k).map(([,i])=>i));const A=t(a),B=t(b);let c=0;A.forEach(i=>B.has(i)&&c++);return c/k;};
function survey(theta,total,adaptiveFrom){
  const W=mat(),C=mat(),cnt=Array(N).fill(0),used=new Set();
  const all=[];for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)all.push([i,j]);
  all.sort(()=>rnd()-.5);
  for(let n=0;n<total;n++){
    let pick;
    if(n<adaptiveFrom){ // balanced random (same as the live app)
      let b=0,bs=1e9;all.forEach((pr,k)=>{if(used.has(k))return;const s=cnt[pr[0]]+cnt[pr[1]];if(s<bs){bs=s;b=k;}});pick=b;
    } else { // closest current scores, with a mild coverage penalty
      const p=bt(W,C);let b=-1,bs=1e9;all.forEach((pr,k)=>{if(used.has(k))return;const s=Math.abs(Math.log(p[pr[0]]/p[pr[1]]))+0.08*(cnt[pr[0]]+cnt[pr[1]]);if(s<bs){bs=s;b=k;}});pick=b;}
    used.add(pick);const [a,b]=all[pick];cnt[a]++;cnt[b]++;
    const aw=rnd()<sig(theta[a]-theta[b]);const [w,l]=aw?[a,b]:[b,a];W[w][l]++;C[w][l]++;C[l][w]++;
  }
  return {W,C};
}
const conds={'random 75':[75,75],'random 100':[100,100],'adaptive 75 (40 random + 35 adaptive)':[75,40]};
const res={};for(const k in conds)res[k]={ind:0,indTop:0,grp:0,grpTop:0};
const TR=150,BOYS=10;
for(let t=0;t<TR;t++){
  const mu=Array.from({length:N},gauss);
  const thetas=Array.from({length:BOYS},()=>mu.map(m=>m+0.8*gauss()));
  const truthGroup=mu.map((m,i)=>thetas.reduce((s,th)=>s+th[i],0)/BOYS);
  for(const k in conds){
    const [tot,from]=conds[k];const Wg=mat(),Cg=mat();
    for(const th of thetas){const {W,C}=survey(th,tot,from);const est=bt(W,C).map(Math.log);
      res[k].ind+=spearman(est,th)/ (TR*BOYS); res[k].indTop+=topk(est,th)/(TR*BOYS);
      for(let i=0;i<N;i++)for(let j=0;j<N;j++){Wg[i][j]+=W[i][j];Cg[i][j]+=C[i][j];}}
    const g=bt(Wg,Cg).map(Math.log);res[k].grp+=spearman(g,truthGroup)/TR;res[k].grpTop+=topk(g,truthGroup)/TR;
  }
}
for(const k in res){const r=res[k];console.log(k.padEnd(40),'one boy: rank corr',r.ind.toFixed(3),' top-5 hit',(r.indTop*100).toFixed(0)+'%','| group of 10: rank corr',r.grp.toFixed(3),' top-5 hit',(r.grpTop*100).toFixed(0)+'%');}
