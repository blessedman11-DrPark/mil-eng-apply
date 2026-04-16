#!/usr/bin/env python3
"""
mil_eng_apply.html 의 '최종 수정: YYYY-MM-DD' 날짜를 오늘 날짜로 자동 갱신하는 스크립트.
Claude Code Stop 훅에서 커밋 전에 자동 실행됩니다.
"""
import re
import datetime

today = datetime.date.today().strftime('%Y-%m-%d')
target = 'mil_eng_apply.html'

with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

updated = re.sub(r'최종 수정: \d{4}-\d{2}-\d{2}', f'최종 수정: {today}', content)

if updated != content:
    with open(target, 'w', encoding='utf-8') as f:
        f.write(updated)
    print(f'[update_date] 최종 수정일 → {today}')
else:
    print(f'[update_date] 이미 최신 날짜: {today}')
