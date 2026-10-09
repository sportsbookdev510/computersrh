import * as THREE from 'three';

// The same quarter-resolution light diffusion in World and Build keeps night
// highlights stable while the camera moves. Daytime costs no extra glow passes.
export class SoftNightGlow{
  constructor(renderer){
    this.renderer=renderer;this.size=new THREE.Vector2();this.width=0;this.height=0;
    this.world=new THREE.WebGLRenderTarget(1,1,{samples:2});
    this.a=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
    this.b=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
    this.scene=new THREE.Scene();this.camera=new THREE.Camera();
    const vertexShader='varying vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,0.,1.);}';
    this.blur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:null},delta:{value:new THREE.Vector2()},extract:{value:1}},vertexShader,
      fragmentShader:`varying vec2 q;uniform sampler2D source;uniform vec2 delta;uniform float extract;
      vec3 sampleLight(vec2 p){vec3 c=texture2D(source,p).rgb;float brightness=max(c.r,max(c.g,c.b));return c*mix(1.,smoothstep(.62,.96,brightness),extract);}
      void main(){vec3 c=sampleLight(q)*.227027;
        c+=(sampleLight(q+delta*1.384615)+sampleLight(q-delta*1.384615))*.316216;
        c+=(sampleLight(q+delta*3.230769)+sampleLight(q-delta*3.230769))*.070270;
        gl_FragColor=vec4(c,1.);}`});
    this.finish=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:this.world.texture},glow:{value:this.b.texture},amount:{value:0}},vertexShader,
      fragmentShader:`varying vec2 q;uniform sampler2D source,glow;uniform float amount;
      void main(){vec3 c=texture2D(source,q).rgb+texture2D(glow,q).rgb*amount;
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`});
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.blur);this.quad.frustumCulled=false;this.scene.add(this.quad);
  }
  resize(){
    const r=this.renderer;r.getDrawingBufferSize(this.size);
    if(this.width!==this.size.x||this.height!==this.size.y){
      this.width=this.size.x;this.height=this.size.y;this.world.setSize(this.width,this.height);
      this.a.setSize(Math.ceil(this.width/4),Math.ceil(this.height/4));this.b.setSize(Math.ceil(this.width/4),Math.ceil(this.height/4));
    }
  }
  render(background,skyCamera,world,camera,night){
    this.resize();const r=this.renderer;
    r.setRenderTarget(this.world);r.clear();r.render(background,skyCamera);r.clearDepth();r.render(world,camera);
    this.present(this.world.texture,night);
  }
  present(source,night){
    this.resize();const r=this.renderer;
    this.quad.material=this.blur;this.blur.uniforms.source.value=source;this.blur.uniforms.extract.value=1;this.blur.uniforms.delta.value.set(5/this.width,0);
    r.setRenderTarget(this.a);r.clear();r.render(this.scene,this.camera);
    this.blur.uniforms.source.value=this.a.texture;this.blur.uniforms.extract.value=0;this.blur.uniforms.delta.value.set(0,5/this.height);
    r.setRenderTarget(this.b);r.clear();r.render(this.scene,this.camera);
    this.quad.material=this.finish;this.finish.uniforms.source.value=source;this.finish.uniforms.amount.value=.22*night;
    r.setRenderTarget(null);r.clear();r.render(this.scene,this.camera);
  }
}
