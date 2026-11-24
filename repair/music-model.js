import * as THREE from '../home/vendor/three.module.min.js';

const TAU = 2 * Math.PI;
const drum = { y: 1.32, z: -0.22, radius: 0.52, contactAngle: 0.92 };
const pinTip = drum.radius + 0.09;
const contactY = drum.y + pinTip * Math.cos(drum.contactAngle);
const contactZ = drum.z + pinTip * Math.sin(drum.contactAngle);
const trackX = note => -1.43 + note * 0.365;

function texture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function walnut() {
  return texture(768, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a96e49';
    ctx.fillRect(0, 0, w, h);
    // Long, irregular ribbons of spring and autumn wood, drawn once per instrument.
    for (let i = -55; i < h + 55; i += 1.35) {
      const f = Math.sin(i * 152.617);
      ctx.strokeStyle = f > 0 ? 'rgba(70,32,21,.22)' : 'rgba(235,176,113,.22)';
      ctx.lineWidth = 0.55 + Math.abs(f) * 1.15;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const knot = Math.exp(-((x - 285) ** 2 / 26000 + (i - 174) ** 2 / 1060));
        const y = i + 10 * Math.sin(x / 132 + i / 54) + 4 * Math.sin(x / 82 - i / 33) + 34 * knot;
        if (!x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function studio() {
  const map = texture(256, 128, (ctx, w, h) => {
    const light = ctx.createLinearGradient(0, 0, 0, h);
    light.addColorStop(0, '#918c80');
    light.addColorStop(0.32, '#e9ded0');
    light.addColorStop(0.52, '#7e7969');
    light.addColorStop(0.63, '#d6cab2');
    light.addColorStop(1, '#574a3b');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff9e7';
    ctx.fillRect(29, 23, 68, 24);
    ctx.fillRect(167, 29, 21, 41);
    ctx.fillStyle = '#514f49';
    ctx.fillRect(119, 44, 19, 22);
  });
  map.mapping = THREE.EquirectangularReflectionMapping;
  return map;
}

function roundedBlock(width, height, depth, radius) {
  const x = width / 2 - radius, y = height / 2 - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * radius, bevelEnabled: true, bevelThickness: radius,
    bevelSize: radius, bevelSegments: 3, steps: 1,
  });
  geometry.translate(0, 0, -depth / 2 + radius);
  // ExtrudeGeometry's default UVs are in model units. Fit the veneer to each face.
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
    if (Math.abs(normals.getY(i)) > 0.65) uv.setXY(i, px / width + 0.5, pz / depth + 0.5);
    else if (Math.abs(normals.getX(i)) > 0.65) uv.setXY(i, pz / depth + 0.5, py / height + 0.5);
    else uv.setXY(i, px / width + 0.5, py / height + 0.5);
  }
  return geometry;
}

function gearGeometry(teeth, radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    for (const [phase, scale] of [[0,.88],[.16,.88],[.31,1],[.64,1],[.79,.88]]) {
      const angle = TAU * (i + phase) / teeth;
      const y = Math.cos(angle) * radius * scale, z = Math.sin(angle) * radius * scale;
      if (i === 0 && phase === 0) shape.moveTo(y, z);
      else shape.lineTo(y, z);
    }
  }
  shape.closePath();
  for (let i = 0; i < 4; i++) {
    const hole = new THREE.Path(), a = i * TAU / 4;
    hole.absarc(Math.cos(a) * .54 * radius, Math.sin(a) * .54 * radius, radius * .18, 0, TAU, true);
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, {depth:.085,bevelEnabled:false,curveSegments:10});
  g.translate(0, 0, -.0425);
  g.rotateY(Math.PI / 2);
  g.rotateX(Math.PI / 2);
  return g;
}

