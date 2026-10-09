// Authored Concept 1 landmarks in Three.js coordinates (Blender x, z, -y).
// These are diffuse light-bounce samples, not extra realtime lights.
export const CHERRY_LIGHTS = Object.freeze([
  [-26.0,6,-13.0,4],[-11.7,6,-17.8,3.1],[-4,7.75,-18.7,3.35],
  [4.8,7.75,-19.3,4.2],[15,7.75,-20,3.4],[-26.1,6,-5.4,3.4],
  [26.4,6,-5.8,3.4],[-25.1,4.05,13.6,3.6],[-6.1,4.05,14.8,3.45],
  [6.2,4.05,14.8,3.45],[26,4.05,13.8,3.4],
  [25.15,6,-13,4],
]);

export function islandLightRig(lamps,screens,landmarks=null){
  const sources=lamps.map(l=>({position:l.position,radius:5.2,power:1.12,color:[1,.34,.075],group:l.group}));
  const pools=lamps.map(l=>({position:l.ground,color:'#ffad37',size:[5.2,5.2],strength:.23,group:l.group}));
  const halos=lamps.map(l=>({position:l.position,color:'#ffca78',size:[1.26,1.26],strength:.24,group:l.group}));
  const bulbs=[];
  for(const [x,y,z,h] of landmarks?.cherries||CHERRY_LIGHTS){
    sources.push({position:[x,y+h*.40,z+.28],radius:2.0,power:1.10,color:[1,.49,.23],verticalScale:1.26,canopyMin:y+h*.36});
    pools.push({position:[x,y+.055,z],color:'#ff9f43',size:[3.7,3.7],strength:.16});
    // Keep canopy/ground illumination without visible bulbs or floating halos.
  }
  if(landmarks){
    // The personal island exports its own shop, gazebo and POWER-yard lights.
    for(const {position,radius,power,group,ground} of landmarks.fixtures||[]){
      sources.push({position,radius,power,color:[1,.43,.11],group});
      pools.push({position:[position[0],ground+.055,position[2]+.35],color:'#ffb852',size:[radius*1.5,radius*1.25],strength:.16,group});
    }
    for(const {position,size,group} of landmarks.bulbs||[]){
      bulbs.push({position,size,group});halos.push({position,color:'#ffca76',size:[.76,.76],strength:.24,group});
    }
    return {sources,pools,halos,bulbs};
  }
  // Warm work lights beneath the striped awnings and dome. Storage uses its
  // authored wall-lantern glass in ambience-lights, including the matching spill.
  for(const [x,y,z,radius,power] of [
    [-18.3,7.46,-13.52,4.9,1.55],[-8.4,7.46,-13.82,4.5,1.50],
    [19.8,9.68,-18.2,4.8,1.75],
    [0,8.66,-13.85,4.5,1.38],[0,7.72,15.66,4.4,1.32],
  ]){
    const position=[x,y,z];sources.push({position,radius,power,color:[1,.43,.11]});
    const ground=x===19.8?8.115:x===0&&z>0?5.18:x===0?7.0:6.07;
    pools.push({position:[x,ground,z+.35],color:'#ffb852',size:[radius*1.5,radius*1.25],strength:.16});
  }
  for(const [x,y,z] of [[-19.55,7.53,-13.54],[-17.05,7.53,-13.54],[-9.58,7.53,-13.84],[-7.22,7.53,-13.84]]){
    bulbs.push({position:[x,y,z],size:.12});halos.push({position:[x,y,z],color:'#ffc874',size:[.95,.95],strength:.26});
  }
  for(let k=0;k<8;k++){
    const a=k*Math.PI/4,position=[19.8+Math.cos(a)*1.50,9.78,-18.2+Math.sin(a)*1.50];
    bulbs.push({position,size:.088});halos.push({position,color:'#ffca76',size:[.76,.76],strength:.24});
  }
  for(const screen of screens){
    sources.push({position:screen.position,radius:2.3,power:.29,color:[.08,.56,1]});
    pools.push({position:[screen.position[0],screen.position[1]-.69,screen.position[2]+.42],color:'#59bfff',size:[1.85,1.26],strength:.13});
  }
  return {sources,pools,halos,bulbs};
}
