import * as THREE from 'three';

const direction=new THREE.Vector3(Math.sin(22*Math.PI/180)*Math.cos(33*Math.PI/180),Math.sin(33*Math.PI/180),Math.cos(22*Math.PI/180)*Math.cos(33*Math.PI/180));
const right=new THREE.Vector3(Math.cos(22*Math.PI/180),0,-Math.sin(22*Math.PI/180));
const up=new THREE.Vector3().crossVectors(direction,right);
const C=h=>new THREE.Color(h);
const place=(x,y,d)=>right.clone().multiplyScalar(x).addScaledVector(up,y).addScaledVector(direction,-d);

export class CloudHorizon{
  constructor(scene,skyUniforms){
    this.scene=scene;this.uniforms={...skyUniforms,
      viewScale:skyUniforms.viewScale??{value:new THREE.Vector2(1,1)},
      viewOffset:skyUniforms.viewOffset??{value:new THREE.Vector2()}};this.rotors=[];
    this.hazeDay=C('#b4dbf2');this.hazeNight=C('#494b99');this.hazeDusk=C('#d3a1bc');
    scene.fog=new THREE.Fog(this.hazeDay,95,215);
    this.makeCloudSea();this.makeVeil();
  }
  async load(loader){
    const gltf=await loader.loadAsync('/_media/713a840f5968e2c84936cc2e96938e2d761227719de1268a5afb4d63d82fa81d/exports/concept1-32/cloud-horizon.glb');
    this.root=gltf.scene;this.scene.add(this.root);
    this.root.traverse(o=>{
      if(!o.isMesh)return;
      const windows=o.name==='horizon_windows',glow=o.name==='horizon_lantern_glow';o.material.dispose();
      if(glow){
        o.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
          uniforms:{night:this.uniforms.night},vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader:`uniform float night;varying vec2 q;void main(){
            float radius=length((q-.5)*vec2(1.,.82));
            float glow=pow(1.-smoothstep(.06,.61,radius),2.0);
            gl_FragColor=vec4(1.,.32,.035,glow*night*.34);
            #include <colorspace_fragment>
          }`});
        o.castShadow=false;o.receiveShadow=false;return;
      }
      const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
      mat.onBeforeCompile=shader=>{
        shader.uniforms.horizonNight=this.uniforms.night;shader.uniforms.horizonTwilight=this.uniforms.twilight;
        if(o.name.startsWith('horizon_range_')){
          shader.uniforms.horizonUp={value:up};shader.uniforms.horizonFog={value:this.scene.fog.color};
          shader.vertexShader='uniform vec3 horizonUp; varying float horizonAltitude;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhorizonAltitude=dot((modelMatrix*vec4(transformed,1.)).xyz,horizonUp);');
          shader.fragmentShader='uniform vec3 horizonFog; varying float horizonAltitude;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,horizonFog,clamp((5.5-horizonAltitude)*.12,0.,.88));\n#include <opaque_fragment>');
        }
        shader.fragmentShader='uniform float horizonNight,horizonTwilight;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          ${windows?'diffuseColor.rgb = mix(diffuseColor.rgb*.25,vec3(1.8,.42,.045),horizonNight);':glow?'diffuseColor.rgb *= mix(vec3(1.),vec3(1.1,.46,.16),horizonNight);':'diffuseColor.rgb *= mix(vec3(1.),vec3(.12,.15,.47),horizonNight); diffuseColor.rgb *= mix(vec3(1.),vec3(1.12,.85,.81),horizonTwilight*.35);'}`);
      };
      mat.customProgramCacheKey=()=>windows?'horizon-windows':glow?'horizon-glow':o.name.startsWith('horizon_range_')?'horizon-mountain':'horizon-land';
      if(windows||glow)mat.fog=false;
      o.material=mat;o.castShadow=false;o.receiveShadow=false;
      if(o.name.startsWith('horizon_rotor_')){this.rotors.push({object:o,rotation:o.quaternion.clone()});}
    });
  }
  makeCloudSea(){
    let seed=9381;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const centers=[],sizes=[],phases=[];
    const cluster=(x,y,depth,size,count)=>{
      for(let i=0;i<count;i++){
        centers.push(...place(x+(rand()-.5)*size*3,y+(rand()-.5)*size*.95,depth+(rand()-.5)*size*1.2).toArray());
        const radius=size*(.25+rand()*.50);sizes.push(radius*(1+rand()*.35),radius*(.66+rand()*.28),radius*.8);phases.push(rand()*6.28);
      }
    };
    // Upper banks sit in the gaps between ranges; the lower sea envelops the
    // hanging rocks without introducing volumetric raymarching or shadow maps.
    for(let i=0;i<65;i++)cluster(-23+rand()*46,3.4+rand()*3.8,55+rand()*14,.30+rand()*.45,10);
    for(let i=0;i<56;i++)cluster(-24+rand()*48,1.0+rand()*5.2,31+rand()*12,.34+rand()*.55,11);
    for(let i=0;i<65;i++)cluster(-24+rand()*48,-12+rand()*15,20+rand()*13,.7+rand()*1.0,12);
    for(let i=0;i<35;i++)cluster(-23+rand()*46,-11+rand()*7,8+rand()*12,1.0+rand()*1.2,12);
    // Continuous lower deck fills the gaps between billows so the island hangs
    // over a cloud sea rather than a scattering of isolated white spheres.
    for(let y=-12;y<2.5;y+=1.8)for(let x=-24;x<25;x+=1.8)cluster(x+(rand()-.5),y+(rand()-.5),34+rand()*8,.85+rand()*.35,7);
    const source=new THREE.IcosahedronGeometry(1,1);
    // Smooth the puff normals without increasing its polygon count.
    const normals=source.attributes.normal,positions=source.attributes.position;
    for(let i=0;i<normals.count;i++){const n=new THREE.Vector3().fromBufferAttribute(positions,i).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
    const g=new THREE.InstancedBufferGeometry().copy(source);source.dispose();g.instanceCount=phases.length;
    g.setAttribute('anchor',new THREE.InstancedBufferAttribute(new Float32Array(centers),3));
    g.setAttribute('extent',new THREE.InstancedBufferAttribute(new Float32Array(sizes),3));
    g.setAttribute('seed',new THREE.InstancedBufferAttribute(new Float32Array(phases),1));
    this.cloudCount=phases.length;
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...this.uniforms,fogColor:{value:this.hazeDay.clone()},screenRight:{value:right},screenUp:{value:up}},
      vertexShader:`attribute vec3 anchor,extent;attribute float seed;uniform float seconds;uniform vec3 screenRight,screenUp;varying float shade,distanceFromCamera,height,rim;
      void main(){
        vec3 p=anchor+position*extent+screenRight*sin(seconds*.035+seed)*.85+screenUp*sin(seconds*.04+seed)*.08;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        shade=.42+.58*max(0.,dot(normalize(normal),normalize(vec3(-.6,1.,.7))));
        rim=abs((normalMatrix*normal).z);
        distanceFromCamera=-mv.z;height=dot(p,screenUp);
      }`,
      fragmentShader:`uniform float night,twilight,cloud;uniform vec3 fogColor;varying float shade,distanceFromCamera,height,rim;
      void main(){
        vec3 day=mix(vec3(.53,.67,.86),vec3(1.,.97,.88),shade);
        vec3 lunar=mix(vec3(.075,.075,.30),vec3(.28,.24,.65),shade);
        vec3 color=mix(day,lunar,night);
        color=mix(color,vec3(.75,.44,.43),twilight*.30);
        color=mix(color,fogColor,smoothstep(110.,195.,distanceFromCamera)*.5);
        color*=1.-cloud*.16;gl_FragColor=vec4(color,smoothstep(.05,.72,rim)*.86);
        #include <colorspace_fragment>
      }`});
    this.clouds=new THREE.Mesh(g,m);this.clouds.name='Instanced drifting cloud sea';this.clouds.frustumCulled=false;this.scene.add(this.clouds);
  }
  makeVeil(){
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,depthTest:false,
      vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,.0,1.);}',
      fragmentShader:`varying vec2 q;uniform float seconds,night,twilight;uniform vec2 viewScale,viewOffset;void main(){
        vec2 skyUV=(q-.5)/viewScale+.5+viewOffset;
        float billow=sin(skyUV.x*20.+seconds*.019)*.016+sin(skyUV.x*47.-seconds*.011)*.009;
        float amount=(1.-smoothstep(.02,.66,skyUV.y+billow))*.28;
        vec3 c=mix(vec3(.81,.91,1.),vec3(.19,.16,.41),night);c=mix(c,vec3(.73,.46,.49),twilight*.25);
        gl_FragColor=vec4(c,amount);
        #include <colorspace_fragment>
      }`});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.frustumCulled=false;mesh.renderOrder=8;this.scene.add(mesh);
  }
  step(seconds,state,reduced){
    this.scene.fog.color.copy(this.hazeDay).lerp(this.hazeNight,state.night).lerp(this.hazeDusk,state.dusk*.6);
    this.clouds.material.uniforms.fogColor.value.copy(this.scene.fog.color);
    // Blender's rotor axis is Y; after glTF's Z-up conversion it is -Z.
    for(const {object,rotation} of this.rotors){object.quaternion.copy(rotation);object.rotateZ(reduced?.7:.7-seconds*.10);}
  }
}
