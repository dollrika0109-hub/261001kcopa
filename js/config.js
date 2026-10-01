/* =========================================================================
 * 앱 설정 (배포 환경에 맞게 이 파일만 수정하면 됩니다)
 * ========================================================================= */
window.APP_CONFIG = {
  appVersion: '1.0.0',

  storage: {
    /*
     * 'auto'     : 동봉된 Node 서버(server/server.js)로 접속하면 서버에 중앙 저장,
     *              index.html 파일을 더블클릭해 열면 이 브라우저(localStorage)에 저장
     * 'local'    : 항상 이 브라우저에만 저장 (개인 테스트용)
     * 'server'   : 항상 동봉된 Node 서버 API에 저장
     * 'supabase' : Supabase에 저장 (아래 supabase 항목 입력 필요)
     * 'gsheet'   : 구글 시트에 저장 (아래 googleSheets 항목 입력 필요, google-sheets/Code.gs 참고)
     */
    mode: 'gsheet',

    // 'server' 모드에서 API 주소. 같은 서버에서 페이지를 제공하면 빈 문자열 그대로 두세요.
    serverBaseUrl: '',

    googleSheets: {
      webAppUrl: 'https://script.google.com/macros/s/AKfycbwcbK7zMa_SoCoaYjL_73hUb_ktVcqpCIj0LDixAvgMeAS4--SXtvwP1wZurP7fvcn0RA/exec'
    },

    supabase: {
      url: '',          // 예: 'https://abcdefgh.supabase.co'
      anonKey: '',      // Supabase 프로젝트의 anon public key
      submitRpc: 'submit_mock_report',
      table: 'mock_reports'
    }
  },

  admin: {
    // 'local' 모드 관리자 비밀번호의 SHA-256 해시 (기본 비밀번호: kcopa1234)
    // 변경 방법: README.md의 "관리자 비밀번호 변경" 참고
    localPasswordSha256: '7ce4e5352f2e40cffaeb9df9a590944a02d2f90e1cc6901b561f7b6081f13a83'
  },

  participant: {
    // true면 시작 전에 참가자 성명/소속 입력을 필수로 받습니다 (결과 집계용)
    required: true
  },

  game: {
    // 신고유형을 이 횟수 이상 틀리면 CASE별 힌트를 보여줍니다 (0이면 힌트 없음)
    hintAfterWrongAttempts: 2,
    // 접수 애니메이션 최소 시간(ms)
    sendingAnimationMs: 2600
  }
};
