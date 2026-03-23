const container = document.querySelector('.container');

const homeScore = document.getElementById('home-score');
const awayScore = document.getElementById('away-score');
const homeName = document.getElementById('home-name');
const awayName = document.getElementById('away-name');
const homeNameInput = document.getElementById('home-name-input');
const awayNameInput = document.getElementById('away-name-input');
const homeFoulsElement = document.getElementById('home-fouls');
const awayFoulsElement = document.getElementById('away-fouls');
const homeBonusElement = document.getElementById('home-bonus');
const awayBonusElement = document.getElementById('away-bonus');

const gameClock = document.getElementById('game-clock');
const shotTimer = document.getElementById('shot-timer');
const ring = document.getElementById('ring');
const statusText = document.getElementById('status-text');
const periodLabel = document.getElementById('period-label');

const startClock = document.getElementById('start-clock');
const resetGame = document.getElementById('reset-game');
const nextPeriod = document.getElementById('next-period');
const undoAction = document.getElementById('undo-action');
const clearSavedGame = document.getElementById('clear-saved-game');
const fullscreenToggle = document.getElementById('fullscreen-toggle');
const openQuickEdit = document.getElementById('open-quick-edit');
const quickEditModal = document.getElementById('quick-edit-modal');
const closeQuickEdit = document.getElementById('close-quick-edit');
const applyQuickEdit = document.getElementById('apply-quick-edit');
const editPeriodInput = document.getElementById('edit-period');
const editMinutesInput = document.getElementById('edit-minutes');
const editSecondsInput = document.getElementById('edit-seconds');
const editShotInput = document.getElementById('edit-shot');

const homePossession = document.getElementById('home-possession');
const awayPossession = document.getElementById('away-possession');

const teamButtons = document.querySelectorAll('.inc-btn, .dec-btn');
const foulButtons = document.querySelectorAll('.foul-btn');

const SHOT_RING_LENGTH = 251;
const GAME_MINUTES = 10;
const DEFAULT_SHOT = 24;
const OFFENSIVE_REBOUND_SHOT = 14;
const MAX_REGULATION_PERIOD = 4;
const BONUS_THRESHOLD = 5;
const DOUBLE_BONUS_THRESHOLD = 10;
const STORAGE_KEY = 'swishrScoreboardState';

let homePoints = 0;
let awayPoints = 0;
let homeFouls = 0;
let awayFouls = 0;

let minutes = GAME_MINUTES;
let seconds = 0;
let shotSeconds = DEFAULT_SHOT;

let currentPeriod = 1;
let isRunning = false;
let isGameOver = false;

let clockInterval = null;
let shotInterval = null;
let alertTimer = null;
let undoSnapshot = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCurrentPossession() {
  return homePossession.classList.contains('active') ? 'home' : 'away';
}

function getStateSnapshot() {
  return {
    homePoints,
    awayPoints,
    homeFouls,
    awayFouls,
    minutes,
    seconds,
    shotSeconds,
    currentPeriod,
    isRunning,
    isGameOver,
    statusText: statusText.textContent,
    statusIsAlert: statusText.classList.contains('alert'),
    possession: getCurrentPossession(),
    homeName: homeName.textContent,
    awayName: awayName.textContent,
    homeNameInput: homeNameInput.value,
    awayNameInput: awayNameInput.value
  };
}

function captureUndoSnapshot() {
  undoSnapshot = getStateSnapshot();
}

function applyStateSnapshot(snapshot) {
  pauseTimers();

  homePoints = Math.max(0, Number(snapshot.homePoints) || 0);
  awayPoints = Math.max(0, Number(snapshot.awayPoints) || 0);
  homeFouls = Math.max(0, Number(snapshot.homeFouls) || 0);
  awayFouls = Math.max(0, Number(snapshot.awayFouls) || 0);

  minutes = clamp(Number(snapshot.minutes) || 0, 0, 99);
  seconds = clamp(Number(snapshot.seconds) || 0, 0, 59);
  shotSeconds = clamp(Number(snapshot.shotSeconds) || 0, 0, DEFAULT_SHOT);
  currentPeriod = Math.max(1, Number(snapshot.currentPeriod) || 1);

  isGameOver = Boolean(snapshot.isGameOver);

  homeNameInput.value = typeof snapshot.homeNameInput === 'string' ? snapshot.homeNameInput : 'HOME';
  awayNameInput.value = typeof snapshot.awayNameInput === 'string' ? snapshot.awayNameInput : 'AWAY';
  homeName.textContent = typeof snapshot.homeName === 'string' ? snapshot.homeName : 'HOME';
  awayName.textContent = typeof snapshot.awayName === 'string' ? snapshot.awayName : 'AWAY';

  updateScoreboard();
  updateFoulBoard();
  renderPeriodLabel();
  gameClock.textContent = formatClock(minutes, seconds);
  shotTimer.textContent = shotSeconds;
  updateShotRing();

  setPossession(snapshot.possession === 'away' ? 'away' : 'home');
  setStatus(typeof snapshot.statusText === 'string' ? snapshot.statusText : 'READY', Boolean(snapshot.statusIsAlert));

  container.classList.toggle('game-over', isGameOver);
  updateStartButton();

  if (Boolean(snapshot.isRunning) && !isGameOver && !(minutes === 0 && seconds === 0)) {
    startTimers();
  } else {
    saveState();
  }
}

