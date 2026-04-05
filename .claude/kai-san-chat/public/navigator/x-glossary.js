/**
 * x-glossary.js — 用語辞書（自然言語 + 具体数字 + なぜ）
 *
 * 金融用語: 数式 + 具体的な数字例 + なぜそうなるか
 * システム用語: 自然言語のみ（内部用語ゼロ）
 *
 * 全用語: mouseover popup（短い説明 + 具体例）→ リンクで詳細101 HTML（別窓）
 */

'use strict';

var GLOSSARY = {
  // ===== GCC（ブランド用語 — 数式なし、考え方を伝える）=====

  gcc: {
    display: 'GCC',
    short: '企業の価値を3つの軸で見る考え方',
    body: '会社の価値を「成長しているか」「効率よく稼いでいるか」「信頼されているか」の3つで見ます。\n\n例えば、売上が伸びていても（Growth◎）、お金の使い方が下手なら（Connection✕）、本当の価値は生まれていません。3つ揃って初めて価値が創られます。',
    link101: '/navigator/101/gcc.html'
  },
  growth: {
    display: 'Growth（成長）',
    short: 'この会社は伸びているか？',
    body: '売上が去年より増えているか。新しい市場に挑戦しているか。将来の種を撒いているか。\n\n例: 去年の売上500億円 → 今年530億円なら、成長率6%。業界平均3%を超えていれば「成長力がある」と言えます。\n\nなぜ大事か: 成長しない会社は縮んでいく。お客様が増えないと、いずれ売上も利益も減ります。',
    link101: '/navigator/101/growth.html'
  },
  connection: {
    display: 'Connection（つながり）',
    short: '使ったお金でちゃんと稼げているか？',
    body: '設備や人材に投資したお金が、どれだけの利益を生んでいるか。社内の部門がうまく連携しているか。\n\n例: 200億円投資して16億円の利益 → ROIC 8%。「200億円を銀行に預けるより、事業に使った方が儲かる」という状態です。\n\nなぜ大事か: たくさん投資しても利益が出なければ、お金を燃やしているのと同じです。',
    link101: '/navigator/101/connection.html'
  },
  confidence: {
    display: 'Confidence（信頼）',
    short: '投資家や銀行から信頼されているか？',
    body: '信頼が高い会社は、お金を安く集められます。信頼が低い会社は、高い利息を求められます。\n\n例: 信頼が高い会社のWACC 5% vs 信頼が低い会社のWACC 10%。同じ売上でも、信頼が高い方が2倍の価値を創れます。\n\nなぜ大事か: 信頼は10年かけて積み上げ、1日の不祥事で崩壊します。最も守るべき資産です。',
    link101: '/navigator/101/confidence.html'
  },

  // ===== 財務用語（数式 + 具体数字 + なぜ）=====

  mvc: {
    display: 'MVC',
    short: '毎月の「本当の儲け」の金額',
    body: 'Monthly Value Created。会計上の利益ではなく、資本コストを差し引いた「本当の価値創造額」です。\n\nMVC = 投下資本 ×（ROIC − WACC）÷ 12\n\n例: 投下資本300億円、ROIC 8%、WACC 6%の場合\nMVC = 300億 ×（8% − 6%）÷ 12 = 5,000万円/月\n\nつまり毎月5,000万円の価値を創っています。逆にROIC 5%なら\nMVC = 300億 ×（5% − 6%）÷ 12 = −2,500万円/月\n毎月2,500万円の価値を壊しています。\n\nなぜ大事か: 会計上は黒字でも、株主が求めるリターン（WACC）を下回れば、実は価値を壊しています。MVCはそれを正直に教えてくれます。',
    link101: '/navigator/101/mvc.html'
  },
  yvc: {
    display: 'YVC',
    short: '1年間の「本当の儲け」の金額',
    body: 'Yearly Value Created。MVCの年間版です。投資家向けにはEVA（経済的付加価値）とも呼ばれます。\n\nYVC = 投下資本 ×（ROIC − WACC）\n\n例: 投下資本300億円、ROIC 8%、WACC 6%の場合\nYVC = 300億 ×（8% − 6%）= 6億円/年\n\n1年間で6億円の真の価値を創造。これが毎年続けば、株価は上がるべきです。\n\nなぜ大事か: 決算書の「純利益」より正直な数字です。資本のコストまで考えた、本当の企業の実力を示します。',
    link101: '/navigator/101/yvc.html'
  },
  sg100y: {
    display: 'SG100Y',
    short: 'この会社が100年間で創る価値の合計',
    body: 'Sustainable Growth 100 Years。MVCを100年分、今の価値に換算して合計した金額です。\n\nSG100Y = Σ (X − Y) ÷ (1 + Z)^t\n  X = 創造された価値の額\n  Y = そのために費やされた額\n  Z = 割引率（WACC）\n  t = 0年目, 1年目, ... 100年目\n\n例: 毎月MVC 5,000万円が100年続くと仮定すると\nSG100Y ≒ 100億円（WACCで割り引くため単純合計より小さくなる）\n\nなぜ大事か: 会社の「今」だけでなく「100年先」まで含めた本当の価値を測ります。短期の利益に飛びつかず、長期で価値を積み上げる経営の指針です。',
    link101: '/navigator/101/sg100y.html'
  },
  wacc: {
    display: 'WACC',
    short: 'お金を集めるのにかかるコスト',
    body: 'Weighted Average Cost of Capital。株主と銀行にいくら払わないといけないかの平均コストです。\n\n例: 株主が「8%のリターンがほしい」、銀行が「2%の利息」、株主の出資が7割・銀行が3割なら\nWACC = 8% × 0.7 + 2% × 0.3 = 6.2%\n\nつまり「会社は最低でも6.2%の利益を出さないと、お金を集めるコストすら払えない」ということです。\n\nなぜ大事か: WACCより高く稼げば価値創造、低ければ価値破壊。この数字が全ての判断基準になります。信頼される会社ほどWACCは低くなり、価値を創りやすくなります。',
    link101: '/navigator/101/wacc.html'
  },
  roic: {
    display: 'ROIC',
    short: '投資したお金がどれだけ稼いでいるか',
    body: 'Return on Invested Capital。事業に投下した資本の利益率です。\n\nROIC = 税引後営業利益 ÷ 投下資本\n\n例: 税引後営業利益24億円、投下資本300億円の場合\nROIC = 24億 ÷ 300億 = 8%\n\n「300億円を事業に使って、毎年24億円（8%）を稼いでいる」という意味です。\n\nなぜ大事か: ROICがWACCを上回っていれば「投資して正解」。下回っていれば「銀行に預けた方がマシだった」ということ。経営の通信簿です。',
    link101: '/navigator/101/roic.html'
  },
  nopatm: {
    display: 'NOPATM',
    short: '売上100円のうち、本業でいくら残るか',
    body: 'NOPAT Margin。売上から全てのコストと税金を引いた後に残る、本業の利益率です。\n\n例: 売上500億円、税引後営業利益40億円の場合\nNOPATM = 40億 ÷ 500億 = 8%\n\n「売上100円のうち8円が本業の純粋な儲け」です。\n\nなぜ大事か: この数字が大きいほど「筋肉質な経営」。小さいと「売上は大きいのに手元に残らない体質」です。',
    link101: '/navigator/101/nopatm.html'
  },
  ics: {
    display: 'IC/S',
    short: '100円売るのに何円の元手が必要か',
    body: '投下資本 ÷ 売上高。商売の「重さ」を示す指標です。\n\n例: 投下資本300億円、売上500億円の場合\nIC/S = 300億 ÷ 500億 = 0.6\n\n「100円売るのに60円の設備や資金が必要」という意味です。\n\nなぜ大事か: IC/Sが小さい会社は「身軽」で、少ない投資で大きく稼げます。大きい会社は「重い」ので、設備投資の判断が経営を左右します。',
    link101: '/navigator/101/ics.html'
  },
  spread: {
    display: 'スプレッド',
    short: '「稼ぐ力」から「お金のコスト」を引いた差',
    body: 'ROIC − WACC。この差がプラスなら価値を創造、マイナスなら価値を破壊しています。\n\n例: ROIC 8%、WACC 6%の場合\nスプレッド = 8% − 6% = +2%\n\n「資本コストを超えて2%分の価値を創っている」ということです。\n\n例: ROIC 5%、WACC 6%の場合\nスプレッド = 5% − 6% = −1%\n\n「毎年1%分の価値を壊している」ということ。決算書が黒字でも、です。\n\nなぜ大事か: 全ての経営判断は「スプレッドを広げるかどうか」で評価できます。最もシンプルで正直な経営指標です。',
    link101: '/navigator/101/spread.html'
  },

  // ===== システム用語（自然言語のみ。内部用語ゼロ）=====

  pf: {
    display: '自動処理',
    short: '一度作れば、毎回同じ品質で動く仕組み',
    body: '人間が手作業でやると、疲れや見落としでミスが出ます。自動処理にすると、100回やっても100回とも同じ品質です。\n\n例: WACC計算を毎月手で計算 → 30分、時々計算ミス\n自動処理にした後 → 0.1秒、ミスゼロ\n\n【AIが裏でやっていること】\nPythonという計算専用の言語で、数式をそのままプログラムにしています。電卓の超高性能版です。人間の気分や疲れに影響されないので、月曜朝でも金曜夕方でも全く同じ結果が出ます。\n\nなぜ大事か: 作れば作るほど、あなたの仕事は速く・正確になります。半年後には「手でやっていた頃が信じられない」と感じるはずです。',
    link101: '/navigator/101/pf.html'
  },
  macro: {
    display: 'マクロ',
    short: '「いつもの作業」をワンクリックで再現',
    body: '毎月やるレポート作成、毎週の分析チェック。やることは同じなのに、毎回手順を思い出すのは面倒です。\n\nマクロは「どのデータを使い」「何を作り」「どこに保存するか」をセットで記憶します。\n\n例: 「月次ROIC報告」マクロ → ワンクリック → 最新データで更新されたレポートが指定フォルダに保存\n\nなぜ大事か: 定型業務を自動化すれば、あなたは「考える仕事」に集中できます。',
    link101: '/navigator/101/macro.html'
  },
  fc: {
    display: '能力',
    short: 'Kai-sanができること全体',
    body: '分析の方法、計算の仕組み、レポートの書き方、専門知識。Kai-sanが持っている「引き出し」の全体です。\n\n例: 今日の能力 = WACC計算 + GCC評価 + 競合比較 + レポート作成\n半年後の能力 = 上記 + あなたの会社の固有パターン + 過去の判断記録\n\nなぜ大事か: 使うほど能力が増え、あなたへの提案が的確になります。最初は70点でも、半年で95点になります。',
    link101: '/navigator/101/fc.html'
  },
  x_data: {
    display: 'データ',
    short: 'あなたのPCにある仕事の材料',
    body: 'フォルダの中のファイル、メール、データベース。Kai-sanが分析する「材料」です。\n\n例: 営業部のフォルダ → 売上データ → Growth分析の材料\n経理部のフォルダ → コストデータ → Connection分析の材料\n\nなぜ大事か: 材料の質が結果の質を決めます。整理されたデータからは正確な分析が出ます。散らかったデータからは推測しか出ません。',
    link101: '/navigator/101/x-data.html'
  },
  fp: {
    display: '指示',
    short: 'あなたがKai-sanに伝える「やりたいこと」',
    body: '短い日本語で十分です。能力とデータが豊かなほど、短い指示で良い結果が出ます。\n\n例:\n最初の頃: 「FactSetの6674のROICをリーン投下資本で計算してWACCと比較して…」（長い）\n半年後:   「GSユアサ分析して」（これだけで全部出る）\n\nなぜ短くなるか: Kai-sanがあなたの会社のことを覚え、どう分析すべきか学習するからです。',
    link101: '/navigator/101/fp.html'
  },
  y_output: {
    display: '成果物',
    short: 'Kai-sanが作る出力',
    body: 'レポート、分析表、提案書など。用途に応じた形式で出力します。\n\n変換の流れ:\n文書系: Markdown → HTML → PDF → PowerPoint / Word\nデータ系: Markdown → CSV → Excel\n\n例: 「月次ROIC報告を作って」→ HTML（画面で確認）→ PDF（印刷・メール添付）→ PPTX（会議で投影）\n\nなぜ大事か: 同じ分析結果を、相手に合った形で届けられます。社長にはPDF、部下にはExcel、投資家にはPPTX。',
    link101: '/navigator/101/y-output.html'
  },

  // ===== 仕組みの用語（自然言語のみ）=====

  navigator: {
    display: 'ナビゲーター',
    short: 'あなたの仕事の全体を見渡す案内図',
    body: '「どの能力を使い」「どのデータを見て」「何を作り」「どこに届けるか」を一目で見渡せる画面です。\n\nカーナビのようなものです。目的地（やりたいこと）を伝えれば、最適なルート（手順）を案内します。\n\nなぜ大事か: 仕事の全体像が見えると、何から手をつけるべきか迷わなくなります。迷い = 時間の無駄 = 価値の損失です。',
    link101: '/navigator/101/navigator.html'
  },
  folder_matrix: {
    display: 'フォルダのつながり図',
    short: 'フォルダ同士の情報の流れを可視化した表',
    body: '仕事のフォルダは独立しているように見えて、実は情報が行き来しています。\n\n例:\n営業部 → 経理部: 売上データを毎月送っている\n人事部 ↔ 全部門: 人員情報を相互に更新している\n社長室 ← 全部門: 月次報告を受けている\n\nなぜ大事か: つながりが見えると「どこで情報が詰まっているか」「どの部門の連携が弱いか」が分かります。これがConnection（つながり）の改善ポイントです。',
    link101: '/navigator/101/folder-matrix.html'
  },
  stakeholder_matrix: {
    display: '関係者のつながり図',
    short: '誰と誰が、どれくらいやり取りしているかの表',
    body: 'メールの送受信パターンから、あなたの仕事の「人のつながり」を可視化します。\n\n例:\n田中部長 ↔ 佐藤CFO: 毎週やり取り（予算管理）\nあなた → 顧客A: 毎日連絡（営業活動）\nあなた ← 投資家B: 四半期ごと（IR質問）\n\nなぜ大事か: 重要な人との連絡が途絶えていたり、本来つながるべき人同士がつながっていなかったりすることが見えます。',
    link101: '/navigator/101/stakeholder-matrix.html'
  }
};

