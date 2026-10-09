import * as THREE from 'three';

const WIDTH = 1672, HEIGHT = 941, ASPECT = WIDTH / HEIGHT;
const MOONS = Object.freeze({ open: [.193, .846, 80], mist: [.202, .880, 74], corners: [.190, .830, 92] });
// Padded, non-overlapping pixel rectangles in the transparent artwork atlases.
// They retain the approved composition exactly at the reference viewport.
export const SKY_LAYOUTS = Object.freeze({
  open: [
    [0, 22, 234, 185], [635, 130, 221, 108], [1045, 83, 153, 87],
    [1259, 38, 413, 234], [155, 224, 194, 94], [0, 425, 113, 70],
    [1535, 514, 137, 72],
  ],
  mist: [
    [0, 100, 240, 123], [480, 200, 166, 90], [1085, 38, 314, 158],
    [1418, 199, 199, 99],
  ],
  corners: [
    [1099, 0, 573, 273], [0, 528, 641, 413], [1320, 715, 352, 226],
    [54, 238, 222, 95], [1435, 381, 166, 82],
  ],
});

export function normalizeSkyVariant(value) {
  return Object.hasOwn(SKY_LAYOUTS, value) ? value : 'open';
}

function cloudGeometry(rectangles) {
  const positions = [], uvs = [], rectanglesData = [], phases = [], indices = [];
  rectangles.forEach(([x, y, width, height], index) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      positions.push(u * 2 - 1, v * 2 - 1, 0);
      uvs.push((x + u * width) / WIDTH, 1 - (y + (1 - v) * height) / HEIGHT);
      rectanglesData.push(x / WIDTH, 1 - (y + height) / HEIGHT, width / WIDTH, height / HEIGHT);
      phases.push(index * 1.913 + .4);
    }
    const offset = index * 4;
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('artRect', new THREE.Float32BufferAttribute(rectanglesData, 4));
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  return geometry;
}

const screenVertex = 'varying vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,.999,1.);}';
const textureFragment = `varying vec2 q;uniform sampler2D artwork;
  void main(){gl_FragColor=texture2D(artwork,q);if(gl_FragColor.a<.004)discard;
    #include <colorspace_fragment>
  }`;

