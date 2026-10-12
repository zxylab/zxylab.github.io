import * as THREE from './vendor/three.module.min.js';

// 小公寓使用独立物件建模；摆放、灯光和物件状态都只保存在本机。
const $ = id => document.getElementById(id);
const container = $('room'), loading = $('loading');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-9, 9, 6, -6, .1, 100);
camera.position.set(12, 12.5, 16); camera.lookAt(0, 1, 0);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'low-power' }); }
catch { loading.textContent='这台设备暂时无法显示三维小屋。可以换一个支持 WebGL 的浏览器再来。'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
renderer.domElement.setAttribute('aria-label','一个有床、厨房、卫生间、书桌和起居区的三维小公寓。物品也可从下方列表选择。');
renderer.domElement.setAttribute('role','img'); container.append(renderer.domElement);
const house=new THREE.Group(); scene.add(house);
const fill=new THREE.HemisphereLight(0xfff8e9,0x99866b,2.2); scene.add(fill);
const sun=new THREE.DirectionalLight(0xffdfaa,3.4); sun.position.set(-4,10,3);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:35});sun.shadow.normalBias=.035;scene.add(sun);
const bounce=new THREE.DirectionalLight(0xe9f2ef,.7);bounce.position.set(7,6,-8);scene.add(bounce);
const materials=new Map(), items=new Map(), obstacles=[];
const storageKey='zxylab-home-v1';let memory={positions:{},states:{}};
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&typeof saved==='object')memory={positions:saved.positions||{},states:saved.states||{}};}catch{}
const state={night:false,rain:false,curtains:false,lamp:false,bed:false,wardrobe:false,fridge:false,tap:false,kettle:false,record:false,book:false,cat:false,...memory.states};
let selected=null,arranging=false,sound=false,wallpaper=false,audio=null,audioGain=null,rainNode=null,melodyTimer=null;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function save(){
  memory.states={...state};memory.positions={};
  for(const [id,o] of items)if(o.move)memory.positions[id]={x:o.group.position.x,z:o.group.position.z,r:o.group.rotation.y};
  try{localStorage.setItem(storageKey,JSON.stringify(memory));}catch{$('save-note').textContent='这次布置会保留到页面关闭。';}
}
function say(text){$('message').textContent=text;}
function mat(color,roughness=.82,map=null){const key=color+'-'+roughness+'-'+(map?.uuid||'');if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,map}));return materials.get(key);}
function mesh(parent,geometry,material,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(parent,w,h,d,color,x=0,y=0,z=0,rounded=0,map=null){
  const g=new THREE.BoxGeometry(w,h,d,rounded?4:1,rounded?4:1,rounded?4:1);
  if(rounded){const r=Math.min(rounded,w/2,h/2,d/2),p=g.attributes.position,v=new THREE.Vector3(),q=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);q.set(Math.max(-w/2+r,Math.min(w/2-r,v.x)),Math.max(-h/2+r,Math.min(h/2-r,v.y)),Math.max(-d/2+r,Math.min(d/2-r,v.z)));v.sub(q).normalize().multiplyScalar(r).add(q);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();}
  return mesh(parent,g,mat(color,.85,map),x,y,z);
}
function cyl(parent,r,h,color,x=0,y=0,z=0,top=r){return mesh(parent,new THREE.CylinderGeometry(top,r,h,28),mat(color),x,y,z);}
function ball(parent,r,color,x=0,y=0,z=0,scale=[1,1,1]){const o=mesh(parent,new THREE.SphereGeometry(r,24,16),mat(color),x,y,z);o.scale.set(...scale);return o;}
function tube(parent,points,r,color){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,8,false),mat(color));}
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function woodTexture(){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#bd956e';ctx.fillRect(0,0,256,256);let seed=391;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<260;i++){ctx.strokeStyle=`rgba(${rnd()>.5?'83,51,27':'240,218,178'},${.025+rnd()*.06})`;ctx.lineWidth=.4+rnd()*1.8;const y=rnd()*256;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(80,y+rnd()*10-5,180,y+rnd()*10-5,256,y);ctx.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const wood=woodTexture();
function clothTexture(){const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#ddd';ctx.lineWidth=.3;for(let i=0;i<128;i+=3){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.colorSpace=THREE.SRGBColorSpace;return t;}
const cloth=clothTexture();
function contact(parent,w,d){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const grad=ctx.createRadialGradient(32,32,2,32,32,31);grad.addColorStop(0,'rgba(72,48,25,.22)');grad.addColorStop(1,'rgba(72,48,25,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false});const o=mesh(parent,new THREE.PlaneGeometry(w*1.5,d*1.5),m,0,.013,0);o.rotation.x=-Math.PI/2;o.castShadow=false;o.userData.ignorePick=true;return o;}
function item(id,name,description,x,z,w,d,move,action){const g=group(house,x,0,z);const o={id,name,description,group:g,w,d,move,action,original:{x,z,r:0}};items.set(id,o);g.userData.item=id;contact(g,w,d);if(!move)obstacles.push(o);return g;}
function legs(p,w,d,h,color='#72523a'){for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])cyl(p,.045,h,color,x,h/2,z);}
function plant(p,x,y,z,size=1){const g=group(p,x,y,z);cyl(g,.2*size,.35*size,'#ba7755',0,.175*size,0,.26*size);cyl(g,.21*size,.018,'#584836',0,.353*size);for(let i=0;i<7;i++){const a=i*2.4,ht=(.62+(i%3)*.16)*size;const px=Math.sin(a)*.22*size,pz=Math.cos(a)*.22*size;tube(g,[[0,.33*size,0],[px/2,ht*.75,pz/2],[px,ht,pz]],.014*size,'#60734c');const leaf=ball(g,.18*size,i%2?'#748557':'#56754f',px,ht,pz,[.65,1.5,.27]);leaf.rotation.set(.4,a,.6);}return g;}
function cup(p,x,y,z){cyl(p,.11,.18,'#ede5d5',x,y+.09,z);const ring=mesh(p,new THREE.TorusGeometry(.08,.017,8,20),mat('#eee6d5'),x+.12,y+.10,z);ring.rotation.y=Math.PI/2;cyl(p,.09,.008,'#7b5639',x,y+.181,z);}
function lamp(p,x,y,z,color='#b89662'){const g=group(p,x,y,z);cyl(g,.2,.05,color,0,.025);cyl(g,.028,.65,color,0,.35);const shade=cyl(g,.27,.3,color,0,.76,0,.14);const bulb=ball(g,.09,'#ffe9b1',0,.66);const light=new THREE.PointLight(0xffd08a,0,3,2);light.position.set(0,.65,0);g.add(light);return{g,shade,bulb,light};}
function books(p,x,y,z,n=7){const colors=['#a7785b','#6e806e','#dbc7a1','#8e928e','#ba965e'];for(let i=0;i<n;i++){const h=.28+(i%3)*.065;const b=box(p,.075,h,.23,colors[i%colors.length],x+i*.085,y+h/2,z,.012);if(i===n-1)b.rotation.z=-.1;}}
function picture(p,x,y,z,w,h){box(p,w,h,.06,'#8e6946',x,y,z,.01);box(p,w-.08,h-.08,.02,'#e5dac3',x,y,z+.04);const hill=ball(p,.2,'#7d896c',x,y-.09,z+.061,[w*1.8,.5,.02]);ball(p,.065,'#d6a267',x+.12,y+.12,z+.065,[1,1,.1]);return hill;}

// 木地板、两面保留的墙和窗外小景，前方敞开便于看见全屋。
box(house,12.3,.22,8.3,'#a88a66',0,-.12,0,.04);
for(let row=0;row<20;row++)for(let col=0;col<6;col++){const x=-5+col*2+(row%2?1:0);const left=Math.max(-6,x-1),right=Math.min(6,x+1);if(right>left)box(house,right-left-.018,.03,.39,['#e4c499','#daba90','#eed1a7','#ddbf96'][(row+col)%4],(left+right)/2,.018,-3.8+row*.4,0,wood);}
box(house,12.3,3.05,.16,'#eee3cd',0,1.5,-4.07);
box(house,.16,3.05,8.3,'#e3d9c6',-6.07,1.5,0);
box(house,12,.11,.07,'#c7b592',0,.12,-3.97);box(house,.07,.11,8,'#c7b592',-5.97,.12,0);
const windowGroup=item('window','窗帘','把窗外的光放进来，也可以把夜色轻轻挡住。',-.7,-3.87,2.7,.1,false,'curtains');
box(windowGroup,2.65,1.5,.08,'#b3c3ae',0,1.9,0);
box(windowGroup,2.52,1.36,.01,'#bfced1',0,1.9,.05);
for(let i=0;i<7;i++)ball(windowGroup,.23,'#82946e',-.98+i*.32,1.8+(i%3)*.12,.065,[1,1.3,.1]);
box(windowGroup,2.85,.11,.24,'#e8dcc4',0,1.1,.08);box(windowGroup,2.77,.07,.12,'#faf2df',0,2.65,.08);
for(const x of [-1.29,0,1.29])box(windowGroup,.065,1.48,.12,'#ede3d0',x,1.9,.09);
box(windowGroup,2.7,.06,.12,'#efe4cf',0,1.93,.09);
const curtains=[];for(const side of [-1,1]){const g=group(windowGroup,side*1.45,1.8,.2);for(let i=0;i<7;i++){const strip=box(g,.11,2.1,.085,'#e7dcc8',i*.07*side,0,Math.sin(i)*.022,.035,cloth);curtains.push({mesh:strip,side,index:i});}}
cyl(windowGroup,.025,3.55,'#8a7860',0,2.96,.17).rotation.z=Math.PI/2;
picture(house,-4.2,2.25,-3.94,1.1,.85);picture(house,3.65,2.3,-3.94,.72,.8);

const bed=item('bed','床','一张自己的床。掖一掖被角，今天就算收拾好了。',-4.25,-2.35,2.2,2.9,false,'bed');
box(bed,2.2,.22,2.9,'#a47d53',0,.34,0,.05,wood);legs(bed,1.85,2.5,.3);box(bed,2.18,1,.15,'#a9845d',0,.85,-1.4,.06,wood);
box(bed,2.1,.32,2.74,'#f0e7d6',0,.6,0,.12,cloth);const duvet=box(bed,2.14,.13,1.98,'#adb49a',0,.79,.42,.08,cloth);
for(const x of [-.51,.51])box(bed,.89,.16,.52,'#f5ecdc',x,.86,-.87,.1,cloth);
const blanket=box(bed,2.16,.075,.52,'#c89976',0,.87,1.03,.04,cloth);
const bedTable=item('bedtable','床头灯','夜里醒来，也有一盏小灯。',-2.8,-2.65,.6,.65,false,'lamp');box(bedTable,.57,.55,.61,'#bd9667',0,.31,0,.03,wood);box(bedTable,.56,.03,.61,'#d3b080',0,.61,0,.01);box(bedTable,.42,.18,.02,'#b0875c',0,.41,.316,.01);ball(bedTable,.032,'#65533b',0,.41,.34);const bedsideLamp=lamp(bedTable,0,.63,0,'#c29862');

const desk=item('desk','书桌','窗边坐一会儿。书可以翻开，灯也可以亮着。',-.65,-2.7,2.25,.85,false,'book');
box(desk,2.25,.11,.85,'#bf9667',0,.88,0,.035,wood);legs(desk,2.05,.66,.85);box(desk,.4,.6,.72,'#ab845a',.85,.52,0,.025,wood);
const book=group(desk,.1,.955,.07);box(book,.44,.035,.33,'#b5885d',0,0,0,.01);const bookPage=box(book,.43,.016,.32,'#eee7d5',0,.025,0,.006);const leafPage=box(book,.215,.013,.32,'#e9dfc9',-.107,.04,0);cup(desk,-.68,.94,.14);const deskLamp=lamp(desk,.72,.94,-.08,'#7f8b70');
const laptop=group(desk,-.23,.94,-.14);box(laptop,.48,.018,.32,'#9a9f98',0,0,0,.014);const screen=box(laptop,.47,.29,.018,'#697a75',0,.16,-.16,.014);screen.rotation.x=-.15;
const deskChair=item('deskchair','书桌椅','挪到窗边，或者给自己留条舒服的路。',-.7,-1.55,.66,.72,true,null);legs(deskChair,.5,.51,.44);box(deskChair,.68,.10,.66,'#bd9668',0,.49,0,.04,wood);box(deskChair,.67,.54,.07,'#b89164',0,.83,.28,.05,wood);

const wardrobe=item('wardrobe','衣柜','衣服挂好了。柜门可以开合，旁边还有出门要带的包。',-5.25,2.45,1.15,1.0,false,'wardrobe');
box(wardrobe,1.15,2.18,.98,'#b48e63',0,1.1,0,.04,wood);const wardrobeDoor=group(wardrobe,-.53,1.1,.515);box(wardrobeDoor,1.05,2.03,.055,'#c7a67b',.525,0,0,.025,wood);box(wardrobeDoor,.025,.25,.035,'#65573e',.87,-.02,.044);
const hanger=tube(wardrobe,[[-.4,1.85,0],[0,1.85,0],[.4,1.85,0]],.025,'#85745b');box(wardrobe,.75,.88,.2,'#869781',0,1.27,.1,.08);box(wardrobe,.9,.08,.8,'#a17b52',0,.42,0);
const shoes=item('entry','门口','钥匙、鞋子和一个帆布包。慢慢出门，也慢慢回来。',-4.55,3.45,1.1,.4,false,null);box(shoes,1.08,.42,.38,'#bc956b',0,.23,0,.025,wood);box(shoes,1.13,.06,.43,'#ddbe92',0,.47,0,.025,wood);for(const x of [-.15,.15])ball(shoes,.16,'#7a7666',x,.08,.12,[.57,.35,1.2]);ball(shoes,.13,'#d9cdb4',-.31,.60,0,[1,.4,1]);const key=mesh(shoes,new THREE.TorusGeometry(.04,.009,6,18),mat('#a98848'),-.31,.66,.02);key.rotation.x=Math.PI/2;
box(house,.08,1.95,.95,'#c4a782',-5.94,1.12,3.25,.01);box(house,.06,1.8,.8,'#b69972',-5.88,1.12,3.25,.01);ball(house,.04,'#725e41',-5.82,1.14,2.93);

const kitchen=item('kitchen','厨房','水槽、灶台、锅和杯子。做一顿简单的饭也很好。',3.05,-3.25,3.0,1.1,false,'tap');
box(kitchen,3.0,.88,1.0,'#b9b59d',0,.46,0,.035);box(kitchen,3.08,.10,1.1,'#e6dfce',0,.95,0,.02);
for(const x of [-1,0,1]){box(kitchen,.92,.72,.026,'#c8c6af',x,.5,.516,.025);box(kitchen,.25,.025,.03,'#827c65',x,.69,.55);}
box(kitchen,1.08,.025,.69,'#9caaa8',-.85,1.012,0,.055);box(kitchen,.82,.03,.49,'#667e80',-.85,1.026,0,.07);
tube(kitchen,[[-.85,1.04,-.37],[-.85,1.5,-.37],[-.85,1.54,-.03],[-.85,1.3,.03]],.025,'#a5b6b2');
const water=box(kitchen,.026,.25,.026,'#b3d4d4',-.85,1.16,.025,.008);water.visible=false;
box(kitchen,.95,.025,.74,'#5c625e',.86,1.016,0,.02);for(const x of [.59,1.13])for(const z of [-.20,.2]){cyl(kitchen,.15,.01,'#343b36',x,1.037,z);const r=mesh(kitchen,new THREE.TorusGeometry(.105,.012,8,24),mat('#899188'),x,1.05,z);r.rotation.x=Math.PI/2;}
cyl(kitchen,.19,.20,'#7d8f7c',.61,1.15,-.18,.21);cyl(kitchen,.215,.025,'#abb7a1',.61,1.263,-.18);ball(kitchen,.035,'#5d6853',.61,1.3,-.18);
box(kitchen,1.5,.05,.27,'#b59167',.55,1.87,-.43,.015,wood);cup(kitchen,.15,1.9,-.43);cup(kitchen,.45,1.9,-.43);books(kitchen,.7,1.90,-.43,4);
const kettle=item('kettle','小水壶','今天喝点热的吧。水壶烧好后，会自动停下来。',2.53,-2.93,.34,.34,false,'kettle');cyl(kettle,.17,.28,'#e9dec3',0,1.16,0,.14);tube(kettle,[[.13,1.04,0],[.25,1.17,0],[.15,1.29,0]],.025,'#978568');tube(kettle,[[-.12,1.15,0],[-.23,1.23,0],[-.22,1.28,0]],.035,'#d8c9a6');cyl(kettle,.145,.025,'#c0a67b',0,1.313,0);const kettleSteam=group(kettle,0,1.45,0);for(let i=0;i<3;i++)ball(kettleSteam,.055,'#eee7d8',i*.04-.04,i*.08,0,[.4,1.6,.4]);kettleSteam.visible=false;
const fridge=item('fridge','冰箱','打开看看，有水果、牛奶和留给明天的一点食物。',5.35,-3.2,.95,1.2,false,'fridge');box(fridge,.94,1.9,1.12,'#e2decf',0,.96,0,.075);const fridgeDoor=group(fridge,-.45,.96,.58);box(fridgeDoor,.9,1.78,.07,'#ebe5d4',.45,0,0,.035);box(fridgeDoor,.045,.48,.07,'#9eaa9f',.79,.25,.065,.012);box(fridgeDoor,.82,.02,.02,'#bbb9aa',.45,.16,.045);
for(const y of [.48,.94,1.42])box(fridge,.75,.035,.8,'#adbbb2',0,y,.10,.01);for(let i=0;i<3;i++)ball(fridge,.075,['#c2914e','#a5664d','#8b9c6a'][i],-.24+i*.19,.58,.28);box(fridge,.12,.25,.12,'#f0ece0',.17,1.095,.19,.01);

// 卫浴采用低隔墙，保持一屏可见；门、淋浴和洁具都在实际空间里。
const bath=item('bath','卫生间','独立的小卫生间，有淋浴、洗手台、镜子和毛巾。',4.45,2.65,2.8,2.65,false,null);
box(bath,2.75,.035,2.6,'#d7ded3',0,.045,0);for(let i=0;i<7;i++)for(let j=0;j<6;j++)box(bath,.38,.008,.42,(i+j)%2?'#e2e5dc':'#d5ded7',-1.17+i*.39,.067,-1.08+j*.43);
box(bath,.10,.85,2.7,'#d4d8cd',-1.42,.47,0);box(bath,2.85,.85,.10,'#d4d8cd',0,.47,-1.35);
box(bath,.08,.82,.88,'#b8c6bc',-1.43,.45,.6,.02);
const shower=group(bath,.68,.08,-.63);box(shower,1.12,.10,1.05,'#ebece2',0,.05,0,.04);box(shower,.04,1.55,1.05,'#cad7d3',.56,.84,0,.01);tube(shower,[[.45,.12,-.38],[.45,1.72,-.38],[.14,1.72,-.38]],.025,'#a7b7b1');cyl(shower,.11,.035,'#879b94',.13,1.71,-.38);box(shower,.72,1.17,.025,'#d9e1d8',.1,.70,.5,.012);const rail=cyl(shower,.025,1.2,'#9caea3',0,1.32,.50);rail.rotation.z=Math.PI/2;
const toilet=group(bath,.65,.08,.74);box(toilet,.47,.76,.25,'#eff0e8',0,.43,-.26,.06);ball(toilet,.30,'#f0f1e9',0,.28,0,[.8,1.05,1.2]);cyl(toilet,.265,.055,'#dedfd6',0,.59,0,.23);box(toilet,.40,.055,.45,'#f5f4ec',0,.62,0,.05);box(toilet,.09,.014,.04,'#b2bdb7',0,.83,-.26);
const sink=group(bath,-.85,.08,-.63);box(sink,.71,.73,.69,'#a7b6a6',0,.40,0,.025);box(sink,.76,.11,.72,'#efeee5',0,.83,0,.05);cyl(sink,.22,.025,'#9cbbb6',0,.89,.06);tube(sink,[[0,.88,-.21],[0,1.09,-.21],[0,1.12,.03]],.016,'#9dafaa');box(sink,.59,.65,.045,'#aebbb3',0,1.4,-.35,.025);box(sink,.53,.59,.02,'#c8d8d3',0,1.4,-.32,.015);
box(bath,.43,.07,.12,'#8a9b8b',-.89,.95,.73,.01);box(bath,.38,.41,.035,'#dfc9a3',-.89,.71,.81,.025,cloth);

const dining=item('dining','小餐桌','一个人吃饭，两把椅子。也给偶尔来的人留个位置。',2.05,-.1,1.18,1.05,true,null);legs(dining,.88,.76,.73);box(dining,1.18,.095,1.05,'#c2a074',0,.79,0,.06,wood);cyl(dining,.20,.015,'#e5decb',0,.85,0);ball(dining,.06,'#bd7556',.03,.91,0);cup(dining,.36,.85,.12);
for(const [id,x,z] of [['diningchair1',2.15,.87],['diningchair2',2.15,-1.03]]){const g=item(id,'餐椅','围着桌子坐，或者随手挪个位置。',x,z,.55,.6,true,null);legs(g,.4,.42,.43);box(g,.55,.09,.56,'#b39c70',0,.47,0,.035,wood);box(g,.54,.45,.075,'#bda57e',0,.72,.23,.045,wood);if(id==='diningchair2'){g.rotation.y=Math.PI;items.get(id).original.r=Math.PI;}}
const rug=item('rug','地毯','给脚下一点柔软。地毯也能换个地方。',-1.38,1.25,3.5,2.7,true,null);const rugMesh=cyl(rug,1,.04,'#dccab0',0,.055);rugMesh.scale.set(1.75,1,1.35);rugMesh.material=mat('#e4d6bc',.96,cloth);items.get('rug').flat=true;
for(let i=0;i<4;i++){const ring=mesh(rug,new THREE.TorusGeometry(1-i*.12,.012,6,72),mat('#cdbb9e'),0,.079,0);ring.rotation.x=Math.PI/2;ring.scale.set(1.7,1.3,1);}
const chair=item('armchair','扶手椅','换个方向坐坐。窗边看雨，屋里听歌。',-2.9,.54,1.22,1.20,true,null);legs(chair,.85,.80,.22);box(chair,1.1,.35,1.05,'#8a957a',0,.46,0,.13,cloth);box(chair,1.12,.9,.28,'#879378',0,.8,-.43,.13,cloth);for(const x of [-.53,.53])box(chair,.22,.38,1.07,'#929d83',x,.69,0,.1,cloth);box(chair,.83,.17,.82,'#a1ab8f',0,.68,.03,.11,cloth);const pillow=box(chair,.49,.43,.18,'#be815f',.15,.95,-.26,.08,cloth);pillow.rotation.z=.12;
const table=item('coffee','圆茶几','一杯茶、一本书。小桌子可以跟着椅子走。',-1.3,1.45,1.35,1.15,true,null);for(const x of [-.38,.38])for(const z of [-.28,.28])cyl(table,.055,.43,'#8c6946',x,.22,z);const top=cyl(table,.69,.09,'#c5a177',0,.48);top.scale.z=.85;box(table,.31,.04,.24,'#749185',.14,.56,0,.008);box(table,.28,.025,.23,'#e8ddc5',.13,.585,0,.008);cup(table,-.26,.535,.18);plant(table,.36,.535,-.12,.45);
const shelf=item('shelf','矮书架与唱片机','书排得不太整齐。选一张唱片，把今天慢下来。',-5.48,.24,1.0,2.35,false,'record');
box(shelf,.62,.90,2.28,'#b28d62',0,.52,0,.025,wood);for(const z of [-.70,0,.70])box(shelf,.625,.045,.04,'#8f704b',.01,.54,z);for(const y of [.12,.58,1.0])box(shelf,.72,.065,2.4,'#c5a376',0,y,0,.02,wood);
for(let i=0;i<13;i++)box(shelf,.35,.35,.09,['#b3956f','#7d8d7b','#bf805b','#e0ceaa'][i%4],.18,.34,-1.01+i*.16,.009);for(let i=0;i<8;i++)box(shelf,.36,.27,.085,['#b5b898','#c6a174','#eee0bf'][i%3],.18,.755,-.5+i*.16,.008);
const player=group(shelf,0,1.05,.4);box(player,.58,.12,.70,'#9a744e',0,.06,0,.025,wood);const vinyl=cyl(player,.23,.012,'#353e38',0,.133,0);cyl(player,.055,.015,'#b98257',0,.143,0);tube(player,[[.23,.15,-.22],[.13,.16,-.17],[.04,.16,.1]],.013,'#b3b9a6');box(player,.52,.35,.014,'#b7c2b7',0,.32,-.33,.01).rotation.x=-.15;plant(shelf,0,1.05,-.82,.65);
const potted=item('plant','窗边的植物','叶子有一点渴。浇点水，再换个晒得到光的位置。',.55,2.8,.70,.70,true,'plant');plant(potted,0,0,0,1.28);
const cat=item('cat','打盹的猫','摸摸它。它可能只翻个身，继续睡。',-.2,2.45,.86,.68,true,'cat');const cushion=cyl(cat,.45,.12,'#b7b094',0,.1);cushion.scale.z=.8;const catBody=ball(cat,.29,'#c89059',0,.33,0,[1.25,.72,.85]);const catHead=ball(cat,.16,'#d0a16e',-.22,.34,.13,[1,.9,.9]);for(const x of [-.30,-.14]){const ear=mesh(cat,new THREE.ConeGeometry(.065,.13,3),mat('#c18754'),x,.48,.10);ear.rotation.z=x<-.2?.25:-.25;}tube(cat,[[.32,.30,0],[.4,.26,.17],[.21,.26,.25],[.06,.27,.22]],.04,'#ba804d');for(const x of [-.27,-.17])tube(cat,[[x-.025,.355,.263],[x,.345,.273],[x+.022,.355,.263]],.006,'#684d37');

// 环境动画中的雨线和灯光，声音只有用户主动打开才会播放。
const rain=group(windowGroup,0,1.93,.135);for(let i=0;i<45;i++){const r=box(rain,.009,.12,.005,'#dce8e7',(i*137%250)/100-1.25,(i*79%120)/100-.6,.01);r.rotation.z=-.17;}rain.visible=state.rain;
const selectionRing=mesh(house,new THREE.RingGeometry(.65,.69,64),new THREE.MeshBasicMaterial({color:'#b88a5d',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}),0,.09,0);selectionRing.rotation.x=-Math.PI/2;selectionRing.visible=false;selectionRing.castShadow=false;
function bounds(o,x=o.group.position.x,z=o.group.position.z,r=o.group.rotation.y){const a=Math.abs(Math.cos(r)),b=Math.abs(Math.sin(r));return{x,z,w:o.w*a+o.d*b,d:o.d*a+o.w*b};}
function canPlace(o,x,z,r=o.group.rotation.y){const b=bounds(o,x,z,r);if(x-b.w/2< -5.82||x+b.w/2>5.82||z-b.d/2< -3.82||z+b.d/2>3.82)return false;if(o.flat)return true;
  for(const q of items.values()){if(q===o||q.flat||q.id==='window'||q.id==='bedtable'||q.id==='kettle')continue;const t=bounds(q);if(Math.abs(x-t.x)<(b.w+t.w)/2-.09&&Math.abs(z-t.z)<(b.d+t.d)/2-.09)return false;}return true;}
for(const [id,o]of items){const p=memory.positions[id];if(o.move&&p&&[p.x,p.z,p.r].every(Number.isFinite)&&Math.abs(p.x)<6&&Math.abs(p.z)<4){o.group.position.set(p.x,0,p.z);o.group.rotation.y=p.r;}}
function sync(){
  document.body.classList.toggle('night',state.night);sun.intensity=state.night?.12:state.rain?1.4:3.4;fill.intensity=state.night?.50:state.rain?1.6:2.2;bounce.intensity=state.night?.18:.7;
  $('day').textContent=state.night?'夜里':'傍晚';$('day').setAttribute('aria-label',state.night?'切换到傍晚':'切换到夜里');$('weather').textContent=state.rain?'雨停了吧':'下点雨';$('weather').setAttribute('aria-pressed',state.rain);
  rain.visible=state.rain;wardrobeDoor.rotation.y=state.wardrobe?-1.45:0;fridgeDoor.rotation.y=state.fridge?-1.35:0;
  duvet.position.z=state.bed?.33:.42;duvet.rotation.y=state.bed?0:.025;blanket.rotation.y=state.bed?0:-.07;
  bookPage.scale.x=state.book?1.45:1;leafPage.rotation.z=state.book?-.16:0;water.visible=state.tap;
  for(const l of [bedsideLamp,deskLamp]){l.light.intensity=state.lamp?4:0;l.bulb.material=mat(state.lamp?'#ffdda0':'#eee1c3');l.bulb.material.emissive.set(state.lamp?'#e19c40':'#000000');l.bulb.material.emissiveIntensity=state.lamp?.8:0;}
  catBody.rotation.z=state.cat?.1:0;syncAudio();save();requestDraw();
}
const actionLabels={curtains:()=>state.curtains?'拉开窗帘':'拉上窗帘',lamp:()=>state.lamp?'关上小灯':'开一盏灯',bed:()=>state.bed?'把被子铺松一点':'整理床铺',wardrobe:()=>state.wardrobe?'关上柜门':'打开衣柜',fridge:()=>state.fridge?'关上冰箱':'打开冰箱',tap:()=>state.tap?'关掉水龙头':'洗洗手',kettle:()=>state.kettle?'水正在烧…':'烧一壶水',record:()=>state.record?'收起这张唱片':'放一张唱片',book:()=>state.book?'合上书':'翻开书',plant:()=> '浇一点水',cat:()=> '摸摸猫'};
let kettleTimer=null,tapTimer=null;
function act(action){
  if(action==='plant'){say('浇好了。叶子也精神了一点。');potted.scale.set(1.025,1.05,1.025);setTimeout(()=>{potted.scale.set(1,1,1);requestDraw();},1300);requestDraw();return;}
  if(action==='kettle'){if(state.kettle)return;state.kettle=true;kettleSteam.visible=true;say('水在慢慢热起来。稍等一会儿。');clearTimeout(kettleTimer);kettleTimer=setTimeout(()=>{state.kettle=false;kettleSteam.visible=false;say('水烧好了。今天也给自己泡杯茶吧。');sync();if(selected)show(selected,false);},6500);}
  else{state[action]=!state[action];const notes={curtains:state.curtains?'窗帘合上了，小屋安静了一点。':'光又落进来了。',lamp:state.lamp?'给自己留了一盏灯。':'灯熄了，窗外还有一点光。',bed:state.bed?'被角掖好了。晚上会睡得舒服一点。':'被子铺得松松的。',wardrobe:state.wardrobe?'衣服和明天要带的东西，都在这里。':'柜门轻轻关上了。',fridge:state.fridge?'还有水果和牛奶。晚饭不用太复杂。':'把新鲜留给明天。',tap:state.tap?'水有一点凉。洗洗手，慢下来。':'水停了。',record:state.record?'唱片转起来了。打开声音，可以听一小段旋律。':'唱片停下来了。',book:state.book?'翻到上次读的那一页。':'书签夹好了，下次再读。',cat:'它翻了个身，继续睡。'};say(notes[action]||'');}
  if(action==='tap'){clearTimeout(tapTimer);if(state.tap)tapTimer=setTimeout(()=>{state.tap=false;sync();if(selected)show(selected,false);},5000);}
  sync();if(selected)show(selected,false);
}
function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;}
function show(o,focus=false){selected=o;$('object-panel').hidden=false;$('object-title').textContent=o.name;$('object-description').textContent=o.description;const actions=$('object-actions');actions.replaceChildren();if(o.action){const b=button(actionLabels[o.action](),()=>act(o.action));b.disabled=o.action==='kettle'&&state.kettle;actions.append(b);}
  if(o.move){actions.append(button('转个方向',()=>rotate(o)),button(arranging?'正在摆放':'移动这件',()=>{arranging=true;syncArrange();show(o,false);say('可以拖动这件家具，也可以用方向按钮挪动。');}));if(arranging){const pad=document.createElement('div');pad.className='move-pad';[['↖',-.2,-.2],['↑',0,-.2],['↗',.2,-.2],['←',-.2,0],['归位',null,null],['→',.2,0],['↙',-.2,.2],['↓',0,.2],['↘',.2,.2]].forEach(([s,x,z])=>pad.append(button(s,()=>{if(x===null){const p=o.original;if(canPlace(o,p.x,p.z,p.r)){o.group.position.set(p.x,0,p.z);o.group.rotation.y=p.r;save();requestDraw();}else say('原来的位置被占住了，先挪开旁边的家具吧。');}else move(o,o.group.position.x+x,o.group.position.z+z);})));actions.append(pad);}}
  selectionRing.visible=true;selectionRing.position.set(o.group.position.x,.09,o.group.position.z);selectionRing.scale.set(o.w*.7,o.d*.7,1);requestDraw();if(focus)actions.querySelector('button')?.focus();
}
function rotate(o){const r=o.group.rotation.y+Math.PI/2;if(canPlace(o,o.group.position.x,o.group.position.z,r)){o.group.rotation.y=r;save();requestDraw();say('换个方向，也换个心情。');}else say('这里有点挤，先挪开一点再转。');}
function move(o,x,z){if(canPlace(o,x,z)){o.group.position.x=x;o.group.position.z=z;selectionRing.position.set(x,.09,z);save();requestDraw();return true;}return false;}
for(const o of items.values())$('object-list').append(button(o.name,()=>show(o,true)));
function closePanel(){selected=null;$('object-panel').hidden=true;selectionRing.visible=false;requestDraw();}
$('close-panel').addEventListener('click',closePanel);
function syncArrange(){$('arrange').setAttribute('aria-pressed',arranging);$('arrange').textContent=arranging?'摆好了':'挪挪家具';$('hint').textContent=arranging?'拖动家具重新摆放。选中后，也可以用方向键移动。':'点点屋里的东西，看看会发生什么。';}
$('arrange').addEventListener('click',()=>{arranging=!arranging;syncArrange();if(selected)show(selected,false);});
$('day').addEventListener('click',()=>{state.night=!state.night;if(state.night)state.lamp=true;sync();say(state.night?'夜色到了，给你留着灯。':'傍晚的光，还有一点暖。');if(selected)show(selected,false);});
$('weather').addEventListener('click',()=>{state.rain=!state.rain;sync();say(state.rain?'窗外下起小雨。声音打开时，可以听见它。':'雨停了，窗外又安静下来。');});
$('wallpaper').addEventListener('click',()=>{wallpaper=!wallpaper;document.body.classList.toggle('wallpaper',wallpaper);$('wallpaper').textContent=wallpaper?'回到小家':'安静看一会儿';$('wallpaper').setAttribute('aria-pressed',wallpaper);closePanel();resize();});
$('reset').addEventListener('click',()=>{if(!confirm('把家具恢复到最初的位置？灯光和天气会保留。'))return;for(const o of items.values())if(o.move){o.group.position.set(o.original.x,0,o.original.z);o.group.rotation.y=o.original.r;}save();closePanel();say('家具回到最初的位置了。想怎么摆，随时再来。');requestDraw();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePanel();if(wallpaper)$('wallpaper').click();}if(!arranging||!selected?.move||['INPUT','TEXTAREA'].includes(e.target.tagName))return;const v={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]}[e.key];if(v){e.preventDefault();move(selected,selected.group.position.x+v[0],selected.group.position.z+v[1]);}});

