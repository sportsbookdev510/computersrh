import * as THREE from 'three';
import {WEATHER_BUDGET} from './ambience-model.mjs';

// Bounded shared buffers, wrapped shader motion, no per-drop physics or raycasts.
// Inspired by the approach reviewed in GreenVeil; standalone WebGL implementation.
// Snow is one of the island's three weathers (7 Oct 2026): a flake (world units) reads from the overview camera,
// about 3 to 5 px at its 40-unit view on a 900 px screen, and stays a soft flake at the closest zoom.
export const SNOWFLAKE=Object.freeze({min:.13,spread:.12});
export class WeatherFX{
  constructor(scene,samples,reduced){
    this.reduced=reduced;this.uniforms={clock:{value:0},rain:{value:0},snow:{value:0},night:{value:0},center:{value:new THREE.Vector3()},radius:{value:26},cameraRight:{value:new THREE.Vector3(1,0,0)},cameraUp:{value:new THREE.Vector3(0,1,0)}};
    let seed=19231;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    this.meshes=[];
    for(const snow of [false,true]){
      const count=snow?WEATHER_BUDGET.snow:WEATHER_BUDGET.rain;
      const g=new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1));g.instanceCount=count;
      const seeds=new Float32Array(count*4);for(let i=0;i<seeds.length;i++)seeds[i]=random();g.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));
      const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:this.uniforms,
        vertexShader:`attribute vec4 seed;uniform float clock,radius;uniform vec3 center,cameraRight,cameraUp;varying vec2 q;varying float fade;
        void main(){q=uv;float t=clock*${snow?'.12':'.85'}+seed.w;
          vec3 p=vec3((seed.x-.5)*radius*2.,mix(5.9,21.,1.-fract(t)),(seed.y-.5)*radius*2.);
          p.x+=${snow?'sin(clock*.65+seed.z*24.)*.65':'(p.y-6.)*.11'};
          p.z+=${snow?'cos(clock*.46+seed.z*19.)*.35':'(p.y-6.)*.04'};
          p.xz+=center.xz;fade=smoothstep(5.9,7.2,p.y)*(1.-smoothstep(.78,1.,max(abs(seed.x-.5),abs(seed.y-.5))*2.));
          p+=cameraRight*position.x*${snow?`(${SNOWFLAKE.min}+seed.z*${SNOWFLAKE.spread})`:'.018'}+cameraUp*position.y*${snow?`(${SNOWFLAKE.min}+seed.z*${SNOWFLAKE.spread})`:'(.30+seed.z*.25)'};
          gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        }`,
        fragmentShader:`uniform float rain,snow,night;varying vec2 q;varying float fade;
        void main(){float a=${snow?'1.-smoothstep(.3,.5,length(q-.5))':'smoothstep(0.,.20,q.y)*(1.-smoothstep(.75,1.,q.y))'};
          vec3 c=${snow?'mix(vec3(.96,.98,1.),vec3(.86,.91,1.),night*.45)':'mix(vec3(.70,.87,1.),vec3(.50,.64,.95),night*.45)'};
          gl_FragColor=vec4(c,a*fade*${snow?'snow*.86':'rain*.36'});
          #include <colorspace_fragment>
        }`});
      const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=12;mesh.name=snow?'Weather snow pool':'Weather rain pool';scene.add(mesh);this.meshes.push(mesh);
    }
    const g=new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1));g.instanceCount=samples.length;
    const anchors=new Float32Array(samples.flat()),ages=new Float32Array(samples.map(()=>random()));
    g.setAttribute('anchor',new THREE.InstancedBufferAttribute(anchors,3));g.setAttribute('age',new THREE.InstancedBufferAttribute(ages,1));
    const m=new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,
      vertexShader:`attribute vec3 anchor;attribute float age;uniform float clock;varying vec2 q;varying float progress;
      void main(){q=uv;progress=fract(clock*1.4+age);vec3 p=anchor+vec3(position.x,0.,position.y)*(.12+progress*.36);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float rain;varying vec2 q;varying float progress;void main(){float d=length(q-.5);float ring=smoothstep(.28,.34,d)*(1.-smoothstep(.38,.45,d));gl_FragColor=vec4(.70,.86,1.,ring*(1.-progress)*rain*.28);
      #include <colorspace_fragment>
      }`,side:THREE.DoubleSide});
    this.splashes=new THREE.Mesh(g,m);this.splashes.frustumCulled=false;this.splashes.name='Ground rain rings';scene.add(this.splashes);
    this.forward=new THREE.Vector3();this.target=new THREE.Vector3();
  }
  step(seconds,state,camera,inspection){
    const u=this.uniforms;u.clock.value=seconds;u.rain.value=state.rain;u.snow.value=state.snow;u.night.value=state.night;
    camera.getWorldDirection(this.forward);const distance=(6-camera.position.y)/this.forward.y;
    this.target.copy(camera.position).addScaledVector(this.forward,Math.max(0,distance));u.center.value.copy(this.target);
    u.radius.value=Math.min(38,Math.max(18,(camera.right-camera.left)*.7));
    u.cameraRight.value.setFromMatrixColumn(camera.matrixWorld,0);u.cameraUp.value.setFromMatrixColumn(camera.matrixWorld,1);
    this.meshes[0].visible=!this.reduced&&!inspection&&state.rain>.005;
    this.meshes[1].visible=!this.reduced&&!inspection&&state.snow>.005;
    this.splashes.visible=!this.reduced&&!inspection&&state.rain>.005;
  }
}
