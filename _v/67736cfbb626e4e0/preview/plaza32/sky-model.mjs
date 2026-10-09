// Camera-independent sky coordinates, bottom-left origin. The two bodies share
// one normalized orbit, independent of the lighting cycle's real duration.
export function celestialState(phase){
  const angle=phase/120*Math.PI*2;
  // The accepted overview places the midday sun (and midnight moon) left of
  // centre. A gently skewed orbit keeps that composition and still rises/sets.
  const skew=Math.log((.202-.07)/.86)/Math.log(.5);
  const body=a=>({x:.07+.86*Math.pow((1-Math.cos(a))*.5,skew),y:.675+.23*Math.sin(a),altitude:Math.sin(a)});
  return {sun:body(angle),moon:body(angle+Math.PI)};
}

export const CLOUDS=Object.freeze([
  [.078,.927,.063,.00128,0], [.30,.850,.044,.00088,1], [.752,.933,.073,.00112,2], [.924,.906,.040,.00104,3],
  [.431,.873,.031,.00096,4], [.618,.952,.025,.00144,5], [.326,.923,.014,.00152,6],
  [.137,.855,.016,.00136,7], [.859,.837,.025,.00120,8],
]);
export const CLOUD_SPAN=1.64;
export const CLOUD_MARGIN=.32;
export function cloudPosition(seconds,index,reduced=false){
  const [start,y,scale,speed,seed]=CLOUDS[index];
  const t=reduced?0:seconds;
  return {x:((start+CLOUD_MARGIN+t*speed)%CLOUD_SPAN+CLOUD_SPAN)%CLOUD_SPAN-CLOUD_MARGIN,
    y:y+Math.sin(t*.045+seed*1.7)*.0015,scale};
}
