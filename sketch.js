// 測驗系統的核心變數
let quizTable;
let questions = [];
let questionImages = {}; // 用來儲存預載入的圖片
let currentQuestionIndex = 0;
let score = 0;
let currentShuffledOptions = []; // 儲存當前問題隨機排序後的選項
let gameState = 'LOADING'; // 遊戲狀態: LOADING, START, QUIZZING, RESULTS

// UI 變數
let optionButtons = []; // 選項按鈕
let startButton, retryButton;
let questionP; // 用來顯示問題的 HTML 段落元素
let feedbackText = ''; // 答題回饋

// 特效變數
let cursorParticles = []; // 游標粒子
let selectionEffect = null; // 點擊選項的特效
let resultParticles = []; // 最終成績的動畫粒子

// 滾動變數
let scrollY = 0;
let contentHeight = 0;

// === SCORM 變數 ===
let startTime;

// === 1. p5.js 載入階段 ===

function preload() {
  // 載入 CSV 檔案，指定 'csv' 格式和 'header' (第一行是標頭)
  quizTable = loadTable('quiz.csv', 'csv', 'header', () => {
    // 這個回呼函式會在 CSV 載入後執行
    // 遍歷 CSV 載入所有圖片路徑
    for (let row of quizTable.getRows()) {
      const imagePaths = [
        row.getString('imgA'),
        row.getString('imgB'),
        row.getString('imgC'),
        row.getString('imgD')
      ];
      for (const path of imagePaths) {
        // 如果路徑存在且尚未載入
        if (path && !questionImages[path]) {
          questionImages[path] = loadImage(path);
        }
      }
    }
  });
}

// === 2. p5.js 設定階段 ===

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Arial'); // 設定一個通用的字體

  // 解析 CSV 資料
  parseQuizData();

  // 初始化選項按鈕的結構
  for (let i = 0; i < 4; i++) {
    optionButtons.push({ text: '', img: null, isHover: false });
  }

  // 根據當前畫布大小更新所有 UI 元件的佈局
  updateLayout();

  // 記錄測驗開始時間 (用於 SCORM)
  startTime = new Date().getTime();

  // *** SCORM: 讀取儲存的進度 ***
  loadProgress();

  // 如果沒有讀取到進度，則進入開始畫面
  if (gameState !== 'QUIZZING') {
    gameState = 'START';
  }
}

function createQuestionParagraph() {
  // 如果段落元素已存在，先移除
  if (questionP) {
    questionP.remove();
  }
  questionP = createP(''); // 建立一個空的 <p> 元素
  questionP.style('font-size', `${windowWidth / 70}px`); // 根據視窗寬度調整文字大小
  questionP.style('font-weight', 'bold');
  questionP.style('color', '#FFFFFF');
}

function parseQuizData() {
  // 遍歷 CSV 的每一行
  for (let row of quizTable.getRows()) {
    let questionText = row.getString('question');
    let options = [
      row.getString('optA'),
      row.getString('optB'),
      row.getString('optC'),
      row.getString('optD')
    ];
    let imagePaths = [
      row.getString('imgA'),
      row.getString('imgB'),
      row.getString('imgC'),
      row.getString('imgD')
    ];
    let correctIndex = row.getNum('correctIndex');

    // 將問題物件存入陣列
    questions.push({
      text: questionText,
      options: options,
      // 將圖片路徑轉換為已載入的圖片物件
      images: imagePaths.map(path => (path ? questionImages[path] : null)),
      correct: correctIndex
    });
  }
}

// 載入並隨機化指定題目的選項
function loadQuestion(qIndex) {
  if (qIndex >= questions.length) return;

  let q = questions[qIndex];
  currentShuffledOptions = [];

  // 1. 將選項與是否正確的資訊綁定
  for (let i = 0; i < q.options.length; i++) {
    currentShuffledOptions.push({
      text: q.options[i],
      img: q.images[i],
      isCorrect: (i === q.correct)
    });
  }

  // 2. 使用 p5.js 的 shuffle() 函式隨機排序
  shuffle(currentShuffledOptions, true); // true 表示原地修改陣列
}

// === 3. p5.js 繪圖迴圈 ===

