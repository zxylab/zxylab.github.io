/* Small, accessible calculators. Formula implementations live in models.js. */
'use strict';
const M = ToolModels;
const units = {
  frequency: [['Hz',1],['kHz',1e3],['MHz',1e6],['GHz',1e9]],
  distance: [['m',1],['km',1e3]], time: [['ns',1e-9],['μs',1e-6],['ms',1e-3],['s',1]],
  power: [['W',1],['kW',1e3],['MW',1e6]], area: [['m²',1],['dBsm','db']],
  speed: [['m/s',1],['km/h',1/3.6]]
};
const field = (key, label, value, type, unit, min = 0, strict = true) => ({ key, label, value, type, unit, min, strict });
const select = (key, label, value, options) => ({ key, label, value, options });
const freq = () => field('f','工作频率',10,'frequency','GHz');
const dist = () => field('r','目标斜距',50,'distance','km');
const thermal = () => [field('t','天线噪声温度 Tₐ',290,'K','K'),field('nf','噪声系数 NF（参考 290 K）',3,'dB','dB',0,false)];
const bandwidth = () => field('b','等效噪声带宽 B',20,'frequency','MHz');
const radarFields = () => [freq(),dist(),field('pt','发射峰值功率 Pₜ',1,'power','kW'),
  field('gt','发射天线增益 Gₜ',30,'dBi','dBi',null),field('gr','接收天线增益 Gᵣ',30,'dBi','dBi',null),
  field('sigma','目标 RCS σ',1,'area','m²'),field('tau','有效脉宽 τ',10,'time','μs'),bandwidth(),...thermal(),
  field('loss','射频 / 传播总损耗 Lᵣ𝒻',3,'dB','dB',0,false),field('processing','处理损耗 Lₚ',1,'dB','dB',0,false)];
