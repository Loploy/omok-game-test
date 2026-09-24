
const STONE_COLORS = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const DEFAULT_STONE_COLOR = STONE_COLORS[0];
const PROFILE_NICK_MAX_LENGTH = 12;
const GUEST_PROFILE_KEY = STORAGE_PREFIX + 'guest-profile';
let accountUser = null;
let accountAuth = null;
let accountProfile = null;
let accountRevision = 0;
let accountReady = false;
let accountBusy = false;

function normalizeProfile(raw, fallbackName) {
  return {
    nickname: (typeof raw?.nickname === 'string' ? raw.nickname.trim() : '').slice(0, PROFILE_NICK_MAX_LENGTH)
      || fallbackName.trim().slice(0, PROFILE_NICK_MAX_LENGTH) || '손님',
    stoneColor: STONE_COLORS.includes(raw?.stoneColor) ? raw.stoneColor : DEFAULT_STONE_COLOR
  };
}

function readGuestProfile() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(GUEST_PROFILE_KEY)); } catch (e) {  }
  loadNick();
  return normalizeProfile(raw, getNick());
}

function showAccountError(error) {
  document.getElementById('accountMessage').textContent = UI_TEXT.account.errors[error.code]
    || UI_TEXT.account.errors.default;
}

function renderAccount() {
  const text = UI_TEXT.account;
  document.getElementById('accountStatus').textContent = accountUser ? text.signedIn : text.guest;
  document.getElementById('googleLoginBtn').hidden = !!accountUser;
  document.getElementById('logoutBtn').hidden = !accountUser;
  document.getElementById('googleLoginBtn').disabled = accountBusy || !accountAuth || !!currentRoom;
  document.getElementById('logoutBtn').disabled = accountBusy || !!currentRoom;
  document.getElementById('profileSaveBtn').disabled = !accountReady || accountBusy;
  document.getElementById('profileNickname').disabled = !accountReady || accountBusy;
  document.getElementById('profileColor').disabled = !accountReady || accountBusy;
  if (accountProfile) {
    document.getElementById('profileNickname').value = accountProfile.nickname;
    document.getElementById('profileColor').value = accountProfile.stoneColor;
  }
  renderColorChoices();
}

async function applyAccountUser(user) {
  const revision = ++accountRevision;
  if (online) disconnectOnline();
  accountUser = user;
  accountReady = false;
  accountProfile = null;
  document.getElementById('accountMessage').textContent = '';
  renderAccount();
  try {
    let profile;
    if (user) {
      const snap = await ensureDb().ref('profiles/' + user.uid).once('value');
      profile = normalizeProfile(snap.val(), user.displayName || '플레이어');
    } else {
      profile = readGuestProfile();
    }
    if (revision !== accountRevision) return;
    accountProfile = profile;
    accountReady = true;
    nickInput.value = profile.nickname;
  } catch (error) {
    if (revision !== accountRevision) return;
    nickInput.value = user?.displayName?.slice(0, PROFILE_NICK_MAX_LENGTH) || '플레이어';
    showAccountError(error);
  }
  if (revision !== accountRevision) return;

  nickInput.readOnly = true;
  onlineCheck.checked = true;
  connectOnline();
  renderAccount();
}

async function changeAccount(signOut) {
  if (!accountAuth || accountBusy) return;
  if (currentRoom) {
    document.getElementById('accountMessage').textContent = UI_TEXT.account.leaveRoom;
    return;
  }
  accountBusy = true;
  renderAccount();
  try {
    if (signOut) await accountAuth.signOut();
    else await accountAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (error) {
    showAccountError(error);
  } finally {
    accountBusy = false;
    renderAccount();
  }
}

async function saveAccountProfile() {
  if (!accountReady || accountBusy) return;
  const nickname = document.getElementById('profileNickname').value.trim();
  if (!nickname) {
    document.getElementById('accountMessage').textContent = UI_TEXT.account.nicknameRequired;
    return;
  }
  const profile = normalizeProfile({ nickname, stoneColor: document.getElementById('profileColor').value }, nickname);
  const revision = accountRevision;
  accountBusy = true;
  try {
    if (accountUser) await ensureDb().ref('profiles/' + accountUser.uid).update(profile);
    else {
      localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(NICK_KEY, profile.nickname);
    }
    if (revision !== accountRevision) return;
    accountProfile = profile;
    nickInput.value = profile.nickname;
    await recolorMyStones(profile.stoneColor);
    publishNick();
    document.getElementById('accountMessage').textContent = UI_TEXT.account.saved;
    document.getElementById('settingsDialog').close();
  } catch (error) {
    if (revision === accountRevision) showAccountError(error);
  } finally {
    accountBusy = false;
    renderAccount();
  }
}

function initializeAccount() {
  const text = UI_TEXT.account;
  for (const id of ['settingsBtn', 'settingsTitle', 'googleLoginBtn', 'logoutBtn', 'nicknameLabel', 'colorLabel', 'profileSaveBtn', 'settingsCloseBtn']) {
    document.getElementById(id).textContent = text[id];
  }
  for (const color of STONE_COLORS) {
    const option = document.createElement('option');
    option.value = color;
    option.textContent = text.colors[color];
    document.getElementById('profileColor').append(option);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-choice';
    button.style.backgroundColor = color;
    button.dataset.color = color;
    button.title = text.colors[color];
    button.setAttribute('aria-label', text.colors[color]);
    button.addEventListener('click', () => {
      document.getElementById('profileColor').value = color;
      renderColorChoices();
    });
    document.getElementById('colorChoices').append(button);
  }
  const dialog = document.getElementById('settingsDialog');
  document.getElementById('settingsBtn').addEventListener('click', () => {
    renderAccount();
    if (currentRoom) document.getElementById('accountMessage').textContent = text.leaveRoom;
    dialog.showModal();
    if (!accountReady && accountAuth && !accountBusy && !currentRoom) applyAccountUser(accountAuth.currentUser);
  });
  document.getElementById('settingsCloseBtn').addEventListener('click', () => dialog.close());
  document.getElementById('googleLoginBtn').addEventListener('click', () => changeAccount(false));
  document.getElementById('logoutBtn').addEventListener('click', () => changeAccount(true));
  document.getElementById('profileSaveBtn').addEventListener('click', saveAccountProfile);
  const db = ensureDb();
  if (!db || typeof firebase.auth !== 'function') {
    applyAccountUser(null);
    return;
  }
  accountAuth = firebase.app('omok-game-' + ENVIRONMENT).auth();
  accountAuth.onAuthStateChanged(applyAccountUser, showAccountError);
}

function renderColorChoices() {
  document.querySelectorAll('#colorChoices .color-choice').forEach(button => {
    const selected = button.dataset.color === document.getElementById('profileColor').value;
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = !accountReady || accountBusy;
  });
}