function draw() {
  background(40, 40, 50); // 深藍灰色背景
  noStroke();

  // --- 滾動視圖 ---
  // 根據 scrollY 的值來移動整個畫布
  push();
  translate(0, scrollY);

  // --- 實時更新題目文字大小 ---
  if (gameState === 'QUIZZING' && questionP) {
    questionP.style('font-size', `${windowWidth / 50}px`);
  }

  // 根據不同的遊戲狀態，繪製不同的畫面
  switch (gameState) {
    case 'START':
      drawStartScreen();
      break;
    case 'QUIZZING':
      drawQuizScreen();
      break;
    case 'RESULTS':
      drawResultScreen();
      break;
    case 'LOADING':
      drawLoadingScreen();
      break;
  }

  // 恢復畫布的原始狀態，這樣游標特效才不會跟著滾動
  pop();

  // --- 在滾動視圖之外繪製固定 UI ---
  // 這些元件會固定在畫面上，不受滾動影響
  if (gameState === 'QUIZZING') {
    // 繪製回饋文字 (例如：答對了！/ 答錯了)
    if (feedbackText) {
      fill(feedbackText.includes('正確') ? [0, 255, 0] : [255, 0, 0]);
      textSize(24);
      textAlign(CENTER, CENTER);
      text(feedbackText, width / 2, height - 80);
    }

    // 繪製進度
    fill(150);
    textSize(16);
    textAlign(CENTER, BOTTOM);
    text(`進度: ${currentQuestionIndex + 1} / ${questions.length} | 分數: ${score}`, width / 2, height - 30);
  }

  // 繪製游標特效 (在所有畫面的最上層)
  drawCursorEffect();
  // 繪製點擊特效
  drawSelectionEffect();
}

// --- 繪製不同遊戲狀態的畫面 ---

function drawLoadingScreen() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text('載入中...', width / 2, height / 2);
}

function drawStartScreen() {
  // 標題
  fill(255, 215, 0); // 金色
  textAlign(CENTER, CENTER);
  textSize(48);
  textStyle(BOLD);
  text('明日方舟測試問答（程度：中）', width / 2, height / 2 - 100);

  // 說明
  fill(255);
  textSize(20);
  textStyle(NORMAL);
  text(`共有 ${questions.length} 道題目`, width / 2, height / 2 - 20);

  // 繪製開始按鈕
  drawButton(startButton);
}

function drawQuizScreen() {
  if (currentQuestionIndex >= questions.length) {
    // 題目答完了
    gameState = 'RESULTS';
    // 觸發成績動畫
    sendScormData(); // *** 新增：傳送 SCORM 資料 ***
    spawnResultParticles();
    return;
  }

  // 取得目前的問題
  let q = questions[currentQuestionIndex];

  // --- 使用 HTML 元素顯示問題並計算其高度 ---
  const questionText = `Q${currentQuestionIndex + 1}: ${q.text}`;
  const questionWidth = width * 0.8;
  const questionY = 60; // 將題目向上移動
  
  // 更新 HTML 元素的內容和樣式
  questionP.html(questionText);
  questionP.position((width - questionWidth) / 2, questionY + scrollY); // 加上 scrollY 讓它跟著滾動
  questionP.size(questionWidth, AUTO);
  questionP.show(); // 確保元素是可見的

  // 從 HTML 元素獲取精確的高度
  const questionHeight = questionP.height;
  let questionBottomY = questionY + questionHeight;

  // 重設文字對齊，避免影響後續元件
  textAlign(LEFT, BASELINE);

  // --- 動態計算並繪製選項按鈕 ---
  const isWide = width > 800; // 判斷是否為寬螢幕
  const gap = 20;
  // 讓選項從問題下方開始，並保留一些間距
  const startY = questionBottomY + windowWidth*0.125; // 增加題目和選項之間的間距

  // 根據是否有圖片決定按鈕大小
  const btnW_text = isWide ? 300 : width * 0.4;
  const btnH_text = 50;
  const btnW_img = isWide ? 350 : width * 0.45;
  const btnH_img = 350; // 稍微縮小圖片按鈕高度以適應更多螢幕

  // 檢查當前題目是否包含任何圖片
  const hasImage = currentShuffledOptions.some(opt => opt.img);
  const rowHeight = hasImage ? btnH_img : btnH_text;

  // 繪製選項按鈕
  for (let i = 0; i < optionButtons.length; i++) {
    let btn = optionButtons[i];
    btn.text = currentShuffledOptions[i].text; // 使用隨機排序後的選項文字
    btn.img = currentShuffledOptions[i].img;   // 使用隨機排序後的圖片

    // 根據是否有圖片，動態設定按鈕大小
    if (btn.img) {
      btn.w = btnW_img;
      btn.h = btnH_img;
    } else {
      btn.w = btnW_text;
      btn.h = btnH_text;
    }
    // 動態設定按鈕位置
    // Y 座標的計算需要考慮按鈕自身的高度，確保是按鈕的上緣對齊
    const rowTopY = startY + floor(i / 2) * (rowHeight + gap);
    btn.x = (width / 2) + (i % 2 === 0 ? -1 : 1) * (btn.w / 2 + gap / 2);
    btn.y = rowTopY + btn.h / 2; // 按鈕的中心點 Y

    drawButton(btn);
  }

  // --- 根據內容調整畫布高度 ---
  // 計算選項區塊的底部 Y 座標
  const optionsBottomY = startY + floor((optionButtons.length - 1) / 2) * (rowHeight + gap) + rowHeight;
  contentHeight = optionsBottomY + 120; // 更新全域的內容高度

}

