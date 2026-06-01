# 🎖️ 군사영어 문장 선택 시스템

건양대학교 군사영어 수업에서 학생들이 희망 발표 문장을 신청하고, 교수가 추첨으로 배정하는 웹 애플리케이션입니다.

## 주요 기능

- **문장 신청 (학생)**: 희망 문장 번호 1~3지망 신청, 배정 결과 조회
- **발표 순서 신청 (학생)**: 학번·성명 입력 후 대기 → 교수가 신청을 열면 발표 순번을 **선착순**으로 신청
- **교수**: 신청 현황 실시간 모니터링, 추첨 배정 실행, 발표 순서 관리, 데이터 관리
- **통계**: 학생별 누적 당첨 횟수, 회차별 기록 조회 (암호 보호)

## 최근 업데이트 (2026-06-02) — 발표 순서 신청 기능 추가

| 항목 | 내용 |
|---|---|
| 발표 순서 선착순 신청 | 학생이 발표 순번(1~N)을 선착순으로 신청. `presentation_orders.order_number` **UNIQUE 제약**으로 동시 신청 시에도 중복 배정 없음 (22명 동시 접속 부하 테스트 통과) |
| 미리 입력 후 대기 | 학생이 학번·성명을 미리 입력하고 대기 → 교수가 "신청 받기"를 켠 뒤 **[신청하기] 버튼**을 누르면 번호 신청 화면으로 (자동 전환 없음 → 공정성 확보) |
| 연타 방지 | 신청 시작 전 [신청하기]를 누르면 **5초간 버튼 비활성화** + 카운트다운 안내 |
| 매번 새 입력 | 발표 순서 페이지 진입 시 항상 학번·성명을 새로 입력 (이전 값 미사용) |
| 교수 실시간 현황 | 1~N번 배정 현황을 Realtime + **2.5초 폴링**으로 자동 갱신, **🔄 새로고침** 버튼으로 즉시 재조회 |
| 총 순번 수 설정 | 교수 화면에서 총 발표 순번 수를 설정 (기본 22) → 다른 과목/분반에서도 재사용 가능 |
| 메인 화면 그룹화 | 학생용 / 교수용 진입 카드를 부드러운 색상 박스로 그룹화 |

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
| 메인 (`mil_eng_apply.html`) | 학생용 / 교수용 / 통계 진입 (그룹 박스) |
| 문장 신청 (`student.html`) | 희망 문장 신청 및 배정 결과 확인 |
| 발표 순서 신청 (`order_student.html`) | 학번·성명 입력 → 대기 → 발표 순번 선착순 신청 |
| 교수 (`professor.html`) | 대시보드 (설정·현황·배정결과·통계) |
| 발표 순서 관리 (`order_professor.html`) | 신청 시작/마감, 총 순번 수 설정, 실시간 배정 현황, 초기화 |
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

## 발표 순서 신청 흐름

1. **학생**: 발표 순서 페이지 접속 → 학번·성명 입력 → **대기 화면**
2. 교수가 "신청 받기"를 켠 뒤, 학생이 **[신청하기]** 버튼을 누름
   - 신청 받는 중 → 번호 신청 화면으로 이동
   - 아직 마감 → "아직 신청을 받지 않습니다" 안내 + **5초간 버튼 비활성화**(연타 방지)
3. 원하는 번호 신청 → `INSERT` 시도
   - 성공 → 배정 완료
   - **UNIQUE 충돌(23505)** → "이미 선택된 번호" 안내 + 남은 번호 갱신 후 재신청
4. **교수**: 1~N번 배정 현황을 실시간(Realtime + 2.5초 폴링)으로 확인, 🔄 새로고침·전체 초기화 가능

> 선착순 보장은 `order_number` **기본키(UNIQUE)** 제약으로 처리 → 동시 신청 시 DB가 1명만 받아들이고 나머지는 거부. `students` 테이블과 독립적이라 **다른 과목/분반에서도 재사용** 가능.

## 기술 스택

- **Frontend**: Vanilla HTML / CSS / JavaScript
- **Database**: [Supabase](https://supabase.com) (PostgreSQL + Realtime)
- **Hosting**: [Vercel](https://vercel.com)
- **CI/CD**: GitHub Actions → Vercel 자동 배포
- **Excel 출력**: [SheetJS (xlsx)](https://sheetjs.com)

## 프로젝트 구조

```
├── mil_eng_apply.html     # 메인 페이지 (학생용/교수용 그룹)
├── student.html           # 문장 신청 페이지
├── order_student.html     # 발표 순서 신청 페이지 (학생)
├── professor.html         # 교수 대시보드
├── order_professor.html   # 발표 순서 관리 (교수)
├── stats.html             # 통계 페이지
├── css/
│   └── style.css
├── js/
│   ├── config.js          # Supabase 설정, ROUND_WEEK_MAP (회차↔주차 매핑)
│   ├── supabase.js        # DB 클라이언트, TABLES 상수
│   ├── algorithm.js       # 문장 배정 알고리즘
│   ├── student.js         # 문장 신청 로직
│   ├── order_student.js   # 발표 순서 신청 로직 (학생)
│   ├── professor.js       # 교수 대시보드 로직
│   ├── order_professor.js # 발표 순서 관리 로직 (교수)
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
| `settings` | 총 문장 수, 신청 허용 여부, 배정 완료 여부, 교수 비밀번호 / **발표 순서용**: `order_apply_open`(신청 받기), `order_total`(총 순번 수) |
| `students` | 전체 수강생 명단 (student_id PK, student_name) |
| `submissions` | 학생 신청 데이터 (학번, 이름, 1~3지망, 배정 결과) |
| `rounds` | 회차 기록 |
| `win_history` | 학생별 누적 당첨 횟수 |
| `win_records` | 회차별 당첨 상세 기록 (`assigned_sentence` NULL 허용) |
| `presentation_orders` | 발표 순서 신청 (`order_number` PK/UNIQUE, `student_id`, `student_name`, `claimed_at`) |

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

-- presentation_orders (발표 순서)
CREATE POLICY "anon select presentation_orders" ON public.presentation_orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert presentation_orders" ON public.presentation_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon delete presentation_orders" ON public.presentation_orders FOR DELETE TO anon USING (true);
```

## DB 스키마 변경 이력

```sql
-- win_records.assigned_sentence NOT NULL 제약 해제 (수동 추가 시 배정 문장 생략 허용)
ALTER TABLE win_records ALTER COLUMN assigned_sentence DROP NOT NULL;

-- 발표 순서 기능 (2026-06-02)
CREATE TABLE presentation_orders (
  order_number int PRIMARY KEY,          -- 선착순 보장 (UNIQUE)
  student_id   text,
  student_name text,
  claimed_at   timestamptz DEFAULT now()
);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS order_apply_open boolean DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS order_total int DEFAULT 22;
-- (선택) 더 즉각적인 실시간 갱신을 원하면 Database → Replication에서
--        presentation_orders 테이블을 Realtime 발행 목록에 추가
```
