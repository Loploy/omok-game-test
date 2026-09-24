

window.OMOK_UI_TEXT = {
  account: {
    settingsBtn: '설정', settingsTitle: '설정', googleLoginBtn: 'Google 로그인', logoutBtn: '로그아웃',
    nicknameLabel: '닉네임', colorLabel: '기본 돌 색', profileSaveBtn: '저장', settingsCloseBtn: '닫기',
    guest: '손님 · 이 브라우저에 저장', signedIn: 'Google 계정 · 계정에 저장', saved: '저장됨',
    leaveRoom: '로그인·로그아웃은 로비에서 가능합니다.', nicknameRequired: '닉네임을 입력해주세요.',
    colors: { black: '검정', white: '흰색', red: '빨강', orange: '주황', yellow: '노랑', green: '초록', blue: '파랑', purple: '보라' },
    errors: {
      'auth/operation-not-allowed': 'Firebase에서 Google 로그인을 활성화해주세요.',
      'auth/unauthorized-domain': 'Firebase 승인된 도메인에 현재 사이트를 추가해주세요.',
      'auth/popup-blocked': '팝업 허용 후 다시 로그인해주세요.',
      'auth/popup-closed-by-user': '로그인을 취소했습니다.',
      'PERMISSION_DENIED': '계정 저장 권한이 없습니다. 테스트 DB의 profiles 규칙을 확인해주세요.',
      'auth/network-request-failed': '인터넷 연결을 확인해주세요.',
      default: '처리하지 못했습니다. 연결과 Firebase 설정을 확인 후 다시 시도해주세요.'
    }
  },
  title: '오목',
  modeHeading: '모드',
  settingsHeading: '모드 설정',
  pendingLabel: '준비 중',
  pendingDescription: '현재 선택만 가능하며 게임에는 적용되지 않습니다.',
  waveIntensity: '삐뚤빼뚤 정도',
  waveTangle: '위치 꼬임 허용',
  modes: {
    skill: { name: '스킬', description: '스킬을 사용하는 모드. 세부 규칙 준비 중.' },
    wave: { name: '웨이브', description: '격자 선을 구불구불하게 만듭니다. 오목 판정은 원래 격자를 따릅니다.' },
    '3d': { name: '3D', description: '3D 모드. 세부 규칙 준비 중.' },
    fight: { name: '싸움', description: '싸움 모드. 세부 규칙 준비 중.' },
    rps: { name: '가위바위보', description: '가위바위보 모드. 세부 규칙 준비 중.' },
    disaster: { name: '자연재해', description: '자연재해 모드. 세부 규칙 준비 중.' },
    teams: { name: 'n vs n', description: '팀 대결 모드. 세부 규칙 준비 중.' },
    blind: { name: '블라인드', description: '블라인드 모드. 세부 규칙 준비 중.' },
    moving: { name: '판 움직임', description: '판 움직임 모드. 세부 규칙 준비 중.' },
    'multi-stone': { name: '돌 n개씩', description: '한 차례에 여러 돌을 놓는 모드. 세부 규칙 준비 중.' }
  }
};
