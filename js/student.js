// student.js

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) return;

  const loadingEl  = document.getElementById('loading-section');
  const closedEl   = document.getElementById('closed-msg');
  const formEl     = document.getElementById('form-section');
  const doneEl     = document.getElementById('done-section');
  const resultEl   = document.getElementById('result-section');
  const formError  = document.getElementById('form-error');

  let totalSentences = 20;

  function show(el) {
    [loadingEl, closedEl, formEl, doneEl, resultEl].forEach(e => e.classList.add('hidden'));
    el.classList.remove('hidden');
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.classList.remove('hidden');
  }

  function clearError() {
    formError.classList.add('hidden');
  }

  // ── 초기 로드 ──────────────────────────────────────────────
  async function init() {
    const [{ data: settings, error }, { data: rounds }] = await Promise.all([
      db.from(TABLES.SETTINGS).select('*').single(),
      db.from(TABLES.ROUNDS).select('round_number').order('round_number', { ascending: false }).limit(1),
    ]);
    if (error || !settings) { show(closedEl); return; }

    if (rounds?.[0]) {
      const r = rounds[0].round_number;
      document.getElementById('round-display').textContent = `(${r}회차)`;
      const badge = document.getElementById('form-round-badge');
      badge.textContent = `📋 ${r}회차 신청`;
      badge.style.display = '';
    }

    totalSentences = settings.total_sentences;
    document.getElementById('range-hint').textContent = `(1 ~ ${totalSentences})`;
    document.querySelectorAll('#choice1, #choice2, #choice3').forEach(inp => {
      inp.max = totalSentences;
    });

    if (!settings.is_open) { show(closedEl); return; }

    // 배정 완료 상태이면 학번 입력 후 결과 조회
    if (settings.is_assigned) {
      show(formEl);
      setAssignedMode(true);
      return;
    }

    show(formEl);
    setAssignedMode(false);
  }

  function setAssignedMode(assigned) {
    const submitBtn = document.getElementById('submit-btn');
    const notice = document.getElementById('assigned-notice');
    if (assigned) {
      submitBtn.textContent = '배정 결과 확인';
      submitBtn.className = 'btn btn-secondary';
      document.getElementById('choice1').parentElement.parentElement.classList.add('hidden');
      notice.style.display = '';
    } else {
      submitBtn.textContent = '신청하기';
      submitBtn.className = 'btn btn-primary';
      document.getElementById('choice1').parentElement.parentElement.classList.remove('hidden');
      notice.style.display = 'none';
    }
  }

  // ── 제출 버튼 ──────────────────────────────────────────────
  document.getElementById('submit-btn').addEventListener('click', async () => {
    clearError();

    const name = document.getElementById('student-name').value.trim();
    const sid  = document.getElementById('student-id').value.trim();
    if (!name) { showError('이름을 입력해주세요.'); return; }
    if (!sid)  { showError('학번을 입력해주세요.'); return; }

    // 배정 결과 조회 모드
    const { data: settings } = await db.from(TABLES.SETTINGS).select('is_assigned').single();
    if (settings?.is_assigned) {
      await showResult(sid, name);
      return;
    }

    // 신청 모드 유효성 검사
    const c1 = parseInt(document.getElementById('choice1').value);
    const c2 = parseInt(document.getElementById('choice2').value) || null;
    const c3 = parseInt(document.getElementById('choice3').value) || null;

    if (!c1) { showError('1지망 번호를 입력해주세요.'); return; }
    if (c1 < 1 || c1 > totalSentences) { showError(`1지망은 1 ~ ${totalSentences} 사이여야 합니다.`); return; }
    if (c2 !== null && (c2 < 1 || c2 > totalSentences)) { showError(`2지망은 1 ~ ${totalSentences} 사이여야 합니다.`); return; }
    if (c3 !== null && (c3 < 1 || c3 > totalSentences)) { showError(`3지망은 1 ~ ${totalSentences} 사이여야 합니다.`); return; }

    const choices = [c1, c2, c3].filter(c => c !== null);
    const unique = new Set(choices);
    if (unique.size !== choices.length) { showError('중복된 번호를 입력할 수 없습니다.'); return; }

    // 중복 제출 확인
    const { data: existing } = await db.from(TABLES.SUBMISSIONS).select('id').eq('student_id', sid).maybeSingle();
    if (existing) { showError('이미 신청하셨습니다. 중복 제출은 불가합니다.'); return; }

    // is_open 재확인
    const { data: settings2 } = await db.from(TABLES.SETTINGS).select('is_open').single();
    if (!settings2?.is_open) { show(closedEl); return; }

    // 제출
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    const { error: insertErr } = await db.from(TABLES.SUBMISSIONS).insert({
      student_id: sid,
      student_name: name,
      choice1: c1,
      choice2: c2,
      choice3: c3,
    });
    btn.disabled = false;

    if (insertErr) {
      if (insertErr.code === '23505') {
        showError('이미 신청하셨습니다. 중복 제출은 불가합니다.');
      } else {
        showError('제출 중 오류가 발생했습니다: ' + insertErr.message);
      }
      return;
    }

    // 완료 화면
    document.getElementById('done-name').textContent = `${name} (${sid})`;  // textContent는 안전
    document.getElementById('done-choices').innerHTML =
      `1지망: <strong>${c1}번</strong>` +
      (c2 ? ` &nbsp;/&nbsp; 2지망: <strong>${c2}번</strong>` : '') +
      (c3 ? ` &nbsp;/&nbsp; 3지망: <strong>${c3}번</strong>` : '');
    show(doneEl);
  });

  // ── 배정 결과 표시 ──────────────────────────────────────────
  async function showResult(sid, name) {
    const { data } = await db.from(TABLES.SUBMISSIONS)
      .select('assigned_sentence, choice1, choice2, choice3')
      .eq('student_id', sid)
      .maybeSingle();

    if (!data) {
      showError('해당 학번의 신청 내역이 없습니다.');
      return;
    }

    const content = document.getElementById('result-content');
    if (data.assigned_sentence) {
      content.innerHTML = `
        <p style="margin-bottom:.75rem">${escHtml(name)} (${escHtml(sid)}) 학생의 배정 결과입니다.</p>
        <div style="background:#e8f0ff;border-radius:8px;padding:1.25rem;text-align:center">
          <div style="font-size:2rem;font-weight:700;color:#4a7fff">${escHtml(data.assigned_sentence)}번</div>
          <div style="color:#555;margin-top:.4rem">배정 완료</div>
        </div>`;
    } else {
      content.innerHTML = `
        <p style="margin-bottom:.75rem">${escHtml(name)} (${escHtml(sid)}) 학생의 신청 내역이 확인되었습니다.</p>
        <div class="msg msg-warn">배정이 아직 완료되지 않았습니다.</div>`;
    }
    show(resultEl);
  }

  await init();
});
