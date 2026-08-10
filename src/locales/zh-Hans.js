/* Simplified Chinese. Standard mainland aviation terminology: 涡扇发动机 for
 * the turbofan, 涵道比 for the bypass ratio, 外涵道 for the bypass duct,
 * 增压级 for the booster, 附件机匣 for the accessory gearbox. Chinese uses the
 * decimal point, so the prose matches what Intl produces. */

export default {
  'app.title': '涡扇发动机 — 交互式三维模型',
  'app.loading': '正在装配发动机…',
  'panel.h1': '涡扇发动机',
  'panel.sub': '大涵道比涡扇发动机 · 交互式模型',

  'panel.flow.title': '气流',
  'panel.flow.hint': '冷的外涵道与热的射流',
  'panel.cut.title': '查看内部',
  'panel.cut.hint': '机匣剖开，可见转子',
  'panel.sound.title': '发动机声音',
  'panel.sound.hint': '由 N1 与 N2 合成',
  'panel.volume': '音量',

  'power.start': '起动发动机',
  'power.shutdown': '关闭发动机',
  'power.hint.starting': '起动机带转，点火…',
  'power.hint.stopping': '切断供油，转子惰转…',
  'power.hint.running': '切断供油，转子惰转',
  'power.hint.off': '起动、点火、加速至慢车',
  'mode.off': '已关车',
  'mode.start': '起动中',
  'mode.run': '运转中',
  'mode.stop': '停车 · 惰转',
  'panel.state': '状态',
  'panel.timescale': '时间倍率',
  'panel.throttle': '发动机功率（油门）',

  'gauge.n1.sub': '风扇',
  'gauge.n2.sub': '高压转子',
  'gauge.t4.sub': '高压涡轮前',
  'gauge.thrust.label': '推力',
  'gauge.thrust.sub': '计算值',

  'amb.title': '环境条件',
  'amb.altitude': '高度',
  'amb.isa': '相对标准大气偏差',
  'amb.rh': '相对湿度',
  'amb.t.sub': '外界大气',
  'amb.td.sub': '露点',
  'amb.e.sub': '水汽，Pa',
  'amb.rhi.sub': '相对于冰面',

  'trail.title': '凝结尾迹',
  'trail.eta': '推进效率',
  'trail.tform.sub': '低于此值时形成',
  'trail.tmix.sub': '喷口处',
  'verdict.none': '无尾迹',
  'verdict.short-lived': '短暂',
  'verdict.persistent': '持久',

  'hint.trail.persistent':
    '空气比阈值低 {margin} °C，因此形成尾迹；且相对于冰面过饱和，所以尾迹会扩散而不是蒸发。{where}。',
  'hint.trail.shortLived':
    '空气比阈值低 {margin} °C，因此形成尾迹；但相对于冰面未达饱和，所以冰晶在几秒内蒸发。{where}。',
  'hint.trail.none': '空气比阈值高 {margin} °C — 不会形成尾迹。{where}。',

  'where.higher.stop': '再高 {km} km 就不会形成了',
  'where.lower.stop': '再低 {km} km 就不会形成了',
  'where.higher.start': '再高 {km} km 就会开始形成',
  'where.lower.start': '再低 {km} km 就会开始形成',
  'where.nowhere': '在地面到 {max} km 之间，这样的空气不会有任何不同的表现',

  'cut.angle': '剖切角度',
  'cut.rotation': '剖切旋转',
  'explode.label': '分解模块',

  'toggle.xray': '透明机匣',
  'toggle.nacelle': '短舱',
  'toggle.labels': '模块标注',
  'toggle.lines': '流线',
  'toggle.haze': '尾喷气流',
  'toggle.trail': '凝结尾迹',
  'toggle.spin': '转子旋转',
  'toggle.orbit': '相机环绕',

  'footer.mouse': '左键 — 旋转 · 滚轮 — 缩放 · 右键 — 平移',
  'footer.keys1': 'Space — 气流 · C — 剖视 · X — 透视 · S — 声音',
  'footer.keys2': 'E — 起动/关车 · H — 尾喷气流 · T — 尾迹',
  'footer.keys3': '1…9、0 — 视角',

  'legend.title': '气流',
  'legend.bypass.name': '外涵道',
  'legend.bypass.text': ' —— 冷空气，海平面约 15…50 °C。占推力的 80 % 以下。',
  'legend.compression.name': '压缩',
  'legend.compression.text': ' —— 空气在压气机中被加热到 600 °C。',
  'legend.combustion.name': '燃烧',
  'legend.combustion.text': ' —— 火焰筒内 1800…2000 °C。',
  'legend.jet.name': '高温射流',
  'legend.jet.text': ' —— 经涡轮和尾喷管膨胀，550 °C。',

  'stations.head.station': '截面',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': '进气道',
  'station.bypass': '外涵道',
  'station.booster': '增压级后',
  'station.hpc': '高压压气机后',
  'station.combustor': '燃烧室',
  'station.hpt': '高压涡轮后',
  'station.nozzle': '喷口',

  'view.overview': '总览',
  'view.cutaway': '剖视',
  'view.front': '正前方',
  'view.fan': '风扇',
  'view.hpc': '高压压气机',
  'view.combustor': '燃烧室',
  'view.turbine': '涡轮',
  'view.nozzle': '尾喷管与射流',
  'view.behind': '自后方，位于射流中',
  'view.contrail': '凝结尾迹',

  'label.nacelle': '短舱',
  'label.reverser': '反推',
  'label.fan': '风扇',
  'label.booster': '增压级',
  'label.hpc': '高压压气机',
  'label.combustor': '燃烧室',
  'label.hpt': '高压涡轮',
  'label.lpt': '低压涡轮',
  'label.nozzle': '尾喷管',
  'label.shafts': '低压 / 高压轴',
  'label.accessory': '附件机匣',

  'module.nacelle.title': '短舱与进气道',
  'module.nacelle.info':
    '带防冰系统的进气道筒体、风扇整流罩和外涵道。最大尺寸 2.44 m，至风扇喷口长度 3.18 m。下部和唇口被压扁（所谓“仓鼠颊囊”）：737 的机翼离地面很近。',
  'module.reverser.title': '反推力装置',
  'module.reverser.info':
    '外涵道叶栅式反推力装置。移动整流罩后移 0.45 米，露出导流叶栅，十二扇阻流门横越涵道——它们由连杆牵引至固定壁面，而非直接驱动，因此只在行程末段才关闭。内涵道不受影响：只有风扇气流被折转，反推时约产生起飞推力的五分之一。',
  'module.fan.title': '风扇（N1）',
  'module.fan.info':
    '24 片宽弦叶片，最大弦长 0.279 m。直径 1.549 m，起飞状态 5175 rpm。通过将空气送入外涵道，产生高达 80 % 的推力。涵道比 5.1。',
  'module.booster.title': '增压级，低压压气机（N1）',
  'module.booster.info':
    '低压压气机：风扇轴上的 3 级。在高压压气机之前把内涵空气增压到约 2.5 bar。',
  'module.hpc.title': '高压压气机（N2）',
  'module.hpc.info':
    '9 级。将空气压缩约 11 倍；连同风扇和增压级，总增压比约为 28，温度升至 550-600 °C。部分空气被引出，用于涡轮冷却和空调。',
  'module.combustor.title': '燃烧室',
  'module.combustor.info':
    '带 20 个燃油喷嘴的环形燃烧室。燃油在 1800-2000 °C 下燃烧；来自高压压气机的空气对火焰筒进行气膜冷却。只有约 25 % 的空气参与燃烧，其余用于冷却和掺混。',
  'module.hpt.title': '高压涡轮（N2）',
  'module.hpt.info':
    '1 级。带内部气冷和陶瓷涂层的单晶叶片工作在 1500 °C 的燃气中，高于合金的熔点。一级就够，是因为它在高叶尖速度下承担了很大的压降：它以约 14 500 rpm 驱动高压压气机。',
  'module.lpt.title': '低压涡轮（N1）',
  'module.lpt.info':
    '4 级大直径涡轮。从燃气中提取剩余能量，通过一根长轴驱动风扇和增压级（起飞状态 5175 rpm）。',
  'module.exhaust.title': '涡轮后机匣与内涵喷管',
  'module.exhaust.info':
    '后机匣的支板支承低压轴轴承，并把燃气的旋流整直。中心锥形成喷管；射流以 400-500 m/s、550-600 °C 排出。',
  'module.cowl.title': '外涵道内壁',
  'module.cowl.info': '把冷的外涵道与热的核心机隔开的壁面。其内部布置着附件、管路和隔热层。',
  'module.shafts.title': '转子轴',
  'module.shafts.info':
    '两根同轴的轴：低压轴（风扇 + 增压级 + 低压涡轮）穿过空心的高压轴（高压压气机 + 高压涡轮）内部。两个转子以不同转速独立旋转。',
  'module.accessory.title': '附件机匣与附件',
  'module.accessory.info':
    '由高压轴引出的锥齿轮传动驱动燃油泵、滑油泵、发电机和起动机。引气管路和 FADEC 组件也在这里。在 737 上，机匣从发动机下方移到了侧面——正是这一点使短舱底部得以压扁。',
};
