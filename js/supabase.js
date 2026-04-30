// Supabase 클라이언트
// 사전 로드 필요: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js

// CDN 로드 후 window.supabase 가 Supabase 모듈을 가리킴.
// initSupabase() 호출 뒤부터 아래 'db' 변수를 클라이언트로 사용.
var db;

function initSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('js/config.js에서 SUPABASE_URL을 설정해주세요.');
    return false;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

// HTML 특수문자 이스케이프 (XSS 방지)
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 테이블 이름 상수
const TABLES = {
  SETTINGS:    'settings',
  ROUNDS:      'rounds',
  SUBMISSIONS: 'submissions',
  WIN_HISTORY: 'win_history',
  WIN_RECORDS: 'win_records',
  STUDENTS:    'students',
};
