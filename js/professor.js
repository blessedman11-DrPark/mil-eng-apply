// professor.js

document.addEventListener('DOMContentLoaded', async () => {
  const authExpiry = parseInt(sessionStorage.getItem('prof_auth') || '0', 10);
  if (!authExpiry || Date.now() > authExpiry) {
    sessionStorage.removeItem('prof_auth');
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
    const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z').toLocaleDateString('ko-KR');
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
      rounds?.[0] ? `현재 ${getRoundLabel(rounds[0].round_number)}` : '회차 없음 (새 회차를 시작해주세요)';
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
      <td><input type="checkbox" class="row-check sub-ck" data-id="${escHtml(s.id)}"/></td>
      <td>${escHtml(s.student_id)}</td><td>${escHtml(s.student_name)}</td>
      <td>${escHtml(s.choice1 ?? '-')}</td><td>${escHtml(s.choice2 ?? '-')}</td><td>${escHtml(s.choice3 ?? '-')}</td>
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
      <td><input type="checkbox" class="row-check wh-ck" data-id="${escHtml(h.student_id)}"/></td>
      <td>${escHtml(h.student_id)}</td><td>${escHtml(h.student_name)}</td>
      <td>${escHtml(h.win_count)}</td><td>${fmtDate(h.last_won_at)}</td>
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

  document.getElementById('recalc-wh-btn').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: '당첨 누계 재계산',
      message: '당첨 기록(win_records)을 기준으로 누계를 다시 계산합니다. 현재 누계 데이터는 모두 교체됩니다. 계속하시겠습니까?',
      danger: false,
    });
    if (!ok) return;

    const { data: wr, error } = await db.from(TABLES.WIN_RECORDS).select('student_id, student_name, won_at');
    if (error) { showToast('기록 조회 실패: ' + error.message, 'error'); return; }

    // win_records 기준으로 학생별 집계
    const countMap = {}, nameMap = {}, lastWonMap = {};
    (wr || []).forEach(r => {
      const sid = String(r.student_id);
      countMap[sid] = (countMap[sid] || 0) + 1;
      nameMap[sid]  = r.student_name;
      if (r.won_at && (!lastWonMap[sid] || r.won_at > lastWonMap[sid])) {
        lastWonMap[sid] = r.won_at;
      }
    });

    // 기존 누계 전체 삭제 후 재삽입
    await db.from(TABLES.WIN_HISTORY).delete().gte('win_count', 0);
    const rows = Object.keys(countMap).map(sid => ({
      student_id:   sid,
      student_name: nameMap[sid],
      win_count:    countMap[sid],
      last_won_at:  lastWonMap[sid] || null,
    }));
    if (rows.length) await db.from(TABLES.WIN_HISTORY).insert(rows);

    await loadWhAccordion();
    showToast(`재계산 완료: ${rows.length}명 업데이트`, 'success');
  });

  // ── 아코디언: 당첨 기록 ──
  let allWinRecords = [];
  let wrRoundsCache = [];
  let wrStudentsCache = [];
  document.getElementById('accordion-win-records').addEventListener('toggle', function() {
    if (this.open) loadWrAccordion();
  });
  async function loadWrAccordion() {
    const [{ data: wr }, { data: rounds }, { data: students }] = await Promise.all([
      db.from(TABLES.WIN_RECORDS).select('*').order('won_at', { ascending: false }),
      db.from(TABLES.ROUNDS).select('*').order('round_number'),
      db.from(TABLES.STUDENTS).select('student_id,student_name').order('student_id'),
    ]);
    allWinRecords = wr || [];
    wrRoundsCache = rounds || [];
    wrStudentsCache = students || [];
    const filter = document.getElementById('wr-round-filter');
    filter.innerHTML = '<option value="">전체 회차</option>' +
      wrRoundsCache.map(r => `<option value="${r.id}">${getRoundLabel(r.round_number)}</option>`).join('');
    renderWrTable(allWinRecords);
    bindCheckAll('chk-all-wr', '.wr-ck');
  }
  function renderWrTable(records) {
    if (!records.length) { empty('tbody-win-records', 7); return; }
    document.getElementById('tbody-win-records').innerHTML = records.map(r => `<tr>
      <td><input type="checkbox" class="row-check wr-ck" data-id="${escHtml(r.id)}"/></td>
      <td>${getRoundLabel(r.round_number)}</td><td>${escHtml(r.student_id)}</td><td>${escHtml(r.student_name)}</td>
      <td>${r.assigned_sentence != null ? escHtml(r.assigned_sentence) + '번' : '-'}</td><td>${fmt(r.won_at)}</td>
      <td><button class="btn btn-sm btn-secondary wr-edit-btn" data-id="${r.id}" style="white-space:nowrap">✏️ 편집</button></td>
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

  // ── 당첨 기록 추가/편집 모달 ──
  let wrEditTarget = null;
  const wrEditModal = document.getElementById('wr-edit-modal');

  function openWrModal(record = null) {
    wrEditTarget = record;
    document.getElementById('wr-edit-title').textContent = record ? '당첨 기록 편집' : '당첨 기록 추가';

    const roundSel = document.getElementById('wr-modal-round');
    roundSel.innerHTML = wrRoundsCache.map(r =>
      `<option value="${r.id}" data-num="${r.round_number}" data-at="${r.executed_at || ''}">${getRoundLabel(r.round_number)}</option>`
    ).join('');

    const studentSel = document.getElementById('wr-modal-student');
    studentSel.innerHTML = wrStudentsCache.length
      ? wrStudentsCache.map(s =>
          `<option value="${escHtml(s.student_id)}">${escHtml(s.student_id)} ${escHtml(s.student_name)}</option>`
        ).join('')
      : '<option value="">학생 목록이 없습니다</option>';

    if (record) {
      roundSel.value = record.round_id;
      studentSel.value = record.student_id;
      document.getElementById('wr-modal-sentence').value = record.assigned_sentence ?? '';
    } else {
      document.getElementById('wr-modal-sentence').value = '';
    }
    wrEditModal.classList.add('open');
  }

  function closeWrModal() {
    wrEditModal.classList.remove('open');
    wrEditTarget = null;
  }

  document.getElementById('wr-modal-cancel').addEventListener('click', closeWrModal);
  wrEditModal.addEventListener('click', e => { if (e.target === wrEditModal) closeWrModal(); });

  document.getElementById('wr-modal-save').addEventListener('click', async () => {
    const roundId  = parseInt(document.getElementById('wr-modal-round').value);
    const studentId = document.getElementById('wr-modal-student').value;
    const sentence = parseInt(document.getElementById('wr-modal-sentence').value) || null;

    if (!roundId || !studentId) { showToast('회차와 학생을 선택해주세요.', 'error'); return; }

    const round   = wrRoundsCache.find(r => r.id === roundId);
    const student = wrStudentsCache.find(s => String(s.student_id) === String(studentId));
    const studentName = student?.student_name ?? studentId;
    const wonAt   = round?.executed_at || null;

    const saveBtn = document.getElementById('wr-modal-save');
    saveBtn.disabled = true;
    try {
      if (!wrEditTarget) {
        // ── 추가 ──
        const { error } = await db.from(TABLES.WIN_RECORDS).insert({
          round_id: roundId, round_number: round.round_number,
          student_id: studentId, student_name: studentName,
          assigned_sentence: sentence, won_at: wonAt,
        });
        if (error) throw error;

        // win_history 증가
        const { data: hist } = await db.from(TABLES.WIN_HISTORY)
          .select('*').eq('student_id', studentId).maybeSingle();
        if (hist) {
          await db.from(TABLES.WIN_HISTORY).update({
            win_count: hist.win_count + 1,
            last_won_at: wonAt || hist.last_won_at,
          }).eq('student_id', studentId);
        } else {
          await db.from(TABLES.WIN_HISTORY).insert({
            student_id: studentId, student_name: studentName,
            win_count: 1, last_won_at: wonAt,
          });
        }
        showToast('당첨 기록이 추가되었습니다.', 'success');

      } else {
        // ── 편집 ──
        const oldStudentId = wrEditTarget.student_id;
        await db.from(TABLES.WIN_RECORDS).update({
          round_id: roundId, round_number: round.round_number,
          student_id: studentId, student_name: studentName,
          assigned_sentence: sentence, won_at: wonAt || wrEditTarget.won_at,
        }).eq('id', wrEditTarget.id);

        // 학생이 바뀐 경우 win_history 조정
        if (studentId !== oldStudentId) {
          const { data: oldHist } = await db.from(TABLES.WIN_HISTORY)
            .select('*').eq('student_id', oldStudentId).maybeSingle();
          if (oldHist) {
            if (oldHist.win_count <= 1) {
              await db.from(TABLES.WIN_HISTORY).delete().eq('student_id', oldStudentId);
            } else {
              await db.from(TABLES.WIN_HISTORY).update({ win_count: oldHist.win_count - 1 }).eq('student_id', oldStudentId);
            }
          }
          const { data: newHist } = await db.from(TABLES.WIN_HISTORY)
            .select('*').eq('student_id', studentId).maybeSingle();
          if (newHist) {
            await db.from(TABLES.WIN_HISTORY).update({
              win_count: newHist.win_count + 1,
              last_won_at: wonAt || newHist.last_won_at,
            }).eq('student_id', studentId);
          } else {
            await db.from(TABLES.WIN_HISTORY).insert({
              student_id: studentId, student_name: studentName,
              win_count: 1, last_won_at: wonAt,
            });
          }
        }
        showToast('수정되었습니다.', 'success');
      }

      closeWrModal();
      await loadWrAccordion();
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('add-wr-btn').addEventListener('click', () => openWrModal(null));

  document.getElementById('tbody-win-records').addEventListener('click', e => {
    const btn = e.target.closest('.wr-edit-btn');
    if (!btn) return;
    const record = allWinRecords.find(r => r.id === parseInt(btn.dataset.id));
    if (record) openWrModal(record);
  });

  // ── 아코디언: 회차 기록 ──
  document.getElementById('accordion-rounds').addEventListener('toggle', function() {
    if (this.open) loadRdAccordion();
  });
  async function loadRdAccordion() {
    const { data } = await db.from(TABLES.ROUNDS).select('*').order('round_number', { ascending: false });
    if (!data?.length) { empty('tbody-rounds', 3); return; }
    document.getElementById('tbody-rounds').innerHTML = data.map(r => `<tr>
      <td><input type="checkbox" class="row-check rd-ck" data-id="${escHtml(r.id)}"/></td>
      <td>${getRoundLabel(r.round_number)}</td><td>${fmt(r.executed_at)}</td>
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
    const ok = await showConfirm({ title: '전체 초기화', message: '모든 데이터가 영구 삭제되고 1회차로 돌아갑니다. 계속하시겠습니까?' });
    if (!ok) return;
    await Promise.all([
      db.from(TABLES.SUBMISSIONS).delete().neq('id', 0),
      db.from(TABLES.WIN_HISTORY).delete().neq('student_id', ''),
      db.from(TABLES.WIN_RECORDS).delete().neq('id', 0),
      db.from(TABLES.ROUNDS).delete().neq('id', 0),
    ]);
    await db.from(TABLES.SETTINGS).update({ is_assigned: false, is_open: false }).eq('id', 1);
    await loadSettings();
    showToast('전체 초기화 완료', 'success');
  });

  // ════════════════════════════════════════════════════════════
  // 데이터 내보내기
  // ════════════════════════════════════════════════════════════
  function makeSheet(headers, rows) {
    return XLSX.utils.aoa_to_sheet([headers, ...rows]);
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  async function exportAll() {
    const btn = document.getElementById('export-all-btn');
    btn.disabled = true;
    btn.textContent = '불러오는 중...';
    try {
      const [
        { data: rounds },
        { data: winRecords },
        { data: winHistory },
        { data: submissions },
      ] = await Promise.all([
        db.from(TABLES.ROUNDS).select('*').order('round_number'),
        db.from(TABLES.WIN_RECORDS).select('*').order('round_number').order('student_id'),
        db.from(TABLES.WIN_HISTORY).select('*').order('win_count', { ascending: false }).order('student_id'),
        db.from(TABLES.SUBMISSIONS).select('*').order('student_id'),
      ]);

      const wb = XLSX.utils.book_new();

      // 시트1: 회차 기록 (_실행일시 = ISO, 복원용)
      XLSX.utils.book_append_sheet(wb, makeSheet(
        ['회차', '실행 일시', '_실행일시'],
        (rounds || []).map(r => [getRoundLabel(r.round_number), fmt(r.executed_at), r.executed_at || ''])
      ), '회차 기록');

      // 시트2: 당첨 기록 (_당첨일시 = ISO, 복원용)
      XLSX.utils.book_append_sheet(wb, makeSheet(
        ['회차', '학번', '이름', '배정 문장', '당첨 일시', '_당첨일시'],
        (winRecords || []).map(r => [getRoundLabel(r.round_number), r.student_id, r.student_name, r.assigned_sentence != null ? r.assigned_sentence + '번' : '-', fmt(r.won_at), r.won_at || ''])
      ), '당첨 기록');

      // 시트3: 당첨 누계 (_마지막당첨일 = ISO, 복원용)
      XLSX.utils.book_append_sheet(wb, makeSheet(
        ['학번', '이름', '총 당첨 횟수', '마지막 당첨일', '_마지막당첨일'],
        (winHistory || []).map(h => [h.student_id, h.student_name, h.win_count, fmtDate(h.last_won_at), h.last_won_at || ''])
      ), '당첨 누계');

      // 시트4: 현재 제출 데이터
      XLSX.utils.book_append_sheet(wb, makeSheet(
        ['학번', '이름', '1지망', '2지망', '3지망', '배정 문장', '제출 일시'],
        (submissions || []).map(s => [
          s.student_id, s.student_name,
          s.choice1 ?? '', s.choice2 ?? '', s.choice3 ?? '',
          s.assigned_sentence != null ? s.assigned_sentence + '번' : '미배정',
          fmt(s.created_at),
        ])
      ), '현재 제출');

      XLSX.writeFile(wb, `군사영어_전체데이터_${todayStr()}.xlsx`);
      showToast('다운로드 완료!', 'success');
    } catch (e) {
      showToast('내보내기 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📥 전체 데이터 내보내기';
    }
  }

  async function exportWinRecords() {
    const btn = document.getElementById('export-wr-btn');
    btn.disabled = true;
    try {
      const { data: winRecords } = await db.from(TABLES.WIN_RECORDS).select('*').order('round_number').order('student_id');
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, makeSheet(
        ['회차', '학번', '이름', '배정 문장', '당첨 일시'],
        (winRecords || []).map(r => [getRoundLabel(r.round_number), r.student_id, r.student_name, r.assigned_sentence + '번', fmt(r.won_at)])
      ), '당첨 기록');
      XLSX.writeFile(wb, `군사영어_당첨기록_${todayStr()}.xlsx`);
      showToast('다운로드 완료!', 'success');
    } catch (e) {
      showToast('내보내기 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function exportWinHistory() {
    const btn = document.getElementById('export-wh-btn');
    btn.disabled = true;
    try {
      const { data: winHistory } = await db.from(TABLES.WIN_HISTORY).select('*').order('win_count', { ascending: false }).order('student_id');
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, makeSheet(
        ['학번', '이름', '총 당첨 횟수', '마지막 당첨일'],
        (winHistory || []).map(h => [h.student_id, h.student_name, h.win_count, fmtDate(h.last_won_at)])
      ), '당첨 누계');
      XLSX.writeFile(wb, `군사영어_당첨누계_${todayStr()}.xlsx`);
      showToast('다운로드 완료!', 'success');
    } catch (e) {
      showToast('내보내기 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  document.getElementById('export-all-btn').addEventListener('click', exportAll);
  document.getElementById('export-wr-btn').addEventListener('click', exportWinRecords);
  document.getElementById('export-wh-btn').addEventListener('click', exportWinHistory);

  // ── 데이터 불러오기 (복원) ──
  async function importData(file) {
    const importBtn = document.getElementById('import-btn');
    importBtn.disabled = true;
    importBtn.textContent = '파일 읽는 중...';
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const parseNum   = v => (v !== undefined && v !== null && v !== '') ? (parseInt(v) || null) : null;
      const parseRound = label => parseInt(String(label ?? '').match(/^(\d+)/)?.[1] || '') || null;
      const toStr      = v => (v !== undefined && v !== null) ? String(v) : '';

      const readSheet = name => {
        const sheet = wb.Sheets[name];
        if (!sheet) return [];
        return XLSX.utils.sheet_to_json(sheet, { header: 1 })
          .slice(1)
          .filter(r => r.length && r[0] != null && r[0] !== '');
      };

      const roundRows = readSheet('회차 기록');
      const wrRows    = readSheet('당첨 기록');
      const whRows    = readSheet('당첨 누계');
      const subRows   = readSheet('현재 제출');

      if (!roundRows.length && !wrRows.length && !whRows.length) {
        showToast('복원할 데이터가 없거나 올바른 백업 파일이 아닙니다.', 'error');
        return;
      }

      // 회차 데이터 (번호 + 실행일시) — 회차 시트 우선, 없으면 당첨기록에서 추출
      const roundsToRestore = roundRows.length
        ? roundRows.map(r => ({ num: parseRound(r[0]), executedAt: toStr(r[2]) || null })).filter(r => r.num)
        : [...new Set(wrRows.map(r => parseRound(r[0])).filter(Boolean))].sort((a, b) => a - b).map(num => ({ num, executedAt: null }));
      const roundNums = roundsToRestore.map(r => r.num);

      const ok = await showConfirm({
        title: '백업 파일로 복원',
        message: `회차 ${roundNums.length}건 · 당첨기록 ${wrRows.length}건 · 당첨누계 ${whRows.length}건 · 현재제출 ${subRows.length}건을 복원합니다. 현재 저장된 데이터가 모두 삭제됩니다. 계속하시겠습니까?`,
        danger: true,
      });
      if (!ok) return;

      importBtn.textContent = '복원 중...';

      // 1. 기존 데이터 전체 삭제 (win_records → rounds FK 순서 보장)
      await Promise.all([
        db.from(TABLES.SUBMISSIONS).delete().neq('id', 0),
        db.from(TABLES.WIN_HISTORY).delete().neq('student_id', ''),
        db.from(TABLES.WIN_RECORDS).delete().neq('id', 0),
      ]);
      await db.from(TABLES.ROUNDS).delete().neq('id', 0);

      // 2. 회차 순서대로 삽입 (win_records FK용 ID 확보, executed_at 포함)
      const roundNumToId = {};
      const roundNumToAt = {};
      for (const { num, executedAt } of roundsToRestore) {
        const { data } = await db.from(TABLES.ROUNDS)
          .insert({ round_number: num, executed_at: executedAt }).select('id').single();
        if (data) { roundNumToId[num] = data.id; roundNumToAt[num] = executedAt; }
      }

      // 3. 당첨 누계 삽입 (_마지막당첨일 ISO 열: index 4)
      if (whRows.length) {
        await db.from(TABLES.WIN_HISTORY).insert(whRows.map(r => ({
          student_id:   toStr(r[0]),
          student_name: toStr(r[1]),
          win_count:    parseNum(r[2]) ?? 0,
          last_won_at:  toStr(r[4]) || null,
        })));
      }

      // 4. 당첨 기록 삽입 (_당첨일시 ISO 열: index 5)
      if (wrRows.length) {
        const toInsert = wrRows.map(r => {
          const rn = parseRound(r[0]);
          return {
            round_id:          roundNumToId[rn] ?? null,
            round_number:      rn,
            student_id:        toStr(r[1]),
            student_name:      toStr(r[2]),
            assigned_sentence: parseNum(r[3]),
            won_at:            toStr(r[5]) || roundNumToAt[rn] || null,
          };
        }).filter(r => r.round_id && r.student_id);
        if (toInsert.length) await db.from(TABLES.WIN_RECORDS).insert(toInsert);
      }

      // 5. 현재 제출 삽입
      if (subRows.length) {
        const toInsert = subRows.map(r => ({
          student_id:        toStr(r[0]),
          student_name:      toStr(r[1]),
          choice1:           parseNum(r[2]),
          choice2:           parseNum(r[3]),
          choice3:           parseNum(r[4]),
          assigned_sentence: toStr(r[5]) === '미배정' ? null : parseNum(r[5]),
        })).filter(r => r.student_id);
        if (toInsert.length) await db.from(TABLES.SUBMISSIONS).insert(toInsert);
      }

      // 6. 설정 업데이트
      const hasAssigned = subRows.some(r => r[5] && String(r[5]) !== '미배정');
      await db.from(TABLES.SETTINGS).update({ is_assigned: hasAssigned, is_open: false }).eq('id', 1);
      await loadSettings();

      showToast(`복원 완료! 회차 ${roundNums.length}건 · 당첨기록 ${wrRows.length}건 · 당첨누계 ${whRows.length}건`, 'success');
    } catch (e) {
      showToast('복원 실패: ' + e.message, 'error');
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = '📂 백업 파일로 복원';
      document.getElementById('import-file').value = '';
    }
  }

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) await importData(file);
  });

  // ════════════════════════════════════════════════════════════
  // 탭2: 현황 (Realtime)
  // ════════════════════════════════════════════════════════════

  // 서브 탭 전환
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab-btn').forEach(b => {
        b.style.color = '#8896a5';
        b.style.borderBottomColor = 'transparent';
      });
      btn.style.color = '#4a7fff';
      btn.style.borderBottomColor = '#4a7fff';
      const target = btn.dataset.subtab;
      document.getElementById('subtab-by-student').style.display = target === 'by-student' ? '' : 'none';
      document.getElementById('subtab-by-sentence').style.display = target === 'by-sentence' ? '' : 'none';
      if (target === 'by-sentence') loadSentenceStatusTable();
    });
  });

  async function loadStatusTable() {
    const { data } = await db.from(TABLES.SUBMISSIONS).select('*').order('student_id');
    const tbody = document.getElementById('tbody-status');
    document.getElementById('status-count').textContent = data?.length || 0;
    if (!data?.length) { empty('tbody-status', 5, '제출된 데이터가 없습니다'); return; }
    tbody.innerHTML = data.map(s => `<tr>
      <td style="white-space:nowrap">${escHtml(s.student_id)}</td><td style="white-space:nowrap">${escHtml(s.student_name)}</td>
      <td style="white-space:nowrap;padding-left:1.5rem">${escHtml(s.choice1 ?? '-')}</td><td style="white-space:nowrap">${escHtml(s.choice2 ?? '-')}</td><td style="white-space:nowrap">${escHtml(s.choice3 ?? '-')}</td>
    </tr>`).join('');
  }

  async function loadSentenceStatusTable() {
    const [{ data: settings }, { data: subs }] = await Promise.all([
      db.from(TABLES.SETTINGS).select('total_sentences').single(),
      db.from(TABLES.SUBMISSIONS).select('student_id,student_name,choice1,choice2,choice3'),
    ]);
    const total = settings?.total_sentences || 20;
    const tbody = document.getElementById('tbody-sentence-status');

    // 문장 번호별로 지망 신청자 집계
    const byChoice1 = {}, byChoice2 = {}, byChoice3 = {};
    (subs || []).forEach(s => {
      if (s.choice1) { (byChoice1[s.choice1] = byChoice1[s.choice1] || []).push(s.student_name); }
      if (s.choice2) { (byChoice2[s.choice2] = byChoice2[s.choice2] || []).push(s.student_name); }
      if (s.choice3) { (byChoice3[s.choice3] = byChoice3[s.choice3] || []).push(s.student_name); }
    });

    tbody.innerHTML = Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      const cnt1 = byChoice1[n]?.length || 0;
      const cnt2 = byChoice2[n]?.length || 0;
      const cnt3 = byChoice3[n]?.length || 0;
      const total_applicants = cnt1 + cnt2 + cnt3;
      const totalCell = total_applicants > 0
        ? `<span style="font-weight:600">${total_applicants}명</span> <span style="color:#8896a5;font-size:.85em">(${cnt1}, ${cnt2}, ${cnt3})</span>`
        : '<span class="text-muted">-</span>';
      const c1 = byChoice1[n]?.map(escHtml).join(', ') || '<span class="text-muted">-</span>';
      const c2 = byChoice2[n]?.map(escHtml).join(', ') || '<span class="text-muted">-</span>';
      const c3 = byChoice3[n]?.map(escHtml).join(', ') || '<span class="text-muted">-</span>';
      return `<tr><td style="text-align:center;font-weight:600">${n}번</td><td style="white-space:nowrap">${totalCell}</td><td>${c1}</td><td>${c2}</td><td>${c3}</td></tr>`;
    }).join('');
  }

  function setupRealtime() {
    loadStatusTable();
    db.channel('prof-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.SUBMISSIONS }, () => {
        loadStatusTable();
        if (document.getElementById('subtab-by-sentence').style.display !== 'none') {
          loadSentenceStatusTable();
        }
      })
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

  // 결과 서브 탭 전환
  document.querySelectorAll('.result-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.result-sub-tab-btn').forEach(b => {
        b.style.color = '#8896a5';
        b.style.borderBottomColor = 'transparent';
      });
      btn.style.color = '#4a7fff';
      btn.style.borderBottomColor = '#4a7fff';
      const target = btn.dataset.resultSubtab;
      document.getElementById('result-subtab-by-sentence').style.display = target === 'by-sentence' ? '' : 'none';
      document.getElementById('result-subtab-by-student').style.display = target === 'by-student' ? '' : 'none';
    });
  });

  async function loadResults() {
    const { data: s } = await db.from(TABLES.SETTINGS).select('total_sentences').single();
    const total = s?.total_sentences || 20;
    const { data: subs } = await db.from(TABLES.SUBMISSIONS).select('student_id,student_name,assigned_sentence');

    // 문장번호 → 학생 맵
    const map = {};
    (subs || []).forEach(s => { if (s.assigned_sentence) map[s.assigned_sentence] = s; });

    // 문장번호순
    document.getElementById('tbody-results-by-sentence').innerHTML =
      Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const st = map[n];
        return `<tr>
          <td class="result-num" style="width:80px">${n}번</td>
          <td style="text-align:left">${st ? `${escHtml(st.student_id)} &nbsp; ${escHtml(st.student_name)}` : '<span class="text-muted">-</span>'}</td>
        </tr>`;
      }).join('');

    // 학번순 (배정된 학생만, 학번 오름차순)
    const assigned = (subs || []).filter(s => s.assigned_sentence)
      .sort((a, b) => a.student_id.localeCompare(b.student_id));
    if (!assigned.length) {
      empty('tbody-results-by-student', 3, '배정된 학생이 없습니다');
    } else {
      document.getElementById('tbody-results-by-student').innerHTML = assigned.map(st => `<tr>
        <td style="white-space:nowrap">${escHtml(st.student_id)}</td>
        <td style="white-space:nowrap">${escHtml(st.student_name)}</td>
        <td style="text-align:left;font-weight:600">${escHtml(st.assigned_sentence)}번</td>
      </tr>`).join('');
    }

    // 탈락자 (신청했으나 배정 안 됨)
    const unassigned = (subs || []).filter(s => !s.assigned_sentence)
      .sort((a, b) => a.student_id.localeCompare(b.student_id));
    const unassignedSection = document.getElementById('unassigned-section');
    if (unassigned.length) {
      document.getElementById('unassigned-count').textContent = `(${unassigned.length}명)`;
      document.getElementById('tbody-unassigned').innerHTML = unassigned.map(st => `<tr>
        <td style="white-space:nowrap;padding-right:.5rem">${escHtml(st.student_id)}</td>
        <td style="white-space:nowrap;padding-left:.5rem">${escHtml(st.student_name)}</td>
      </tr>`).join('');
      unassignedSection.style.display = '';
    } else {
      unassignedSection.style.display = 'none';
    }

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
  let profWinHistoryData = [];
  let profSortMode = 'wins';
  let profBarChart = null;

  function renderProfChart() {
    if (!profWinHistoryData.length) return;
    const sorted = [...profWinHistoryData].sort((a, b) => {
      if (profSortMode === 'id') return String(a.student_id).localeCompare(String(b.student_id));
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
    document.getElementById('prof-chart-wrap').style.width = Math.max(500, labels.length * 64) + 'px';
    const ctx = document.getElementById('prof-bar-chart').getContext('2d');
    if (profBarChart) profBarChart.destroy();
    profBarChart = new Chart(ctx, {
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

  function renderProfRankTable() {
    if (!profWinHistoryData.length) return;
    const sorted = [...profWinHistoryData].sort((a, b) => {
      if (profSortMode === 'id') return String(a.student_id).localeCompare(String(b.student_id));
      if (b.win_count !== a.win_count) return b.win_count - a.win_count;
      return String(a.student_id).localeCompare(String(b.student_id));
    });
    document.getElementById('stats-tbody-wh').innerHTML = sorted.map((h, i) => `<tr>
      <td>${i + 1}</td><td>${escHtml(h.student_id)}</td><td>${escHtml(h.student_name)}</td>
      <td>${escHtml(h.win_count)}</td><td>${fmtDate(h.last_won_at)}</td>
    </tr>`).join('');
  }

  document.getElementById('prof-sort-by-wins').addEventListener('click', () => {
    profSortMode = 'wins';
    document.getElementById('prof-sort-by-wins').classList.add('active');
    document.getElementById('prof-sort-by-id').classList.remove('active');
    renderProfChart();
    renderProfRankTable();
  });
  document.getElementById('prof-sort-by-id').addEventListener('click', () => {
    profSortMode = 'id';
    document.getElementById('prof-sort-by-id').classList.add('active');
    document.getElementById('prof-sort-by-wins').classList.remove('active');
    renderProfChart();
    renderProfRankTable();
  });

  async function loadStatistics() {
    const [{ data: wr }, { data: rounds }, { data: allStudents }, { data: subs }] = await Promise.all([
      db.from(TABLES.WIN_RECORDS).select('*').order('round_number').order('student_id'),
      db.from(TABLES.ROUNDS).select('*').order('round_number', { ascending: false }),
      db.from(TABLES.STUDENTS).select('student_id, student_name').order('student_id'),
      db.from(TABLES.SUBMISSIONS).select('student_id'),
    ]);

    // 학생별 누계: win_records에서 직접 집계 (source of truth)
    const cumulativeMap = {};
    (wr || []).forEach(r => {
      if (!cumulativeMap[r.student_id]) {
        cumulativeMap[r.student_id] = { student_name: r.student_name, win_count: 0, last_won_at: null };
      }
      cumulativeMap[r.student_id].win_count++;
      if (!cumulativeMap[r.student_id].last_won_at || r.won_at > cumulativeMap[r.student_id].last_won_at) {
        cumulativeMap[r.student_id].last_won_at = r.won_at;
      }
    });
    profWinHistoryData = Object.entries(cumulativeMap).map(([student_id, v]) => ({
      student_id, student_name: v.student_name, win_count: v.win_count, last_won_at: v.last_won_at,
    }));

    if (!profWinHistoryData.length) {
      document.getElementById('prof-chart-empty').classList.remove('hidden');
      document.getElementById('prof-chart-wrap').style.display = 'none';
      empty('stats-tbody-wh', 5);
    } else {
      document.getElementById('prof-chart-empty').classList.add('hidden');
      document.getElementById('prof-chart-wrap').style.display = '';
      renderProfChart();
      renderProfRankTable();
    }

    // 회차별 배정 기록
    const roundsSec = document.getElementById('stats-rounds-section');
    if (roundsSec) {
      if (!rounds?.length) {
        roundsSec.style.display = 'none';
      } else {
        roundsSec.style.display = '';
        const roundsWithWinners = (rounds || []).filter(round =>
          (wr || []).some(r => r.round_id === round.id)
        );
        if (!roundsWithWinners.length) { roundsSec.style.display = 'none'; return; }
        document.getElementById('stats-rounds-list').innerHTML = roundsWithWinners.map(round => {
          const recs = (wr || [])
            .filter(r => r.round_id === round.id)
            .sort((a, b) => a.assigned_sentence - b.assigned_sentence);
          const tbody = recs.map(r => `<tr>
                <td>${escHtml(r.student_id)}</td>
                <td>${escHtml(r.student_name)}</td>
                <td style="text-align:center;font-weight:600">${r.assigned_sentence != null ? escHtml(r.assigned_sentence) + '번' : '-'}</td>
              </tr>`).join('');
          return `<details class="accordion" style="margin-bottom:.5rem">
            <summary style="font-size:.95rem">${getRoundLabel(round.round_number)} 당첨자 목록 <span class="text-muted" style="font-size:.82rem;font-weight:400">(${recs.length}명${round.executed_at ? ' · ' + fmtDate(round.executed_at) : ''})</span></summary>
            <div class="accordion-body">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>학번</th><th>이름</th><th>배정 문장</th></tr></thead>
                  <tbody>${tbody}</tbody>
                </table>
              </div>
            </div>
          </details>`;
        }).join('');
      }
    }

    // ── 미신청: students에서 submissions·win_records 모두에 없는 학생 ──
    const wonIds = new Set((wr || []).map(r => String(r.student_id)));
    const noApplySec = document.getElementById('prof-no-apply-section');
    if (allStudents?.length) {
      const appliedIds = new Set([
        ...(subs || []).map(s => String(s.student_id)),
        ...wonIds,
      ]);
      const noApply = allStudents.filter(s => !appliedIds.has(String(s.student_id)));
      if (noApply.length) {
        noApplySec.style.display = '';
        document.getElementById('prof-no-apply-count').textContent = `(${noApply.length}명)`;

        let profShowNames = false;
        let profListVisible = false;

        const listEl = document.getElementById('prof-no-apply-list');
        const nameToggleBtn = document.getElementById('prof-no-apply-name-toggle');
        const sectionToggleBtn = document.getElementById('prof-no-apply-section-toggle');

        const renderProfNoApplyList = () => {
          listEl.textContent = profShowNames
            ? noApply.map(s => `${s.student_id} (${s.student_name})`).join(', ')
            : noApply.map(s => s.student_id).join(', ');
        };

        sectionToggleBtn.onclick = () => {
          profListVisible = !profListVisible;
          listEl.style.display = profListVisible ? '' : 'none';
          sectionToggleBtn.textContent = profListVisible ? '숨기기' : '보기';
          nameToggleBtn.style.display = profListVisible ? '' : 'none';
          if (!profListVisible) {
            profShowNames = false;
            nameToggleBtn.textContent = '이름 표시';
          } else {
            renderProfNoApplyList();
          }
        };

        nameToggleBtn.onclick = () => {
          profShowNames = !profShowNames;
          nameToggleBtn.textContent = profShowNames ? '이름 숨기기' : '이름 표시';
          renderProfNoApplyList();
        };
      } else {
        noApplySec.style.display = 'none';
      }
    } else {
      noApplySec.style.display = 'none';
    }
  }

  // ════════ 초기화 ════════
  await loadSettings();
});