const fmt = x => {
  if (!Number.isFinite(x)) throw new Error('计算结果超出数值范围，请缩小参数范围');
  if (x === 0) return '0';
  return Math.abs(x) < .001 || Math.abs(x) >= 1e6 ? x.toExponential(4) : Number(x.toPrecision(6)).toString();
};
const metric = (label, value, unit) => ({label,value,unit});
const source = (url, text) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
const commonRadar = `<p>单站、自由空间、远场；R 为单程目标斜距，Gₜ/Gᵣ 为功率增益。Pₜ 为脉内峰值功率，Pₜτ 为脉冲能量；τ 是按能量定义的有效脉宽。点目标 RCS 恒定、极化匹配。Lᵣ𝒻 是射频与传播<strong>往返总损耗</strong>，不含自由空间扩散项（已在 R⁴ 中），不含 NF 与处理损耗。Lₚ 包含加窗、失配等处理损耗。</p><p>Tₛᵧₛ = Tₐ + 290(F − 1)，F = 10^(NF/10)。温度与损耗均折算至同一接收输入参考面；不含杂波、干扰、检测概率及虚警门限。</p>`;
const configs = [
 { id:'base64', name:'Base64 编解码', short:'06 / TEXT', lead:'把 UTF-8 文本编码为 Base64，或解码回文本。中文与多行文本都可以。',
  fields:[select('direction','处理方向','encode',[['encode','文本 → Base64'],['decode','Base64 → 文本']]),{key:'text',label:'输入内容',value:'你好，世界！',type:'text'}],
  calculate:p => [{label:p.direction==='encode'?'Base64 编码结果':'UTF-8 解码结果',value:M.base64(p.text,p.direction),unit:'',text:true}],
  formula:'编码：Unicode 文本 → UTF-8 字节 → 标准 Base64\n解码：标准 Base64 → 字节 → UTF-8 文本',
  conditions:'<p>使用标准 Base64 字母表 A–Z、a–z、0–9、+、/ 和 = 填充。解码允许空白和换行，须包含必要的填充；不接受 URL-safe 的 − 和 _。只处理 UTF-8 文本，拒绝无效 UTF-8 字节与二进制文件。空文本是有效输入；输入上限为 1 Mi 个字符。</p><p><strong>Base64 是编码，不是加密。</strong>所有文本处理都在浏览器本地完成，输入与输出不会上传。</p>' },
 { id:'fspl', name:'自由空间路径损耗', short:'01 / FSPL', lead:'从发射端到接收端，一次传播的几何扩散损耗。', fields:[freq(),field('r','传播距离',50,'distance','km')],
  calculate:p => [metric('单程自由空间路径损耗',M.fspl(p.f,p.r),'dB'),metric('波长 λ',M.C/p.f,'m'),metric('距离翻倍，损耗增加',20*Math.log10(2),'dB')],
  formula:'FSPL = 20 log₁₀(4πRf / c)',
  conditions:`<p>f 用 Hz，R 用 m；c = 299 792 458 m/s。适用自由空间、视距、远场传播；天线增益、吸收、遮挡、多径均未计入。很短距离下出现负值不代表实际链路增益，须先确认远场条件。</p><p><strong>这是单程传播损耗。</strong>雷达回波还包含目标散射、往返传播与接收孔径，不能将 FSPL 简单乘二当作完整雷达方程。请使用单脉冲 / SAR 工具。</p><p>公式参考：${source('https://www.itu.int/rec/R-REC-P.525/en','ITU-R P.525')}。</p>`, chart:true },
 { id:'pulse', name:'单脉冲雷达', short:'02A / RADAR', lead:'一次脉冲的回波功率，以及理想匹配滤波后的能量 SNR。', fields:radarFields(),
  calculate:p => {const x=M.radar(p);return [metric('单脉冲匹配滤波后 SNR',x.single,'dB'),metric('接收峰值功率 Pᵣ',x.prdbm,'dBm'),metric('接收峰值功率 Pᵣ',x.watts,'W'),metric('带宽 B 内滤波前 SNR',x.pre,'dB'),metric('理想距离处理增益 Bτ',x.rangeGain,'dB'),metric('系统噪声温度 Tₛᵧₛ',x.ts,'K')];},
  formula:'Pᵣ = Pₜ Gₜ Gᵣ λ² σ / [(4π)³ R⁴ Lᵣ𝒻]\nSNR₁ = Pᵣ τ / (k Tₛᵧₛ Lₚ)\nSNRᵢₙ = Pᵣ / (k Tₛᵧₛ B)',
  conditions:commonRadar+`<p>采用复基带能量约定：噪声谱密度 kTₛᵧₛ；单脉冲匹配滤波输出 SNR = Eᵣ/(kTₛᵧₛ)。带宽 B 应覆盖信号。以 Pᵣ/(kTₛᵧₛB) 为起点时，距离处理增益为 Bτ；以能量 SNR 为起点时，<strong>不能再乘一次 Bτ</strong>。Bτ &lt; 1 时，输入带宽与有效脉宽通常不相容，应检查波形 / 带宽。</p><p>参考：${source('https://www.mathworks.com/help/radar/ref/radareqsnr.html','单脉冲能量雷达方程')}。</p>` },
 { id:'sar', name:'成像雷达 · SAR', short:'02B / IMAGING', lead:'显式给定积累脉冲数的简化 SAR 能量预算。分别估算点目标与一个地面分辨单元。',
  fields:[select('target','目标模型','point',[['point','点目标 · 恒定 RCS'],['distributed','分布式 · σ⁰ × 地面单元面积']]),...radarFields(),field('n','相干积累脉冲数 N',128,'pulses','脉冲',1,false),
    field('sigma0','后向散射系数 σ⁰',-10,'dB','dB',null),field('az','地面方位分辨率 δₐ',3,'distance','m'),field('angle','入射角 θ（相对地面法线）',45,'°','°')],
  calculate:p => {const x=M.sar(p);let out=[metric(p.target==='point'?'点目标聚焦后 SNR':'分辨单元平均热噪声 SNR',x.image,'dB'),metric('单脉冲匹配滤波后 SNR',x.single,'dB'),metric('理想相干积累增益 N',x.azGain,'dB'),metric('理想距离处理增益 Bτ',x.rangeGain,'dB'),metric('等效 RCS σ',x.sigma,'m²'),metric('系统噪声温度 Tₛᵧₛ',x.ts,'K')];if(p.target==='distributed')out.push(metric('地面分辨单元面积 A',x.area,'m²'),metric('噪声等效 σ⁰ · NESZ',x.nesz,'dB'));return out;},
  formula:'SNRᵢₘ𝓰 = N Pᵣ τ / (k Tₛᵧₛ Lₚ)\n点目标：σ = 输入 RCS\n分布式：δᵣ,ground = c / (2B sin θ)\nA = δᵣ,ground δₐ，σ = σ⁰ A\nNESZ = σ⁰ / SNRᵢₘ𝓰（线性）',
  conditions:commonRadar+`<p><strong>明确建模：</strong>N 个脉冲有相同能量、近似相同距离与天线增益；独立白热噪声、等权积累，目标静止且相位完全补偿，距离迁移已校正。点目标采用恒定 RCS。由能量 SNR 推得相干增益 N（不是 N²）；Bτ 仅显示供核对，不重复计入。非等权加窗、波束变化、相位误差等须用 Lₚ 计入。N 与 δₐ 由用户给定，本工具不自动验证两者的几何可实现性，也不替代条带 / 聚束 SAR 系统设计。</p><p>分布式模式采用平坦地面、局部恒定入射角 0° &lt; θ &lt; 90°、均匀 σ⁰（单位 m²/m²）、互不相关散射单元。将一个<strong>矩形地面分辨单元</strong>平均 RCS 近似为 σ⁰A；δₐ 为输入地面方位分辨率，距离分辨率取未加窗 c/(2B)，本模式 B 同时作为信号带宽与等效噪声带宽。加窗或其他像元权重下需另外修正等效面积和处理损耗。输出是平均信号功率 / 热噪声功率，<strong>不包含散斑、杂波、模糊、地形起伏和多视处理</strong>；θ 接近 0° 时地面投影近似失效。</p><p>NESZ 为该模型中 SNR = 1（0 dB）时的 σ⁰。此页从单脉冲能量预算推导，参考 ${source('https://www.mathworks.com/help/radar/ref/radareqsnr.html','能量雷达方程')} 与 ${source('https://www.mathworks.com/help/radar/ug/airborne-sar-system-design.html','SAR 处理与几何说明')}，并非将某一条带公式推广到所有成像体制。</p>` },
 { id:'noise', name:'热噪声功率', short:'03 / kTB + NF', lead:'看一眼噪声底。默认 290 K 时，就是常用的 kTB + NF。', fields:[bandwidth(),...thermal()],
  calculate:p => {const x=M.noise(p.b,p.t,p.nf);return [metric('折算至接收输入的噪声功率',x.dbm,'dBm'),metric('噪声功率',x.watts,'W'),metric('噪声谱密度',x.density,'dBm/Hz'),metric('系统噪声温度 Tₛᵧₛ',x.ts,'K')];},
  formula:'F = 10^(NF/10)，Tₑ = 290(F − 1)\nTₛᵧₛ = Tₐ + Tₑ，Pₙ = k Tₛᵧₛ B\nTₐ = 290 K 时：Pₙ,dBm = 10 log₁₀(k Tₐ B / 1 mW) + NF',
  conditions:`<p>k = 1.380 649 × 10⁻²³ J/K；B 是<strong>等效噪声带宽</strong>，不一定等于采样率或滤波器 −3 dB 带宽。噪声系数 NF 固定以 290 K 定义；Tₐ 改变时使用等效输入噪声温度 Tₑ，而非直接把任意 kTₐB 乘 F。默认 290 K、NF = 0 时约 −173.98 dBm/Hz。</p><p>白热噪声模型；数值是折算到接收输入的噪声功率，未乘接收链增益，不含量化噪声、干扰及杂波。各项需在同一参考面定义。</p><p>参考：${source('https://www.mathworks.com/help/phased/ref/systemp.html','NF 与 290 K 参考温度')}。</p>` },
 { id:'motion', name:'距离 / 多普勒', short:'04 / RANGE & DOPPLER', lead:'单站雷达的往返回波时延，与带符号的径向速度。两个方向都能换算。',
  fields:[select('rangeDirection','距离 / 时延方向','range',[['range','距离 → 回波时延'],['time','回波时延 → 距离']]),field('rangeValue','距离',50,'distance','km',0,false),freq(),select('velocityDirection','速度 / 多普勒方向','velocity',[['velocity','径向速度 → 多普勒'],['doppler','多普勒 → 径向速度']]),field('velocityValue','径向速度（接近为正）',30,'speed','m/s',null)],
  calculate:p => [metric(p.rangeDirection==='range'?'往返回波时延':'单程目标距离',M.rangeTime(p.rangeValue,p.rangeDirection)*(p.rangeDirection==='range'?1e6:.001),p.rangeDirection==='range'?'μs':'km'),metric(p.velocityDirection==='velocity'?'多普勒频率':'径向速度（接近为正）',M.doppler(p.velocityValue,p.f,p.velocityDirection),p.velocityDirection==='velocity'?'Hz':'m/s')],
  formula:'τ = 2R / c，R = cτ / 2\nfᴅ = 2vᵣ f / c，vᵣ = c fᴅ / (2f)',
  conditions:`<p>单站、窄带、|vᵣ| ≪ c；速度沿视线方向。此页规定<strong>接近雷达为正</strong>，正多普勒对应接近，远离为负；若使用其他复基带符号约定，需相应改变符号。不是平台总速度或切向速度。未考虑 PRF 折叠、距离 / 多普勒模糊。</p>` },
 { id:'db', name:'dB / 功率单位', short:'05 / UNITS', lead:'绝对功率与相对比值，分别换算。dB 本身没有绝对功率参考。',
  fields:[select('kind','换算类型','absolute',[['absolute','绝对功率'],['ratio','功率比 / 幅度比']]),select('from','输入单位','dBm',[['dBm','dBm'],['dBW','dBW'],['W','W'],['mW','mW']]),field('value','输入数值',0,'number','',null)],
  calculate:p => p.kind==='absolute'?Object.entries(M.power(p.value,p.from)).map(([u,v])=>metric('绝对功率',v,u)):Object.entries(M.ratio(p.value,p.from)).map(([u,v])=>metric(u==='dB'?'对数比值':u==='power'?'功率比':'幅度比',v,u==='dB'?'dB':'倍')),
  formula:'P(dBm) = 10 log₁₀[P(W) / 0.001]\nP(dBW) = 10 log₁₀[P(W)]，dBm = dBW + 30\n功率比：dB = 10 log₁₀(P₂/P₁)\n幅度比：dB = 20 log₁₀(|A₂|/|A₁|)',
  conditions:`<p>W、mW 和线性比值输入须大于 0；dBm、dBW、dB 可为负。dBm 参考 1 mW，dBW 参考 1 W。<strong>幅度比换算假设相同阻抗</strong>（功率与幅度平方成正比），不包含相位；不同阻抗不能直接用 20 log₁₀ 电压比换算功率比。</p>` }
];
configs.push(configs.shift());
const states = new Map();
const nav = document.querySelector('.tool-nav'), panels = document.querySelector('#panels');
function optionMarkup(options, selected) { return options.map(([v,label])=>`<option value="${v}" ${String(v)===String(selected)?'selected':''}>${label}</option>`).join(''); }
function fieldMarkup(c, f) {
 const id=`${c.id}-${f.key}`;
 if(f.type==='text')return `<label class="field text-field" for="${id}"><span class="field-name">${f.label}</span><textarea id="${id}" name="${f.key}" maxlength="1048576" spellcheck="false" aria-describedby="${c.id}-error">${f.value}</textarea></label>`;
 if(f.options)return `<label class="field" for="${id}"><span class="field-name">${f.label}</span><select id="${id}" name="${f.key}">${optionMarkup(f.options,f.value)}</select></label>`;
 const opts=units[f.type];
 return `<label class="field" for="${id}" data-field="${f.key}"><span class="field-name">${f.label}</span><span class="input-row"><input id="${id}" name="${f.key}" type="number" step="any" value="${f.value}" aria-describedby="${c.id}-error">${opts?`<select data-unit-for="${f.key}" aria-label="${f.label}单位">${optionMarkup(opts.map(([u])=>[u,u]),f.unit)}</select>`:`<span class="fixed-unit">${f.unit}</span>`}</span></label>`;
}
configs.forEach((c,i)=>{
 const b=document.createElement('button');b.type='button';b.id=`tab-${c.id}`;b.role='tab';b.setAttribute('aria-controls',c.id);b.setAttribute('aria-selected','false');b.tabIndex=-1;b.innerHTML=`${c.name}<small>${c.short}</small>`;nav.append(b);
 const section=document.createElement('section');section.className='panel';section.id=c.id;section.role='tabpanel';section.tabIndex=0;section.hidden=true;section.setAttribute('aria-labelledby',b.id);
 section.innerHTML=`<span class="tag">${c.short}</span><h2>${c.name}</h2><p class="lead">${c.lead}</p><form aria-label="${c.name}参数" novalidate><div class="inputs">${c.fields.map(f=>fieldMarkup(c,f)).join('')}</div></form><p class="error" id="${c.id}-error" role="status" hidden></p><div class="results" aria-live="polite" aria-atomic="true"></div>${c.chart?`<figure class="chart" hidden><svg viewBox="0 0 560 230" role="img" aria-labelledby="fspl-chart-title fspl-chart-desc"><title id="fspl-chart-title">距离与单程自由空间路径损耗</title><desc id="fspl-chart-desc"></desc><g class="plot"></g></svg><figcaption>横轴为对数距离，纵轴为单程损耗。橙点是当前参数。</figcaption></figure>`:''}<p class="notice" hidden></p><div class="actions"><button type="button" class="copy">复制结果</button><button type="button" class="reset">恢复默认</button><span class="copy-status" role="status"></span></div><details><summary>公式与适用条件</summary><div class="conditions"><p class="formula">${c.formula.replaceAll('\n','<br>')}</p>${c.conditions}</div></details>`;
 panels.append(section);states.set(c.id,{section,fields:structuredClone(c.fields),metrics:[],lastUnits:new Map()});
 c.fields.filter(f=>units[f.type]).forEach(f=>states.get(c.id).lastUnits.set(f.key,f.unit));
 b.addEventListener('click',()=>activate(c.id));
 b.addEventListener('keydown',e=>{let j;if(e.key==='ArrowRight'||e.key==='ArrowDown')j=(i+1)%configs.length;if(e.key==='ArrowLeft'||e.key==='ArrowUp')j=(i+configs.length-1)%configs.length;if(e.key==='Home')j=0;if(e.key==='End')j=configs.length-1;if(j!==undefined){e.preventDefault();activate(configs[j].id);nav.children[j].focus();}});
 section.querySelector('form').addEventListener('submit',e=>e.preventDefault());
 section.querySelector('form').addEventListener('input',e=>{if(!e.target.matches('select'))update(c);});
 section.querySelector('form').addEventListener('change',e=>{const target=e.target;if(target.dataset.unitFor)convertUnit(c,target);else if(target.tagName==='SELECT')adapt(c,target.name);update(c);});
 section.querySelector('.copy').addEventListener('click',()=>copy(c));
 section.querySelector('.reset').addEventListener('click',()=>{const s=states.get(c.id);s.fields=structuredClone(c.fields);section.querySelector('.inputs').innerHTML=c.fields.map(f=>fieldMarkup(c,f)).join('');s.lastUnits.clear();c.fields.filter(f=>units[f.type]).forEach(f=>s.lastUnits.set(f.key,f.unit));adapt(c);update(c);});
 adapt(c);update(c);
});
function activate(id, sync=true) {
 if(!states.has(id))id='fspl';
 configs.forEach(c=>{const on=c.id===id;states.get(c.id).section.hidden=!on;const tab=document.getElementById('tab-'+c.id);tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;});
 if(sync)history.replaceState(null,'','#'+id);
}
window.addEventListener('hashchange',()=>activate(location.hash.slice(1),false));activate(location.hash.slice(1),false);
function adapt(c, changed) {
 const s=states.get(c.id), section=s.section, form=section.querySelector('form');
 if(c.id==='sar'){
 const distributed=form.elements.target.value==='distributed';
 ['sigma0','az','angle'].forEach(k=>{section.querySelector(`[data-field="${k}"]`).hidden=!distributed;});section.querySelector('[data-field="sigma"]').hidden=distributed;
 }
 if(c.id==='motion'){
 if(!changed||changed==='rangeDirection')replaceNumeric(c,'rangeValue',form.elements.rangeDirection.value==='range'?field('rangeValue','距离',50,'distance','km',0,false):field('rangeValue','往返回波时延',333.564,'time','μs',0,false));
 if(!changed||changed==='velocityDirection')replaceNumeric(c,'velocityValue',form.elements.velocityDirection.value==='velocity'?field('velocityValue','径向速度（接近为正）',30,'speed','m/s',null):field('velocityValue','多普勒频率（接近为正）',2001.38,'frequency','Hz',null));
 }
 if(c.id==='db'&&(!changed||changed==='kind')){
 const relative=form.elements.kind.value==='ratio';const opts=relative?[['dB','dB'],['power','功率比'],['amplitude','幅度比']]:[['dBm','dBm'],['dBW','dBW'],['W','W'],['mW','mW']];form.elements.from.innerHTML=optionMarkup(opts,relative?'dB':'dBm');form.elements.value.value='0';
 }
}
function replaceNumeric(c,key,f){const s=states.get(c.id);s.fields[s.fields.findIndex(x=>x.key===key)]=f;s.section.querySelector(`[data-field="${key}"]`).outerHTML=fieldMarkup(c,f);s.lastUnits.set(key,f.unit);}
function convertUnit(c,selectEl){
 const s=states.get(c.id),key=selectEl.dataset.unitFor,f=s.fields.find(x=>x.key===key),input=s.section.querySelector(`[name="${key}"]`);
 const old=s.lastUnits.get(key),next=selectEl.value,list=units[f.type],oldScale=list.find(x=>x[0]===old)[1],nextScale=list.find(x=>x[0]===next)[1];
 if(input.value!==''&&Number.isFinite(input.valueAsNumber)){
 const val=input.valueAsNumber,si=oldScale==='db'?10**(val/10):val*oldScale,result=nextScale==='db'?10*Math.log10(si):si/nextScale;
 if(Number.isFinite(result))input.value=Number(result.toPrecision(12)).toString();else input.value='';
 }s.lastUnits.set(key,next);
}
function parameters(c){
 const s=states.get(c.id),form=s.section.querySelector('form'),p={};
 s.fields.forEach(f=>{
 const el=form.elements[f.key];if(f.options){p[f.key]=el.value;return;}
 const label=el.closest('.field');el.removeAttribute('aria-invalid');if(label.hidden)return;
 if(f.type==='text'){p[f.key]=el.value;return;}
 let v=el.valueAsNumber;let scale=units[f.type]?.find(x=>x[0]===label.querySelector('select').value)[1];if(scale==='db')v=10**(v/10);else if(scale)v*=scale;
 if(!Number.isFinite(v)||(f.min!==null&&(f.strict?v<=f.min:v<f.min))){el.setAttribute('aria-invalid','true');throw new Error(`${f.label}：请输入${f.min===null?'有限数值':f.strict?'大于 '+f.min+' 的数值':'不小于 '+f.min+' 的数值'}`);}p[f.key]=v;
 });return p;
}
function update(c){
 const s=states.get(c.id),error=s.section.querySelector('.error'),results=s.section.querySelector('.results'),copyBtn=s.section.querySelector('.copy'),notice=s.section.querySelector('.notice');s.section.querySelector('.copy-status').textContent='';s.section.querySelector('.copy-fallback')?.remove();
 s.section.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
 try{const p=parameters(c);const out=c.calculate(p);out.forEach(x=>{if(!x.text)fmt(x.value);});s.metrics=out;results.replaceChildren();out.forEach(x=>{
 const box=document.createElement('div');box.className='metric';const label=document.createElement('small');label.textContent=x.label;box.append(label);
 if(x.text){const value=document.createElement('textarea');value.className='text-result';value.readOnly=true;value.setAttribute('aria-label',x.label);value.value=x.value;box.append(value);}
 else{const value=document.createElement('strong');value.textContent=fmt(x.value);const unit=document.createElement('em');unit.textContent=x.unit;value.append(unit);box.append(value);}results.append(box);
 });results.hidden=false;error.hidden=true;copyBtn.disabled=false;
 let text='';if((c.id==='pulse'||c.id==='sar')&&p.b*p.tau<1)text='Bτ < 1：请确认输入带宽覆盖信号，当前理想匹配滤波模型可能不适用。';if(c.id==='sar'&&p.target==='distributed'&&p.angle<5)text+=' 入射角接近地面法线，地面投影近似可能不适用。';if(c.id==='motion'&&Math.abs(p.velocityDirection==='velocity'?p.velocityValue:M.doppler(p.velocityValue,p.f,'doppler'))>M.C*.01)text='速度已超过光速的 1%，低速多普勒近似可能不适用。';notice.textContent=text;notice.hidden=!text;
 if(c.chart)drawFspl(s,p);
 }catch(e){s.metrics=[];results.innerHTML='';results.hidden=true;error.textContent=e.message;error.hidden=false;copyBtn.disabled=true;notice.hidden=true;if(c.chart)s.section.querySelector('.chart').hidden=true;}
}
function drawFspl(s,p){
 const figure=s.section.querySelector('.chart');figure.hidden=false;
 const center=Math.log10(p.r),left=center-1,right=center+1,y0=M.fspl(p.f,p.r)-20,y1=y0+40;
 const x=t=>54+(t-left)/(right-left)*480,y=v=>184-(v-y0)/(y1-y0)*152;
 let svg='';for(let i=0;i<=4;i++){const xx=54+i*120,yy=184-i*38;svg+=`<path d="M${xx} 32V184M54 ${yy}H534" stroke="#dedfd4"/><text x="${xx}" y="207" text-anchor="middle">${fmt(10**(left+i*.5)/1000)}</text><text x="44" y="${yy+4}" text-anchor="end">${fmt(y0+i*10)}</text>`;}
 svg+=`<path d="M${x(left)} ${y(y0)}L${x(right)} ${y(y1)}" fill="none" stroke="#326b5e" stroke-width="2.5"/><circle cx="${x(center)}" cy="${y(y0+20)}" r="5" fill="#bd5d38"/><text x="54" y="17">损耗 / dB</text><text x="534" y="225" text-anchor="end">距离 / km（对数）</text>`;
 s.section.querySelector('.plot').innerHTML=`<g fill="#62685c" font-size="10" font-family="system-ui,sans-serif">${svg}</g>`;
 s.section.querySelector('#fspl-chart-desc').textContent=`频率 ${fmt(p.f/1e9)} GHz，在 ${fmt(p.r/1000)} km 时损耗 ${fmt(M.fspl(p.f,p.r))} dB。距离从当前的十分之一到十倍，损耗从 ${fmt(y0)} 到 ${fmt(y1)} dB，每翻倍增加 6.0206 dB。`;
}
async function copy(c){
 const s=states.get(c.id),status=s.section.querySelector('.copy-status');if(!s.metrics.length)return;
 const form=s.section.querySelector('form'),lines=[`小工具 · ${c.name}`];
 s.fields.forEach(f=>{const el=form.elements[f.key];if(el.closest('.field').hidden)return;lines.push(`${el.closest('.field').querySelector('.field-name').textContent}：${f.options?el.selectedOptions[0].textContent:el.value+' '+(el.closest('.field').querySelector('[data-unit-for]')?.value||f.unit)}`);});
 lines.push('',...s.metrics.map(x=>`${x.label}：${x.text?x.value:fmt(x.value)} ${x.unit}`),'','模型与适用条件：'+location.origin+'/tools/#'+c.id);
 const text=c.id==='base64'?s.metrics[0].value:lines.join('\n');
 try{await navigator.clipboard.writeText(text);status.textContent=c.id==='base64'?'已复制结果':'已复制参数和结果';}
 catch{let box=s.section.querySelector('.copy-fallback');if(!box){box=document.createElement('textarea');box.className='copy-fallback';box.setAttribute('aria-label','手动复制参数和结果');box.style.cssText='width:100%;min-height:180px;margin-bottom:18px';s.section.querySelector('.actions').after(box);}box.value=text;box.focus();box.select();status.textContent='请复制下方已选中的文字';}
}
