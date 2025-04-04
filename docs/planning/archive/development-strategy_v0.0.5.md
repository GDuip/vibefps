아래 내용은 **PO(Project Owner) 혹은 PM(Project Manager)**의 관점에서, 앞선 회의와 팀원들의 의견을 종합해 **개발 전략**을 최종 정리한 문서입니다.

---

# Vibe Jam 2025 FPS 게임 프로젝트  
**PO/PM 회의록 및 개발 전략 확정안**

## 1. 개요

- **프로젝트 명**: Vibe Jam 2025 FPS 게임  
- **마감 기한**: 2025년 3월 25일 (현재 5일 남음)  
- **목표**: 대회 규정(80% AI 코드, 즉시 플레이, 웹 기반) 충족 + 완성도 있는 FPS 프로토타입 제출

## 2. 회의 목적
- **개발자**, **기획자**, **디자이너**의 의견을 종합하여  
  1) 남은 5일 동안 **개발해야 할 핵심 기능과 우선순위** 확정  
  2) **프로젝트 일정** 및 **역할 분담** 결정  
  3) **위험 요소**에 대한 대응 전략 마련

---

## 3. 핵심 전략 요약

1. **게임플레이 다양화**  
   - **이동 타겟**, **보너스 타겟**, **감점 타겟** 등 **타겟 패턴**을 추가해 짧은 시간 안에 재미를 극대화  
   - 점수 시스템에 **연속 타격 보너스**, **특수 타겟 보상** 등을 넣어 **리플레이성** 확보

2. **즉시 시작(Instant Play) & 최적화**  
   - 대회 규정상 **로딩 화면 없이 바로 게임**이 실행되어야 함  
   - 리소스 용량 최소화, 불필요한 3D 모델·텍스처 제거, 지연 로딩(lazy loading) 등 적극 도입

3. **UX/UI 강화**  
   - **모바일 & PC**를 동시에 지원: 간단한 **조작 안내(오버레이)** 및 **입력 모드 자동 전환**(터치/마우스)  
   - **설정 메뉴**(감도, 볼륨, 난이도)를 직관적으로 정비해, 플레이어 맞춤 설정 용이

4. **타격감(피드백) 보강**  
   - 최소한의 파티클 이펙트(피격 시 시각 효과), 사운드(발사, 타격) 추가  
   - 모바일 환경 성능 부담을 고려해 **가벼운 이펙트** 위주로 구성

5. **AI 코드 활용 투명성 확보**  
   - 전체 코드 중 **80% 이상**이 AI가 작성되었음을 입증해야 함  
   - **커밋 메시지**, **주석**, **최종 문서화** 등을 통해 투명하게 기여도 기록

---

## 4. 상세 우선순위 및 일정

> **기간**: 남은 5일을 기준으로 업무를 배분

1. **Day 1~2: 게임플레이 & 시스템 보강**  
   - (1) **TargetManager** 개선:  
     - 이동 타겟, 보너스 타겟, 감점 타겟 등 추가  
     - 점수 시스템 내 **콤보/배율** 로직 구현  
   - (2) **Physics & Graphics** 최적화:  
     - CannonJS 물리 스텝 튜닝 (모바일 성능 고려)  
     - ThreeJS 렌더링 설정(해상도/라이팅 최소화)  
   - (3) **AudioManager** 최적화:  
     - 데이터 URI 사운드 용량 축소, 짧고 가벼운 사운드 사용  

2. **Day 3: UX/UI & 즉시 시작**  
   - (1) **UI/UX 개선**:  
     - 간단한 조작 가이드(튜토리얼 팝업, 오버레이)  
     - 모바일 조작(터치) vs. 데스크톱 조작(마우스) 자동 분기  
   - (2) **설정 메뉴**:  
     - 감도, 볼륨, 난이도, 키 바인딩 등 직관적 배치  
   - (3) **Instant Play** 점검:  
     - 불필요한 리소스 제거, 초기 로딩 1~2초 이하 유지 목표  

