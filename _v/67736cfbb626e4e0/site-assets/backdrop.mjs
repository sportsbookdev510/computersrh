export const BACKDROPS=Object.freeze(['pixel','open','mist','corners']);
const KEY='rh-early-backdrop';

function normalize(value){
  if(value==='rain')return 'open';
  return BACKDROPS.includes(value)?value:null;
}

function explicitChoice(search){
  const choices=new URLSearchParams(search).getAll('backdrop');
  return choices.length===1?normalize(choices[0]):null;
}

export function resolveBackdrop(search,stored){
  return explicitChoice(search)??normalize(stored)??'corners';
}

export function readBackdrop(search,storage){
  if(storage===undefined){
    try{storage=globalThis.sessionStorage;}catch{storage=null;}
  }
  let stored;
  try{stored=storage?.getItem(KEY);}catch{}
  const choice=explicitChoice(search);
  if(choice){try{storage?.setItem(KEY,choice);}catch{}}
  return choice??normalize(stored)??'corners';
}

// Keep the comparison mode through a sign-in return, independently in each tab.
export function readSkyMotion(search,storage){
  if(storage===undefined){
    try{storage=globalThis.sessionStorage;}catch{storage=null;}
  }
  const key='rh-sky-motion',valid=value=>['animated','still'].includes(value);
  const choices=new URLSearchParams(search).getAll('motion');
  const choice=choices.length===1&&valid(choices[0])?choices[0]:null;
  let stored;
  try{stored=storage?.getItem(key);if(choice)storage?.setItem(key,choice);}catch{}
  return choice??(valid(stored)?stored:'animated');
}
