// stats.js — 선택 현황 통계 로직

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) return;

  const totalStudentsEl = document.getElementById('total-students');
  const selectedStudentsEl = document.getElementById('selected-students');
  const totalSentencesEl = document.getElementById('total-sentences');
  const tableBody = document.getElementById('stats-table-body');

  const { data: sentences } = await supabase.from(TABLES.SENTENCES).select('*').order('id');
  const { data: selections } = await supabase.from(TABLES.SELECTIONS).select('*');
  const { data: students } = await supabase.from(TABLES.STUDENTS).select('*');

  const allSentences = sentences || [];
  const allSelections = selections || [];
  const allStudents = students || [];

  // 요약 통계
  const uniqueSelectedStudents = new Set(allSelections.map(s => s.student_id)).size;
  totalStudentsEl.textContent = allStudents.length || uniqueSelectedStudents;
  selectedStudentsEl.textContent = uniqueSelectedStudents;
  totalSentencesEl.textContent = allSentences.length;

  // 문장별 집계
  tableBody.innerHTML = '';
  allSentences.forEach((s, idx) => {
    const sels = allSelections.filter(sel => sel.sentence_id === s.id);
    const names = sels.map(sel => escapeHtml(sel.student_name || sel.student_id)).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(s.sentence)}</td>
      <td>${s.category ? escapeHtml(s.category) : '-'}</td>
      <td>${sels.length}</td>
      <td>${names || '-'}</td>
    `;
    tableBody.appendChild(tr);
  });

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
