// Optional art-review variants; the accepted dark feather remains the default.
// Cream matches rh_ivory in build_robinhood_landmarks.py; stone matches
// stone_light in build_concept1.py. Three.js converts these sRGB colors to linear.
export const FEATHER_FINISHES=Object.freeze({
  original:{label:'Original forest',color:null},
  cream:{label:'Gateway cream',color:'#f3f0cf'},
  stone:{label:'Monument stone',color:'#c6c6b9'},
  sage:{label:'Soft sage',color:'#b9cda6'},
});

export function applyFeatherFinish(feather,key='original'){
  const finish=Object.hasOwn(FEATHER_FINISHES,key)?FEATHER_FINISHES[key]:FEATHER_FINISHES.original;
  if(!finish.color)return 'original';
  const seen=new Set();
  feather.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of [].concat(object.material)){
      if(seen.has(material))continue;seen.add(material);
      material.color.set(finish.color);
      // Keep the finish matte and shaded, with the existing glass/aura providing
      // the night glow. Both vanes and bevels use the selected surface color.
      material.emissive.copy(material.color).multiplyScalar(.035);
      material.emissiveIntensity=1;
      material.roughness=.82;
    }
  });
  return key;
}
