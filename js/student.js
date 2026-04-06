// student.js — 학생 문장 선택 로직

document.addEventListener('DOMContentLoaded', () => {
  if (!initSupabase()) return;

  const loginSection = document.getElementById('login-section');
  const sentenceSection = document.getElementById('sentence-section');
  const resultSection = document.getElementById('result-section');
  const loginForm = document.getElementById('student-login-form');
  const sentenceList = document.getElementById('sentence-list');
  const confirmBtn = document.getElementById('confirm-btn');
  const resetBtn = document.getElementById('reset-btn');
  const studentInfoEl = document.getElementById('student-info');
  const resultInfoEl = document.getElementById('result-info');

  let currentStudent = null;
  let selectedSentenceId = null;
  let allSentences = [];
  let allSelections = [];

  // 로그인
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('student-id').value.trim();
    const studentName = document.getElementById('student-name').value.trim();
    if (!studentId || !studentName) return;

    currentStudent = { id: studentId, name: studentName };
    await loadSentences();
  });

  async function loadSentences() {
    const { data: sentences, error: sErr } = await supabase
      .from(TABLES.SENTENCES)
      .select('*')
      .order('id');

    const { data: selections, error: selErr } = await supabase
      .from(TABLES.SELECTIONS)
      .select('*');

    if (sErr || selErr) {
      alert('데이터를 불러오는 중 오류가 발생했습니다.');
      return;
    }

    allSentences = sentences || [];
    allSelections = selections || [];

    // 이미 선택 확정된 경우
    const mySelection = allSelections.find(s => s.student_id === currentStudent.id);
    if (mySelection) {
      const mySentence = allSentences.find(s => s.id === mySelection.sentence_id);
      showResult(mySentence);
      return;
    }

    renderSentenceList();
  }

  function renderSentenceList() {
    loginSection.classList.add('hidden');
    sentenceSection.classList.remove('hidden');
    studentInfoEl.textContent = `${currentStudent.name} (${currentStudent.id}) 학생`;

    const counts = countSelections(allSentences, allSelections);
    const available = getAvailableSentences(allSentences, allSelections, currentStudent.id);
    const sorted = sortByLeastSelected(available, counts);

    sentenceList.innerHTML = '';
    sorted.forEach(s => {
      const item = document.createElement('div');
      item.className = 'sentence-item';
      item.dataset.id = s.id;
      item.innerHTML = `
        <div class="eng">${escapeHtml(s.sentence)}</div>
        ${s.translation ? `<div class="kor">${escapeHtml(s.translation)}</div>` : ''}
        ${s.category ? `<span class="category-badge">${escapeHtml(s.category)}</span>` : ''}
      `;
      item.addEventListener('click', () => selectSentence(item, s.id));
      sentenceList.appendChild(item);
    });
  }

  function selectSentence(item, id) {
    document.querySelectorAll('.sentence-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    selectedSentenceId = id;
    confirmBtn.disabled = false;
  }

  confirmBtn.addEventListener('click', async () => {
    if (!selectedSentenceId) return;
    confirmBtn.disabled = true;

    const { error } = await supabase.from(TABLES.SELECTIONS).insert({
      student_id: currentStudent.id,
      student_name: currentStudent.name,
      sentence_id: selectedSentenceId,
    });

    if (error) {
      alert('선택 저장 중 오류가 발생했습니다: ' + error.message);
      confirmBtn.disabled = false;
      return;
    }

    const chosen = allSentences.find(s => s.id === selectedSentenceId);
    showResult(chosen);
  });

  function showResult(sentence) {
    loginSection.classList.add('hidden');
    sentenceSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    resultInfoEl.innerHTML = sentence
      ? `<p><strong>선택한 문장:</strong></p>
         <div class="sentence-item selected">
           <div class="eng">${escapeHtml(sentence.sentence)}</div>
           ${sentence.translation ? `<div class="kor">${escapeHtml(sentence.translation)}</div>` : ''}
           ${sentence.category ? `<span class="category-badge">${escapeHtml(sentence.category)}</span>` : ''}
         </div>`
      : '<p>선택 정보를 불러올 수 없습니다.</p>';
  }

  resetBtn.addEventListener('click', () => {
    currentStudent = null;
    selectedSentenceId = null;
    loginForm.reset();
    resultSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