function saveState() {
  try {
    const state = {
      homePoints,
      awayPoints,
      homeFouls,
      awayFouls,
      minutes,
      seconds,
      shotSeconds,
      currentPeriod,
      isRunning,
      isGameOver,
      statusText: statusText.textContent,
      possession: getCurrentPossession(),
      homeName: homeName.textContent,
      awayName: awayName.textContent,
      homeNameInput: homeNameInput.value,
      awayNameInput: awayNameInput.value
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
  }
}

function loadState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) return false;

    const state = JSON.parse(rawState);

    homePoints = Number.isFinite(state.homePoints) ? Math.max(0, state.homePoints) : 0;
    awayPoints = Number.isFinite(state.awayPoints) ? Math.max(0, state.awayPoints) : 0;
    homeFouls = Number.isFinite(state.homeFouls) ? Math.max(0, state.homeFouls) : 0;
    awayFouls = Number.isFinite(state.awayFouls) ? Math.max(0, state.awayFouls) : 0;

    minutes = Number.isFinite(state.minutes) ? clamp(state.minutes, 0, 99) : GAME_MINUTES;
    seconds = Number.isFinite(state.seconds) ? clamp(state.seconds, 0, 59) : 0;
    shotSeconds = Number.isFinite(state.shotSeconds) ? clamp(state.shotSeconds, 0, DEFAULT_SHOT) : DEFAULT_SHOT;
    currentPeriod = Number.isFinite(state.currentPeriod) ? Math.max(1, state.currentPeriod) : 1;

    isRunning = false;
    isGameOver = Boolean(state.isGameOver);

    homeNameInput.value = typeof state.homeNameInput === 'string' ? state.homeNameInput : 'HOME';
    awayNameInput.value = typeof state.awayNameInput === 'string' ? state.awayNameInput : 'AWAY';
    homeName.textContent = typeof state.homeName === 'string' ? state.homeName : 'HOME';
    awayName.textContent = typeof state.awayName === 'string' ? state.awayName : 'AWAY';

    updateScoreboard();
    updateFoulBoard();
    renderPeriodLabel();
    gameClock.textContent = formatClock(minutes, seconds);
    shotTimer.textContent = shotSeconds;
    updateShotRing();

    setPossession(state.possession === 'away' ? 'away' : 'home');
    setStatus(typeof state.statusText === 'string' ? state.statusText : 'READY');

    container.classList.toggle('game-over', isGameOver);
    updateStartButton();

    if (Boolean(state.isRunning) && !isGameOver && !(minutes === 0 && seconds === 0)) {
      startTimers();
    }

    return true;
  } catch {
    return false;
  }
}

function formatClock(mins, secs) {
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateScoreboard() {
  homeScore.textContent = homePoints;
  awayScore.textContent = awayPoints;
}

function updateFoulBoard() {
  homeFoulsElement.textContent = homeFouls;
  awayFoulsElement.textContent = awayFouls;
  renderBonusState(homeFouls, homeBonusElement);
  renderBonusState(awayFouls, awayBonusElement);
}

function renderBonusState(fouls, bonusElement) {
  bonusElement.classList.remove('bonus', 'double');

  if (fouls >= DOUBLE_BONUS_THRESHOLD) {
    bonusElement.textContent = 'DOUBLE BONUS';
    bonusElement.classList.add('double');
    return;
  }

  if (fouls >= BONUS_THRESHOLD) {
    bonusElement.textContent = 'BONUS';
    bonusElement.classList.add('bonus');
    return;
  }

  bonusElement.textContent = 'NO BONUS';
}

function renderPeriodLabel() {
  periodLabel.textContent = currentPeriod <= MAX_REGULATION_PERIOD ? `Q${currentPeriod}` : 'OT';
}

function updateShotRing() {
  const ratio = Math.max(0, shotSeconds) / DEFAULT_SHOT;
  ring.style.strokeDashoffset = SHOT_RING_LENGTH * (1 - ratio);
}

function updateStartButton() {
  const icon = startClock.querySelector('.play-icon');
  const stack = startClock.querySelector('.btn-stack');

  if (isGameOver) {
    icon.textContent = '■';
    stack.innerHTML = 'GAME<br />OVER';
    startClock.disabled = true;
    return;
  }

  startClock.disabled = false;

  if (isRunning) {
    icon.textContent = '❚❚';
    stack.innerHTML = 'PAUSE<br />CLOCK';
  } else {
    icon.textContent = '▶';
    stack.innerHTML = 'RESUME<br />CLOCK';
  }
}

function setStatus(text, isAlert = false) {
  statusText.textContent = text;
  statusText.classList.toggle('alert', isAlert);
}

function setPossession(side) {
  const homeActive = side === 'home';
  homePossession.classList.toggle('active', homeActive);
  awayPossession.classList.toggle('active', !homeActive);
}

function beep(frequency = 880, duration = 220) {
  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextRef) return;

  const context = new AudioContextRef();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1000);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + duration / 1000);

  oscillator.onended = () => {
    context.close();
  };
}