3. **Day 4: 크로스 브라우저 & 디바이스 테스트**  
   - (1) PC 브라우저(Chrome, Firefox, Safari, Edge) 테스트  
   - (2) 모바일(iOS Safari, Android Chrome) 실기 테스트  
   - (3) 발견된 주요 버그 및 UI 이슈 즉시 수정  

4. **Day 5: 마무리 폴리싱 & 제출 문서 정리**  
   - (1) 최종 버그 픽스, 성능 점검  
   - (2) AI 코드 증빙 문서(주석, 커밋 로그 등) 최종 정리  
   - (3) 대회 제출 요건(플레이 URL, 설명 자료, 80% AI 증빙) 확인 후 업로드

---

## 5. 역할 분담 제안

| 역할/담당    | 주요 업무                                                    |
|--------------|------------------------------------------------------------|
| **개발자 A** | TargetManager 확장(이동/보너스 타겟), Physics/Graphics 최적화 |
| **개발자 B** | AudioManager 개선, UI/UX 스크립트 (튜토리얼, 설정 메뉴)       |
| **디자이너** | 게임 오버레이/아이콘 디자인, 파티클·시각 이펙트 리소스 준비   |
| **기획자**   | 난이도 파라미터 기획, 점수 룰 확정, 타겟 패턴 문서화          |
| **QA 전담**  | Day 4~5 집중 테스트, 크로스 브라우저·모바일 호환성 체크       |
| **PO/PM**    | 일정 조율, 대회 제출 자료(프로젝트 소개, AI 코드 증빙) 정리  |

---

## 6. 주요 리스크 및 대응

1. **시간 부족(5일 제한)**  
   - **핵심 기능** 위주로 개발 후, 폴리싱에 집중  
   - 기능 과도하게 늘리지 말고, **안정성** 우선  
2. **브라우저 호환성**  
   - **테스트 일정 확보**(Day 4~5) → 발견 시 즉시 수정  
3. **AI 코드 사용 증빙**  
   - 매 커밋마다 AI 코드 작성 표시, 주석 철저 기록  
4. **모바일 퍼포먼스 이슈**  
   - CannonJS·ThreeJS 간소화(불필요 쉐이더·하이폴리곤 모델 제거)  

---

## 7. 결론 및 확정 내용

1. **게임 핵심 목표**: 웹 환경에서 **즉시 플레이**가 가능하고, **타격감**과 **다양한 타겟 패턴**으로 **간단하지만 즐거운** FPS를 완성한다.  
2. **개발 범위**:  
   - 타겟 시스템 개선(이동/보너스/감점), 점수 콤보 로직, UX/UI 오버레이, 사운드·파티클 피드백, 크로스 브라우저 테스트  
3. **일정 및 역할**:  
   - Day 1~2에 기능 구현/최적화, Day 3 UI/UX/Instant Play, Day 4 테스트, Day 5 폴리싱 및 제출  
   - 팀원별로 전담 영역을 명확히 구분하고, 필요 시 즉시 협력  
4. **대회 제출 요건**:  
   - 코드 80% 이상 AI 작성 (주석+커밋 증빙), 즉시 시작 가능, 무료 웹 플레이, 대회용 임베디드 코드 삽입 등  
5. **추가 제안사항**:  
   - **개발 로그**(Git, 문서) 꼼꼼히 남겨 추후 AI 코드 검증 문제 없이 대응  
   - 우선 핵심 재미를 완성한 뒤, 남은 시간으로 추가 폴리싱 진행

---

### 최종 마무리

- 이번 5일간은 **“기본기를 다지면서 재미 요소에 집중”**한다는 기조를 지키되,  
- **브라우저/모바일 호환**, **퍼포먼스**, **AI 코드 80% 증빙**이라는 필수 요건을 놓치지 않도록 **데일리 스탠드업**으로 점검합니다.  
- 각 담당자는 본 문서에 따른 **역할**과 **우선순위**에 맞춰 일정을 소화하고, 필요 시 즉시 PO/PM에게 이슈를 보고해 주세요.  

이상으로, **이번 회의록 및 개발 전략**을 확정합니다.  
**Vibe Jam 2025** 대회에서 좋은 성과를 기대합니다. 
