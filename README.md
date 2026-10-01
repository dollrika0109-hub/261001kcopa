# 🚨 한국저작권보호원 모의신고 훈련

임직원이 가상의 상황 속 당사자가 되어 **상황 파악 → 신고유형 선택 → 신고서 작성 → 신고 접수**를 체험하는 시뮬레이션형 교육 웹게임입니다.

---

## 1. 바로 실행하기

### A. 혼자 테스트 (설치 없음)
`index.html`을 더블클릭해 브라우저로 엽니다.
- 결과는 **이 브라우저에만** 저장됩니다. (화면 우측 상단 `💾 이 PC에 저장`)
- 관리자 화면: `admin.html`을 열고 비밀번호 `kcopa1234`

### B. 여러 직원이 각자 PC에서 참여 (중앙 저장) ← 권장
[Node.js](https://nodejs.org) (18 이상)만 설치되어 있으면 됩니다. 추가 패키지 설치는 필요 없습니다.

```bash
# Windows: start-server.bat 더블클릭
# Mac/Linux:
ADMIN_PASSWORD=원하는비밀번호 node server/server.js
```

서버가 켜지면 콘솔에 접속 주소가 표시됩니다.
- 직원 접속 주소: `http://<서버PC IP>:8080`  (같은 사내망에서 접속)
- 관리자 주소: `http://<서버PC IP>:8080/kcopa-admin`
- 제출 데이터: `server/data/submissions.json`

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8080 | 서버 포트 |
| `ADMIN_PASSWORD` | kcopa1234 | 관리자 비밀번호 (**반드시 변경**) |
| `ADMIN_PATH` | kcopa-admin | 관리자 페이지 경로. 참가자가 추측하기 어려운 값으로 바꾸세요 |

> 서버 모드에서는 `/admin.html`로 직접 접근이 차단되고 `ADMIN_PATH`로만 열립니다. 관리자 API는 로그인 토큰(8시간 유효)이 있어야 호출되며, 비밀번호 5회 오류 시 5분간 잠깁니다.

### C. Supabase 연결 (클라우드)
1. Supabase 프로젝트 생성 → **SQL Editor**에서 `supabase/schema.sql` 실행
2. **Authentication → Users**에서 관리자 계정 생성 후
   `insert into public.admin_users (email) values ('관리자이메일');` 실행
3. `js/config.js` 수정
   ```js
   storage: { mode: 'supabase', supabase: { url: 'https://xxxx.supabase.co', anonKey: '...' } }
   ```
4. 전체 폴더를 정적 호스팅(Netlify, Vercel, GitHub Pages, 사내 웹서버 등)에 올리면 끝입니다.

보안 구조: 참가자(anon)는 `submit_mock_report()` 함수로 **제출만** 가능하고 조회·수정은 불가합니다. 조회·삭제는 `admin_users`에 등록된 로그인 계정만 가능합니다(RLS).

### D. 구글 시트로 결과 받기 (가장 간단한 중앙 저장)
제출할 때마다 구글 시트에 **한 줄씩 자동으로 쌓입니다.** 별도 서버나 DB 가입이 필요 없습니다.

1. 구글 드라이브에서 새 **구글 시트** 생성 (예: `모의신고 훈련 결과`)
2. 메뉴 **확장 프로그램 → Apps Script** 클릭
3. 기본 코드를 지우고 `google-sheets/Code.gs` 내용을 전부 붙여넣기
4. 맨 위 `ADMIN_PASSWORD = 'kcopa1234'` 를 원하는 비밀번호로 변경 → 💾 저장
5. 오른쪽 위 **배포 → 새 배포** → 톱니바퀴에서 **웹 앱** 선택
   - 다음 사용자로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**
   - **배포** → 구글 계정 권한 승인 (“확인되지 않은 앱” 경고가 나오면 *고급 → (안전하지 않음)으로 이동* 선택. 본인이 만든 스크립트라 괜찮습니다)
6. 발급된 **웹 앱 URL**(`https://script.google.com/macros/s/…/exec`)을 복사
7. `js/config.js` 수정
   ```js
   mode: 'gsheet',
   googleSheets: { webAppUrl: '복사한 웹 앱 URL' },
   ```
8. 폴더를 Netlify Drop 등에 올리면 끝. 첫 제출 시 `제출결과` 시트가 자동으로 만들어집니다.

시트에 기록되는 열: 접수번호, 제출일시, 성명, 소속, 신고 구분, CASE, CASE 제목, 신고서 종류, 1차 정답, 오답 횟수, 오답 이력, 예시보기 횟수, 미완료 제출 시도, 참고자료 열람, 첨부 선택 자료, 소요시간(초), 신고서 작성 내용, ID, 원본 데이터(JSON)

- 관리자 화면(`admin.html`)도 그대로 쓸 수 있습니다. 4번에서 정한 비밀번호로 로그인하면 시트 데이터를 읽어 통계를 보여줍니다.
- 시트 자체는 **공유하지 않은 상태 그대로** 두세요. 참가자는 웹 앱을 통해 “추가”만 할 수 있고 시트를 볼 수는 없습니다.
- `Code.gs`를 수정했다면 **배포 → 배포 관리 → ✏️ → 버전: 새 버전 → 배포**를 해야 반영됩니다. (URL은 그대로 유지)
- 한계: 동시에 수십 명이 같은 순간에 제출하면 몇 초씩 대기가 생길 수 있습니다(순서대로 처리). 일반적인 교육 규모에서는 문제없습니다.

---

## 2. 전체 구조

```
mock-report-training/
├─ index.html              참가자용 게임
├─ admin.html              관리자 대시보드
├─ css/style.css, admin.css
├─ js/
│  ├─ config.js            ★ 저장 방식·관리자 비밀번호·힌트 등 설정
│  ├─ data/
│  │  ├─ content.js        ★ 화면 문구, 신고 구분, 진행단계명, 신고센터 안내
│  │  ├─ cases.js          ★ CASE 시나리오·참고자료·정답·힌트·작성예시
│  │  └─ forms.js          ★ 신고서 5종의 대항목/입력항목
│  ├─ render-shared.js     공통 렌더링(참고자료, 신고서 문서 보기)
│  ├─ storage.js           저장소 어댑터 (local / server / supabase / gsheet)
│  ├─ app.js               게임 진행 로직
│  └─ admin.js             관리자 화면 로직
├─ server/server.js        중앙 저장 서버 (Node 내장 모듈만 사용)
├─ supabase/schema.sql     Supabase 테이블·보안정책·제출함수
├─ google-sheets/Code.gs   구글 시트 저장용 Apps Script
└─ start-server.bat        Windows용 서버 실행
```

**계층 분리**: 화면(app.js/admin.js)은 `Store.submit()`, `Store.list()` 같은 공통 인터페이스만 호출합니다. 저장 위치는 `storage.js`의 어댑터가 결정하므로, 다른 백엔드(Firebase, 사내 API 등)를 붙일 때는 `storage.js`에 어댑터 하나만 추가하면 됩니다.

**백엔드 장애 대응**: 서버/Supabase 저장에 실패해도 게임은 정상 진행되고, 결과는 해당 PC에 임시 저장(접수 완료 화면에 안내)된 뒤 다음 접속 시 자동 재전송됩니다.

### 진행 흐름 (상단 진행바 7단계)
| 단계 | 화면 | 주요 기능 |
|---|---|---|
| ① 메인화면 | 참가자 정보 입력, 「위반행위 신고하기」/「본인 신고하기」 선택 | 미입력 시 진행 불가 |
| ② CASE 선택 | 구분별 CASE 3개 카드 | 이미 체험한 CASE에 ‘체험 완료’ 표시 |
| ③ 상황 확인 | 시나리오 본문 + 참고자료(첨부파일처럼 클릭해 열람) | |
| ④ 신고유형 선택 | 신고서 5종 중 선택 → 「신고서 작성하기」 | 오답 시 “다시 한번 생각해주세요”·진행 차단, 2회 이상 오답 시 힌트 |
| ⑤ 신고서 작성 | 왼쪽 시나리오·참고자료 / 오른쪽 신고서, [예시보기] | 미작성 항목 빨간 표시 + “작성이 완료되지 않았습니다” |
| ⑥ 신고 접수 | 작성 내용 문서 형태로 확인 → 「신고하기」 | 접수 애니메이션 |
| ⑦ 접수 완료 | 접수번호(예: 2026-MOCK-001), 실제 신고 안내 | |

---

## 3. 저장되는 데이터 구조

제출 1건 = 아래 객체 1개 (서버: `submissions.json`의 `items[]`, Supabase: `mock_reports.payload`)

```jsonc
{
  "id": "uuid",                       // 고유 ID
  "receiptNo": "2026-MOCK-001",       // 접수번호 (저장소가 연도별 일련번호로 발급)
  "appVersion": "1.0.0",
  "participant": { "name": "홍길동", "dept": "경영지원부" },   // 메인화면 참가자 정보
  "category": "violation",            // violation(위반행위 신고) | self(본인 신고)
  "caseId": "case01", "caseNo": "01", "caseTitle": "참석하지 않은 간담회",
  "formId": "conduct", "formTitle": "행동강령 위반행위 신고서",
  "typeSelection": {                  // ④ 신고유형 선택 결과
    "correctFormId": "conduct",
    "wrongAttempts": [{ "formId": "gapjil", "at": "2026-10-01T05:10:00Z" }],
    "wrongCount": 1,
    "firstTryCorrect": false
  },
  "answers": {                        // ⑤ 신고서 작성 내용 (키 = forms.js의 field id)
    "reporter_name": "홍길동", "identity_consent": "부동의",
    "violation_content": "...", "evidence": ["m1", "m3"]
  },
  "evidenceSelected": ["m1", "m3"],   // 첨부로 선택한 참고자료 id
  "behavior": {                       // 학습 행동 지표
    "exampleViewedCount": 1,          // [예시보기] 클릭 횟수
    "validationFailCount": 2,         // 미완료 상태로 제출 시도한 횟수
    "materialsOpened": ["m1", "m3"],  // 열람한 참고자료
    "materialsTotal": 3
  },
  "startedAt": "...",                 // CASE 선택 시각
  "formStartedAt": "...",             // 신고서 작성 시작 시각
  "submittedAt": "...",               // 신고하기 시각
  "durationSec": 245,                 // CASE 선택~접수 소요시간
  "client": { "userAgent": "...", "screen": "1920x1080" },
  "storedAt": "...",                  // 저장소 기록 시각 (서버/로컬)
  "syncStatus": "pending"             // (로컬 임시저장 건에만) 미전송 표시
}
```

Supabase에서는 위 값 중 자주 집계하는 항목(참가자, CASE, 1차 정답 여부, 오답 수, 소요시간 등)을 별도 컬럼으로도 저장해 SQL로 바로 분석할 수 있습니다.

### 관리자 화면에서 볼 수 있는 것
- KPI: 총 제출 건수, 참여 인원, 신고유형 1차 정답률, 평균 소요시간, 예시보기 활용률
- CASE별: 참여 수, 1차 정답률, 평균 오답, **가장 많이 혼동한 신고서**, 예시보기율, 미완료 제출 시도, 평균 소요
- 제출 목록 검색·CASE 필터, 행 클릭 시 작성한 신고서 원문 + 오답 이력
- CSV(엑셀용) / JSON 백업 다운로드, 개별 삭제

---

## 4. 내용 수정 방법

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 시나리오 문장, 참고자료, 정답 신고서, 힌트, 작성 예시 | `js/data/cases.js` |
| 신고서 항목 추가·삭제·필수 여부·안내문 | `js/data/forms.js` |
| 안내 문구, 진행단계 이름, 오류 메시지, 신고센터·담당자 안내 | `js/data/content.js` |
| 저장 방식, 관리자 비밀번호(로컬 모드), 힌트 표시 기준 | `js/config.js` |

- 시나리오에서 `**문장**`은 굵게(강조) 표시됩니다.
- 참고자료 형식: `kv`(영수증·송장형), `chat`(메신저 대화), `table`(표·캡처), `text`(문단)
- 신고서 항목 옵션: `width: 'half'|'third'`, `required: false`, `showIf: { field, equals }`(조건부 표시)

### 관리자 비밀번호 변경
- **서버 모드**: 실행 시 `ADMIN_PASSWORD` 환경변수로 지정 (`start-server.bat` 안에서 수정)
- **로컬 모드**: 아래 명령으로 해시를 만들어 `js/config.js`의 `localPasswordSha256`에 붙여넣기
  ```bash
  node -e "console.log(require('crypto').createHash('sha256').update('새비밀번호').digest('hex'))"
  ```
  ※ 로컬 모드의 비밀번호는 브라우저 안에서만 확인하는 간이 잠금입니다. 실제 운영은 서버 또는 Supabase 모드를 사용하세요.
- **Supabase 모드**: Supabase Authentication에서 계정 관리

---

## 5. 운영 체크리스트
- [ ] `ADMIN_PASSWORD`, `ADMIN_PATH` 변경
- [ ] 서버 PC의 방화벽에서 포트(8080) 허용
- [ ] 교육 전 테스트 제출 후 관리자 화면에서 삭제
- [ ] 교육 종료 후 CSV/JSON 백업
- [ ] 글꼴(Pretendard)은 인터넷 CDN에서 불러오며, 폐쇄망에서는 맑은 고딕으로 자동 대체됩니다
