import * as THREE from 'three';
import {FeatherOrbNightFX} from './feather-orb-fx.mjs';
import {applyFeatherFinish} from './feather-finish.mjs';

export async function loadRobinhoodLandmark(scene,loader,night={value:0},{featherFinish='original'}={}){
  const gltf=await loader.loadAsync('/_media/a10a0092bef7243739f9454f5bdcfa379605d7d2f58ef7d15e25cac79d7be205/exports/components/robinhood-orb.glb');
  const root=gltf.scene.getObjectByName('RH_ORB_FLOAT');
  if(!root)throw Error('Robinhood globe rig missing');
  scene.add(gltf.scene);
  const base=root.position.clone(),feather=gltf.scene.getObjectByName('RH_FEATHER');
  const rotation=feather.quaternion.clone();
  const finish=applyFeatherFinish(feather,featherFinish);
  gltf.scene.traverse(ob=>{
    if(!ob.isMesh)return;
    ob.castShadow=false;ob.receiveShadow=false;
    if(ob.name==='RH_ORB_GLASS'){
      ob.material.dispose();
      ob.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,
        uniforms:{tint:{value:new THREE.Color('#bdf63e')},night,
          nightTint:{value:new THREE.Color('#79d86f')},mint:{value:new THREE.Color('#c9f7ad')}},
        vertexShader:`varying vec3 n; varying vec3 eye; void main(){
          vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal);eye=-p.xyz;
          gl_Position=projectionMatrix*p;}`,
        fragmentShader:`uniform vec3 tint,nightTint,mint;uniform float night; varying vec3 n; varying vec3 eye; void main(){
          float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.1);
          vec3 day=mix(tint,vec3(.9,1.,.65),rim);
          vec3 evening=mix(nightTint,mint,pow(rim,.7));
          gl_FragColor=vec4(mix(day,evening,night),.10+.48*rim+night*(.12+.18*rim));
          #include <colorspace_fragment>
        }`});
      ob.renderOrder=5;
    }
  });
  const effects=new FeatherOrbNightFX(scene,root,gltf.scene.getObjectByName('RH_ORB_GLASS'),night);
  const twist=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);let shown=true;
  return {finish,root:gltf.scene,lightSources:effects.lightSources,
  // A fountain centerpiece (centerpiece.mjs) stands here instead: the orb, its aura and water glow hide.
  setVisible(visible){shown=!!visible;gltf.scene.visible=shown;if(!shown)effects.water.visible=false;},
  step(time){
    if(!shown)return;
    root.position.copy(base);root.position.y+=Math.sin(time*Math.PI/5)*.055;
    // Small yaw keeps the recognizable feather facing the island camera.
    feather.quaternion.copy(rotation).premultiply(twist.setFromAxisAngle(axis,Math.sin(time*Math.PI/5)*.065));
    effects.step(time);
  },dispose(){effects.dispose();gltf.scene.removeFromParent();
    const geometries=new Set(),materials=new Set();gltf.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of [].concat(o.material))materials.add(m);}});
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  }};
}
