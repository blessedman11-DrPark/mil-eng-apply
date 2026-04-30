// stats.js

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) return;

  let barChart = null;
  let winHistoryData = [];
  let sortMode = 'wins'; // 'wins' | 'id'

  function fmt(iso) {
    if (!iso) return '-';
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleDateString('ko-KR');
  }
  function empty(tbodyId, cols) {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${cols}" class="text-center text-muted" style="padding:1rem">데이터가 없습니다</td></tr>`;
  }

  // ════════ 정렬 버튼 ════════
  function renderChart() {
    if (!winHistoryData.length) return;
    const sorted = [...winHistoryData].sort((a, b) => {
      if (sortMode === 'id') return String(a.student_id).localeCompare(String(b.student_id));
      if (b.win_count !== a.win_count) return b.win_count - a.win_count;
      return String(a.student_id).localeCompare(String(b.student_id));
    });
    const labels = sorted.map(h => h.student_id);
    const values = sorted.map(h => h.win_count);
    const maxVal = Math.max(...values);
    const colors = values.map(v => {
      const ratio = maxVal > 0 ? v / maxVal : 0;
      const r = Math.round(197 + (26 - 197) * ratio);
      const g = Math.round(216 + (71 - 216) * ratio);
      const b = Math.round(255 + (214 - 255) * ratio);
      return `rgb(${r},${g},${b})`;
    });
    document.getElementById('chart-wrap').style.width = Math.max(500, labels.length * 64) + 'px';
    const ctx = document.getElementById('bar-chart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
      type: 'bar',
      plugins: [ChartDataLabels],
      data: { labels, datasets: [{ label: '당첨 횟수', data: values, backgroundColor: colors, borderRadius: 5, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 24 } },
        plugins: {
          legend: { display: false },
          title: { display: false },
          datalabels: { anchor: 'end', align: 'end', color: '#333', font: { weight: 'bold', size: 12 }, formatter: v => v, clip: false },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#eaeef5' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderRankTable() {
    if (!winHistoryData.length) return;
    const sorted = [...winHistoryData].sort((a, b) => {
      if (sortMode === 'id') return String(a.student_id).localeCompare(String(b.student_id));
      if (b.win_count !== a.win_count) return b.win_count - a.win_count;
      return String(a.student_id).localeCompare(String(b.student_id));
    });
    document.getElementById('tbody-rank').innerHTML = sorted.map((h, i) => `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(h.student_id)}</td>
      <td>${escHtml(h.student_name)}</td>
      <td>${escHtml(h.win_count)}</td>
      <td>${fmtDate(h.last_won_at)}</td>
    </tr>`).join('');
  }

  document.getElementById('sort-by-wins').addEventListener('click', () => {
    sortMode = 'wins';
    document.getElementById('sort-by-wins').classList.add('active');
    document.getElementById('sort-by-id').classList.remove('active');
    renderChart();
    renderRankTable();
  });
  document.getElementById('sort-by-id').addEventListener('click', () => {
    sortMode = 'id';
    document.getElementById('sort-by-id').classList.add('active');
    document.getElementById('sort-by-wins').classList.remove('active');
    renderChart();
    renderRankTable();
  });

  // ════════ 탭 전환 ════════
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'rounds') loadRoundsTab();
    });
  });

  // ════════ 새로고침 ════════
  document.getElementById('refresh-btn').addEventListener('click', loadAll);

  // ════════════════════════════════════════════════════════════
  // 탭1: 학생별 현황
  // ════════════════════════════════════════════════════════════
  async function loadStudentsTab() {
    const { data: wh } = await db.from(TABLES.WIN_HISTORY).select('*').order('win_count', { ascending: false });
    winHistoryData = wh || [];

    if (!winHistoryData.length) {
      document.getElementById('chart-empty').classList.remove('hidden');
      document.getElementById('chart-wrap').style.display = 'none';
      empty('tbody-rank', 5);
      return;
    }

    document.getElementById('chart-empty').classList.add('hidden');
    document.getElementById('chart-wrap').style.display = '';

    renderChart();
    renderRankTable();

    // ── 미당첨: submissions에서 win_history에 없는 학생 ──
    const [{ data: subs }, { data: allStudents }] = await Promise.all([
      db.from(TABLES.SUBMISSIONS).select('student_id,student_name'),
      db.from(TABLES.STUDENTS).select('student_id, student_name').order('student_id'),
    ]);

    if (subs?.length) {
      const wonIds = new Set(wh.map(h => h.student_id));
      const noWin = subs.filter(s => !wonIds.has(s.student_id));
      const sec = document.getElementById('no-win-section');
      if (noWin.length) {
        sec.style.display = '';
        document.getElementById('no-win-list').textContent =
          noWin.map(s => `${s.student_name} (${s.student_id})`).join(', ');
      } else {
        sec.style.display = 'none';
      }
    }

    // ── 미신청: students에서 submissions에 없는 학생 ──
    const noApplySec = document.getElementById('no-apply-section');
    if (allStudents?.length) {
      const appliedIds = new Set((subs || []).map(s => s.student_id));
      const noApply = allStudents.filter(s => !appliedIds.has(s.student_id));
      if (noApply.length) {
        noApplySec.style.display = '';
        document.getElementById('no-apply-count').textContent = `(${noApply.length}명)`;
        document.getElementById('no-apply-list').textContent = noApply.map(s => `${s.student_name} (${s.student_id})`).join(', ');
      } else {
        noApplySec.style.display = 'none';
      }
    } else {
      noApplySec.style.display = 'none';
    }
  }

  // ════════════════════════════════════════════════════════════
  // 탭2: 회차별 기록
  // ════════════════════════════════════════════════════════════
  async function loadRoundsTab() {
    const [{ data: rounds }, { data: wr }] = await Promise.all([
      db.from(TABLES.ROUNDS).select('*').order('round_number', { ascending: false }),
      db.from(TABLES.WIN_RECORDS).select('*'),
    ]);

    // 드롭다운
    const sel = document.getElementById('round-select');
    sel.innerHTML = '<option value="">-- 회차를 선택하세요 --</option>' +
      (rounds || []).map(r => `<option value="${r.id}">${r.round_number}회차 (${fmtDate(r.executed_at)})</option>`).join('');

    // 회차 요약 테이블
    if (!rounds?.length) { empty('tbody-rounds-summary', 3); }
    else {
      const countMap = {};
      (wr || []).forEach(r => { countMap[r.round_id] = (countMap[r.round_id] || 0) + 1; });
      document.getElementById('tbody-rounds-summary').innerHTML = rounds.map(r => `<tr>
        <td>${escHtml(r.round_number)}회차</td>
        <td>${fmtDate(r.executed_at)}</td>
        <td>${escHtml(countMap[r.id] || 0)}명</td>
      </tr>`).join('');
    }

    // 회차 선택 핸들러
    sel.addEventListener('change', async () => {
      const rid = parseInt(sel.value);
      const detailSec = document.getElementById('round-detail-section');
      if (!rid) { detailSec.style.display = 'none'; return; }

      const round = (rounds || []).find(r => r.id === rid);
      const { data: records } = await db.from(TABLES.WIN_RECORDS).select('*')
        .eq('round_id', rid).order('assigned_sentence');

      detailSec.style.display = '';
      document.getElementById('round-detail-title').textContent =
        `${round?.round_number}회차 당첨자 목록`;

      if (!records?.length) { empty('tbody-round-detail', 4); return; }
      document.getElementById('tbody-round-detail').innerHTML = records.map(r => `<tr>
        <td>${escHtml(r.student_id)}</td><td>${escHtml(r.student_name)}</td>
        <td>${escHtml(r.assigned_sentence)}번</td><td>${fmt(r.won_at)}</td>
      </tr>`).join('');
    });
  }

  async function loadAll() {
    await loadStudentsTab();
    // 탭2는 탭 전환 시 로드
  }

  await loadAll();
});