function drawResultScreen() {
  // 1. 繪製成績動畫
  // 這個動畫會在背景持續執行
  for (let i = resultParticles.length - 1; i >= 0; i--) {
    resultParticles[i].update();
    resultParticles[i].display();
    if (resultParticles[i].isDead()) {
      resultParticles.splice(i, 1);
    }
  }

  // 2. 繪製標題和分數
  let finalScore = (score / questions.length) * 100;
  let titleText = '';
  let titleColor;

  if (finalScore >= 80) {
    titleText = '這都被你答對了！';
    titleColor = color(0, 255, 150); // 亮綠色 (稱讚)
  } else if (finalScore >= 50) {
    titleText = '不錯喔！繼續加油！';
    titleColor = color(255, 215, 0); // 金色 (中等)
  } else {
    titleText = '別灰心！再多練習一下！';
    titleColor = color(150, 200, 255); // 淺藍色 (鼓勵)
  }

  fill(titleColor);
  textAlign(CENTER, CENTER);
  textSize(40);
  textStyle(BOLD);
  text(titleText, width / 2, height / 2 - 100);

  fill(255);
  textSize(32);
  textStyle(NORMAL);
  text(`你的分數: ${finalScore.toFixed(0)} 分`, width / 2, height / 2);
  text(`(答對 ${score} / ${questions.length} 題)`, width / 2, height / 2 + 60);


  // 3. 繪製重新開始按鈕
  drawButton(retryButton);
}

// === SCORM 函式 ===

function loadProgress() {
  const suspendData = scormWrapper.getSuspendData();
  if (suspendData) {
    try {
      const progress = JSON.parse(suspendData);
      if (progress && typeof progress.currentQuestionIndex !== 'undefined') {
        console.log("Resuming progress:", progress);
        currentQuestionIndex = progress.currentQuestionIndex;
        score = progress.score || 0;
        
        // 直接進入測驗畫面
        gameState = 'QUIZZING';
        createQuestionParagraph();
        loadQuestion(currentQuestionIndex);
      }
    } catch (e) {
      console.error("Error parsing suspend data:", e);
    }
  }
}

function saveProgress() {
  const progress = { currentQuestionIndex, score };
  scormWrapper.setSuspendData(JSON.stringify(progress));
}

function sendScormData() {
  const finalScore = (score / questions.length) * 100;
  const passingScore = 80; // 您可以自訂及格分數

  // 1. 設定分數
  // setScore(原始分數, 最小分數, 最大分數)
  scormWrapper.setScore(finalScore.toFixed(0), 0, 100);

  // 2. 設定課程狀態
  if (finalScore >= passingScore) {
    scormWrapper.setLessonStatus("passed");
  } else {
    scormWrapper.setLessonStatus("failed");
  }
  // 無論通過與否，都標記為 "completed"
  scormWrapper.setLessonStatus("completed");

  // 3. 設定作答時間
  const endTime = new Date().getTime();
  const totalTime = Math.round((endTime - startTime) / 1000); // 秒
  const scormTime = new Date(totalTime * 1000).toISOString().substr(11, 8); // 轉換為 HH:MM:SS 格式
  scormWrapper.setSessionTime(scormTime);

  // 4. 清除 suspend_data，因為測驗已完成
  scormWrapper.setSuspendData("");
}

