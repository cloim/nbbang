# nBBang | 총무의 비밀

모임과 만남의 지출을 기록하고 정산하는 모바일 우선 웹앱입니다.

## 기능

- 모임, 멤버, 총무 정보 관리
- 모임 안의 여러 만남과 모임 외 만남 생성
- 만남별 참석자 선택, 지출 기록, 지출 순서 변경
- 개인별 정산, 정산 그룹, 정산 이미지 내보내기
- Google 로그인과 이름, 계좌번호 설정

## 기술 스택

React, Vite, TypeScript, Express, PostgreSQL 17, Docker Compose

## 로컬 실행

1. Docker Compose를 지원하는 컨테이너 엔진을 준비합니다.
2. `.env.example`을 참고해 `.env.local`을 만들고 `POSTGRES_PASSWORD`와 `GOOGLE_CLIENT_ID`를 설정합니다.
3. 웹, API와 PostgreSQL을 `nbbang` Compose 프로젝트로 빌드하고 실행합니다.

   ```powershell
   docker compose --env-file .env.local up -d --build --wait
   ```

4. `http://127.0.0.1:47420`에 접속합니다.

| 서비스 | 역할 | 로컬 주소 |
| --- | --- | --- |
| web | Nginx, 프런트엔드 빌드와 `/api` 프록시 | `http://127.0.0.1:47420` |
| api | Express API | `http://127.0.0.1:47422/api/health` |
| db | PostgreSQL 17 | `127.0.0.1:47430` |

DB, API와 웹 순서로 헬스체크를 통과한 뒤 시작합니다. 각 서비스는 컨테이너 엔진 재시작 후 자동으로 실행됩니다. 프런트엔드를 포함한 소스 변경은 위 빌드 명령으로 반영합니다. 컨테이너 관리 도구에는 이 폴더의 `compose.yaml`과 환경 파일 `.env.local`을 함께 등록합니다.

```powershell
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs --tail 100
docker compose --env-file .env.local stop
docker compose --env-file .env.local up -d --wait
```

기존 DB 데이터는 `nbbang_nbbang_postgres_data` 볼륨을 그대로 사용합니다. `down`은 컨테이너와 네트워크를 제거하고 볼륨을 유지합니다. `down -v`는 저장된 데이터까지 삭제하므로 데이터 초기화가 필요할 때만 사용합니다.

## 프런트엔드 개발

Node.js 22 이상을 설치하고 `npm ci` 후 `npm run dev`를 실행합니다. 개발 화면은 `http://127.0.0.1:47421`에서 제공하며 소스 변경을 즉시 반영합니다. `/api` 요청은 `127.0.0.1:47422`의 API 컨테이너로 전달합니다. Compose의 웹 화면 `47420`과 개발 화면 `47421`을 함께 사용할 수 있습니다.

컨테이너 API는 내부 서비스 주소 `db:5432`를 사용합니다. 호스트에서 API를 직접 개발할 때는 API 컨테이너를 중지한 후 `npm run dev:api`로 `47422` 포트에서 실행합니다. 호스트 실행 시 `POSTGRES_HOST`의 기본값은 `127.0.0.1`, `POSTGRES_PORT`는 `47430`이며, `DATABASE_URL`을 지정하면 그 값을 우선합니다.

## Google 로그인

Google Cloud Console에서 OAuth 웹 클라이언트를 만들고 로컬 주소와 운영 도메인을 승인된 JavaScript 원본에 등록합니다. 서버 `.env.local`의 `GOOGLE_CLIENT_ID`에 클라이언트 ID를 설정합니다. 서버에서 Google ID 토큰을 확인하고 세션 쿠키를 발급합니다.

## 데이터베이스

처음 만든 PostgreSQL 볼륨에는 `database/schema.sql`이 자동 적용됩니다. 기존 볼륨을 초기화하지 않고 스키마를 갱신할 때는 SQL 파일을 데이터베이스에 적용합니다. 사용자와 정산 데이터는 데이터베이스 내부에 저장됩니다.

## 확인

```powershell
npm run build
```
