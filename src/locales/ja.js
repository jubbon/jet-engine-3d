/* Japanese. Standard aero-engine terminology: 高圧圧縮機 and 低圧タービン for
 * the spools, バイパスダクト for the bypass duct, バイパス比 for the bypass
 * ratio, 補機ギアボックス for the accessory gearbox, 動翼 for a rotor blade.
 * Japanese uses the decimal point, so the prose matches what Intl produces. */

export default {
  'app.title': 'ターボファンエンジン — インタラクティブ 3D モデル',
  'app.loading': 'エンジンを組み立て中…',
  'panel.h1': 'ターボファンエンジン',
  'panel.sub': '高バイパス比ターボファン · インタラクティブモデル',

  'panel.flow.title': '空気の流れ',
  'panel.flow.hint': '冷たいバイパスダクトと高温のジェット',
  'panel.cut.title': '内部を見る',
  'panel.cut.hint': 'ケーシングを断面表示し、ローターを見る',
  'panel.sound.title': 'エンジン音',
  'panel.sound.hint': 'N1 と N2 から合成',
  'panel.volume': '音量',

  'power.start': 'エンジンを始動',
  'power.shutdown': 'エンジンを停止',
  'power.hint.starting': 'スターターでクランキング、着火…',
  'power.hint.stopping': '燃料カット、ローターが惰性回転中…',
  'power.hint.running': '燃料遮断、ローターの惰性回転',
  'power.hint.off': 'スターター、着火、アイドルまで加速',
  'mode.off': '停止中',
  'mode.start': '始動中',
  'mode.run': '運転中',
  'mode.stop': '停止 · 惰性回転',
  'panel.state': '状態',
  'panel.timescale': '時間スケール',
  'panel.throttle': 'エンジン出力（スロットル）',
  'panel.rev.title': '逆推力装置',
  'panel.reverser': '逆推力',
  'rev.stowed': '格納',
  'rev.deploying': '展開中',
  'rev.deployed': '展開',
  'rev.stowing': '格納中',
  'rev.hint.deploy': 'スリーブが後退し、ドアがバイパスダクトを塞ぎます',
  'rev.hint.stow': 'ドアが開き、スリーブが元の位置に戻ります',
  'rev.hint.moving': 'スリーブが動作中、エンジンはアイドルに保たれます',
  'rev.hint.off': 'エンジンが運転中である必要があります',

  'gauge.n1.sub': 'ファン',
  'gauge.n2.sub': '高圧ローター',
  'gauge.t4.sub': '高圧タービン前',
  'gauge.thrust.label': '推力',
  'gauge.thrust.sub': '計算値',

  'amb.title': '外気条件',
  'amb.altitude': '高度',
  'amb.isa': '標準大気からの偏差',
  'amb.rh': '相対湿度',
  'amb.t.sub': '外気',
  'amb.td.sub': '露点',
  'amb.e.sub': '水蒸気, Pa',
  'amb.rhi.sub': '氷に対して',

  'trail.title': '飛行機雲',
  'trail.eta': '推進効率',
  'trail.tform.sub': 'これ以下で発生',
  'trail.tmix.sub': 'ノズルにて',
  'verdict.none': '発生なし',
  'verdict.short-lived': '短時間',
  'verdict.persistent': '持続',

  'hint.trail.persistent':
    '外気はしきい値より {margin} °C 低いため飛行機雲が発生します。氷に対して過飽和なので、雲は蒸発せずに広がります。{where}。',
  'hint.trail.shortLived':
    '外気はしきい値より {margin} °C 低いため飛行機雲が発生します。ただし氷に対しては飽和していないので、氷晶は数秒で蒸発します。{where}。',
  'hint.trail.none': '外気はしきい値より {margin} °C 高く、飛行機雲は発生しません。{where}。',

  'where.higher.stop': '{km} km 高ければ発生しなくなります',
  'where.lower.stop': '{km} km 低ければ発生しなくなります',
  'where.higher.start': '{km} km 高ければ発生し始めます',
  'where.lower.start': '{km} km 低ければ発生し始めます',
  'where.nowhere': '地上から {max} km までのどこでも、この空気の振る舞いは変わりません',

  'cut.angle': '断面の角度',
  'cut.rotation': '断面の回転',
  'explode.label': 'モジュールを分解',

  'toggle.xray': 'ケーシングを透過',
  'toggle.nacelle': 'ナセル',
  'toggle.labels': 'モジュール名',
  'toggle.lines': '流線',
  'toggle.haze': '排気ガス',
  'toggle.trail': '飛行機雲',
  'toggle.spin': 'ローターの回転',
  'toggle.orbit': 'カメラの周回',

  'footer.mouse': '左ボタン — 回転 · ホイール — ズーム · 右ボタン — 平行移動',
  'footer.keys1': 'Space — 流れ · C — 断面 · X — 透過 · S — 音',
  'footer.keys2': 'E — 始動/停止 · R — 逆推力 · H — 排気 · T — 飛行機雲',
  'footer.keys3': '1…9、0 — 視点',

  'legend.title': '流れ',
  'legend.bypass.name': 'バイパスダクト',
  'legend.bypass.text': ' —— 冷たい空気、海面上で約 15…50 °C。推力の最大 80 % を担います。',
  'legend.compression.name': '圧縮',
  'legend.compression.text': ' —— 圧縮機で空気は 600 °C まで加熱されます。',
  'legend.combustion.name': '燃焼',
  'legend.combustion.text': ' —— ライナー内で 1800…2000 °C。',
  'legend.jet.name': '高温のジェット',
  'legend.jet.text': ' —— タービンとノズルでの膨張、550 °C。',

  'stations.head.station': '断面',
  'stations.head.t': 'T, °C',
  'stations.head.p': 'P, bar',
  'station.intake': 'インテーク',
  'station.bypass': 'バイパスダクト',
  'station.booster': 'ブースター後',
  'station.hpc': '高圧圧縮機後',
  'station.combustor': '燃焼器',
  'station.hpt': '高圧タービン後',
  'station.nozzle': 'ノズル出口',

  'view.overview': '全体',
  'view.cutaway': '断面',
  'view.front': '正面',
  'view.fan': 'ファン',
  'view.hpc': '高圧圧縮機',
  'view.combustor': '燃焼器',
  'view.turbine': 'タービン',
  'view.nozzle': 'ノズルとジェット',
  'view.behind': '後方から、ジェットの中で',
  'view.contrail': '飛行機雲',

  'label.nacelle': 'ナセル',
  'label.reverser': '逆推力装置',
  'label.fan': 'ファン',
  'label.booster': 'ブースター',
  'label.hpc': '高圧圧縮機',
  'label.combustor': '燃焼器',
  'label.hpt': '高圧タービン',
  'label.lpt': '低圧タービン',
  'label.nozzle': 'ノズル',
  'label.shafts': '低圧 / 高圧シャフト',
  'label.accessory': '補機ギアボックス',

  'module.nacelle.title': 'ナセルと空気取入口',
  'module.nacelle.info':
    '防氷装置付きのインテークバレル、ファンカウル、そしてバイパスダクト。最大寸法 2.44 m、ファンノズル出口までの長さ 3.18 m。下部とリップは平らにつぶされています（いわゆる「ハムスターの頬袋」）。737 の主翼は地面に近い位置にあるためです。',
  'module.reverser.title': '逆推力装置',
  'module.reverser.info':
    'バイパスダクトのカスケード式逆推力装置。スリーブが 0.45 m 後退して整流ベーンを露出させ、12 枚のブロッカードアがダクトを塞ぐ。ドアは駆動されるのではなく固定壁へのリンクに引き回されるため、行程の終盤になって初めて閉じる。コア流はそのままで、転向するのはファン空気だけ。逆推力は離陸推力のおよそ五分の一になる。',
  'module.fan.title': 'ファン（N1）',
  'module.fan.info':
    '幅広コードの動翼 24 枚、最大コード長 0.279 m。直径 1.549 m、離陸出力で 5175 rpm。空気をバイパスダクトへ送り込むことで推力の最大 80 % を生み出します。バイパス比 5.1。',
  'module.booster.title': 'ブースター、低圧圧縮機（N1）',
  'module.booster.info':
    '低圧圧縮機：ファンシャフト上の 3 段。高圧圧縮機の手前でコア空気を約 2.5 bar まで昇圧します。',
  'module.hpc.title': '高圧圧縮機（N2）',
  'module.hpc.info':
    '9 段。空気を約 11 倍に圧縮します。ファンとブースターと合わせて全体圧力比は約 28 となり、550-600 °C まで昇温します。一部の空気はタービン冷却と空調のために抽気されます。',
  'module.combustor.title': '燃焼器',
  'module.combustor.info':
    '20 本の燃料ノズルを備えた環状燃焼器。燃料は 1800-2000 °C で燃焼し、高圧圧縮機からの空気がライナーをフィルム冷却します。燃焼に関与するのは空気の約 25 % だけで、残りは冷却と希釈に使われます。',
  'module.hpt.title': '高圧タービン（N2）',
  'module.hpt.info':
    '1 段。内部空冷とセラミックコーティングを施した単結晶動翼が、合金の融点を超える 1500 °C のガス中で働きます。1 段で足りるのは、高い翼速度で大きな圧力降下を受け持つからです。高圧圧縮機を約 14 500 rpm で駆動します。',
  'module.lpt.title': '低圧タービン（N1）',
  'module.lpt.info':
    '大直径の 4 段。ガスから残りのエネルギーを取り出し、長いシャフトを介してファンとブースターを駆動します（離陸出力で 5175 rpm）。',
  'module.exhaust.title': 'タービン後部フレームとコアノズル',
  'module.exhaust.info':
    '後部フレームのストラットが低圧シャフトの軸受を支え、ガスの旋回を整流します。プラグがノズルを形づくり、ジェットは 400-500 m/s、550-600 °C で流出します。',
  'module.cowl.title': 'バイパスダクトの内壁',
  'module.cowl.info':
    '冷たいバイパスダクトと高温のコアを隔てる壁。その内側に補機、配管、断熱材が収められています。',
  'module.shafts.title': 'ローターシャフト',
  'module.shafts.info':
    '同軸の 2 本のシャフト：低圧シャフト（ファン + ブースター + 低圧タービン）が中空の高圧シャフト（高圧圧縮機 + 高圧タービン）の内側を通ります。2 つのローターは異なる回転数で独立して回ります。',
  'module.accessory.title': '補機ギアボックスと補機',
  'module.accessory.info':
    '高圧シャフトからのベベルギア駆動が燃料ポンプ、オイルポンプ、発電機、スターターを回します。抽気配管と FADEC ユニットもここにあります。737 ではギアボックスをエンジンの下から側面へ移しており、それによってナセル下部を平らにすることができました。',

  /* ------------------------ compressor stability ---------------------- */
  'panel.stability': '安定性',
  'panel.sm': 'サージマージン',
  'surge.clear': '安定',
  'surge.surging': 'サージ',
  'surge.stall': 'ストール固定',
  'surge.hint.clear': '圧縮機は余裕の内側で働いています。スロットルをアイドルから一気に全開まで動かすと、そうではなくなります。燃料は数分の一秒で届くのに対しロータは数秒かかり、その間、燃焼器は圧縮機がまだ達していない回転数に見合う燃料を受け取ります。',
  'surge.hint.surging': '流れが崩れ、ガスが毎秒数回、吸気口から前方へ吹き出しています。いまスロットルを戻せば回復します。上げたままにすると固定します。',
  'surge.hint.stall': '固定したストールです。ロータの回転数は低いまま留まり、ガス経路は過熱し、推力は失われました。スロットルをどう動かしても解消せず、停止するほかありません。',
  'surge.hint.off': 'エンジンが運転中である必要があります',
};