// 点选射线和地面拖动共用同一组家具，不用不可见热区模拟物件。
const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitFloor=new THREE.Vector3();
function ray(e){const rect=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);}
function pick(e){ray(e);for(const hit of raycaster.intersectObjects(house.children,true)){if(hit.object.userData.ignorePick||hit.object===selectionRing)continue;let p=hit.object;while(p&&!p.userData.item)p=p.parent;if(p?.userData.item)return items.get(p.userData.item);}return null;}
let drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;const o=pick(e);if(!o){closePanel();return;}show(o,false);if(arranging&&o.move){ray(e);raycaster.ray.intersectPlane(floorPlane,hitFloor);drag={o,x:e.clientX,y:e.clientY,offsetX:hitFloor.x-o.group.position.x,offsetZ:hitFloor.z-o.group.position.z,moved:false};renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';}});
renderer.domElement.addEventListener('pointermove',e=>{if(drag){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;ray(e);if(raycaster.ray.intersectPlane(floorPlane,hitFloor))move(drag.o,hitFloor.x-drag.offsetX,hitFloor.z-drag.offsetZ);return;}if(e.pointerType==='touch')return;const o=pick(e);renderer.domElement.style.cursor=o?(arranging&&o.move?'grab':'pointer'):'default';const label=$('hover-label');label.hidden=!o;if(o){label.textContent=o.name;const r=container.getBoundingClientRect();label.style.left=Math.min(e.clientX-r.left+13,r.width-100)+'px';label.style.top=e.clientY-r.top-30+'px';}});
function endDrag(){if(drag?.moved)say('位置留好了。下次回来，它还在这里。');drag=null;renderer.domElement.style.cursor='default';}
renderer.domElement.addEventListener('pointerup',endDrag);renderer.domElement.addEventListener('pointercancel',endDrag);renderer.domElement.addEventListener('lostpointercapture',endDrag);renderer.domElement.addEventListener('pointerleave',()=>{$('hover-label').hidden=true;});
function createAudio(){if(audio)return;audio=new(window.AudioContext||window.webkitAudioContext)();audioGain=audio.createGain();audioGain.gain.value=.22;audioGain.connect(audio.destination);}
function note(f,when,duration=.7){if(!audio||!sound)return;const osc=audio.createOscillator(),g=audio.createGain();osc.type='sine';osc.frequency.value=f;g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(.15,when+.025);g.gain.exponentialRampToValueAtTime(.0001,when+duration);osc.connect(g);g.connect(audioGain);osc.start(when);osc.stop(when+duration+.05);}
function syncAudio(){if(!audio)return;const active=sound&&!document.hidden;audioGain.gain.setTargetAtTime(active?.22:0,audio.currentTime,.025);if(active)audio.resume().catch(()=>{});if(rainNode){rainNode.stop();rainNode=null;}clearInterval(melodyTimer);melodyTimer=null;if(active&&state.rain){const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.10;const n=audio.createBufferSource();n.buffer=buffer;n.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;n.connect(filter);filter.connect(audioGain);n.start();rainNode=n;}if(active&&state.record){const tune=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];let i=0;note(tune[i++],audio.currentTime);melodyTimer=setInterval(()=>note(tune[i++%tune.length],audio.currentTime),680);}}
$('quiet').addEventListener('click',()=>{sound=!sound;if(sound){try{createAudio();}catch{sound=false;say('这台设备暂时没能播放声音。小屋仍然可以继续玩。');}}$('quiet').setAttribute('aria-pressed',sound);$('quiet').textContent=sound?'声音：开':'声音：关';syncAudio();});

