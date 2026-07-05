# nBBang — 모임 정산

모임 회비/지출을 기록하고 최소 송금 횟수로 정산 경로를 계산해주는 모바일 우선 웹앱.

## 기능

- 모임별 멤버·지출 기록 관리 (수정 후 재정산 가능)
- 지출처별 참여 인원, 지출인 개별 지정
- 인원별 금액 직접 지정 + 나머지 균등 분배 혼합 지원
- 균등 분배 라운딩 나머지는 총무(미지정 시 지출인)가 흡수 — 총합 항상 정확히 보존
- 최소 송금 횟수 경로 산정 (0합 그룹 분할 DP, 14명 초과 시 greedy)
- 총무 허브 송금 모드 (모두 총무에게 보내고 총무가 지급)

## 기술 스택

React 19 + Vite + TypeScript / Supabase (Auth + Postgres) / Vercel

## 로컬 실행

1. [Supabase](https://supabase.com) 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Authentication → Providers에서 Email 활성화 확인
4. `.env` 생성:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

5. 실행:

   ```
   npm install
   npm run dev
   ```

## 테스트

```
npm test        # 정산 엔진 단위 테스트
npm run build   # 타입 검사 + 프로덕션 빌드
```

## Vercel 배포

1. 저장소를 GitHub에 푸시 후 Vercel에서 Import (Framework: Vite 자동 감지)
2. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가
3. SPA 라우팅은 `vercel.json`의 rewrite가 처리

## 정산 규칙

- 지출별 분담액을 먼저 원 단위로 확정하고, 사람별 `net = 지불액 − 부담액`을 계산
- `net > 0`이면 받을 돈, `net < 0`이면 보낼 돈. 총합은 항상 0
- 송금 경로는 0합 부분 그룹 개수를 최대화해 송금 횟수를 최소로 보장
