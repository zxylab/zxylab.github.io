/* Pure SI-unit models. No network, stored user data, or external dependencies. */
(function (root) {
  'use strict';
  const C = 299792458, K = 1.380649e-23, T0 = 290;
  const db = x => 10 * Math.log10(x);
  function positive(x, name) { if (!Number.isFinite(x) || x <= 0) throw new Error(name + '须为有限正数'); return x; }
  function finite(x, name) { if (!Number.isFinite(x)) throw new Error(name + '须为有限数值'); return x; }
  function nonnegative(x, name) { finite(x, name); if (x < 0) throw new Error(name + '不能为负'); return x; }
  function linear(d) { const x = 10 ** (d / 10); return positive(x, '换算结果（超出数值范围）'); }
  function systemTemperature(t, nf) {
    positive(t, '天线噪声温度'); nonnegative(nf, '噪声系数');
    return positive(t + T0 * (linear(nf) - 1), '系统噪声温度');
  }
  function fspl(f, r) {
    positive(f, '频率'); positive(r, '距离');
    return 20 * (Math.log10(4 * Math.PI / C) + Math.log10(f) + Math.log10(r));
  }
  function noise(b, t, nf) {
    positive(b, '带宽'); const ts = systemTemperature(t, nf);
    const wdb = db(K) + db(ts) + db(b);
    return { ts, wdb, dbm: wdb + 30, watts: linear(wdb), density: db(K) + db(ts) + 30 };
  }
  function radar(p) {
    ['f','r','pt','sigma','tau','b'].forEach(key => positive(p[key], key));
    finite(p.gt, '发射增益'); finite(p.gr, '接收增益');
    nonnegative(p.loss, '射频损耗'); nonnegative(p.processing, '处理损耗');
    const ts = systemTemperature(p.t, p.nf);
    const prdb = db(p.pt) + p.gt + p.gr + 20 * (Math.log10(C) - Math.log10(p.f)) + db(p.sigma)
      - 30 * Math.log10(4 * Math.PI) - 40 * Math.log10(p.r) - p.loss;
    const ndb = db(K) + db(ts) + db(p.b);
    return { ts, prdb, prdbm: prdb + 30, watts: linear(prdb), pre: prdb - ndb,
      single: prdb + db(p.tau) - db(K) - db(ts) - p.processing, rangeGain: db(p.b) + db(p.tau) };
  }
  function sar(p) {
    positive(p.n, '积累脉冲数'); if (!Number.isSafeInteger(p.n)) throw new Error('积累脉冲数须为安全范围内的整数');
    let sigma = p.sigma, area;
    if (p.target === 'distributed') {
      positive(p.az, '方位分辨率'); positive(p.b, '带宽');
      if (!Number.isFinite(p.angle) || p.angle <= 0 || p.angle >= 90) throw new Error('入射角须在 0° 与 90° 之间');
      finite(p.sigma0, '后向散射系数');
      area = positive(C / (2 * p.b * Math.sin(p.angle * Math.PI / 180)) * p.az, '分辨单元面积');
      sigma = positive(linear(p.sigma0) * area, '等效 RCS');
    }
    const base = radar({ ...p, sigma });
    const image = base.single + db(p.n);
    return { ...base, sigma, area, image, azGain: db(p.n), nesz: p.target === 'distributed' ? p.sigma0 - image : undefined };
  }
  function rangeTime(value, direction) {
    nonnegative(value, '距离 / 时延'); return direction === 'range' ? 2 * value / C : value * C / 2;
  }
  function doppler(value, f, direction) {
    finite(value, '速度 / 多普勒'); positive(f, '频率');
    return direction === 'velocity' ? 2 * value * f / C : value * C / (2 * f);
  }
  function power(value, unit) {
    finite(value, '输入');
    const wdb = unit === 'dBm' ? value - 30 : unit === 'dBW' ? value : db(positive(value, '功率')) + (unit === 'mW' ? -30 : 0);
    return { dBW: wdb, dBm: wdb + 30, W: linear(wdb), mW: positive(linear(wdb) * 1000, '毫瓦结果') };
  }
  function ratio(value, unit) {
    finite(value, '输入');
    const d = unit === 'dB' ? value : (unit === 'amplitude' ? 20 : 10) * Math.log10(positive(value, '比值'));
    return { dB: d, power: linear(d), amplitude: linear(d / 2) };
  }
  function base64(source, direction) {
    if (source.length > 1048576) throw new Error('文本过长，请限制在 1 Mi 个字符以内');
    if (direction === 'encode') {
      const bytes = new TextEncoder().encode(source);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    }
    const compact = source.replace(/\s/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact))
      throw new Error('请输入有效的标准 Base64（包含必要的 = 填充；不支持 URL-safe 字母表）');
    const binary = atob(compact);
    if (btoa(binary) !== compact) throw new Error('Base64 填充位无效');
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(binary, x => x.charCodeAt(0))); }
    catch { throw new Error('解码字节不是有效的 UTF-8 文本；此工具不处理二进制文件'); }
  }
  const api = { C, K, T0, db, fspl, noise, radar, sar, rangeTime, doppler, power, ratio, base64 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToolModels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
