// order_professor.js — 발표 순서 관리 (교수용)

document.addEventListener('DOMContentLoaded', async () => {
  // 교수 인증 가드 (professor.html과 동일)
  const authExpiry = parseInt(sessionStorage.getItem('prof_auth') || '0', 10);
  if (!authExpiry || Date.now() > authExpiry) {
    sessionStorage.removeItem('prof_auth');
    location.href = 'mil_eng_apply.html';
    return;
  }
  if (!initSupabase()) return;

  let total = 22;

  // ── 토스트 ────────────────────────────────────────────────
  function showToast(msg, type = '') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 280); }, 3200);
  }

  // ── 현황 그리드 ───────────────────────────────────────────
  async function loadGrid() {
    const { data } = await db.from(TABLES.PRESENTATION_ORDERS)
      .select('order_number, student_name')
      .order('order_number', { ascending: true });
    const map = {};
    (data || []).forEach(r => { map[r.order_number] = r.student_name; });

    const grid = document.getElementById('order-grid');
    let claimed = 0;
    let html = '';
    for (let n = 1; n <= total; n++) {
      const name = map[n];
      if (name) claimed++;
      html += `<div class="order-cell ${name ? 'filled' : ''}">
        <span class="order-cell-num">${n}</span>
        <span class="order-cell-name">${name ? escHtml(name) : '—'}</span>
      </div>`;
    }
    grid.innerHTML = html;
    document.getElementById('claimed-count').textContent = `(${claimed} / ${total})`;
  }

  // ── 설정 로드 ─────────────────────────────────────────────
  async function loadSettings() {
    const { data } = await db.from(TABLES.SETTINGS)
      .select('order_apply_open, order_total').single();
    total = data?.order_total || 22;
    document.getElementById('total-input').value = total;
    setToggle(!!data?.order_apply_open);
  }

  function setToggle(open) {
    document.getElementById('open-toggle').checked = open;
    const label = document.getElementById('open-label');
    label.textContent = open ? '신청 받는 중' : '마감됨';
    label.style.color = open ? '#2aa058' : '#999';
  }

  // ── 총 순번 수 저장 ───────────────────────────────────────
  document.getElementById('save-total-btn').addEventListener('click', async () => {
    const v = parseInt(document.getElementById('total-input').value, 10);
    if (!v || v < 1 || v > 200) { showToast('1 ~ 200 사이로 입력해주세요.', 'error'); return; }
    const { error } = await db.from(TABLES.SETTINGS).update({ order_total: v }).eq('id', 1);
    if (error) { showToast('저장 실패: ' + error.message, 'error'); return; }
    total = v;
    showToast('총 순번 수를 저장했습니다.', 'success');
    loadGrid();
  });

  // ── 신청 받기 토글 ────────────────────────────────────────
  document.getElementById('open-toggle').addEventListener('change', async (e) => {
    const open = e.target.checked;
    const { error } = await db.from(TABLES.SETTINGS).update({ order_apply_open: open }).eq('id', 1);
    if (error) {
      showToast('변경 실패: ' + error.message, 'error');
      setToggle(!open);
      return;
    }
    setToggle(open);
    showToast(open ? '신청을 시작했습니다.' : '신청을 마감했습니다.', 'success');
  });

  // ── 전체 초기화 ───────────────────────────────────────────
  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('모든 발표 순서 배정을 삭제합니다. 계속할까요?')) return;
    const { error } = await db.from(TABLES.PRESENTATION_ORDERS).delete().neq('order_number', -1);
    if (error) { showToast('초기화 실패: ' + error.message, 'error'); return; }
    showToast('전체 초기화 완료', 'success');
    loadGrid();
  });

  // ── 실시간 갱신 (Realtime + 폴링 안전장치) ─────────────────
  function setBadge(connected) {
    document.getElementById('realtime-badge').innerHTML = connected
      ? '<span class="realtime-dot" style="background:#2aa058"></span>실시간 연결됨'
      : '<span class="realtime-dot" style="background:#f5a623"></span>자동 새로고침 중';
  }

  function setupRealtime() {
    // 즉시 갱신용 Realtime 구독
    db.channel('order-prof')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLES.PRESENTATION_ORDERS },
        () => loadGrid())
      .subscribe(status => setBadge(status === 'SUBSCRIBED'));

    // Realtime 미사용 환경 대비 — 2.5초마다 현황 자동 새로고침
    setInterval(loadGrid, 2500);
  }

  await loadSettings();
  await loadGrid();
  setupRealtime();
});