function flashStatus(text, ms = 1300) {
  clearTimeout(alertTimer);
  setStatus(text, true);
  alertTimer = setTimeout(() => {
    if (!isGameOver) {
      setStatus(isRunning ? 'LIVE' : 'PAUSED');
    }
  }, ms);
}

function pauseTimers() {
  clearInterval(clockInterval);
  clearInterval(shotInterval);
  clockInterval = null;
  shotInterval = null;
  isRunning = false;
  updateStartButton();
  saveState();
}

function endGame() {
  pauseTimers();
  isGameOver = true;
  container.classList.add('game-over');
  setStatus('GAME OVER', true);
  beep(660, 300);
  setTimeout(() => beep(520, 340), 160);
  updateStartButton();
  saveState();
}

function resetShotClock(secondsValue = DEFAULT_SHOT) {
  shotSeconds = secondsValue;
  shotTimer.textContent = shotSeconds;
  updateShotRing();
}

function onClockTick() {
  if (minutes === 0 && seconds === 0) {
    pauseTimers();
    return;
  }

  if (seconds === 0) {
    minutes -= 1;
    seconds = 59;
  } else {
    seconds -= 1;
  }

  gameClock.textContent = formatClock(minutes, seconds);

  if (minutes === 0 && seconds === 0) {
    pauseTimers();
    clearInterval(shotInterval);

    if (currentPeriod >= MAX_REGULATION_PERIOD) {
      endGame();
      return;
    }

    const endedPeriod = currentPeriod;
    currentPeriod += 1;
    renderPeriodLabel();

    homeFouls = 0;
    awayFouls = 0;
    updateFoulBoard();

    minutes = GAME_MINUTES;
    seconds = 0;
    gameClock.textContent = formatClock(minutes, seconds);
    resetShotClock(DEFAULT_SHOT);

    flashStatus(`END Q${endedPeriod}`);
  }

  saveState();
}

function onShotTick() {
  if (shotSeconds <= 0) {
    clearInterval(shotInterval);
    return;
  }

  shotSeconds -= 1;
  shotTimer.textContent = shotSeconds;
  updateShotRing();

  if (shotSeconds === 0) {
    clearInterval(shotInterval);
    beep(980, 180);
    flashStatus('SHOT CLOCK VIOLATION');
  }

  saveState();
}

function startTimers() {
  if (isGameOver || isRunning) return;
  if (minutes === 0 && seconds === 0) return;

  isRunning = true;
  updateStartButton();
  setStatus('LIVE');

  clockInterval = setInterval(onClockTick, 1000);
  shotInterval = setInterval(onShotTick, 1000);
  saveState();
}

function handleStartPause() {
  if (isGameOver) return;

  captureUndoSnapshot();

  if (isRunning) {
    pauseTimers();
    setStatus('PAUSED');
    saveState();
    return;
  }

  startTimers();
}

function nextPeriodHandler() {
  if (isRunning) return;
  if (isGameOver) return;

  captureUndoSnapshot();

  currentPeriod += 1;
  renderPeriodLabel();

  homeFouls = 0;
  awayFouls = 0;
  updateFoulBoard();

  minutes = GAME_MINUTES;
  seconds = 0;
  gameClock.textContent = formatClock(minutes, seconds);

  resetShotClock(DEFAULT_SHOT);
  setStatus('READY');
  updateStartButton();
  saveState();
}

function resetGameHandler() {
  captureUndoSnapshot();

  homePoints = 0;
  awayPoints = 0;
  homeFouls = 0;
  awayFouls = 0;
  currentPeriod = 1;

  minutes = GAME_MINUTES;
  seconds = 0;

  isGameOver = false;

  clearTimeout(alertTimer);
  container.classList.remove('game-over');

  pauseTimers();
  gameClock.textContent = formatClock(minutes, seconds);
  resetShotClock(DEFAULT_SHOT);

  updateScoreboard();
  updateFoulBoard();
  renderPeriodLabel();
  setStatus('READY');
  setPossession('home');
  updateStartButton();
  saveState();
}