// --- 特效與互動 ---

// 繪製一個通用的按鈕
function drawButton(btn) {
  // 檢查滑鼠是否懸停
  // 因為畫布被 translate 移動了，所以需要從 mouseY 減去 scrollY 來得到正確的相對座標
  const correctedMouseY = mouseY - scrollY;
  btn.isHover = (mouseX > btn.x - btn.w / 2 && mouseX < btn.x + btn.w / 2 &&
                 correctedMouseY > btn.y - btn.h / 2 && correctedMouseY < btn.y + btn.h / 2);

  push(); // 保存繪圖設定
  translate(btn.x, btn.y);
  rectMode(CENTER);

  
  textSize(22);
  textStyle(NORMAL);

  if (btn.isHover) {
    fill(100, 150, 255); // 懸停時的亮藍色
    stroke(255);
    if (btn.highlightColor) {
      // 如果有高亮顏色，則先繪製高亮矩形
      fill(btn.highlightColor);
      rect(0, 0, btn.w + 10, btn.h + 5, 10);
    }
    strokeWeight(3);
    // 稍微放大特效
    rect(0, 0, btn.w + 10, btn.h + 5, 10);
  } else {
    fill(60, 80, 150); // 預設的深藍色
    stroke(200);
    strokeWeight(1);
    if (btn.highlightColor) {
      // 如果有高亮顏色，則先繪製高亮矩形
      fill(btn.highlightColor);
      rect(0, 0, btn.w + 10, btn.h + 5, 10);
    }
    rect(0, 0, btn.w, btn.h, 10); // 圓角矩形
  }

  fill(255); // 按鈕文字顏色
  noStroke();

  // 如果有圖片，就繪製圖片和文字
  if (btn.img) {
    // 繪製圖片 (上半部)
    imageMode(CENTER);
    let imgHeight = btn.h * 0.8; // 圖片佔用 80% 的高度
    let imgWidth = imgHeight; // 保持圖片比例
    image(btn.img, 0, -btn.h / 2 + imgHeight / 2 + 5, imgWidth, imgHeight);

    // 繪製文字 (下半部)
    textAlign(CENTER, CENTER);
    let textY = btn.h * 0.4; // 將文字定位在按鈕下方約 3/4 處
    text(btn.text, 0, textY);
  } else {
    // 如果沒有圖片，文字置中
    textAlign(CENTER, CENTER);
    text(btn.text, 0, 0);
  }
  pop(); // 恢復繪圖設定
}

// 游標特效
function drawCursorEffect() {
  // 在游標位置產生新的粒子
  if (mouseIsPressed || frameCount % 5 === 0) { // 按下時或每 5 幀
      if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
           cursorParticles.push(new CursorParticle(mouseX, mouseY));
      }
  }

  // 更新和繪製所有游標粒子
  for (let i = cursorParticles.length - 1; i >= 0; i--) {
    cursorParticles[i].update();
    cursorParticles[i].display();
    if (cursorParticles[i].isDead()) {
      cursorParticles.splice(i, 1);
    }
  }
}

// 點擊選項時的特效
function drawSelectionEffect() {
  if (selectionEffect) {
    selectionEffect.update();
    selectionEffect.display();
    if (selectionEffect.isDead()) {
      selectionEffect = null;
    }
  }
}

