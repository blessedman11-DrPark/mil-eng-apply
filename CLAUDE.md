# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

군사영어 문장 선택 사이트 — 건양대학교 군사영어 수업에서 학생들이 희망 발표 문장을 신청하고, 교수가 추첨 배정하는 웹 애플리케이션.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (프레임워크 없음)
- **Backend/DB**: Supabase (PostgreSQL + Realtime)
- **Hosting**: Vercel (GitHub Actions → 자동 배포)

## File Structure

```
/
├── mil_eng_apply.html   # 메인 페이지 (교수/학생/통계 진입점)
├── student.html         # 학생 문장 신청 화면
├── professor.html       # 교수 대시보드 (설정·현황·배정결과·통계)
├── stats.html           # 통계 페이지 (학생별 현황, 회차별 기록)
├── css/
│   └── style.css        # 전체 공통 스타일
├── js/
│   ├── config.js        # Supabase URL/Key, 상수 설정
│   ├── supabase.js      # Supabase 클라이언트 초기화, TABLES 상수
│   ├── algorithm.js     # 문장 배정 알고리즘 (3지망 추첨)
│   ├── student.js       # 학생 신청 로직
│   ├── professor.js     # 교수 대시보드 로직
│   └── stats.js         # 통계 페이지 로직
├── vercel.json          # Vercel 라우팅 설정
└── .github/workflows/
    └── deploy.yml       # GitHub Actions → Vercel 자동 배포
```

## Supabase Tables

| 테이블 | 용도 |
|---|---|
| `students` | 전체 수강생 명단 (student_id PK, student_name) |
| `settings` | 총 문장 수, 신청 허용 여부, 배정 완료 여부, 비밀번호 |
| `submissions` | 학생 신청 데이터 (학번, 이름, 1~3지망, 배정 결과) |
| `rounds` | 회차 기록 |
| `win_history` | 학생별 누적 당첨 횟수 |
| `win_records` | 회차별 당첨 상세 기록 |

## Key Notes

- 교수 인증: `settings` 테이블의 `password1`/`password2` 값과 비교 (클라이언트 단순 인증)
- 배정 알고리즘: 1→2→3지망 순 추첨, 3지망 탈락 시 미배정 처리
- 모든 페이지는 `initSupabase()` 호출 후 전역 `db` 변수로 Supabase 사용
