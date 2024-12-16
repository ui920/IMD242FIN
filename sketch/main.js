// 종횡비를 고정하고 싶을 경우: 아래 두 변수를 0이 아닌 원하는 종, 횡 비율값으로 설정.
// 종횡비를 고정하고 싶지 않을 경우: 아래 두 변수 중 어느 하나라도 0으로 설정.
const aspectW = 4;
const aspectH = 3;
// html에서 클래스명이 container-canvas인 첫 엘리먼트: 컨테이너 가져오기.
const container = document.body.querySelector('.container-canvas');
// 필요에 따라 이하에 변수 생성.

let mouthOpen = 0;
let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

let source;
let history;
let historyIndex = 0;
let offset = 0;
let H = 10;

let stressLevel = 0;
let stressDecayRate = 0.01;
let stressIncreaseRate = 0.1;
let maxStressLevel = 100;

let wasMouthOpen = false;

function calcMouthOpen(face) {
  let upper = face.keypoints[13];
  let lower = face.keypoints[14];
  let distance = dist(upper.x, upper.y, upper.z, lower.x, lower.y, lower.z);
  return distance;
}

function calcWidth(face) {
  let left = face.keypoints[21];
  let right = face.keypoints[251];
  let distance = dist(left.x, left.y, left.z, right.x, right.y, right.z);
  return distance;
}

function initSlitscan() {
  source = createGraphics(width, height);
  history = Array.from({ length: floor(height / H) }, () =>
    createImage(width, height)
  );
}

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  // 컨테이너의 현재 위치, 크기 등의 정보 가져와서 객체구조분해할당을 통해 너비, 높이 정보를 변수로 추출.
  const { width: containerW, height: containerH } =
    container.getBoundingClientRect();
  // 종횡비가 설정되지 않은 경우:
  // 컨테이너의 크기와 일치하도록 캔버스를 생성하고, 컨테이너의 자녀로 설정.
  if (aspectW === 0 || aspectH === 0) {
    createCanvas(containerW, containerH).parent(container);
  }
  // 컨테이너의 가로 비율이 설정한 종횡비의 가로 비율보다 클 경우:
  // 컨테이너의 세로길이에 맞춰 종횡비대로 캔버스를 생성하고, 컨테이너의 자녀로 설정.
  else if (containerW / containerH > aspectW / aspectH) {
    createCanvas((containerH * aspectW) / aspectH, containerH).parent(
      container
    );
  }
  // 컨테이너의 가로 비율이 설정한 종횡비의 가로 비율보다 작거나 같을 경우:
  // 컨테이너의 가로길이에 맞춰 종횡비대로 캔버스를 생성하고, 컨테이너의 자녀로 설정.
  else {
    createCanvas(containerW, (containerW * aspectH) / aspectW).parent(
      container
    );
  }
  init();
  // createCanvas를 제외한 나머지 구문을 여기 혹은 init()에 작성.
  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  video.hide();
  initSlitscan();
  faceMesh.detectStart(video, gotFaces);
}

function drawSlitscan() {
  alpha = lerp(alpha, 255, 0.1);
  tint(255, alpha);
  source.image(video, 0, 0, width, height);
  for (let i = 0; i < history.length; i++) {
    let y = i * H;
    let currentIndex = (i + offset) % history.length;
    copy(history[currentIndex], 0, y, width, H, 0, y, width, H);
  }
  offset++;
  history[historyIndex].copy(
    source,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    width,
    height
  );
  historyIndex = (historyIndex + 1) % history.length;
}

// windowResized()에서 setup()에 준하는 구문을 실행해야할 경우를 대비해 init이라는 명칭의 함수를 만들어 둠.
function init() {}

function draw() {
  background('white');
  let mouthOpenThreshold = 0.05;
  image(video, 0, 0, width, height);
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let faceWidth = calcWidth(face);
    let mouthDist = calcMouthOpen(face);
    let normalizedMouth = mouthDist / faceWidth;
    let isMouthOpen = normalizedMouth > mouthOpenThreshold;
    if (!isMouthOpen && wasMouthOpen) {
      stressLevel = 0;
    }
    if (isMouthOpen) {
      stressLevel = min(stressLevel + stressIncreaseRate, maxStressLevel);
      drawSlitscan();
    } else {
      stressLevel = max(stressLevel - stressDecayRate, 0);
      image(video, 0, 0, width, height);
    }
    wasMouthOpen = isMouthOpen;
  }
  displayStressLevel();
  if (stressLevel >= maxStressLevel) {
    StressFin();
  }
}

function displayStressLevel() {
  let barWidth = map(stressLevel, 0, maxStressLevel, 0, width);
  let startColor = color(255, 255, 204, 140);
  let endColor = color(204, 0, 102, 140);
  let barColor = lerpColor(startColor, endColor, stressLevel / maxStressLevel);
  noStroke();
  fill(barColor);
  rect(0, height - 30, barWidth, 30);

  fill(255);
  stroke(0);
  strokeWeight(3);
  textSize(19);
  textAlign(LEFT, CENTER);
  text(`Stress gage ${floor(stressLevel)}`, 10, height - 47);
  let emojiCount = floor(map(stressLevel, 0, maxStressLevel, 0, 11));
  let emojiSpacing = barWidth / max(emojiCount, 1);
  textSize(22);
  textAlign(CENTER, CENTER);

  for (let i = 0; i < emojiCount; i++) {
    let emojiX = emojiSpacing * i + emojiSpacing / 2;
    if (emojiX + emojiSpacing / 2 <= barWidth) {
      text('😡', emojiX, height - 12);
    }
  }
  fill(255);
  stroke(0);
  strokeWeight(3);
  textSize(20);
  textAlign(CENTER, TOP);
  text(
    `Open your 👄 and move your body to release your stress.`,
    width / 2,
    20
  );
}

function StressFin() {
  background(255, 0, 153, 180);
  fill(255);
  textSize(22);
  textAlign(CENTER, CENTER);
  text(
    'Too much stress detected😡 Take a breath, close your 👄, open it again, and reset to start over.',
    width / 2,
    height / 2
  );
}

function gotFaces(results) {
  faces = results;
}

function windowResized() {
  // 컨테이너의 현재 위치, 크기 등의 정보 가져와서 객체구조분해할당을 통해 너비, 높이 정보를 변수로 추출.
  const { width: containerW, height: containerH } =
    container.getBoundingClientRect();
  // 종횡비가 설정되지 않은 경우:
  // 컨테이너의 크기와 일치하도록 캔버스 크기를 조정.
  if (aspectW === 0 || aspectH === 0) {
    resizeCanvas(containerW, containerH);
  }
  // 컨테이너의 가로 비율이 설정한 종횡비의 가로 비율보다 클 경우:
  // 컨테이너의 세로길이에 맞춰 종횡비대로 캔버스 크기를 조정.
  else if (containerW / containerH > aspectW / aspectH) {
    resizeCanvas((containerH * aspectW) / aspectH, containerH);
  }
  // 컨테이너의 가로 비율이 설정한 종횡비의 가로 비율보다 작거나 같을 경우:
  // 컨테이너의 가로길이에 맞춰 종횡비대로 캔버스 크기를 조정.
  else {
    resizeCanvas(containerW, (containerW * aspectH) / aspectW);
  }
  // 위 과정을 통해 캔버스 크기가 조정된 경우, 다시 처음부터 그려야할 수도 있다.
  // 이런 경우 setup()의 일부 구문을 init()에 작성해서 여기서 실행하는게 편리하다.
  // init();
}