/**
 * 101 tooltip system — mouseover popup + link to detailed HTML
 */
function initGlossary() {
  var tooltip = document.getElementById('tooltip-101');
  if (!tooltip) return;

  var titleEl = tooltip.querySelector('.tooltip-title');
  var bodyEl = tooltip.querySelector('.tooltip-body');
  var linkEl = tooltip.querySelector('.tooltip-link');

  document.addEventListener('mouseover', function(e) {
    var termEl = e.target.closest('.term');
    if (!termEl) return;

    var key = termEl.dataset.term;
    var entry = GLOSSARY[key];
    if (!entry) return;

    titleEl.textContent = entry.display + ' — ' + entry.short;
    bodyEl.textContent = entry.body;
    linkEl.href = entry.link101;
    linkEl.style.display = entry.link101 ? 'block' : 'none';

    var rect = termEl.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';

    // Keep within viewport
    var tipRect = tooltip.getBoundingClientRect();
    if (tipRect.right > window.innerWidth - 16) {
      tooltip.style.left = (window.innerWidth - tipRect.width - 16) + 'px';
    }
    if (tipRect.bottom > window.innerHeight - 16) {
      tooltip.style.top = (rect.top - tipRect.height - 8) + 'px';
    }
  });

  document.addEventListener('mouseout', function(e) {
    var termEl = e.target.closest('.term');
    if (!termEl) return;
    setTimeout(function() {
      if (!tooltip.matches(':hover')) {
        tooltip.style.display = 'none';
      }
    }, 200);
  });

  tooltip.addEventListener('mouseleave', function() {
    tooltip.style.display = 'none';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlossary);
} else {
  initGlossary();
}