// 檢查答案
function checkAnswer(selectedIndex) {
  if (feedbackText) return; // 如果還在顯示回饋，就不要重複觸發

  if (currentShuffledOptions[selectedIndex].isCorrect) {
    highlightCorrectAnswer(selectedIndex, true);
    score++;
    feedbackText = '回答正確！';
    selectionEffect = new SelectionEffect(optionButtons[selectedIndex].x, optionButtons[selectedIndex].y, color(0, 255, 0));
  } else {
    feedbackText = `答錯了！`; // 簡化回饋，避免透露答案
    selectionEffect = new SelectionEffect(optionButtons[selectedIndex].x, optionButtons[selectedIndex].y, color(255, 0, 0));
    highlightCorrectAnswer(selectedIndex, false);
  }

  // 停留 1.5 秒後跳到下一題
  setTimeout(() => {
    currentQuestionIndex++;
    feedbackText = '';
    selectionEffect = null;
    loadQuestion(currentQuestionIndex); // 載入下一題並隨機化選項

    // *** SCORM: 儲存進度 ***
    saveProgress();
  }, 1500);
}

function highlightCorrectAnswer(selectedIndex, isCorrect) {
  // 找到正確答案的索引
  let correctIndex = currentShuffledOptions.findIndex(option => option.isCorrect);

  // 如果選擇正確，則高亮顯示選擇的選項為綠色
  if (isCorrect) {
    optionButtons[selectedIndex].highlightColor = color(0, 255, 0, 150); // 綠色
  }
  // 如果選擇錯誤，則高亮顯示選擇的選項為紅色，並高亮顯示正確答案為綠色
  else {
    optionButtons[selectedIndex].highlightColor = color(255, 0, 0, 150); // 紅色
    optionButtons[correctIndex].highlightColor = color(0, 255, 0, 150); // 綠色
  }

  // 在 1.5 秒後清除高亮
  setTimeout(() => {
    optionButtons.forEach(btn => btn.highlightColor = null);
  }, 1500);
}
// 重設測驗
function resetQuiz() {
  score = 0;
  currentQuestionIndex = 0;
  resultParticles = []; // 清空動畫粒子
  gameState = 'START';
  // 重設 SCORM 狀態，準備下一次作答
  scormWrapper.setLessonStatus("incomplete");
  scormWrapper.setSuspendData(""); // 清空進度
  scormWrapper.setLessonStatus("not attempted");
}

// === p5.js 事件處理 ===

function mousePressed() {
  if (gameState === 'START') {
    if (startButton.isHover) {
      gameState = 'QUIZZING';
      createQuestionParagraph(); // 建立問題顯示區塊
      loadQuestion(currentQuestionIndex); // 第一次進入測驗時，載入第一題
    }
  } else if (gameState === 'QUIZZING') {
    // 只有在沒有顯示回饋時才能點擊
    if (!feedbackText) {
      for (let i = 0; i < optionButtons.length; i++) {
        if (optionButtons[i].isHover) {
          checkAnswer(i);
          break; // 點擊後就跳出迴圈
        }
      }
    }
  } else if (gameState === 'RESULTS') {
    if (retryButton.isHover) {
      questionP.hide(); // 隱藏問題段落
      resetQuiz();
    }
  }
}

function windowResized() {
  // 當視窗大小改變時，重新設定畫布大小並更新 UI 佈局
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
}

function mouseMoved() {
    // 立即在滑鼠移動的地方產生一個粒子
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        cursorParticles.push(new CursorParticle(mouseX, mouseY));
    }
}

// 監聽滑鼠滾輪事件
function mouseWheel(event) {
  // 只有在測驗畫面才允許滾動
  if (gameState === 'QUIZZING') {
    // event.delta 提供了滾動的幅度 (正值向下，負值向上)
    scrollY -= event.delta;

    // 限制滾動範圍
    // 1. 不能向上滾動超過頂部 (scrollY 不能大於 0)
    // 2. 不能向下滾動超過內容底部 (scrollY 的最小值)
    scrollY = constrain(scrollY, min(0, height - contentHeight), 0);

    // 當滾動時，更新問題段落的位置
    const questionWidth = width * 0.8;
    questionP.position((width - questionWidth) / 2, 80 + scrollY);
  }
}

// === 響應式佈局更新函式 ===

