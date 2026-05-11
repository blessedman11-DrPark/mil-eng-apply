# 🎖️ 군사영어 문장 선택 시스템

건양대학교 군사영어 수업에서 학생들이 희망 발표 문장을 신청하고, 교수가 추첨으로 배정하는 웹 애플리케이션입니다.

## 주요 기능

- **학생**: 희망 문장 번호 1~3지망 신청, 배정 결과 조회
- **교수**: 신청 현황 실시간 모니터링, 추첨 배정 실행, 데이터 관리
- **통계**: 학생별 누적 당첨 횟수, 회차별 기록 조회 (암호 보호)

## 최근 업데이트 (2026-05-11)

| 항목 | 내용 |
|---|---|
| 회차 주차 표시 | 회차 레이블에 주차 정보 병기 (예: `1회차(6주차)`) — `config.js`의 `ROUND_WEEK_MAP`으로 관리 |
| 데이터 내보내기 | 설정 탭에서 전체 데이터를 Excel(.xlsx)로 저장 (회차 기록·당첨 기록·당첨 누계·현재 제출 4개 시트) |
| 데이터 불러오기 | 이전에 내보낸 Excel 백업 파일로 DB 데이터 복원 (전체 초기화 후 재사용 가능) |
| 당첨 기록 수동 편집 | 당첨 기록 관리에서 행 추가(➕) 및 편집(✏️) — 학생 선택, 배정 문장 선택 입력, 당첨 누계 자동 반영 |
| 당첨 누계 재계산 | 당첨 누계 관리에서 🔄 재계산 버튼으로 `win_records` 기준 누계 재산출 |
| 통계 회차별 기록 | 당첨자가 0명인 회차는 통계 탭 회차별 배정 기록에서 자동 숨김 |

## 화면 구성

| 화면 | 설명 |
|---|---|
| 메인 (`mil_eng_apply.html`) | 교수 / 학생 / 통계 진입 |
| 학생 (`student.html`) | 희망 문장 신청 및 배정 결과 확인 |
| 교수 (`professor.html`) | 대시보드 (설정·현황·배정결과·통계) |
| 통계 (`stats.html`) | 학생별 당첨 현황, 회차별 기록 |

## 교수 대시보드 — 설정 탭 기능

### 기본 설정
- 총 문장 수 설정, 제출 허용/마감 토글, 새 회차 시작

### 데이터 관리
- 제출 데이터 / 당첨 누계 / 당첨 기록 / 회차 기록 조회·삭제
- **당첨 기록**: 행 추가(➕) 및 편집(✏️) 지원 — 학생·회차·배정문장 수정, `win_history` 자동 동기화
- **당첨 누계**: 🔄 재계산 버튼으로 `win_records` 기준 누계 재산출

### 데이터 백업 / 복원
| 버튼 | 파일명 | 내용 |
|---|---|---|
| 📥 전체 데이터 내보내기 | `군사영어_전체데이터_YYYYMMDD.xlsx` | 회차 기록·당첨 기록·당첨 누계·현재 제출 (4개 시트) |
| 당첨 기록만 | `군사영어_당첨기록_YYYYMMDD.xlsx` | 당첨 기록 단일 시트 |
| 당첨 누계만 | `군사영어_당첨누계_YYYYMMDD.xlsx` | 당첨 누계 단일 시트 |
| 📂 백업 파일로 복원 | — | 전체 데이터 파일 선택 후 DB 복원 |

## 배정 알고리즘

1. 모든 학생의 **1지망**을 기준으로 그룹화
2. 단독 신청 → 즉시 배정 / 경쟁 → 랜덤 추첨, 탈락자는 2지망으로 이동
3. 2지망, 3지망도 동일 방식으로 반복
4. 3지망까지 모두 탈락한 학생은 미배정 처리

## 기술 스택

- **Frontend**: Vanilla HTML / CSS / JavaScript
- **Database**: [Supabase](https://supabase.com) (PostgreSQL + Realtime)
- **Hosting**: [Vercel](https://vercel.com)
- **CI/CD**: GitHub Actions → Vercel 자동 배포
- **Excel 출력**: [SheetJS (xlsx)](https://sheetjs.com)

## 프로젝트 구조

```
├── mil_eng_apply.html     # 메인 페이지
├── student.html           # 학생 신청 페이지
├── professor.html         # 교수 대시보드
├── stats.html             # 통계 페이지
├── css/
│   └── style.css
├── js/
│   ├── config.js          # Supabase 설정, ROUND_WEEK_MAP (회차↔주차 매핑)
│   ├── supabase.js        # DB 클라이언트
│   ├── algorithm.js       # 배정 알고리즘
│   ├── student.js
│   ├── professor.js
│   └── stats.js
└── .github/workflows/
    └── deploy.yml         # 자동 배포
```

## 회차 주차 매핑 설정

`js/config.js`의 `ROUND_WEEK_MAP`에서 회차별 주차를 관리합니다.

```js
const ROUND_WEEK_MAP = { 1: 6, 2: 7, 3: 10 };
// 키: 회차 번호 / 값: 주차 번호
// 예: 1회차 → "1회차(6주차)" 로 표시
// 매핑에 없는 회차는 "N회차"로 표시
```

## Supabase 테이블

| 테이블 | 설명 |
|---|---|
| `settings` | 총 문장 수, 신청 허용 여부, 배정 완료 여부, 교수 비밀번호 |
| `students` | 전체 수강생 명단 (student_id PK, student_name) |
| `submissions` | 학생 신청 데이터 (학번, 이름, 1~3지망, 배정 결과) |
| `rounds` | 회차 기록 |
| `win_history` | 학생별 누적 당첨 횟수 |
| `win_records` | 회차별 당첨 상세 기록 (`assigned_sentence` NULL 허용) |

## 배포 설정

GitHub Actions를 통해 `main` 브랜치에 push 시 Vercel에 자동 배포됩니다.

**필요한 GitHub Secrets:**

| Secret | 설명 |
|---|---|
| `VERCEL_TOKEN` | Vercel 계정 토큰 |
| `VERCEL_ORG_ID` | Vercel 조직 ID |
| `VERCEL_PROJECT_ID` | Vercel 프로젝트 ID |

## Supabase RLS 정책

모든 테이블에 `anon` 역할의 접근 정책이 필요합니다. Supabase SQL Editor에서 실행:

```sql
-- settings
CREATE POLICY "anon select settings" ON public.settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon update settings" ON public.settings FOR UPDATE TO anon USING (true);

-- submissions
CREATE POLICY "anon select submissions" ON public.submissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert submissions" ON public.submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update submissions" ON public.submissions FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete submissions" ON public.submissions FOR DELETE TO anon USING (true);

-- rounds
CREATE POLICY "anon select rounds" ON public.rounds FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert rounds" ON public.rounds FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update rounds" ON public.rounds FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete rounds" ON public.rounds FOR DELETE TO anon USING (true);

-- win_history
CREATE POLICY "anon select win_history" ON public.win_history FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert win_history" ON public.win_history FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update win_history" ON public.win_history FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete win_history" ON public.win_history FOR DELETE TO anon USING (true);

-- win_records
CREATE POLICY "anon select win_records" ON public.win_records FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert win_records" ON public.win_records FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update win_records" ON public.win_records FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete win_records" ON public.win_records FOR DELETE TO anon USING (true);
```

## DB 스키마 변경 이력

```sql
-- win_records.assigned_sentence NOT NULL 제약 해제 (수동 추가 시 배정 문장 생략 허용)
ALTER TABLE win_records ALTER COLUMN assigned_sentence DROP NOT NULL;
```
