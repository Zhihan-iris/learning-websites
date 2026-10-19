export const STORAGE_KEY='zhihan-econometrics-v1';
export const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function ols(points){
 if(points.length<3||points.some(p=>p.length!==2||p.some(x=>!Number.isFinite(x))))throw Error('至少需要三个有效观测');
 const mx=mean(points.map(p=>p[0])),my=mean(points.map(p=>p[1]));
 const sxx=points.reduce((s,[x])=>s+(x-mx)**2,0);if(sxx<=0)throw Error('X 需要变异');
 const slope=points.reduce((s,[x,y])=>s+(x-mx)*(y-my),0)/sxx,intercept=my-slope*mx;
 const sse=points.reduce((s,[x,y])=>s+(y-intercept-slope*x)**2,0),sst=points.reduce((s,[,y])=>s+(y-my)**2,0);
 return {slope,intercept,sse,r2:sst?1-sse/sst:null,mx,my,sxx};
}
export function intervals(n,sigma,x0,mx,sxx){const h=1/n+(x0-mx)**2/sxx;return {mean:1.96*sigma*Math.sqrt(h),prediction:1.96*sigma*Math.sqrt(1+h)};}
export function logistic(z){return z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));}
export function omitted(beta,gamma,corr,sdRatio=1){return beta+gamma*corr*sdRatio;}
export function arPath(rho,innovations,y0=0){let y=y0;return [y,...innovations.map(e=>(y=rho*y+e))];}
export function arVariance(rho,t,sigma=1){let v=0;for(let i=0;i<t;i++)v=rho*rho*v+sigma*sigma;return v;}
export function blankState(){return {read:[],notes:{},answers:{},last:'ch01'};}
export function sanitizeState(raw,chapters){const s=blankState();if(!raw||typeof raw!=='object')return s;const ids=chapters.map(c=>c.id);s.read=Array.isArray(raw.read)?[...new Set(raw.read.filter(x=>ids.includes(x)))]:[];s.last=ids.includes(raw.last)?raw.last:'ch01';for(const id of ids)if(typeof raw.notes?.[id]==='string')s.notes[id]=raw.notes[id].slice(0,20000);for(const q of chapters.flatMap(c=>c.quizzes)){const a=raw.answers?.[q.id];if(a&&Number.isInteger(a.choice)&&a.choice>=0&&a.choice<q.options.length)s.answers[q.id]={choice:a.choice,correct:a.choice===q.answer,missed:!!a.missed||a.choice!==q.answer};}return s;}
export function recordAnswer(state,q,choice){if(!Number.isInteger(choice)||choice<0||choice>=q.options.length)throw Error('无效选项');state.answers[q.id]={choice,correct:choice===q.answer,missed:!!state.answers[q.id]?.missed||choice!==q.answer};return state.answers[q.id];}
