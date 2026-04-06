// Supabase 클라이언트 초기화 (CDN 버전 사용)
// HTML에서 이 파일보다 먼저 Supabase CDN 스크립트를 로드하세요:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

let supabase;

function initSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('config.js에서 SUPABASE_URL을 설정해주세요.');
    return false;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

// 테이블 이름 상수
const TABLES = {
  SENTENCES: 'sentences',
  SELECTIONS: 'selections',
  STUDENTS: 'students',
};
