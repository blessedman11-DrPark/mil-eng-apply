// order_student.js — 발표 순서 선착순 신청 (학생용)

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) return;

  const ID_KEY   = 'order_student_id';
  const NAME_KEY = 'order_student_name';

  const sections = {
    loading:  document.getElementById('loading-section'),
    waiting:  document.getElementById('waiting-section'),
    identity: document.getElementById('identity-section'),
    pick:     document.getElementById('pick-section'),
    done:     document.getElementById('done-section'),
  };

  let total = 22;
  let channel = null;

  function show(name) {
    Object.values(sections).forEach(el => el.classList.add('hidden'));
    sections[name].classList.remove('hidden');
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function clearError(id) {
    document.getElementById(id).classList.add('hidden');
  }

  function getIdentity() {
    return {
      sid:  (localStorage.getItem(ID_KEY)   || '').trim(),
      name: (localStorage.getItem(NAME_KEY) || '').trim(),
    };
  }

  // ── 현재 신청 현황 조회 ───────────────────────────────────
  async function fetchClaims() {
    const { data } = await db.from(TABLES.PRESENTATION_ORDERS)
      .select('order_number, student_id, student_name')
      .order('order_number', { ascending: true });
    return data || [];
  }

  // ── 완료 화면 ─────────────────────────────────────────────
  function showDone(name, number) {
    document.getElementById('done-name').textContent = name + ' 학생';
    document.getElementById('done-number').textContent = number + '번';
    show('done');
    teardownRealtime();
  }

  // ── 남은 번호 렌더링 ──────────────────────────────────────
  function renderAvailable(claims) {
    const taken = new Set(claims.map(c => c.order_number));
    let remainingCount = 0;
    let html = '';
    for (let n = 1; n <= total; n++) {
      if (taken.has(n)) {
        html += `<button type="button" class="order-chip taken" disabled>${n}</button>`;
      } else {
        remainingCount++;
        html += `<button type="button" class="order-chip" data-n="${n}">${n}</button>`;
      }
    }

    document.getElementById('avail-count').textContent = `${remainingCount} / ${total}개`;

    const wrap = document.getElementById('avail-list');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.order-chip[data-n]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('order-input').value = btn.dataset.n;
        clearError('pick-error');
      });
    });
  }

  async function refreshPick() {
    const claims = await fetchClaims();
    const { sid } = getIdentity();
    // 이미 신청했다면 완료 화면으로
    const mine = claims.find(c => c.student_id === sid);
    if (mine) { showDone(mine.student_name, mine.order_number); return; }
    renderAvailable(claims);
  }

  // ── Realtime ──────────────────────────────────────────────
  function setupRealtime() {
    if (channel) return;
    channel = db.channel('order-student')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLES.PRESENTATION_ORDERS },
        () => { if (!sections.pick.classList.contains('hidden')) refreshPick(); })
      .subscribe();
  }
  function teardownRealtime() {
    if (channel) { db.removeChannel(channel); channel = null; }
  }

  // ── 번호 신청 ─────────────────────────────────────────────
  async function claimNumber() {
    clearError('pick-error');
    const { sid, name } = getIdentity();
    if (!sid || !name) { show('identity'); return; }

    const n = parseInt(document.getElementById('order-input').value, 10);
    if (!n || n < 1 || n > total) {
      showError('pick-error', `1 ~ ${total} 사이의 번호를 입력해주세요.`);
      return;
    }

    const btn = document.getElementById('pick-btn');
    btn.disabled = true;

    // 신청 오픈 여부 재확인
    const { data: settings } = await db.from(TABLES.SETTINGS).select('order_apply_open').single();
    if (!settings?.order_apply_open) { btn.disabled = false; show('waiting'); return; }

    // 본인 중복 신청 확인
    const existing = await fetchClaims();
    const mine = existing.find(c => c.student_id === sid);
    if (mine) { btn.disabled = false; showDone(mine.student_name, mine.order_number); return; }

    // 선착순 INSERT (order_number PK 충돌 시 이미 선점된 번호)
    const { error } = await db.from(TABLES.PRESENTATION_ORDERS).insert({
      order_number: n,
      student_id:   sid,
      student_name: name,
    });
    btn.disabled = false;

    if (error) {
      if (error.code === '23505') {
        showError('pick-error', `${n}번은 방금 다른 학생이 선택했습니다. 남은 번호에서 다시 선택해주세요.`);
        await refreshPick();
      } else {
        showError('pick-error', '신청 중 오류가 발생했습니다: ' + error.message);
      }
      return;
    }

    showDone(name, n);
  }

  // ── 본인 확인 제출 ────────────────────────────────────────
  document.getElementById('identity-btn').addEventListener('click', () => {
    clearError('identity-error');
    const sid  = document.getElementById('student-id').value.trim();
    const name = document.getElementById('student-name').value.trim();
    if (!sid)  { showError('identity-error', '학번을 입력해주세요.'); return; }
    if (!name) { showError('identity-error', '이름을 입력해주세요.'); return; }
    localStorage.setItem(ID_KEY, sid);
    localStorage.setItem(NAME_KEY, name);
    enterPick();
  });

  document.getElementById('pick-btn').addEventListener('click', claimNumber);
  document.getElementById('order-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') claimNumber();
  });

  async function enterPick() {
    const { name } = getIdentity();
    document.getElementById('pick-greeting').textContent = `${name} 학생, 원하는 순번을 선택하세요.`;
    document.getElementById('range-hint').textContent = `(1 ~ ${total})`;
    document.getElementById('order-input').max = total;
    show('pick');
    await refreshPick();
    setupRealtime();
  }

  // ── 초기 로드 ─────────────────────────────────────────────
  async function init() {
    const { data: settings, error } = await db.from(TABLES.SETTINGS)
      .select('order_apply_open, order_total').single();
    if (error || !settings) { show('waiting'); return; }

    total = settings.order_total || 22;

    if (!settings.order_apply_open) { show('waiting'); return; }

    const { sid } = getIdentity();
    if (sid) {
      // 이미 신청했는지 확인
      const claims = await fetchClaims();
      const mine = claims.find(c => c.student_id === sid);
      if (mine) { showDone(mine.student_name, mine.order_number); return; }
      enterPick();
    } else {
      show('identity');
    }
  }

  await init();
});
