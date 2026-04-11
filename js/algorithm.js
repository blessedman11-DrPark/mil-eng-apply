// algorithm.js — 문장 배정 알고리즘
// 의존: db (supabase client), TABLES (상수) — supabase.js에서 제공

async function runAssignment() {
  try {
    // 1. 설정 조회
    const { data: settings, error: sErr } = await db.from(TABLES.SETTINGS).select('total_sentences').single();
    if (sErr) throw new Error('설정 조회 실패: ' + sErr.message);
    const totalSentences = settings.total_sentences;

    // 2. 제출 데이터 전체 조회
    const { data: submissions, error: subErr } = await db.from(TABLES.SUBMISSIONS).select('*');
    if (subErr) throw new Error('제출 데이터 조회 실패: ' + subErr.message);
    if (!submissions?.length) return { success: false, message: '제출된 학생이 없습니다.' };

    // 3. 현재 회차 조회
    const { data: rounds } = await db.from(TABLES.ROUNDS).select('*').order('round_number', { ascending: false }).limit(1);
    const currentRound = rounds?.[0];
    if (!currentRound) return { success: false, message: '먼저 새 회차를 시작해주세요.' };

    // ────────────────────────────────────────────────────────
    // 4. 기존 배정 결과 초기화 (재배정 대비)
    // ────────────────────────────────────────────────────────
    await db.from(TABLES.SUBMISSIONS).update({ assigned_sentence: null }).neq('id', 0);
    await db.from(TABLES.WIN_RECORDS).delete().eq('round_id', currentRound.id);

    // win_history 재계산 (현재 회차 제외한 나머지 기록 기준)
    const { data: remainingRecords } = await db.from(TABLES.WIN_RECORDS)
      .select('student_id,student_name,won_at')
      .order('won_at', { ascending: false });
    const histMap = {};
    (remainingRecords || []).forEach(r => {
      if (!histMap[r.student_id]) {
        histMap[r.student_id] = { student_name: r.student_name, win_count: 0, last_won_at: r.won_at };
      }
      histMap[r.student_id].win_count++;
    });
    await db.from(TABLES.WIN_HISTORY).delete().neq('student_id', '');
    const rebuiltHistory = Object.entries(histMap).map(([sid, v]) => ({
      student_id:   sid,
      student_name: v.student_name,
      win_count:    v.win_count,
      last_won_at:  v.last_won_at,
    }));
    if (rebuiltHistory.length) {
      await db.from(TABLES.WIN_HISTORY).insert(rebuiltHistory);
    }

    await db.from(TABLES.SETTINGS).update({ is_assigned: false }).eq('id', 1);

    // ────────────────────────────────────────────────────────
    // 5. 배정 알고리즘
    // assigned: { student_id → sentence_number }
    // takenSentences: 이미 배정된 문장 번호 Set
    // ────────────────────────────────────────────────────────
    const assigned = {};
    const takenSentences = new Set();

    // 각 학생의 지망 큐: { student, currentChoice, remainingChoices[] }
    let queue = submissions.map(s => ({
      student: s,
      currentChoice: s.choice1,
      remaining: [s.choice2, s.choice3].filter(c => c != null),
    }));

    for (let level = 0; level < 3; level++) {
      if (!queue.length) break;

      // 이미 배정된 학생 제외
      const eligible = queue.filter(item => !assigned[item.student.student_id]);

      // 현재 지망을 기준으로 그룹화 (이미 선점된 문장 제외)
      const groups = {};
      const unplaceable = []; // 지망 번호가 없거나 이미 선점됨

      for (const item of eligible) {
        if (!item.currentChoice || takenSentences.has(item.currentChoice)) {
          unplaceable.push(item);
        } else {
          if (!groups[item.currentChoice]) groups[item.currentChoice] = [];
          groups[item.currentChoice].push(item);
        }
      }

      const nextQueue = [];

      // 그룹별 추첨
      for (const [choiceStr, applicants] of Object.entries(groups)) {
        const choice = parseInt(choiceStr);
        if (takenSentences.has(choice)) {
          // 동시 처리 중 선점된 경우 — 다음 지망으로
          applicants.forEach(item => {
            if (item.remaining.length > 0) {
              nextQueue.push({ student: item.student, currentChoice: item.remaining[0], remaining: item.remaining.slice(1) });
            }
          });
          continue;
        }

        if (applicants.length === 1) {
          // 단독 신청 → 즉시 배정
          assigned[applicants[0].student.student_id] = choice;
          takenSentences.add(choice);
        } else {
          // 2명 이상 → 랜덤 추첨
          const winIdx = Math.floor(Math.random() * applicants.length);
          assigned[applicants[winIdx].student.student_id] = choice;
          takenSentences.add(choice);

          // 탈락자 → 다음 지망으로
          applicants.forEach((item, idx) => {
            if (idx !== winIdx && item.remaining.length > 0) {
              nextQueue.push({ student: item.student, currentChoice: item.remaining[0], remaining: item.remaining.slice(1) });
            }
          });
        }
      }

      // 지망 없거나 선점된 학생 → 다음 지망으로
      for (const item of unplaceable) {
        if (item.remaining.length > 0) {
          nextQueue.push({ student: item.student, currentChoice: item.remaining[0], remaining: item.remaining.slice(1) });
        }
      }

      queue = nextQueue;
    }

    // 6. 모든 지망 탈락 학생 → 배정 없음 (탈락 처리)

    // ────────────────────────────────────────────────────────
    // 7. DB 업데이트
    // ────────────────────────────────────────────────────────
    const now = new Date();
    // KST(UTC+9) 기준 날짜·월 계산
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const wonMonth = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;

    // 6a. submissions.assigned_sentence 업데이트 (순차)
    for (const s of submissions) {
      const sentence = assigned[s.student_id];
      if (sentence != null) {
        await db.from(TABLES.SUBMISSIONS).update({ assigned_sentence: sentence }).eq('student_id', s.student_id);
      }
    }

    // 6b. win_history UPSERT (기존 win_count 증가)
    const assignedStudents = submissions.filter(s => assigned[s.student_id] != null);
    const sids = assignedStudents.map(s => s.student_id);

    const { data: existingHistory } = await db.from(TABLES.WIN_HISTORY).select('student_id,win_count').in('student_id', sids);
    const existMap = {};
    (existingHistory || []).forEach(h => { existMap[h.student_id] = h.win_count; });

    const winHistoryRows = assignedStudents.map(s => ({
      student_id:   s.student_id,
      student_name: s.student_name,
      win_count:    (existMap[s.student_id] || 0) + 1,
      last_won_at:  now.toISOString(),
    }));
    if (winHistoryRows.length) {
      await db.from(TABLES.WIN_HISTORY).upsert(winHistoryRows, { onConflict: 'student_id' });
    }

    // 6c. win_records INSERT
    const winRecordRows = assignedStudents.map(s => ({
      round_id:          currentRound.id,
      round_number:      currentRound.round_number,
      student_id:        s.student_id,
      student_name:      s.student_name,
      assigned_sentence: assigned[s.student_id],
      won_at:            now.toISOString(),
      won_date:          kst.toISOString().split('T')[0],
      won_month:         wonMonth,
    }));
    if (winRecordRows.length) {
      await db.from(TABLES.WIN_RECORDS).insert(winRecordRows);
    }

    // 6d. is_assigned = true
    await db.from(TABLES.SETTINGS).update({ is_assigned: true }).eq('id', 1);

    const failedCount = submissions.length - assignedStudents.length;
    const msg = failedCount > 0
      ? `${assignedStudents.length}명 배정 완료, ${failedCount}명 탈락 (${currentRound.round_number}회차)`
      : `${assignedStudents.length}명 배정 완료 (${currentRound.round_number}회차)`;

    return {
      success: true,
      message: msg,
      assignments: assigned,
    };

  } catch (err) {
    console.error('[runAssignment]', err);
    return { success: false, message: err.message || '배정 중 오류가 발생했습니다.' };
  }
}
