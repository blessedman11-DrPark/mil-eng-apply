// professor.js — 교수 문장 관리 로직

document.addEventListener('DOMContentLoaded', () => {
  if (!initSupabase()) return;

  const loginSection = document.getElementById('login-section');
  const manageSection = document.getElementById('manage-section');
  const loginForm = document.getElementById('professor-login-form');
  const addBtn = document.getElementById('add-sentence-btn');
  const cancelAddBtn = document.getElementById('cancel-add-btn');
  const addForm = document.getElementById('add-form');
  const sentenceAddForm = document.getElementById('sentence-add-form');
  const resetAllBtn = document.getElementById('reset-all-btn');
  const tableBody = document.getElementById('sentence-table-body');

  let allSentences = [];
  let selectionCounts = {};

  // 로그인
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('professor-pw').value;
    if (pw === PROFESSOR_PASSWORD) {
      loginSection.classList.add('hidden');
      manageSection.classList.remove('hidden');
      loadData();
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  });

  async function loadData() {
    const { data: sentences } = await supabase.from(TABLES.SENTENCES).select('*').order('id');
    const { data: selections } = await supabase.from(TABLES.SELECTIONS).select('*');

    allSentences = sentences || [];
    const counts = {};
    allSentences.forEach(s => { counts[s.id] = 0; });
    (selections || []).forEach(sel => {
      if (counts[sel.sentence_id] !== undefined) counts[sel.sentence_id]++;
    });
    selectionCounts = counts;

    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';
    allSentences.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(s.sentence)}</td>
        <td>${s.category ? escapeHtml(s.category) : '-'}</td>
        <td>${selectionCounts[s.id] || 0}</td>
        <td>
          <button class="btn-danger btn-sm" data-id="${s.id}" data-action="delete">삭제</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // 문장 추가 폼 토글
  addBtn.addEventListener('click', () => addForm.classList.remove('hidden'));
  cancelAddBtn.addEventListener('click', () => {
    addForm.classList.add('hidden');
    sentenceAddForm.reset();
  });

  sentenceAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sentence = document.getElementById('new-sentence').value.trim();
    const translation = document.getElementById('new-translation').value.trim();
    const category = document.getElementById('new-category').value.trim();

    const { error } = await supabase.from(TABLES.SENTENCES).insert({ sentence, translation, category });
    if (error) {
      alert('추가 실패: ' + error.message);
      return;
    }
    sentenceAddForm.reset();
    addForm.classList.add('hidden');
    await loadData();
  });

  // 테이블 액션 (삭제)
  tableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = parseInt(btn.dataset.id);
    if (btn.dataset.action === 'delete') {
      if (!confirm('이 문장을 삭제하시겠습니까?')) return;
      await supabase.from(TABLES.SELECTIONS).delete().eq('sentence_id', id);
      await supabase.from(TABLES.SENTENCES).delete().eq('id', id);
      await loadData();
    }
  });

  // 전체 선택 초기화
  resetAllBtn.addEventListener('click', async () => {
    if (!confirm('모든 학생의 선택을 초기화하시겠습니까?')) return;
    const { error } = await supabase.from(TABLES.SELECTIONS).delete().neq('id', 0);
    if (error) {
      alert('초기화 실패: ' + error.message);
      return;
    }
    await loadData();
    alert('전체 선택이 초기화되었습니다.');
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
