# 小工具

独立静态区域 `/tools/`，与 `/radar/` 和 `/sky/` 并列。没有运行时依赖、网络请求、分析脚本或参数持久化。页面实时计算、单位切换保持物理量、结果复制包含当前参数。每个工具可通过锚点直达。另提供 UTF-8 文本的标准 Base64 编解码（允许空白，要求正确填充与有效 UTF-8）；空文本与 BOM 可往返保留，拒绝二进制内容。Base64 结果仅复制输出文本。

## 物理约定

- 常量：c = 299792458 m/s，k = 1.380649e-23 J/K。
- FSPL：20 log10(4πRf/c)，是远场自由空间单程扩散损耗，不是完整雷达回波预算。
- 单脉冲：Pr = Pt Gt Gr λ² σ / ((4π)³ R⁴ Lrf)。输出接收峰值功率和单脉冲匹配滤波后 SNR = Pr τ / (k Tsys Lp)。采用复基带能量 / 白噪声谱密度约定。带宽内输入 SNR = Pr/(k Tsys B)，距离处理增益 Bτ 只用于说明从输入 SNR 到能量 SNR 的关系，绝不重复相乘。
- 温度：NF 参考温度固定 T0 = 290 K，F = 10^(NF/10)，Te = T0(F−1)，Tsys = Tant + Te。仅 Tant = T0 时使用 kTantBF / kTB+NF。所有温度、功率与损耗均在同一接收输入参考面定义。
- SAR 点目标：SNRimage = N Pr τ / (k Tsys Lp)，N 为有效积累的整数脉冲数，输入非起伏 RCS。假设每个脉冲能量、天线增益与距离相同，目标静止，距离迁移及相位已补偿，噪声独立，等权相干积累；增益为 N 而非 N²。射频总损耗和处理损耗分别输入，NF 不重复计入损耗。
- SAR 分布式目标：平坦地面、均匀 σ⁰、局部恒定入射角 θ（相对地面法线），单个矩形地面分辨单元平均 RCS 近似为 σ⁰ A，A = [c/(2B sinθ)] δaz；此模式将 B 同时用作信号带宽与等效噪声带宽。δaz 是给定的地面方位分辨率，不由 N 推算。NESZ = σ⁰/SNRimage（线性）。这是显式简化单元能量预算，不是适用于所有条带/聚束/双站 SAR 的通式。对像元加权或加窗需另外修正等效面积与处理损耗。未验证 N 与分辨率的几何可实现性；不包含散斑、杂波、模糊、多视、地形起伏及非均匀天线图。输出为平均信号与热噪声功率比，不是检测概率或散斑对比度。
- 时延：τecho = 2R/c；多普勒：fd = 2 vr f/c，接近为正，低速窄带单站模型，未考虑 PRF 折叠。
- dB：功率比 10 log10，幅度模比 20 log10；幅度到功率比要求相同阻抗。W、mW、线性比值须为正，拒绝空白、非法和超出浮点可表示范围的结果。

## 参考

- [ITU-R P.525 自由空间衰减](https://www.itu.int/rec/R-REC-P.525/en)
- [MathWorks 单脉冲能量雷达方程](https://www.mathworks.com/help/radar/ref/radareqsnr.html)
- [MathWorks SAR 处理与几何说明](https://www.mathworks.com/help/radar/ug/airborne-sar-system-design.html)
- [MathWorks NF 参考温度](https://www.mathworks.com/help/phased/ref/systemp.html)

## 验证

无需安装运行时依赖：`node --test tests/models.test.cjs`。

数值测试包括独立 FSPL 算例、MathWorks 单脉冲公开参考值（5.5868 dB）、距离四次方缩放、损耗、带宽与能量 SNR、N=1 退化、积累增益、分布式单元面积与 NESZ、正负速度双向换算、dB/功率/幅度参考值及无效输入。

`tests/browser.cjs` 使用开发环境的 Playwright 运行浏览器验证；启动本地 HTTP 服务后设置 `BASE_URL`（默认为 http://127.0.0.1:8765）。不需要 Playwright 访问网站。