function updateLayout() {
  // 根據畫布寬度決定按鈕大小和間距
  const isWide = width > 700; // 判斷是否為寬螢幕
  const btnW = isWide ? 350 : width * 0.45; // 這個值現在主要影響開始和重試按鈕
  const btnH = 50;
  const gap = 20;

  // 1. 更新選項按鈕 (2x2 網格)
  const startX = width / 2;
  // 在 QUIZZING 狀態下，Y 座標是動態計算的，這裡的設定主要影響 START 畫面 (雖然那裡也用不到)
  // 但保留結構完整性
  const startY = height / 2 + 80;
  for (let i = 0; i < optionButtons.length; i++) {
    // 注意：選項按鈕的最終大小和位置現在由 drawQuizScreen 動態決定
    // 這裡的設定僅為初始化
    let btn = optionButtons[i];
    btn.x = startX + (i % 2 === 0 ? -1 : 1) * (btnW / 2 + gap / 2);
    btn.y = startY + (floor(i / 2) === 0 ? 0 : 1) * (btnH + gap);
    btn.w = btnW;
    btn.h = btnH;
  }


  // 重設滾動位置
  scrollY = 0;

  // 2. 更新開始按鈕
  startButton = {
    x: width / 2,
    y: height / 2 + 100,
    w: 200,
    h: 60,
    text: '開始測驗',
    isHover: false
  };

  // 3. 更新重試按鈕
  retryButton = {
    x: width / 2,
    y: height - 100,
    w: 200,
    h: 50,
    text: '再試一次',
    isHover: false
  };
}

// === 特效的物件導向 (Class) ===

// 游標粒子 Class
class CursorParticle {
  constructor(x, y) {
    this.x = x + random(-5, 5);
    this.y = y + random(-5, 5);
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.alpha = 255;
    this.size = random(3, 8);
    this.color = color(255, 230, 150, this.alpha); // 溫暖的黃色
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 5;
    this.color.setAlpha(this.alpha);
  }

  display() {
    noStroke();
    fill(this.color);
    ellipse(this.x, this.y, this.size);
  }

  isDead() {
    return this.alpha < 0;
  }
}

// 點擊選項特效 Class (擴散的圓圈)
class SelectionEffect {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 80;
    this.alpha = 200;
    this.color = col;
  }

  update() {
    this.radius += 4;
    this.alpha -= 10;
    this.color.setAlpha(this.alpha);
  }

  display() {
    noFill();
    stroke(this.color);
    strokeWeight(4);
    ellipse(this.x, this.y, this.radius * 2);
  }

  isDead() {
    return this.alpha < 0;
  }
}

// 產生結果畫面的動畫粒子
function spawnResultParticles() {
  let finalScore = (score / questions.length) * 100;
  let particleCount = 100;

  if (finalScore >= 80) {
    // 稱讚：金色、綠色彩帶 (煙火)
    for (let i = 0; i < particleCount; i++) {
      resultParticles.push(new ResultParticle(width / 2, height / 2, 'praise'));
    }
  } else {
    // 鼓勵：緩慢上升的藍色氣泡
    for (let i = 0; i < particleCount; i++) {
      resultParticles.push(new ResultParticle(random(width), height + 20, 'encourage'));
    }
  }
}

// 結果動畫粒子 Class
class ResultParticle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.alpha = 255;

    if (this.type === 'praise') {
      // 煙火效果
      this.vel = p5.Vector.random2D().mult(random(2, 8)); // 往四面八方
      this.gravity = createVector(0, 0.2);
      this.color = random([color(255, 215, 0), color(0, 255, 100), color(255)]);
      this.size = random(3, 6);
    } else {
      // 鼓勵的氣泡效果
      this.vx = random(-0.5, 0.5);
      this.vy = random(-1, -3); // 往上飄
      this.color = color(150, 200, 255, 150); // 鼓勵的淺藍色
      this.size = random(10, 30);
    }
  }

  update() {
    if (this.type === 'praise') {
      this.vel.add(this.gravity);
      this.x += this.vel.x;
      this.y += this.vel.y;
      this.alpha -= 3;
    } else {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= 1.5; // 氣泡消失得比較慢
    }
    this.color.setAlpha(this.alpha);
  }

  display() {
    noStroke();
    fill(this.color);
    if (this.type === 'praise') {
      rectMode(CENTER);
      rect(this.x, this.y, this.size, this.size); // 方形彩帶
    } else {
      ellipse(this.x, this.y, this.size); // 圓形氣泡
    }
  }

  isDead() {
    return this.alpha < 0 || this.y > height + 50 || this.y < -50;
  }
}
