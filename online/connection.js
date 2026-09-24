

  const PRODUCTION_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAZvNJjUdua_EVsNtrsNcH31KB25vKC9rw",
    authDomain: "wave-omok.firebaseapp.com",
    databaseURL: "https://wave-omok-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wave-omok",
    storageBucket: "wave-omok.firebasestorage.app",
    messagingSenderId: "24140803014",
    appId: "1:24140803014:web:6d09bd7b396ce7df01e0c7"
  };
  const TEST_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDZdRq2sQeUhL39u4nKy9peR8GLHL63j1Q",
    authDomain: "omok-game-test.firebaseapp.com",
    databaseURL: "https://omok-game-test-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "omok-game-test",
    storageBucket: "omok-game-test.firebasestorage.app",
    messagingSenderId: "605667018474",
    appId: "1:605667018474:web:db2d93c355819d5cd07993"
  };

  const FIREBASE_CONFIG = ENVIRONMENT === 'production' ? PRODUCTION_FIREBASE_CONFIG : TEST_FIREBASE_CONFIG;

  const LOBBY_PATH = 'lobby';
  const ROOMS_PATH = 'rooms';

  const ROOM_LIST_PATH = 'roomList';
  const GAME_PATH = 'game';
  const CHAT_PATH = 'chat';
  const ME_KEY = STORAGE_PREFIX + 'me';
  const NICK_KEY = STORAGE_PREFIX + 'nick';
  const USERS_PATH = 'users';

  const MATCH_PATH = 'match';

  const SESSION_ONLINE_KEY = STORAGE_PREFIX + 'session-online';
  const SESSION_ROOM_KEY = STORAGE_PREFIX + 'session-room';

  let online = false;
  let gameRef = null, gameHandler = null;
  let connRef = null, connHandler = null;
  let chatRef = null, chatQuery = null, chatHandler = null, chatRemoveHandler = null;
  let usersRef = null, usersHandler = null;
  let roomListRef = null, roomListHandler = null;
  let currentRoom = null;
  let rooms = {};

  let roomWatchers = {};
  let roomCounts = {};
  let matchRef = null, matchHandler = null;
  let match = null;
  let countTimer = null;
  let seatLeftTimer = null;
  let timeOffsetRef = null, timeOffsetHandler = null;
  let timeOffset = 0;
  let nickMap = {};
  let applyingRemote = false;
  let lastSig = null;

  function ensureDb() {
    if (typeof firebase === 'undefined') return null;
    try {
      if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) return null;
      const appName = 'omok-game-' + ENVIRONMENT;
      const app = firebase.apps.find(item => item.name === appName)
        || firebase.initializeApp(FIREBASE_CONFIG, appName);
      return app.database();
    } catch (e) {
      return null;
    }
  }

  function setOnlineStatus(text) { onlineStatus.textContent = text; }

