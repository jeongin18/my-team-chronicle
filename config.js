// ─────────────────────────────────────────────────────────────
// 「나의 팀 연대기」 설정 파일
// Firebase 콘솔에서 웹 앱을 만든 뒤 나오는 firebaseConfig 값을 아래에 붙여 넣으세요.
// apiKey가 비어 있으면 '체험 모드'로 동작합니다(이 브라우저 안에만 저장).
// ─────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // 교사 화면(teacher.html) 입장 비밀번호. 수업 전에 바꿔 주세요.
  teacherPin: "1982",
  // 저장 위치 이름. 학기·반마다 따로 쓰고 싶으면 바꾸세요(예: "chronicle-2026-2").
  collection: "chronicle-2026"
};
