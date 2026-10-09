import * as THREE from 'three';
import {CloudHorizon} from './cloud-horizon.mjs';
import {celestialState,CLOUDS,CLOUD_MARGIN,CLOUD_SPAN} from './sky-model.mjs';
import {WORLD_OVERVIEW} from './world-view.mjs';

const color=h=>new THREE.Color(h);
const vertex='varying vec2 q;void main(){q=position.xy*.5+.5;gl_Position=vec4(position.xy,.999,1.);}';
const palette={day:['#54b5ed','#def0f3'],night:['#101c53','#7369b9'],dawn:['#8199c9','#ffe2ab'],dusk:['#667bb6','#ffb991']};

export class CozySky{
  constructor(scene,aspect,{horizon=true,clouds=true,fullHeightGradient=false}={}){
    this.palette=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,v.map(color)]));
    this.uniforms={zenith:{value:color(palette.day[0])},horizon:{value:color(palette.day[1])},
      night:{value:0},cloud:{value:0},twilight:{value:0},seconds:{value:0},aspect:{value:WORLD_OVERVIEW.aspect},
      viewScale:{value:new THREE.Vector2(1,1)},viewOffset:{value:new THREE.Vector2()},gradientRange:{value:new THREE.Vector2(fullHeightGradient?0:.48,fullHeightGradient?1:1.05)},
      sunPosition:{value:new THREE.Vector2()},moonPosition:{value:new THREE.Vector2()}};
    this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:this.uniforms,vertexShader:vertex,
      fragmentShader:`varying vec2 q;uniform vec3 zenith,horizon;uniform vec2 sunPosition,moonPosition,viewScale,viewOffset,gradientRange;
      uniform float night,cloud,twilight,aspect,seconds;
      float disc(vec2 p,float r){return 1.-smoothstep(r-.0015,r+.0015,length(p));}
      void main(){
        vec2 skyUV=(q-.5)/viewScale+.5+viewOffset;
        float height=smoothstep(gradientRange.x,gradientRange.y,skyUV.y);
        vec3 c=mix(horizon,zenith,height);
        c=mix(c,mix(vec3(.40,.49,.59),vec3(.11,.16,.27),night),cloud*.30);
        vec2 ratio=vec2(aspect,1.);
        vec2 sp=(skyUV-sunPosition)*ratio,mp=(skyUV-moonPosition)*ratio;
        float sd=length(sp),md=length(mp);
        float bodyScale=max(.65,min(1.,aspect/.92));
        float clear=1.-cloud*.78;
        // A broad warm horizon glow follows the sun, rather than recoloring a
        // stationary fake disk. Mountains and drifting clouds occlude the bodies.
        float horizonGlow=exp(-abs(skyUV.x-sunPosition.x)*3.8-abs(skyUV.y-.70)*9.);
        c=mix(c,vec3(1.,.49,.23),horizonGlow*twilight*.33*clear);
        c=mix(c,vec3(1.,.89,.61),exp(-sd*sd*230.)*.43*(1.-night)*clear);
        c+=vec3(1.,.76,.38)*exp(-sd*sd*450.)*.07*(1.-night)*clear;
        c+=vec3(1.,.59,.22)*exp(-md*md*550.)*.15*night*clear;
        float sun=disc(sp/bodyScale,.033)*smoothstep(-.08,.04,sunPosition.y-.65);
        c=mix(c,mix(vec3(1.,.79,.35),vec3(1.,.96,.70),height),sun*clear);
        mp/=bodyScale;
        float moon=disc(mp,.0325)*smoothstep(-.08,.04,moonPosition.y-.65);
        vec3 lunar=vec3(1.,.73,.35);
        float craters=0.;
        for(int i=0;i<24;i++){
          float f=float(i),angle=f*2.39996,r=sqrt((f+.4)/24.)*.027;
          vec2 center=vec2(cos(angle),sin(angle))*r;
          craters+=disc(mp-center,.0025+.003*fract(sin(f*7.73)*143.2));
        }
        lunar=mix(lunar,vec3(.77,.40,.19),clamp(craters,0.,1.)*.40);
        lunar+=vec3(.11,.08,.035)*smoothstep(.025,.032,length(mp));
        c=mix(c,lunar,moon*clear);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`});
    const dome=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);dome.frustumCulled=false;dome.renderOrder=-100;scene.add(dome);
    this.makeStars(scene);
    this.horizon=horizon?new CloudHorizon(scene,this.uniforms):null;
    if(clouds)this.makeClouds(scene);
  }
  makeStars(scene){
    let seed=451;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const positions=[],seeds=[];
    for(let i=0;i<160;i++){positions.push(random()*2-1,.36+random()*.62,0);seeds.push(random());}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
    const m=new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthTest:true,depthWrite:false,
      vertexShader:`attribute float seed;uniform float seconds;uniform vec2 viewScale,viewOffset;varying float shimmer;void main(){
        shimmer=.65+.35*pow(.5+.5*sin(seconds*(.55+seed*.4)+seed*37.),2.);
        gl_Position=vec4((position.xy-2.*viewOffset)*viewScale,.998,1.);gl_PointSize=(1.6+pow(seed,4.)*3.8)*viewScale.y;}`,
      fragmentShader:`uniform float night,cloud;varying float shimmer;void main(){
        vec2 p=abs(gl_PointCoord-.5);float star=1.-smoothstep(.16,.48,p.x+p.y);
        gl_FragColor=vec4(.77,.84,1.,star*night*night*(1.-cloud)*shimmer);
        #include <colorspace_fragment>
      }`});
    this.stars=new THREE.Points(g,m);this.stars.frustumCulled=false;this.stars.renderOrder=-99.5;scene.add(this.stars);
  }
  makeClouds(scene){
    // Overlapping chamfered cumulus blocks share one draw call.
    const positions=[],normals=[],data=[],seeds=[];
    const rotation=new THREE.Matrix4().makeRotationY(-.30).multiply(new THREE.Matrix4().makeRotationX(.18));
    for(const cloud of CLOUDS){
      const seed=cloud[4];
      // Broad bases and tall, overlapping blocks give each cloud a sculpted
      // cumulus shape rather than an extruded stair silhouette.
      const blocks=[
        [0,-.48,0,4.05,.20,.88],[-1.52,-.29,.06,.77,.34,.73],[-1.06,-.10,-.1,.89,.68,.95],
        [-.36,.20,-.12,1.12,1.22,1.15],[-.26,.86,-.2,.71,.23,.86],
        [.48,.07,-.13,.96,.96,1.05],[1.14,-.23,.0,.75,.41,.76],[1.67,-.34,.08,.43,.23,.50],
        [-.53,-.27,.62,.76,.42,.39],[.35,-.28,.50,.86,.37,.38],
      ];
      blocks.forEach(([x,y,z,w,h,d],i)=>{
        const variation=Math.sin(seed*2.3+i*1.7)*.10;
        const c=.045,shape=new THREE.Shape();
        const points=[[c,0],[w-c,0],[w,c],[w,h-c],[w-c,h],[c,h],[0,h-c],[0,c]];
        points.forEach(([a,b],j)=>j?shape.lineTo(a,b):shape.moveTo(a,b));shape.closePath();
        const piece=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1,curveSegments:1});
        piece.translate(x-w/2+variation,y-h/2+variation*.5,z-d/2);piece.applyMatrix4(rotation);
        const p=piece.attributes.position,n=piece.attributes.normal;
        for(let k=0;k<p.count;k++){positions.push(p.getX(k),p.getY(k),p.getZ(k));normals.push(n.getX(k),n.getY(k),n.getZ(k));data.push(...cloud.slice(0,4));seeds.push(seed);}
        piece.dispose();
      });
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('cloudData',new THREE.Float32BufferAttribute(data,4));geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,depthTest:true,depthWrite:false,
      vertexShader:`attribute vec4 cloudData;attribute float seed;uniform float seconds,aspect;uniform vec2 viewScale,viewOffset;varying float shade,localHeight;varying vec2 skyUV;
      void main(){
        float x=mod(cloudData.x+${CLOUD_MARGIN.toFixed(2)}+seconds*cloudData.w,${CLOUD_SPAN.toFixed(2)})-${CLOUD_MARGIN.toFixed(2)};
        float y=cloudData.y+sin(seconds*.045+seed*1.7)*.0015;
        float size=cloudData.z*min(1.,aspect/.92);
        skyUV=vec2(x,y)+position.xy*size/vec2(aspect,1.);
        shade=.25+.75*max(0.,dot(normalize(normal),normalize(vec3(-.5,1.3,.35))));localHeight=position.y;
        gl_Position=vec4((skyUV*2.-1.-2.*viewOffset)*viewScale,.996,1.);
      }`,
      fragmentShader:`uniform float night,twilight,cloud;uniform vec2 sunPosition;varying float shade,localHeight;varying vec2 skyUV;
      void main(){
        vec3 daylight=mix(vec3(.63,.72,.84),vec3(1.,.96,.79),shade);
        daylight=mix(daylight,vec3(.66,.73,.86),(1.-smoothstep(-.6,-.25,localHeight))*.4);
        vec3 moonlight=mix(vec3(.085,.060,.245),vec3(.255,.195,.535),shade);
        vec3 c=mix(daylight,moonlight,night);
        c=mix(c,vec3(.93,.53,.34),twilight*(.24+.3*exp(-abs(skyUV.x-sunPosition.x)*3.)));
        c=mix(c,vec3(.32,.39,.51),cloud*.25);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=10;scene.add(mesh);this.clouds=mesh;
  }
  setView(view){
    this.uniforms.viewScale.value.set(view.scale.x,view.scale.y);
    this.uniforms.viewOffset.value.set(view.offset.x,view.offset.y);
  }
  step(seconds,s,reduced,aspect){
    const u=this.uniforms,t=reduced?0:seconds,orbit=celestialState(s.phase);
    u.seconds.value=t;u.night.value=s.night;u.cloud.value=s.cloud;u.twilight.value=s.dusk;
    u.sunPosition.value.set(orbit.sun.x,orbit.sun.y);u.moonPosition.value.set(orbit.moon.x,orbit.moon.y);
    const twilight=s.phase<30||s.phase>90?this.palette.dawn:this.palette.dusk;
    for(const [key,i] of [['zenith',0],['horizon',1]])u[key].value.copy(this.palette.day[i]).lerp(this.palette.night[i],s.night).lerp(twilight[i],s.dusk*.85);
    this.stars.visible=s.night>.005;
    this.horizon?.step(t,s,reduced);
    return orbit;
  }
}
