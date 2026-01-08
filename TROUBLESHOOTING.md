# 멀티플레이어 게임 문제 해결 가이드

## 현재 실행 중인 서비스

### 서버 (백엔드)
- URL: http://10.145.164.94:3000
- 상태 확인: 브라우저에서 http://10.145.164.94:3000 접속 시 JSON 응답이 보여야 함

### 클라이언트 (프론트엔드)
- URL: http://10.145.164.94:5174
- Socket 연결 대상: http://10.145.164.94:3000

## 문제 확인 절차

### 1. 브라우저 콘솔 확인 (F12)
브라우저에서 F12를 눌러 개발자 도구를 열고 Console 탭에서 다음 로그를 확인:

```
Connecting to socket server: http://10.145.164.94:3000
Socket connected: <socket-id>
handleJoin called: { roomName: "...", userName: "...", socketConnected: true }
Emitting join_room event
Setting up socket listeners for room: ...
Received participant_list: [...]
Received rule_list: [...]
```

### 2. 오류 확인

#### Socket 연결 오류가 보이는 경우:
```
Socket connection error: ...
```
**해결 방법:**
- 서버가 실행 중인지 확인 (http://10.145.164.94:3000 접속 테스트)
- 방화벽에서 3000 포트가 열려있는지 확인

#### "Socket is not connected yet!" 오류가 보이는 경우:
**해결 방법:**
- 페이지를 새로고침하고 몇 초 기다린 후 다시 입장 시도
- Socket 연결이 완료되면 자동으로 처리됨

### 3. 게임 시작이 안 되는 경우

확인 사항:
1. 참가자 목록에 이름이 표시되는가?
2. 룰 목록이 표시되는가?
3. "룰렛 시작" 버튼을 클릭했을 때 콘솔에 `Game started with seed: ...` 로그가 보이는가?

### 4. 방화벽 설정 (필요시)

Windows에서 방화벽 열기:
```cmd
netsh advfirewall firewall add rule name="Node Client 5174" dir=in action=allow protocol=TCP localport=5174
netsh advfirewall firewall add rule name="Node Server 3000" dir=in action=allow protocol=TCP localport=3000
```

## 테스트 시나리오

### 로컬 테스트 (같은 PC)
1. 브라우저에서 http://localhost:5174 접속
2. 이름과 방 이름 입력 후 입장
3. 참가자 목록에 이름이 보이는지 확인
4. 룰렛 시작 버튼 클릭

### 멀티플레이어 테스트 (다른 PC)
1. 두 PC가 같은 네트워크에 연결되어 있는지 확인
2. PC1: http://10.145.164.94:5174 접속, 방 "test" 입장
3. PC2: http://10.145.164.94:5174 접속, 같은 방 "test" 입장
4. 양쪽에서 서로의 이름이 참가자 목록에 보이는지 확인
5. 한쪽에서 룰렛 시작 → 양쪽에서 동시에 게임이 시작되어야 함

## 디버깅 모드

모든 주요 이벤트가 콘솔에 로그로 출력됩니다:
- Socket 연결/연결 해제
- 방 입장
- 참가자/룰 업데이트
- 게임 시작

문제가 발생하면 브라우저 콘솔 로그를 확인하세요.
