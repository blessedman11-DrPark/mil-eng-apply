// 문장 배정 알고리즘
// 선택 가능한 문장 필터링 및 공정 배분 로직

/**
 * 학생에게 선택 가능한 문장 목록을 반환한다.
 * - 이미 선택 확정된 문장 제외 (중복 방지용, 선택 정책에 따라 조정)
 * @param {Array} allSentences - 전체 문장 배열
 * @param {Array} selections   - 현재 선택 현황 배열 [{sentence_id, student_id}]
 * @param {string} studentId   - 현재 학생 ID
 * @returns {Array} 선택 가능한 문장 배열
 */
function getAvailableSentences(allSentences, selections, studentId) {
  const mySelection = selections.find(s => s.student_id === studentId);

  // 이미 선택한 경우 자신의 문장만 표시
  if (mySelection) {
    return allSentences.filter(s => s.id === mySelection.sentence_id);
  }

  return allSentences;
}

/**
 * 문장별 선택 인원 수를 계산한다.
 * @param {Array} sentences  - 전체 문장 배열
 * @param {Array} selections - 선택 현황 배열
 * @returns {Object} { sentence_id: count }
 */
function countSelections(sentences, selections) {
  const counts = {};
  sentences.forEach(s => { counts[s.id] = 0; });
  selections.forEach(sel => {
    if (counts[sel.sentence_id] !== undefined) {
      counts[sel.sentence_id]++;
    }
  });
  return counts;
}

/**
 * 선택 인원이 가장 적은 문장을 우선 표시하도록 정렬한다.
 * @param {Array} sentences - 문장 배열
 * @param {Object} counts   - { sentence_id: count }
 * @returns {Array} 정렬된 문장 배열
 */
function sortByLeastSelected(sentences, counts) {
  return [...sentences].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
}
