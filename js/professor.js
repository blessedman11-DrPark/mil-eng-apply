// professor.js

document.addEventListener('DOMContentLoaded', async () => {
  if (!sessionStorage.getItem('prof_auth')) {
    location.href = 'mil_eng_apply.html';
    return;
  }
  if (!initSupabase()) return;

  // ════════ 유틸 ════════
  function showToast(msg, type = '') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 280); }, 3200);
  }

  function fmt(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('ko-KR');
  }
  function empty(tbodyId, cols, msg = '데이터가 없습니다') {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${cols}" class="text-center text-muted" style="padding:1rem">${msg}</td></tr>`;
  }

  // ════════ 확인 모달 ════════
  const confirmModal = document.getElementById('confirm-modal');
  let pendingConfirm = null;

  function showConfirm({ title, message, requireInput = false, inputExpected = '', danger = true }) {
    return new Promise(resolve => {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-msg').textContent  = message;
      const wrap  = document.getElementById('confirm-input-wrap');
      const input = document.getElementById('confirm-input');
      if (requireInput) {
        document.getElementById('confirm-input-label').textContent = `'${inputExpected}'를 입력하세요`;
        input.value = '';
        wrap.classList.remove('hidden');
        setTimeout(() => input.focus(), 80);
      } else {
        wrap.classList.add('hidden');
      }
      document.getElementById('confirm-ok-btn').className =
        'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      confirmModal.classList.add('open');
      pendingConfirm = { resolve, requireInput, inputExpected };
    });
  }

  function resolveConfirm(ok) {
    if (!pendingConfirm) return;
    if (ok && pendingConfirm.requireInput) {
      const val = document.getElementById('confirm-input').value;
      if (val !== pendingConfirm.inputExpected) {
        showToast('입력값이 올바르지 않습니다.', 'error');
        return;
      }
    }
    confirmModal.classList.remove('open');
    const { resolve } = pendingConfirm;
    pendingConfirm = null;
    resolve(ok);
  }

  document.getElementById('confirm-ok-btn').addEventListener('click', () => resolveConfirm(true));
  document.getElementById('confirm-cancel-btn').addEventListener('click', () => resolveConfirm(false));
  confirmModal.addEventListener('click', e => { if (e.target === confirmModal) resolveConfirm(false); });

  // ════════ 체크박스 헬퍼 ════════
  function getChecked(sel) {
    return [...document.querySelectorAll(sel + ':checked')].map(el => el.dataset.id);
  }
  function bindCheckAll(masterId, rowSel) {
    const master = document.getElementById(masterId);
    if (!master) return;
    const fresh = master.cloneNode(true);
    master.replaceWith(fresh);
    fresh.addEventListener('change', () => {
      document.querySelectorAll(rowSel).forEach(cb => { cb.checked = fresh.checked; });
    });
  }

  // ════════ 탭 전환 ════════
  let realtimeReady = false;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById('tab-' + tabId).classList.add('active');
      if (tabId === 'status' && !realtimeReady) { realtimeReady = true; setupRealtime(); }
      if (tabId === 'results') loadResults();
      if (tabId === 'statistics') loadStatistics();
    });
  });

  // ════════════════════════════════════════════════════════════
  // 탭1: 설정
  // ════════════════════════════════════════════════════════════
  async function loadSettings() {
    const { data: s } = await db.from(TABLES.SETTINGS).select('*').single();
    if (!s) return;
    document.getElementById('total-sentences-input').value = s.total_sentences;
    document.getElementById('is-open-toggle').checked = s.is_open;
    document.getElementById('is-open-label').textContent = s.is_open ? '허용 중' : '마감됨';

    const { data: rounds } = await db.from(TABLES.ROUNDS).select('round_number')
      .order('round_number', { ascending: false }).limit(1);
    document.getElementById('current-round-info').textContent =
      rounds?.[0] ? `현재 ${rounds[0].round_number}회차` : '회차 없음 (새 회차를 시작해주세요)';
  }

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('total-sentences-input').value);
    if (!val || val < 1) { showToast('올바른 숫자를 입력하세요.', 'error'); return; }
    const { error } = await db.from(TABLES.SETTINGS).update({ total_sentences: val }).eq('id', 1);
    if (error) { showToast('저장 실패: ' + error.message, 'error'); return; }
    showToast('저장되었습니다.', 'success');
  });

  document.getElementById('is-open-toggle').addEventListener('change', async e => {
    const isOpen = e.target.checked;
    const { error } = await db.from(TABLES.SETTINGS).update({ is_open: isOpen }).eq('id', 1);
    if (error) { showToast('업데이트 실패', 'error'); e.target.checked = !isOpen; return; }
    document.getElementById('is-open-label').textContent = isOpen ? '허용 중' : '마감됨';
    showToast(isOpen ? '제출이 허용되었습니다.' : '제출이 마감되었습니다.', 'success');
  });

  document.getElementById('new-round-btn').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: '새 회차 시작',
      message: '제출 데이터가 모두 삭제되고 새 회차가 시작됩니다. 계속하시겠습니까?',
    });
    if (!ok) return;
    const { data: rounds } = await db.from(TABLES.ROUNDS).select('round_number')
      .order('round_number', { ascending: false }).limit(1);
    const next = (rounds?.[0]?.round_number || 0) + 1;
    await db.from(TABLES.SUBMISSIONS).delete().neq('id', 0);
    await db.from(TABLES.ROUNDS).insert({ round_number: next });
    await db.from(TABLES.SETTINGS).update({ is_assigned: false }).eq('id', 1);
    await loadSettings();
    showToast(`${next}회차가 시작되었습니다.`, 'success');
  });

  // ── 아코디언: 제출 데이터 ──
  document.getElementById('accordion-submissions').addEventListener('toggle', function() {
    if (this.open) loadSubAccordion();
  });
  async function loadSubAccordion() {
    const { data } = await db.from(TABLES.SUBMISSIONS).select('*').order('created_at');
    const tbody = document.getElementById('tbody-submissions');
    if (!data?.length) { empty('tbody-submissions', 7); return; }
    tbody.innerHTML = data.map(s => `<tr>
      <td><input type="checkbox" class="row-check sub-ck" data-id="${s.id}"/></td>
      <td>${s.student_id}</td><td>${s.student_name}</td>
      <td>${s.choice1 ?? '-'}</td><td>${s.choice2 ?? '-'}</td><td>${s.choice3 ?? '-'}</td>
      <td>${fmt(s.created_at)}</td>
    </tr>`).join('');
    bindCheckAll('chk-all-sub', '.sub-ck');
  }
  document.getElementById('del-sel-submissions').addEventListener('click', async () => {
    const ids = getChecked('.sub-ck');
    if (!ids.length) { showToast('삭제할 항목을 선택해주세요.', 'error'); return; }
    const ok = await showConfirm({ title: '선택 삭제', message: `선택한 ${ids.length}명의 제출 데이터를 삭제하시겠습니까?` });
    if (!ok) return;
    await db.from(TABLES.SUBMISSIONS).delete().in('id', ids.map(Number));
    await loadSubAccordion();
    showToast(`${ids.length}건이 삭제되었습니다.`, 'success');
  });
  document.getElementById('del-all-submissions').addEventListener('click', async () => {
    const ok = await showConfirm({ title: '전체 삭제', message: '제출 데이터를 모두 삭제하시겠습니까?' });
    if (!ok) return;
    await db.from(TABLES.SUBMISSIONS).delete().neq('id', 0);
    await loadSubAccordion();
    showToast('전체 삭제되었습니다.', 'success');
  });

  // ── 아코디언: 당첨 누계 ──
  document.getElementById('accordion-win-history').addEventListener('toggle', function() {
    if (this.open) loadWhAccordion();
  });
  async function loadWhAccordion() {
    const { data } = await db.from(TABLES.WIN_HISTORY).select('*').order('win_count', { ascending: false });
    if (!data?.length) { empty('tbody-win-history', 5); return; }
    document.getElementById('tbody-win-history').innerHTML = data.map(h => `<tr>
      <td><input type="checkbox" class="row-check wh-ck" data-id="${h.student_id}"/></td>
      <td>${h.student_id}</td><td>${h.student_name}</td>
      <td>${h.win_count}</td><td>${fmtDate(h.last_won_at)}</td>
    </tr>`).join('');
    bindCheckAll('chk-all-wh', '.wh-ck');
  }
  document.getElementById('del-sel-win-history').addEventListener('click', async () => {
    const ids = getChecked('.wh-ck');
    if (!ids.length) { showToast('삭제할 항목을 선택해주세요.', 'error'); return; }
    const ok = await showConfirm({ title: '선택 삭제', message: `선택한 ${ids.length}명의 누계 데이터를 삭제하시겠습니까?` });
    if (!ok) return;
    await db.from(TABLES.WIN_HISTORY).delete().in('student_id', ids);
    await loadWhAccordion();
    showToast(`${ids.length}건이 삭제되었습니다.`, 'success');
  });
  document.getElementById('del-all-win-history').addEventListener('click', async () => {
    const ok = await showConfirm({ title: '전체 삭제', message: '누계 당첨 데이터를 모두 삭제하시겠습니까?' });
    if (!ok) return;
    await db.from(TABLES.WIN_HISTORY).delete().neq('student_id', '');
    await loadWhAccordion();
    showToast('전체 삭제되었습니다.', 'success');
  });

  // ── 아코디언: 당첨 기록 ──
  let allWinRecords = [];
  document.getElementById('accordion-win-records').addEventListener('toggle', function() {
    if (this.open) loadWrAccordion();
  });
  async function loadWrAccordion() {
    const [{ data: wr }, { data: rounds }] = await Promise.all([
      db.from(TABLES.WIN_RECORDS).select('*').order('won_at', { ascending: false }),
      db.from(TABLES.ROUNDS).select('id,round_number').order('round_number'),
    ]);
    allWinRecords = wr || [];
    const filter = document.getElementById('wr-round-filter');
    filter.innerHTML = '<option value="">전체 회차</option>' +
      (rounds || []).map(r => `<option value="${r.id}">${r.round_number}회차</option>`).join('');
    renderWrTable(allWinRecords);
    bindCheckAll('chk-all-wr', '.wr-ck');
  }
  function renderWrTable(records) {
    if (!records.length) { empty('tbody-win-records', 6); return; }
    document.getElementById('tbody-win-records').innerHTML = records.map(r => `<tr>
      <td><input type="checkbox" class="row-check wr-ck" data-id="${r.id}"/></td>
      <td>${r.round_number}회차</td><td>${r.student_id}</td><td>${r.student_name}</td>
      <td>${r.assigned_sentence}번</td><td>${fmt(r.won_at)}</td>
    </tr>`).join('');
    bindCheckAll('chk-all-wr', '.wr-ck');
  }
  function filterWr() {
    const rid = document.getElementById('wr-round-filter').value;
    const q   = document.getElementById('wr-search').value.toLowerCase();
    renderWrTable(allWinRecords.filter(r =>
      (!rid || r.round_id === parseInt(rid)) &&
      (!q   || r.student_id.toLowerCase().includes(q) || r.student_name.toLowerCase().includes(q))
    ));
  }
  document.getElementById('wr-round-filter').addEventListener('change', filterWr);
  document.getElementById('wr-search').addEventListener('input', filterWr);
  document.getElementById('del-sel-win-records').addEventListener('click', async () => {
    const ids = getChecked('.wr-ck');
    if (!ids.length) { showToast('삭제할 항목을 선택해주세요.', 'error'); return; }
    const ok = await showConfirm({ title: '선택 삭제', message: `선택한 ${ids.length}건의 당첨 기록을 삭제하시겠습니까?` });
    if (!ok) return;
    await db.from(TABLES.WIN_RECORDS).delete().in('id', ids.map(Number));
    await loadWrAccordion();
    showToast(`${ids.length}건이 삭제되었습니다.`, 'success');
  });
  document.getElementById('del-all-win-records').addEventListener('click', async () => {
    const ok = await showConfirm({ title: '전체 삭제', message: '당첨 기록을 모두 삭제하시겠습니까?' });
    if (!ok) return;
    await db.from(TABLES.WIN_RECORDS).delete().neq('id', 0);
    await loadWrAccordion();
    showToast('전체 삭제되었습니다.', 'success');
  });

  // ── 아코디언: 회차 기록 ──
  document.getElementById('accordion-rounds').addEventListener('toggle', function() {
    if (this.open) loadRdAccordion();
  });
  async function loadRdAccordion() {
    const { data } = await db.from(TABLES.ROUNDS).select('*').order('round_number', { ascending: false });
    if (!data?.length) { empty('tbody-rounds', 3); return; }
    document.getElementById('tbody-rounds').innerHTML = data.map(r => `<tr>
      <td><input type="checkbox" class="row-check rd-ck" data-id="${r.id}"/></td>
      <td>${r.round_number}회차</td><td>${fmt(r.executed_at)}</td>
    </tr>`).join('');
    bindCheckAll('chk-all-rd', '.rd-ck');
  }
  document.getElementById('del-sel-rounds').addEventListener('click', async () => {
    const ids = getChecked('.rd-ck');
    if (!ids.length) { showToast('삭제할 항목을 선택해주세요.', 'error'); return; }
    const ok = await showConfirm({ title: '선택 삭제', message: `선택한 ${ids.length}개 회차를 삭제하시겠습니까? 연관된 당첨 기록도 함께 삭제됩니다.` });
    if (!ok) return;
    const numIds = ids.map(Number);
    await db.from(TABLES.WIN_RECORDS).delete().in('round_id', numIds);
    await db.from(TABLES.ROUNDS).delete().in('id', numIds);
    await loadRdAccordion();
    showToast(`${ids.length}건이 삭제되었습니다.`, 'success');
  });
  document.getElementById('del-all-rounds').addEventListener('click', async () => {
    const ok = await showConfirm({ title: '전체 삭제', message: '회차 기록을 모두 삭제하시겠습니까?' });
    if (!ok) return;
    await db.from(TABLES.WIN_RECORDS).delete().neq('id', 0);
    await db.from(TABLES.ROUNDS).delete().neq('id', 0);
    await loadRdAccordion();
    showToast('전체 삭제되었습니다.', 'success');
  });

  // ── 전체 초기화 ──
  document.getElementById('global-reset-btn').addEventListener('click', async () => {
    const step1 = await showConfirm({ title: '전체 초기화', message: '전체 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.' });
    if (!step1) return;
    const step2 = await showConfirm({ title: '초기화 확인', message: '모든 데이터가 영구 삭제됩니다.', requireInput: true, inputExpected: '초기화' });
    if (!step2) return;
    await Promise.all([
      db.from(TABLES.SUBMISSIONS).delete().neq('id', 0),
      db.from(TABLES.WIN_HISTORY).delete().neq('student_id', ''),
      db.from(TABLES.WIN_RECORDS).delete().neq('id', 0),
      db.from(TABLES.ROUNDS).delete().neq('id', 0),
    ]);
    await db.from(TABLES.SETTINGS).update({ is_assigned: false }).eq('id', 1);
    await loadSettings();
    showToast('전체 초기화 완료', 'success');
  });

  // ════════════════════════════════════════════════════════════
  // 탭2: 현황 (Realtime)
  // ════════════════════════════════════════════════════════════
  async function loadStatusTable() {
    const { data } = await db.from(TABLES.SUBMISSIONS).select('*').order('created_at');
    const tbody = document.getElementById('tbody-status');
    document.getElementById('status-count').textContent = data?.length || 0;
    if (!data?.length) { empty('tbody-status', 6, '제출된 데이터가 없습니다'); return; }
    tbody.innerHTML = data.map(s => `<tr>
      <td>${s.student_id}</td><td>${s.student_name}</td>
      <td>${s.choice1 ?? '-'}</td><td>${s.choice2 ?? '-'}</td><td>${s.choice3 ?? '-'}</td>
      <td>${fmt(s.created_at)}</td>
    </tr>`).join('');
  }

  function setupRealtime() {
    loadStatusTable();
    db.channel('prof-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.SUBMISSIONS }, loadStatusTable)
      .subscribe(status => {
        document.getElementById('realtime-badge').textContent =
          status === 'SUBSCRIBED' ? '● 실시간 연결됨' : '연결 중...';
      });
  }

  document.getElementById('run-assign-btn').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: '배정 실행',
      message: '현재 제출된 학생들에게 문장을 배정합니다. 계속하시겠습니까?',
      danger: false,
    });
    if (!ok) return;
    const btn = document.getElementById('run-assign-btn');
    btn.disabled = true; btn.textContent = '배정 중...';
    const result = await runAssignment();
    btn.disabled = false; btn.textContent = '배정 실행';
    if (result.success) { showToast(result.message, 'success'); loadStatusTable(); }
    else showToast(result.message, 'error');
  });

  // ════════════════════════════════════════════════════════════
  // 탭3: 배정 결과
  // ════════════════════════════════════════════════════════════
  async function loadResults() {
    const { data: s } = await db.from(TABLES.SETTINGS).select('total_sentences').single();
    const total = s?.total_sentences || 20;
    const { data: subs } = await db.from(TABLES.SUBMISSIONS).select('student_id,student_name,assigned_sentence');
    const map = {};
    (subs || []).forEach(s => { if (s.assigned_sentence) map[s.assigned_sentence] = s; });

    document.getElementById('tbody-results').innerHTML =
      Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const st = map[n];
        return `<tr>
          <td class="result-num">${n}</td>
          <td>${st ? st.student_name : '<span class="text-muted">-</span>'}</td>
        </tr>`;
      }).join('');

    document.getElementById('csv-btn').onclick = () => downloadCSV(total, map);
  }

  function downloadCSV(total, map) {
    const rows = [['문장번호', '이름', '학번']];
    for (let i = 1; i <= total; i++) {
      const st = map[i];
      rows.push([i, st?.student_name || '', st?.student_id || '']);
    }
    const csv = '\ufeff' + rows.map(r => r.join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: '배정결과.csv',
    });
    a.click();
  }

  // ════════════════════════════════════════════════════════════
  // 탭4: 통계
  // ════════════════════════════════════════════════════════════
  async function loadStatistics() {
    const [{ data: wh }, { data: wr }] = await Promise.all([
      db.from(TABLES.WIN_HISTORY).select('*').order('win_count', { ascending: false }),
      db.from(TABLES.WIN_RECORDS).select('*').order('won_at', { ascending: false }),
    ]);

    // 학생별 누계
    if (!wh?.length) { empty('stats-tbody-wh', 5); }
    else document.getElementById('stats-tbody-wh').innerHTML = wh.map((h, i) => `<tr>
      <td>${i + 1}</td><td>${h.student_id}</td><td>${h.student_name}</td>
      <td>${h.win_count}</td><td>${fmtDate(h.last_won_at)}</td>
    </tr>`).join('');

    // 회차별 기록
    if (!wr?.length) { empty('stats-tbody-wr', 5); }
    else document.getElementById('stats-tbody-wr').innerHTML = wr.map(r => `<tr>
      <td>${r.round_number}회차</td><td>${r.student_id}</td><td>${r.student_name}</td>
      <td>${r.assigned_sentence}번</td><td>${fmt(r.won_at)}</td>
    </tr>`).join('');

    // 문장별 빈도
    const sf = {};
    (wr || []).forEach(r => { sf[r.assigned_sentence] = (sf[r.assigned_sentence] || 0) + 1; });
    const sfSorted = Object.entries(sf).sort((a, b) => b[1] - a[1]);
    if (!sfSorted.length) { empty('stats-tbody-sf', 2); }
    else document.getElementById('stats-tbody-sf').innerHTML =
      sfSorted.map(([n, c]) => `<tr><td>${n}번</td><td>${c}회</td></tr>`).join('');

    // 월별
    const mo = {};
    (wr || []).forEach(r => { mo[r.won_month] = (mo[r.won_month] || 0) + 1; });
    const moSorted = Object.entries(mo).sort((a, b) => b[0].localeCompare(a[0]));
    if (!moSorted.length) { empty('stats-tbody-mo', 2); }
    else document.getElementById('stats-tbody-mo').innerHTML =
      moSorted.map(([m, c]) => `<tr><td>${m}</td><td>${c}건</td></tr>`).join('');
  }

  // ════════ 초기화 ════════
  await loadSettings();
});