// The caller owns input, timing and sound. No perpetual animation loop is needed.
export function createMusicModel(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-4,4,3,-3,.1,60);
  camera.position.set(4.2, 6.9, 10.8);
  camera.lookAt(.15,1.44,-.05);
  camera.updateMatrixWorld();
  const env = studio();
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xffefd9,0x967b62,1.42));
  const key = new THREE.DirectionalLight(0xffedce,2.65);
  key.position.set(-3.8,7,5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-4.5,right:4.5,top:4.5,bottom:-4.5,near:.5,far:17});
  key.shadow.normalBias = .009;
  key.shadow.bias = -.00022;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdcecf0,1.05);
  rim.position.set(3,5,-4);
  scene.add(rim);

  const veneer = walnut();
  veneer.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const surface = (color, metalness = 0, roughness = .55, map = null) =>
    new THREE.MeshStandardMaterial({color,metalness,roughness,map});
  const wood = surface(0xffead2,0,.38,veneer);
  const walnutDark = surface(0xcb997e,0,.45,veneer);
  const ebony = surface(0x49362d,0,.42,veneer);
  const brass = surface(0xdfb867,.82,.31), bright = surface(0xf3d797,.8,.22);
  const brassDark = surface(0x937447,.76,.4), iron = surface(0x48534e,.58,.48);
  const steel = surface(0xcad1c8,.82,.28), slot = surface(0x3e3b34,.2,.65);
  const inlay = surface(0xcfa572,.32,.49);
  const geometries = new Set(), materials = new Set();
  function mesh(parent, geometry, material, x=0,y=0,z=0) {
    geometries.add(geometry);
    materials.add(material);
    const item = new THREE.Mesh(geometry,material);
    item.position.set(x,y,z);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function block(parent,w,h,d,material,x,y,z,bevel=0) {
    return mesh(parent,bevel ? roundedBlock(w,h,d,bevel) : new THREE.BoxGeometry(w,h,d),material,x,y,z);
  }
  function cylinder(parent,r,length,material,x,y,z,axis='x',segments=32) {
    const part = mesh(parent,new THREE.CylinderGeometry(r,r,length,segments),material,x,y,z);
    if (axis === 'x') part.rotation.z = Math.PI / 2;
    if (axis === 'z') part.rotation.x = Math.PI / 2;
    return part;
  }
  function group(parent,x,y,z) {
    const g = new THREE.Group();
    g.position.set(x,y,z);
    parent.add(g);
    return g;
  }
  function screw(parent,x,y,z,size=.085) {
    cylinder(parent,size,.028,bright,x,y,z,'y',18);
    const slit = block(parent,size*1.35,.006,size*.18,slot,x,y+.015,z);
    slit.rotation.y = x * 2.3;
  }

  // The case has a floating plinth, a thin brass stringing line and an inset bed.
  block(scene,5.92,.24,3.34,walnutDark,0,.24,0,.08);
  block(scene,5.76,.26,3.18,wood,0,.43,0,.045);
  block(scene,5.76,.026,3.17,inlay,0,.361,0,.009);
  block(scene,5.72,.25,.16,wood,0,.655,1.49,.035);
  block(scene,5.72,.25,.16,wood,0,.655,-1.49,.035);
  for (const x of [-2.78,2.78]) {
    const side = block(scene,3.02,.25,.15,wood,x,.655,0,.032);
    side.rotation.y = Math.PI / 2;
  }
  block(scene,4.77,.09,2.37,brassDark,-.04,.595,0,.035);
  block(scene,4.66,.05,2.25,brass,-.04,.663,0,.02);
  for (const x of [-2.22,2.12]) for (const z of [-.99,.99]) screw(scene,x,.7,z,.068);
  for (const x of [-2.35,2.35]) for (const z of [-1.19,1.19])
    cylinder(scene,.24,.13,ebony,x,.08,z,'y');

  // Framed lid with a small fan of inlaid reeds, like the comb below it.
  const lid = group(scene,0,.74,-1.48);
  lid.rotation.x = -.35;
  block(lid,5.7,1.9,.17,walnutDark,0,.96,0,.055);
  block(lid,5.46,1.67,.045,inlay,0,.97,.096,.02);
  block(lid,5.41,1.62,.048,wood,0,.97,.108,.02);
  for (let i = -5; i <= 5; i++) {
    const length = .26 + .25 * (1 - Math.abs(i)/6);
    const a = i * .15, cx = Math.sin(a) * length / 2, cy = Math.cos(a) * length / 2;
    const reed = block(lid,.014,length,.009,inlay,cx,.92 + cy,.138);
    reed.rotation.z = -a;
  }
  for (const x of [-1.82,1.82]) {
    block(lid,.51,.20,.047,brassDark,x,.16,.125,.018);
    cylinder(scene,.078,.57,bright,x,.79,-1.42);
  }
  block(scene,.55,.18,.075,brassDark,0,.58,1.595,.025);
  block(scene,.37,.075,.055,bright,0,.60,1.635,.02);

  // The pinned drum and handle share an axle; its smaller drive gear turns oppositely.
  const rotor = group(scene,0,drum.y,drum.z);
  const follower = group(scene,1.87,drum.y,drum.z+.71);
  cylinder(rotor,.09,5.55,steel,.34,0,0);
  cylinder(rotor,drum.radius,3.27,brass,-.15,0,0,'x',72);
  for (const x of [-1.8,1.50]) {
    cylinder(rotor,.545,.09,bright,x,0,0,'x',64);
    cylinder(rotor,.40,.12,brassDark,x + (x < 0 ? -.075 : .075),0,0);
    cylinder(rotor,.23,.13,brass,x + (x < 0 ? -.15 : .15),0,0);
  }
  for (let n = 0; n <= 8; n++) {
    const x = trackX(0) + (n-.5)*.365;
    cylinder(rotor,.522,.009,brassDark,x,0,0,'x',64);
  }
  const pins = [];
  for (let step = 0; step < 8; step++) {
    const phase = drum.contactAngle - step*TAU/8;
    const base = group(rotor,0,0,0);
    base.rotation.x = phase;
    cylinder(base,.031,.094,bright,0,drum.radius+.04,0,'y',12);
    pins.push(base);
  }
  for (const x of [-2.12,2.20]) {
    block(scene,.16,.69,.45,iron,x,1.012,drum.z,.04);
    cylinder(scene,.175,.20,brassDark,x,drum.y,drum.z);
  }
  mesh(rotor,gearGeometry(16,.46),brassDark,1.87);
  mesh(follower,gearGeometry(10,.29),bright);
  cylinder(follower,.092,.18,steel,0,0,0);
  block(scene,.16,.68,.36,iron,2.04,1.012,drum.z+.71,.035);
  cylinder(rotor,.16,.23,brassDark,2.98,0,0);
  block(rotor,.12,.75,.13,bright,3.08,-.31,0,.04);
  cylinder(rotor,.079,.50,steel,3.32,-.63,0);
  const knob = mesh(rotor,new THREE.SphereGeometry(1,28,18),ebony,3.43,-.63,0);
  knob.scale.set(.29,.123,.123);
  cylinder(rotor,.117,.04,bright,3.23,-.63,0);

  const tines = [];
  for (let n = 0; n < 8; n++) {
    const x = trackX(n), rootZ = 1.28 - .047*n, rootY = 1.12;
    const length = Math.hypot(rootZ-contactZ,contactY-rootY);
    const angle = Math.atan2(contactY-rootY,rootZ-contactZ);
    const pivot = group(scene,x,rootY,rootZ);
    // A thin finger cantilevers forward from its heel to the common contact line.
    block(pivot,.198,.045,length,steel,0,0,-length/2,.012);
    block(scene,.243,.45,.21,iron,x,.905,rootZ,.023);
    tines.push({pivot,angle});
  }
  const rail = block(scene,2.94,.09,.18,brassDark,-.15,1.173,1.12,.025);
  rail.rotation.y = Math.atan2(.047,.365);
  for (const n of [0,3.5,7]) screw(scene,trackX(n),1.228,1.28-.047*n,.074);

  const shadowMap = texture(128,128,(ctx,w,h) => {
    const grad = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    grad.addColorStop(0,'rgba(72,48,30,.49)');
    grad.addColorStop(.6,'rgba(72,48,30,.24)');
    grad.addColorStop(1,'rgba(72,48,30,0)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
  });
  const ground = mesh(scene,new THREE.PlaneGeometry(8.35,4.8),
    new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}),0,.005,0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  ground.receiveShadow = false;
  let oldWidth = 0, oldHeight = 0;
  function draw() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    if (width !== oldWidth || height !== oldHeight) {
      oldWidth = width; oldHeight = height;
      const aspect = width / height, viewHeight = Math.max(4.95,7.56/aspect);
      camera.left = -viewHeight * aspect / 2;
      camera.right = -camera.left;
      camera.top = viewHeight / 2;
      camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);
    }
    renderer.render(scene,camera);
  }
  function render(turns,pitches,lastNote=-1,strength=0) {
    const angle = turns * TAU;
    rotor.rotation.x = angle;
    follower.rotation.x = -angle * 16 / 10 + TAU / 20;
    for (let step=0; step<8; step++) pins[step].position.x = trackX(pitches[step]);
    for (let n=0; n<8; n++) {
      tines[n].pivot.rotation.x = tines[n].angle + (n === lastNote ? strength*.093 : 0);
    }
    draw();
  }
  // Invert the projected crank circle so a pointer swept around the handle
  // gives its physical rotation angle even when the camera sees an ellipse.
  const crankCenter = new THREE.Vector3(), crankCos = new THREE.Vector3(), crankSin = new THREE.Vector3();
  function crankAngle(fx,fy) {
    crankCenter.set(3.43,drum.y,drum.z).project(camera);
    crankCos.set(3.43,drum.y-.63,drum.z).project(camera).sub(crankCenter);
    crankSin.set(3.43,drum.y,drum.z-.63).project(camera).sub(crankCenter);
    const x = 2*fx-1-crankCenter.x, y = 1-2*fy-crankCenter.y;
    const determinant = crankCos.x*crankSin.y - crankCos.y*crankSin.x;
    const cosine = (x*crankSin.y - y*crankSin.x) / determinant;
    const sine = (crankCos.x*y - crankCos.y*x) / determinant;
    return Math.atan2(sine,cosine);
  }
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  return {render, crankAngle, dispose() {
    observer.disconnect();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    veneer.dispose(); env.dispose(); shadowMap.dispose();
    key.shadow.dispose();
    renderer.dispose();
  }};
}