let raf=0,lastDraw=0,start=performance.now();
function render(now){raf=0;if(document.hidden)return;if(now-lastDraw<32){raf=requestAnimationFrame(render);return;}lastDraw=now;const t=(now-start)/1000;
  for(const c of curtains){const closed=state.curtains?c.side*.08:c.side*1.45;const target=closed+c.side*c.index*(state.curtains?.19:.07);c.mesh.position.x=target-c.mesh.parent.position.x;c.mesh.scale.x=state.curtains?1.8:1;c.mesh.position.z=reduce?0:Math.sin(t*.65+c.index*.5)*.015;}
  if(state.rain&&!reduce)rain.children.forEach((r,i)=>r.position.y=.64-((t*.5+i*.17)%1.3));
  if(state.record&&!reduce)vinyl.rotation.y=t*.5;
  if(state.kettle&&!reduce)kettleSteam.children.forEach((s,i)=>{s.position.y=(t*.18+i*.12)%.35;s.scale.y=1+Math.sin(t+i)*.2;});
  if(!reduce)catBody.scale.y=.72+Math.sin(t*1.6)*.009;
  renderer.render(scene,camera);if(!reduce||state.record||state.kettle)raf=requestAnimationFrame(render);
}
function requestDraw(){if(!raf&&!document.hidden)raf=requestAnimationFrame(render);}
function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);const aspect=w/h;const view=Math.max(10.8,15.8/aspect);camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2;camera.bottom=-view/2;camera.updateProjectionMatrix();requestDraw();}
new ResizeObserver(resize).observe(container);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else requestDraw();syncAudio();});
// 页面关闭时不留下音频和定时器。
addEventListener('pagehide',()=>{clearInterval(melodyTimer);clearTimeout(kettleTimer);clearTimeout(tapTimer);audio?.suspend();});
// 一次性的水流和烧水状态不跨页面延续。
state.tap=false;state.kettle=false;loading.hidden=true;sync();resize();
