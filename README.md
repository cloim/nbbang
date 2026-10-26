# nBBang | 총무의 비밀

모임과 만남의 지출을 기록하고 정산하는 모바일 우선 웹앱입니다.

## 기능

- 모임, 멤버, 총무 정보 관리
- 모임 안의 여러 만남과 일회성 만남 생성
- 만남별 참석자 선택, 지출 기록, 지출 순서 변경
- 개인별 정산, 정산 그룹, 정산 이미지 내보내기
- Google 로그인과 이름, 계좌번호 설정

## 기술 스택

React, Vite, TypeScript, Express, PostgreSQL 17, Docker Compose

## 로컬 실행

1. Docker Desktop과 Node.js 22 이상을 설치합니다.
2. `.env.example`을 참고해 `.env.local`을 만들고 `POSTGRES_PASSWORD`와 `GOOGLE_CLIENT_ID`를 설정합니다. 서버가 PostgreSQL 접속 주소를 `POSTGRES_PASSWORD`에서 구성합니다. `DATABASE_URL`을 지정하면 그 값을 우선 사용합니다.
3. 전용 PostgreSQL 컨테이너를 생성하고 실행합니다.

   ```powershell
   docker compose --env-file .env.local up -d db
   ```

4. 의존성을 설치하고 개발 서버와 API를 각각 실행합니다.

   ```powershell
   npm install
   npm run dev:api
   npm run dev
   ```

5. `http://127.0.0.1:47420`에 접속합니다.

운영 서버는 `npm run build` 후 `npm start`로 실행합니다. Docker 데이터는 `nbbang_postgres_data` 볼륨에 저장됩니다.

## Google 로그인

Google Cloud Console에서 OAuth 웹 클라이언트를 만들고 로컬 주소와 운영 도메인을 승인된 JavaScript 원본에 등록합니다. 서버 `.env.local`의 `GOOGLE_CLIENT_ID`에 클라이언트 ID를 설정합니다. 서버에서 Google ID 토큰을 확인하고 세션 쿠키를 발급합니다.

## 데이터베이스

처음 만든 PostgreSQL 볼륨에는 `database/schema.sql`이 자동 적용됩니다. 기존 볼륨을 초기화하지 않고 스키마를 갱신할 때는 SQL 파일을 데이터베이스에 적용합니다. 사용자와 정산 데이터는 데이터베이스 내부에 저장됩니다.

## 확인

```powershell
npm run build
```
