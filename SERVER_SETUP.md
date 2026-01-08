# PC를 서버로 사용하기

이 PC를 Roulette Together의 서버로 사용하는 가이드입니다.

## 현재 서버 정보

- **포트**: 3000
- **로컬 URL**: http://localhost:3000
- **네트워크 URL**: http://10.145.164.94:3000
- **상태 확인**: http://localhost:3000 또는 http://10.145.164.94:3000

## 서버 시작하기

### 방법 1: 배치 파일 사용 (권장)

```bash
# server 폴더에서 실행
cd server
start-server.bat
```

### 방법 2: 명령어로 직접 실행

```bash
cd server
npm start
```

또는

```bash
cd server
npx ts-node index.ts
```

## 서버 상태 확인

브라우저에서 접속:
- http://localhost:3000
- http://10.145.164.94:3000

또는 명령어로 확인:
```bash
curl http://localhost:3000
netstat -ano | findstr :3000
```

## 서버 종료하기

1. 실행 중인 서버 창에서 `Ctrl + C`
2. 또는 Task Manager에서 Node.js 프로세스 종료
3. 또는 명령어로 종료:
```bash
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3000

# PID로 프로세스 종료 (PID는 위 명령어 결과의 마지막 숫자)
taskkill /PID <PID번호> /F
```

## Windows 시작 시 자동 실행

### 방법 1: 시작 프로그램에 등록

1. `Win + R` → `shell:startup` 입력
2. 시작 프로그램 폴더가 열림
3. `server/start-server.bat` 파일의 바로가기를 여기에 복사

### 방법 2: 작업 스케줄러 사용

1. `작업 스케줄러` 실행
2. `기본 작업 만들기` 클릭
3. 이름: "Roulette Server"
4. 트리거: "컴퓨터를 시작할 때"
5. 작업: "프로그램 시작"
6. 프로그램: `D:\WorkSpace\RouletteTogether\server\start-server.bat`

## 방화벽 설정

외부에서 접속하려면 Windows 방화벽에서 포트 3000을 열어야 합니다.

### 방화벽 규칙 추가

1. `Windows Defender 방화벽` → `고급 설정` 실행
2. `인바운드 규칙` → `새 규칙` 클릭
3. 규칙 종류: `포트` 선택
4. 프로토콜: `TCP`, 포트: `3000`
5. 작업: `연결 허용`
6. 프로필: 모두 체크
7. 이름: "Roulette Server"

또는 명령어로 추가:
```bash
netsh advfirewall firewall add rule name="Roulette Server" dir=in action=allow protocol=TCP localport=3000
```

## 클라이언트 배포 시 설정

클라이언트를 Netlify에 배포할 때 환경 변수를 설정하세요:

- **변수명**: `VITE_SOCKET_URL`
- **값**: `http://10.145.164.94:3000` (또는 공인 IP)

## 공인 IP로 외부 접속 허용

현재 IP `10.145.164.94`는 사설 IP입니다. 외부에서 접속하려면:

1. **공인 IP 확인**: https://www.whatismyip.com/
2. **공유기 포트포워딩 설정**:
   - 공유기 관리 페이지 접속 (보통 192.168.0.1 또는 192.168.1.1)
   - 포트포워딩 설정
   - 외부 포트: 3000 → 내부 IP: 10.145.164.94, 내부 포트: 3000
3. **클라이언트 환경 변수**를 공인 IP로 변경:
   - `VITE_SOCKET_URL=http://<공인IP>:3000`

## 모니터링

### 서버 로그 확인
서버 실행 창에서 실시간으로 로그를 확인할 수 있습니다.

### 접속자 수 확인
http://localhost:3000 접속 시 현재 방 개수를 확인할 수 있습니다.

## 문제 해결

### 포트 3000이 이미 사용 중
```bash
# 포트 사용 중인 프로세스 찾기
netstat -ano | findstr :3000

# 프로세스 종료 (PID는 위 결과의 마지막 숫자)
taskkill /PID <PID번호> /F
```

### 외부에서 접속 안됨
1. 방화벽 규칙 확인
2. 공유기 포트포워딩 확인
3. 공인 IP 확인
4. 서버 실행 상태 확인

## 보안 권장사항

1. **비밀번호 없는 간단한 게임이므로** 개인 PC에서 운영 시 주의
2. 필요 시 HTTPS 적용 (Let's Encrypt 등)
3. Rate limiting 추가 고려
4. 로그 모니터링