export class SkyClouds {
  constructor(scene, variant = 'open') {
    this.scene = scene;
    this.disposed = false;
    this.generation = 0;
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();
    this.moonPosition = new THREE.Vector2(.192, .83);
    this.uniforms = {
      seconds: { value: 0 }, aspect: { value: ASPECT }, pixelRatio: { value: 1 },
      viewportHeight: { value: HEIGHT }, moonDiameter: { value: 80 },
      moonPosition: { value: this.moonPosition },
    };
    this.baseUniforms = { ...this.uniforms, artwork: { value: null }, mist: { value: 0 },
      gradeTop: { value: new THREE.Vector3(1.15, 1., .84) },
      gradeMiddle: { value: new THREE.Vector3(1.15, 1.14, .88) },
      gradeBottom: { value: new THREE.Vector3(.98, 1.07, .88) } };
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.baseUniforms, depthTest: false, depthWrite: false,
      vertexShader: screenVertex,
      fragmentShader: `varying vec2 q;uniform sampler2D artwork;uniform float seconds,mist;
        uniform vec3 gradeTop,gradeMiddle,gradeBottom;
        void main(){
          vec2 sampleUV=q;
          float low=(1.-smoothstep(.16,.25,q.y))*mist;
          // A bounded UV flow animates the actual wisps without tile wrapping.
          float drift=sin(seconds*.023+q.y*14.)-sin(q.y*14.);
          float rise=sin(seconds*.017+q.x*8.)-sin(q.x*8.);
          sampleUV.x=clamp(q.x+drift*.008*low,.0003,.9997);
          sampleUV.y=clamp(q.y+rise*.003*low,.0005,.9995);
          // Subtle linear-light grading compensates for the cleaned plates'
          // small blue shift while retaining their original atmospheric detail.
          vec3 grade=q.y<.5?mix(gradeBottom,gradeMiddle,smoothstep(.1,.5,q.y)):
            mix(gradeMiddle,gradeTop,smoothstep(.5,.9,q.y));
          gl_FragColor=vec4(texture2D(artwork,sampleUV).rgb*grade,1.);
          #include <colorspace_fragment>
        }`,
    }));
    this.base.name = 'Painted empty sky'; this.base.frustumCulled = false; this.base.renderOrder = -100;
    this.base.visible = false; scene.add(this.base);

    this.cloudUniforms = { ...this.uniforms, seconds: { value: 0 }, cornerMotion: { value: 0 }, artwork: { value: null } };
    this.clouds = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `attribute vec4 artRect;attribute float phase;uniform float seconds,aspect,cornerMotion;varying vec2 q;
        void main(){
          q=uv;
          // Contain the original artwork dimensions. Portrait never enlarges
          // cloud sprites to fill the height of a tall phone screen.
          vec2 contain=vec2(min(1.,${ASPECT.toFixed(8)}/aspect),min(1.,aspect/${ASPECT.toFixed(8)}));
          vec2 size=artRect.zw*contain;
          vec2 center=artRect.xy+artRect.zw*.5;
          float left=1.-step(.00001,artRect.x);
          float bottom=1.-step(.00001,artRect.y);
          float right=step(.99999,artRect.x+artRect.z);
          float top=step(.99999,artRect.y+artRect.w);
          if(left>.5)center.x=size.x*.5;
          if(right>.5)center.x=1.-size.x*.5;
          if(bottom>.5)center.y=size.y*.5;
          if(top>.5)center.y=1.-size.y*.5;
          // The corner composition needs visible travel, not just a faster
          // subpixel oscillation. Keep the quieter alternatives unchanged.
          float speed=mix(.026,.065,cornerMotion)+fract(phase*.71)*mix(.014,.012,cornerMotion);
          vec2 drift=vec2((sin(seconds*speed+phase)-sin(phase))*mix(.0035,.018,cornerMotion),
            (sin(seconds*speed*.6+phase*1.7)-sin(phase*1.7))*mix(.0013,.004,cornerMotion));
          // Cropped artwork moves only outwards along a clipped axis. Its
          // original image boundary never appears inside the sky.
          float outward=(1.-cos(seconds*speed))*mix(.002,.025,cornerMotion);
          if(left>.5)drift.x=-outward;
          if(right>.5)drift.x=outward;
          if(bottom>.5)drift.y=-outward*.5;
          if(top>.5)drift.y=outward*.5;
          drift.y*=mix(1.,contain.y,cornerMotion);
          gl_Position=vec4((center+position.xy*size*.5+drift)*2.-1.,.995,1.);
        }`,
      fragmentShader: textureFragment,
    }));
    this.clouds.name = 'Independently drifting illustrated clouds';
    this.clouds.frustumCulled = false; this.clouds.renderOrder = 10; this.clouds.visible = false; scene.add(this.clouds);

    const stars = [
      [.377,.903,7.0],[.647,.940,4.8],[.284,.801,4.3],[.555,.831,3.4],
      [.760,.608,6.0],[.630,.559,4.3],[.057,.718,3.5],[.021,.363,4.1],
      [.240,.547,2.0],[.438,.659,2.0],[.563,.437,1.7],[.978,.595,2.1],
      [.836,.415,1.6],[.385,.339,1.5],[.516,.725,1.4],[.289,.918,1.4],
      [.935,.910,1.6],[.160,.963,1.2],[.674,.376,1.4],[.129,.494,1.6],
      [.470,.971,1.1],[.701,.807,1.3],[.972,.343,1.1],[.393,.483,1.2],
    ];
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars.flatMap(([x,y]) => [x*2-1,y*2-1,0]), 3));
    starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(stars.map(star => star[2]), 1));
    this.stars = new THREE.Points(starsGeometry, new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `attribute float size;uniform float seconds,pixelRatio;varying float shimmer;
        void main(){shimmer=.65+.35*pow(.5+.5*sin(seconds*.52+position.x*33.+position.y*21.),2.);
          gl_PointSize=size*pixelRatio;gl_Position=vec4(position.xy,.998,1.);}`,
      fragmentShader: `varying float shimmer;void main(){vec2 p=abs(gl_PointCoord-.5);
        float a=(1.-smoothstep(.12,.49,p.x+p.y))*shimmer;
        gl_FragColor=vec4(.83,.87,1.,a);
        #include <colorspace_fragment>
      }`,
    }));
    this.stars.name = 'Subtle twinkling stars'; this.stars.frustumCulled = false; this.stars.renderOrder = -90; scene.add(this.stars);

    this.moonUniforms = { ...this.uniforms, artwork: { value: null } };
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.moonUniforms, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 q;uniform float aspect,moonDiameter,viewportHeight;uniform vec2 moonPosition;
        void main(){q=uv;
          float height=moonDiameter/${(HEIGHT * .48).toFixed(4)}*min(1.,aspect/${ASPECT.toFixed(8)});
          if(aspect<.8)height=max(height,30./viewportHeight/.48);
          vec2 size=vec2(height/aspect,height);
          gl_Position=vec4((moonPosition+position.xy*size*.5)*2.-1.,.997,1.);
        }`,
      fragmentShader: textureFragment,
    }));
    this.moon.name = 'Illustrated glowing moon'; this.moon.frustumCulled = false; this.moon.renderOrder = -80;
    this.moon.visible = false; scene.add(this.moon);
    this.loaded = this.setVariant(variant);
  }

  loadTexture(path) {
    if (this.textures.has(path)) return this.textures.get(path).promise;
    const entry = { texture: null, promise: null };
    entry.promise = this.loader.loadAsync(path).then(texture => {
      if (this.disposed) { texture.dispose(); return null; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
      entry.texture = texture; return texture;
    }).catch(error => { this.textures.delete(path); throw error; });
    this.textures.set(path, entry); return entry.promise;
  }

  setVariant(value) {
    if (this.disposed) return Promise.resolve(false);
    const variant = normalizeSkyVariant(value);
    if (variant === this.variant) return this.loaded;
    this.variant = variant;
    this.cloudUniforms.cornerMotion.value = variant === 'corners' ? 1 : 0;
    this.uniforms.moonDiameter.value = MOONS[variant][2];
    const generation = ++this.generation;
    this.clouds.visible = false;
    const atlas = `/site-assets/sky-${variant}-clouds.webp`;
    const base = `/site-assets/sky-${variant === 'mist' ? 'mist' : 'clear'}.webp`;
    this.loaded = Promise.all([this.loadTexture(atlas), this.loadTexture(base), this.loadTexture('/_media/c627f8bfc3ea6f0b68d23e2475e99157594260e441d5972584e7b1466c4e91a3/site-assets/sky-moon.webp')])
      .then(([clouds, background, moon]) => {
        if (this.disposed || generation !== this.generation) return false;
        this.cloudUniforms.artwork.value = clouds;
        this.baseUniforms.artwork.value = background;
        this.baseUniforms.mist.value = variant === 'mist' ? 1 : 0;
        const grades = variant === 'corners'
          ? [[1.8,1.56,1.02],[.8,.96,.73],[.76,.91,.72]]
          : variant === 'mist' ? [[1.,.83,.73],[1.17,1.,.82],[.98,1.,.89]]
            : [[1.15,1.,.84],[1.15,1.14,.88],[.98,1.07,.88]];
        for (const [index, key] of ['gradeTop','gradeMiddle','gradeBottom'].entries()) this.baseUniforms[key].value.fromArray(grades[index]);
        this.moonUniforms.artwork.value = moon;
        const previous = this.clouds.geometry;
        this.clouds.geometry = cloudGeometry(SKY_LAYOUTS[variant]); previous.dispose();
        this.clouds.visible = this.base.visible = this.moon.visible = true;
        return true;
      });
    return this.loaded;
  }

  step(seconds, aspect, pixelRatio = 1, viewportHeight = HEIGHT) {
    if (this.disposed) return;
    this.uniforms.seconds.value = seconds;
    this.cloudUniforms.seconds.value = seconds * (this.variant === 'corners' ? 3 : 1);
    this.uniforms.aspect.value = Math.max(.1, aspect);
    this.uniforms.pixelRatio.value = pixelRatio;
    this.uniforms.viewportHeight.value = Math.max(1, viewportHeight);
    const [moonX, moonY] = MOONS[this.variant];
    this.moonPosition.set(aspect < .8 ? .61 : moonX, aspect < .8 ? .935 : moonY);
    this.moonPosition.x += Math.sin(seconds / 160) * .003;
  }

  get count() { return SKY_LAYOUTS[this.variant].length; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.generation++;
    for (const entry of this.textures.values()) entry.texture?.dispose();
    this.textures.clear();
    // Remove these nodes before the owner traverses its remaining weather nodes.
    for (const object of [this.base, this.clouds, this.stars, this.moon]) {
      object.removeFromParent(); object.geometry.dispose(); object.material.dispose();
    }
  }
}