function handleScoreClick(event) {
  captureUndoSnapshot();

  const button = event.currentTarget;
  const team = button.dataset.team;
  const points = Number(button.dataset.points);

  if (team === 'home') {
    homePoints = Math.max(0, homePoints + points);
  } else {
    awayPoints = Math.max(0, awayPoints + points);
  }

  updateScoreboard();
  saveState();
}

function handleFoulClick(event) {
  captureUndoSnapshot();

  const button = event.currentTarget;
  const team = button.dataset.team;
  const foulDelta = Number(button.dataset.foulDelta);

  if (team === 'home') {
    homeFouls = Math.max(0, homeFouls + foulDelta);
  } else {
    awayFouls = Math.max(0, awayFouls + foulDelta);
  }

  updateFoulBoard();
  saveState();
}

function bindTeamNameInput(inputElement, outputElement) {
  inputElement.addEventListener('input', () => {
    const cleaned = inputElement.value.trim().toUpperCase();
    outputElement.textContent = cleaned || 'TEAM';
    saveState();
  });
}

function syncFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenToggle.textContent = isFullscreen ? '⤡' : '⤢';
  fullscreenToggle.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
  fullscreenToggle.setAttribute('title', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
}

function openQuickEditModal() {
  editPeriodInput.value = currentPeriod;
  editMinutesInput.value = minutes;
  editSecondsInput.value = seconds;
  editShotInput.value = shotSeconds;
  quickEditModal.classList.remove('hidden');
}

function closeQuickEditModal() {
  quickEditModal.classList.add('hidden');
}

function applyQuickEditValues() {
  captureUndoSnapshot();

  const editedPeriod = clamp(Number(editPeriodInput.value) || 1, 1, 12);
  const editedMinutes = clamp(Number(editMinutesInput.value) || 0, 0, 99);
  const editedSeconds = clamp(Number(editSecondsInput.value) || 0, 0, 59);
  const editedShot = clamp(Number(editShotInput.value) || 0, 0, DEFAULT_SHOT);

  currentPeriod = editedPeriod;
  minutes = editedMinutes;
  seconds = editedSeconds;
  shotSeconds = editedShot;

  renderPeriodLabel();
  gameClock.textContent = formatClock(minutes, seconds);
  shotTimer.textContent = shotSeconds;
  updateShotRing();

  setStatus('MANUAL EDIT');
  saveState();
  closeQuickEditModal();
}

startClock.addEventListener('click', handleStartPause);

resetGame.addEventListener('click', resetGameHandler);

nextPeriod.addEventListener('click', nextPeriodHandler);

fullscreenToggle.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
  }
  syncFullscreenButton();
});

openQuickEdit.addEventListener('click', openQuickEditModal);
closeQuickEdit.addEventListener('click', closeQuickEditModal);
applyQuickEdit.addEventListener('click', applyQuickEditValues);

undoAction.addEventListener('click', () => {
  if (!undoSnapshot) return;

  const snapshotToRestore = undoSnapshot;
  undoSnapshot = null;
  applyStateSnapshot(snapshotToRestore);
});

clearSavedGame.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  setStatus('SAVE CLEARED');
});

quickEditModal.addEventListener('click', (event) => {
  if (event.target === quickEditModal) {
    closeQuickEditModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !quickEditModal.classList.contains('hidden')) {
    closeQuickEditModal();
  }
});

document.addEventListener('fullscreenchange', syncFullscreenButton);

homePossession.addEventListener('click', () => {
  if (isGameOver) return;
  captureUndoSnapshot();
  setPossession('home');
  resetShotClock(DEFAULT_SHOT);
  saveState();
});

awayPossession.addEventListener('click', () => {
  if (isGameOver) return;
  captureUndoSnapshot();
  setPossession('away');
  resetShotClock(OFFENSIVE_REBOUND_SHOT);
  saveState();
});

teamButtons.forEach((button) => {
  button.addEventListener('click', handleScoreClick);
});

foulButtons.forEach((button) => {
  button.addEventListener('click', handleFoulClick);
});

bindTeamNameInput(homeNameInput, homeName);
bindTeamNameInput(awayNameInput, awayName);

const didLoadState = loadState();

if (!didLoadState) {
  updateScoreboard();
  updateFoulBoard();
  renderPeriodLabel();
  gameClock.textContent = formatClock(minutes, seconds);
  resetShotClock(DEFAULT_SHOT);
  setStatus('READY');
  setPossession('home');
  updateStartButton();
  saveState();
}

syncFullscreenButton();
