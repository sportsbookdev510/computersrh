import * as THREE from 'three';

// Classic: authored local effects, driven by Ambience's existing night uniform.
const INNER_GLOW_SCALE=1.13,OUTER_GLOW_SCALE=1.45;
const INNER_GLOW_STRENGTH=.18,OUTER_GLOW_STRENGTH=.055;
const MOTE_COUNT=10; // Plus the three tiny glints already inside the original asset.
const LIGHT_RADIUS=3.5,LIGHT_STRENGTH=.60,WATER_GLOW_STRENGTH=.18;
const BREATHING_SPEED=Math.PI*2/9;
const MINT='#c9f7ad',GREEN='#79d86f';
// build_concept1_32.py: basin center (0,.4,6.024), water top +.52 (Z-up).
const WATER_POSITION=[0,6.565,-.4],WATER_RADIUS=1.67;

function effectMaterial(uniforms,vertexShader,fragmentShader){
  return new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide});
}

export class FeatherOrbNightFX{
  // tint/light: the aura and the baked warmth colour; the defaults are the orb's own
  // (centerpiece.mjs reuses the effect for a fountain centerpiece in its glow colour).
  constructor(scene,root,glass,night,{tint=MINT,light=GREEN}={}){
    this.scene=scene;this.root=root;this.night=night;
    this.time={value:0};this.breath={value:1};
    // Use the loaded asset, including its transforms, rather than a second orb.
    root.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3().setFromObject(glass),size=bounds.getSize(new THREE.Vector3());
    this.radius=Math.max(size.x,size.y,size.z)/2;
    const center=bounds.getCenter(new THREE.Vector3());
    this.group=new THREE.Group();this.group.name='Classic feather aura and motes';
    this.group.position.copy(root.worldToLocal(center.clone()));root.add(this.group);
    this.lightSources=[{position:center.toArray(),radius:LIGHT_RADIUS,power:LIGHT_STRENGTH,
      color:new THREE.Color(light).toArray(),verticalScale:1}];
    const uniforms={night,time:this.time,breath:this.breath,tint:{value:new THREE.Color(tint)}};
    this.aura=this.makeAura(uniforms);this.group.add(this.aura);
    this.motes=this.makeMotes(uniforms);this.group.add(this.motes);
    this.water=this.makeWater(uniforms);scene.add(this.water);
    this.emissions=[];
    // The dark feather stays readable; only its bevel/glass glints catch extra light.
    const seen=new Set();
    root.traverse(o=>{
      if(!o.isMesh||o===this.aura||o===this.motes)return;
      for(const material of [].concat(o.material)){
        if(!material.emissive||seen.has(material))continue;seen.add(material);
        const isBevel=material.name.includes('rh_bevel'),isShine=material.name.includes('rh_glass_shine');
        if(isBevel||isShine)this.emissions.push({material,base:material.emissive.clone(),
          target:new THREE.Color(isBevel?GREEN:MINT).multiplyScalar(isBevel?.32:.65)});
      }
    });
    this.step(0);
  }
  makeAura(uniforms){
    const material=effectMaterial({...uniforms,radius:{value:this.radius}},`
      uniform float radius,breath;varying vec2 q;
      void main(){q=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);
        p.xy+=position.xy*radius*${2*OUTER_GLOW_SCALE}*(1.+(breath-1.)*.38);
        gl_Position=projectionMatrix*p;}`,`
      uniform float night,breath;uniform vec3 tint;varying vec2 q;
      void main(){float r=length((q-.5)*2.)*${OUTER_GLOW_SCALE};
        float inner=exp(-pow((r-1.)/${INNER_GLOW_SCALE-1},2.))*${INNER_GLOW_STRENGTH};
        float outer=pow(1.-smoothstep(.5,${OUTER_GLOW_SCALE},r),2.)*${OUTER_GLOW_STRENGTH};
        gl_FragColor=vec4(tint,(inner+outer)*night*breath);
        #include <colorspace_fragment>
      }`);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
    mesh.name='Feather soft mint halo';mesh.renderOrder=4;mesh.frustumCulled=false;return mesh;
  }
  makeMotes(uniforms){
    const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry().copy(plane);plane.dispose();
    geometry.instanceCount=MOTE_COUNT;
    const seeds=new Float32Array(MOTE_COUNT*4);
    for(let i=0;i<MOTE_COUNT;i++){
      seeds.set([i*2.399963,1.05+(i%4)*.16,((i*7)%11-5)*.12,.13+(i%3)*.025],i*4);
    }
    geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));
    const material=effectMaterial({...uniforms,radius:{value:this.radius}},`
      attribute vec4 seed;uniform float time,radius;varying vec2 q;varying float glimmer;
      void main(){q=uv;float a=seed.x+time*(.085+.009*mod(seed.x,3.));
        float orbit=seed.y+sin(time*.19+seed.x)*.065;
        vec3 p=vec3(cos(a)*orbit,seed.z+sin(time*.28+seed.x)*.13,sin(a)*orbit*.72)*radius;
        vec4 eye=modelViewMatrix*vec4(p,1.);eye.xy+=position.xy*seed.w;
        gl_Position=projectionMatrix*eye;glimmer=.72+.28*sin(time*.4+seed.x);}`,`
      uniform float night;uniform vec3 tint;varying vec2 q;varying float glimmer;
      void main(){float r=length((q-.5)*2.);
        float core=1.-smoothstep(.10,.40,r),halo=pow(max(0.,1.-r),2.);
        gl_FragColor=vec4(tint,(core*.64+halo*.28)*night*glimmer);
        #include <colorspace_fragment>
      }`);
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Feather slow energy motes';
    mesh.frustumCulled=false;mesh.renderOrder=4;return mesh;
  }
  makeWater(uniforms){
    const material=effectMaterial(uniforms,`
      varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,`
      uniform float night,time,breath;uniform vec3 tint;varying vec2 q;
      void main(){vec2 p=(q-.5)*2.;float r=length(p),angle=atan(p.y,p.x);
        float wave=sin(angle*3.+time*.24)*.021+sin(angle*7.-time*.18)*.012;
        float ring=exp(-pow((r-(.69+.018*sin(time*.45))+wave)/.045,2.));
        float echo=exp(-pow((r-.88-wave)/.025,2.))*.36;
        float shimmer=.50+.50*pow(.5+.5*sin(angle*5.+time*.19),2.);
        float pool=(1.-smoothstep(.20,.96,r))*.46;
        float fade=smoothstep(.25,.40,r)*(1.-smoothstep(.92,1.,r));
        gl_FragColor=vec4(tint,((ring+echo)*shimmer+pool)*fade*${WATER_GLOW_STRENGTH}*night*(1.+(breath-1.)*.4));
        #include <colorspace_fragment>
      }`);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(WATER_RADIUS*2,WATER_RADIUS*2),material);
    mesh.rotation.x=-Math.PI/2;mesh.position.fromArray(WATER_POSITION);mesh.renderOrder=4;
    mesh.name='Feather reflection on fountain water';return mesh;
  }
  step(time){
    this.time.value=time;this.breath.value=1+Math.sin(time*BREATHING_SPEED)*.06;
    this.group.visible=this.water.visible=this.night.value>0;
    for(const e of this.emissions)e.material.emissive.copy(e.base).lerp(e.target,this.night.value);
  }
  dispose(){
    for(const e of this.emissions)e.material.emissive.copy(e.base);
    this.group.removeFromParent();this.water.removeFromParent();
    for(const mesh of [this.aura,this.motes,this.water]){mesh.geometry.dispose();mesh.material.dispose();}
  }
}
