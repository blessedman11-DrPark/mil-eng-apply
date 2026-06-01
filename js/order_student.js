// order_student.js — 발표 순서 선착순 신청 (학생용)
// 흐름: 학번·성명 입력 → 대기 화면 → [신청하기] 버튼
//   · 신청 받는 중이면 → 번호 신청 화면
//   · 아직 안 받으면   → "아직 신청을 받지 않습니다" 안내 후 계속 대기

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

  // ── Realtime (번호 신청 화면의 현황 실시간 갱신) ───────────
  function ensureRealtime() {
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

  // 대기 → (신청 가능하면) 번호 신청 화면 / 이미 신청했으면 완료
  async function advanceFromWaiting() {
    const { sid } = getIdentity();
    if (sid) {
      const claims = await fetchClaims();
      const mine = claims.find(c => c.student_id === sid);
      if (mine) { showDone(mine.student_name, mine.order_number); return; }
    }
    enterPick();
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
    if (!settings?.order_apply_open) { btn.disabled = false; enterWaiting(); return; }

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

  // ── 본인 확인 제출 (학번·성명 입력) ────────────────────────
  document.getElementById('identity-btn').addEventListener('click', () => {
    clearError('identity-error');
    const sid  = document.getElementById('student-id').value.trim();
    const name = document.getElementById('student-name').value.trim();
    if (!sid)  { showError('identity-error', '학번을 입력해주세요.'); return; }
    if (!name) { showError('identity-error', '이름을 입력해주세요.'); return; }
    localStorage.setItem(ID_KEY, sid);
    localStorage.setItem(NAME_KEY, name);
    enterWaiting();
  });

  document.getElementById('pick-btn').addEventListener('click', claimNumber);
  document.getElementById('order-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') claimNumber();
  });

  // ── 대기 화면 ─────────────────────────────────────────────
  function enterWaiting() {
    const { name } = getIdentity();
    document.getElementById('waiting-name').textContent = name ? `${name} 학생` : '';
    document.getElementById('waiting-msg').classList.add('hidden');
    if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
    const btn = document.getElementById('waiting-go-btn');
    btn.disabled = false;
    btn.textContent = '신청하기';
    show('waiting');
  }

  // [신청하기] 버튼 — 누른 순간의 신청 상태로 분기 (공정)
  let cooldownTimer = null;

  function startCooldown(seconds) {
    const btn = document.getElementById('waiting-go-btn');
    const msg = document.getElementById('waiting-msg');
    const base = '아직 신청을 받지 않습니다. 계속 누르지 마시고 잠시 기다려 주세요.';
    msg.classList.remove('hidden');
    btn.disabled = true;

    let remain = seconds;
    const render = () => {
      msg.textContent = `${base} (${remain}초 후 다시 시도 가능)`;
      btn.textContent = `${remain}초 후 다시 시도`;
    };
    render();

    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      remain--;
      if (remain <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        btn.disabled = false;
        btn.textContent = '신청하기';
        msg.textContent = base;
      } else {
        render();
      }
    }, 1000);
  }

  document.getElementById('waiting-go-btn').addEventListener('click', async () => {
    const btn = document.getElementById('waiting-go-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    const { data: s } = await db.from(TABLES.SETTINGS).select('order_apply_open, order_total').single();
    if (s?.order_total) total = s.order_total;

    if (s?.order_apply_open) {
      btn.disabled = false;
      await advanceFromWaiting();
    } else {
      // 대기 상태 — 5초간 버튼 비활성화 + 안내
      startCooldown(5);
    }
  });

  // ── 번호 신청 화면 ────────────────────────────────────────
  async function enterPick() {
    const { name } = getIdentity();
    document.getElementById('pick-greeting').textContent = `${name} 학생, 원하는 순번을 선택하세요.`;
    document.getElementById('range-hint').textContent = `(1 ~ ${total})`;
    document.getElementById('order-input').max = total;
    show('pick');
    await refreshPick();
    ensureRealtime();
  }

  // ── 초기 로드 ─────────────────────────────────────────────
  async function init() {
    const { data: settings } = await db.from(TABLES.SETTINGS)
      .select('order_total').single();
    total = settings?.order_total || 22;

    // 페이지에 들어올 때마다 항상 학번·성명을 새로 입력하도록 함
    localStorage.removeItem(ID_KEY);
    localStorage.removeItem(NAME_KEY);
    document.getElementById('student-id').value = '';
    document.getElementById('student-name').value = '';
    show('identity');
  }

  await init();
});
