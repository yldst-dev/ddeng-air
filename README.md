# ddeng-air

땡처리닷컴 "3일 이내 출발" 항공권을 매일 정해진 시각에 수집하여, 신규/가격하락/가격상승/마감 변동을 텔레그램으로 알리는 봇.

## 구조 (클린아키텍처)

```
src/
  domain/            엔티티 + 포트(인터페이스). 외부 의존 없음
    entities/        Listing, StoredListing, ListingChange
    ports/           FlightSource, ListingRepository, Notifier
  application/       유스케이스 + 순수 비즈니스 로직
    ListingDiffer    수집결과 vs DB 상태 비교(신규/하락/상승/마감)
    SyncListingsUseCase
  infrastructure/    어댑터(외부 연동 구현체)
    source/          TtangFlightSource  (땡처리 listAct.do 호출)
    persistence/     SqliteListingRepository
    telegram/        TelegramNotifier, messageFormatter
    config/          .env 로딩
  main/              조립 루트 + 실행 진입점
    container        의존성 조립
    runOnce          1회 수집 (시스템 cron 용)
    schedule         내장 스케줄러 (node-cron)
```

의존 방향은 항상 안쪽(domain)으로만 향한다. domain 은 어떤 외부 라이브러리도 import 하지 않는다.

## 동작

1. 매 회차 `listAct.do` 를 1회 호출해 전체 운임을 수집한다 (서버가 page/scale 무시하고 전체 반환).
2. 노선·날짜·항공사 조합(`fareKey`)으로 SQLite 의 active 목록과 대조한다. 노선당 최저가 1건만 추적한다.
3. 변동만 한 건당 한 개의 텔레그램 메시지로 발송한다.
   - 신규 / 가격하락 / 가격상승 / 마감(취소선)
   - 마감은 DB 상태를 `closed` 로 갱신한다.
4. `price_history` 테이블에 가격 이력이 자동 축적된다.

## 발송 대상 제한

`TELEGRAM_ALLOWED_CHAT_IDS` 에 명시된 채팅/그룹 ID 로만 발송된다. 그 외에는 절대 전송되지 않는다.

## 설정

`.env.example` 을 `.env` 로 복사한 뒤 값을 채운다.

```bash
cp .env.example .env
```

## 실행

```bash
npm install
npm run build

# 내장 스케줄러로 상시 구동 (CRON_SCHEDULE 기본: 매시간 정각)
npm start

# 또는 1회만 실행 (시스템 cron / launchd 에서 호출)
npm run sync:once
```

### 시스템 cron 예시

```cron
0 * * * *  cd /path/to/ddeng-air && /usr/bin/node dist/main/runOnce.js >> run.log 2>&1
```

## Dokploy 배포

이 봇은 HTTP 포트가 없는 상시 구동 워커(내장 스케줄러)이므로 도메인 없이 배포한다.
SQLite 파일이 재배포 후에도 유지되도록 영속 볼륨이 반드시 필요하다. 볼륨이 없으면
재배포마다 DB 가 초기화되어 전체 목록이 다시 "신규" 로 발송된다.

### 방법 A — Docker Compose (권장)

1. Dokploy 에서 Compose 타입 서비스를 만들고 이 저장소를 연결한다.
2. Compose 파일 경로를 `docker-compose.yml` 로 지정한다.
3. Environment 탭에 변수 입력 (`.env.example` 참고):
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_IDS` 는 필수
   - 나머지는 비워두면 compose 의 기본값이 적용된다
4. 배포한다. `ddeng-air-data` 명명 볼륨이 `/app/data` 에 마운트되어 DB 가 보존된다.

### 방법 B — Application (Dockerfile)

1. Dokploy 에서 Application 타입 서비스를 만들고 빌드 방식을 Dockerfile 로 지정한다.
2. Advanced → Volumes/Mounts 에서 마운트 경로 `/app/data` 로 볼륨을 추가한다.
3. Environment 탭에 위와 동일하게 변수를 입력한다.
4. 도메인은 할당하지 않는다(노출 포트 없음).

### 로컬에서 동일 환경 확인

```bash
docker build -t ddeng-air .
docker run --rm --env-file .env -v ddeng-air-data:/app/data ddeng-air
```

## 그룹 채팅 ID 확인

봇을 그룹에 초대한 뒤 아무 메시지나 보내고 아래로 확인한다.

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

응답의 `chat.id` 값을 `TELEGRAM_ALLOWED_CHAT_IDS` 에 넣는다. 그룹은 보통 음수다.
