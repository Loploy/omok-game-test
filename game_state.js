

  function resolveEnvironment(address) {
    const officialPath = address.pathname === '/omok-game'
      || address.pathname.startsWith('/omok-game/')
      || address.pathname === '/wave-omok'
      || address.pathname.startsWith('/wave-omok/');
    return address.protocol === 'https:' && address.hostname === 'loploy.github.io' && officialPath
      ? 'production' : 'test';
  }

  const ENVIRONMENT = resolveEnvironment(location);

  const STORAGE_PREFIX = ENVIRONMENT === 'production' ? 'wave-omok:' : 'omok-game:test:';
  const UI_TEXT = window.OMOK_UI_TEXT;
  document.title = UI_TEXT.title;
  for (const [id, text] of Object.entries({ gameTitle: UI_TEXT.title, modeHeading: UI_TEXT.modeHeading,
    settingsHeading: UI_TEXT.settingsHeading, waveHeading: UI_TEXT.modes.wave.name,
    waveIntensityLabel: UI_TEXT.waveIntensity, waveTangleLabel: UI_TEXT.waveTangle })) {
    document.getElementById(id).textContent = text;
  }
  let selectedModes = [];

  function normalizeModes(value, strength) {
    return MODE_OPTIONS.filter(id => Array.isArray(value) ? value.includes(id) : id === 'wave' && strength > 0);
  }

  function renderModes() {
    document.querySelectorAll('#modeChecks input').forEach(input => { input.checked = selectedModes.includes(input.value); });
    const panels = [...document.querySelectorAll('[data-mode-settings]')];
    panels.forEach(panel => { panel.hidden = !selectedModes.includes(panel.dataset.modeSettings); });
    document.getElementById('modeSettings').hidden = !panels.some(panel => !panel.hidden);
  }
  for (const id of MODE_OPTIONS) {
    const modeText = UI_TEXT.modes[id];
    const wrap = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.value = id;
    const description = modeText.description + (id === 'wave' ? '' : ' ' + UI_TEXT.pendingDescription);
    wrap.title = description;
    input.title = description;
    input.setAttribute('aria-description', description);
    wrap.append(input, document.createTextNode(' ' + modeText.name + (id === 'wave' ? '' : ' (' + UI_TEXT.pendingLabel + ')')));
    document.getElementById('modeChecks').append(wrap);
    input.addEventListener('change', () => {
      selectedModes = [...document.querySelectorAll('#modeChecks input:checked')].map(item => item.value);
      if (id === 'wave') {
        const strength = input.checked ? WAVE_DEFAULT_INTENSITY : 0;
        warpSlider.value = strength * 100; warpVal.textContent = warpSlider.value + '%';
        generateGrid(seed, strength); draw();
      }
      renderModes();
      saveSession();
    });
  }
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  let grid = [];
  let board = [];
  let turn = 1;
  let gameOver = false;
  let lastMove = null;
  let winLine = null;
  let seed = Date.now() % SEED_TIME_MODULUS;
  let intensity = 0;
  let moveHistory = [];
  let zoom = 1;

  const turnDot = document.getElementById('turnDot');
  const turnText = document.getElementById('turnText');
  const msg = document.getElementById('msg');
  const warpSlider = document.getElementById('warpSlider');
  const warpVal = document.getElementById('warpVal');
  const allowTangleCheck = document.getElementById('allowTangleCheck');
  const onlineCheck = document.getElementById('onlineCheck');
  const onlineStatus = document.getElementById('onlineStatus');
  const chatLog = document.getElementById('chatLog');
  const chatEmpty = document.getElementById('chatEmpty');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const nickInput = document.getElementById('nickInput');
  const nickModal = document.getElementById('nickModal');
  const nickModalInput = document.getElementById('nickModalInput');
  const nickOkBtn = document.getElementById('nickOkBtn');
  const nickCancelBtn = document.getElementById('nickCancelBtn');
  const adminPanel = document.getElementById('adminPanel');
  const adminMsg = document.getElementById('adminMsg');
  const roomPanel = document.getElementById('roomPanel');
  const roomWhere = document.getElementById('roomWhere');
  const roomLeaveBtn = document.getElementById('roomLeaveBtn');
  const roomBrowse = document.getElementById('roomBrowse');
  const roomTitleInput = document.getElementById('roomTitleInput');
  const roomMaxNew = document.getElementById('roomMaxNew');
  const roomMaxRow = document.getElementById('roomMaxRow');
  const roomMaxInput = document.getElementById('roomMaxInput');
  const roomCreateBtn = document.getElementById('roomCreateBtn');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const roomJoinBtn = document.getElementById('roomJoinBtn');
  const roomListEl = document.getElementById('roomList');
  const roomInvite = document.getElementById('roomInvite');
  const roomInviteLink = document.getElementById('roomInviteLink');
  const roomCopyBtn = document.getElementById('roomCopyBtn');
  const roomMsg = document.getElementById('roomMsg');
  const matchPanel = document.getElementById('matchPanel');
  const matchState = document.getElementById('matchState');
  const matchPlayers = document.getElementById('matchPlayers');
  const readyBtn = document.getElementById('readyBtn');
  const pickBlackBtn = document.getElementById('pickBlackBtn');
  const pickWhiteBtn = document.getElementById('pickWhiteBtn');
  const matchOkBtn = document.getElementById('matchOkBtn');
  const boardScroll = document.getElementById('boardScroll');
  const zoomVal = document.getElementById('zoomVal');

