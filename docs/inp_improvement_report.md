# INP(Interaction to Next Paint) 개선 작업 보고

## 개요

고객 모드·기사 모드에서 **INP 308ms+** 로 측정되던 상호작용 지연을 줄이기 위해, 메인 스레드를 블로킹하던 state 업데이트와 불필요한 세션 재조회를 정리했습니다.

---

## 1. 배송 요청 폼 (고객 · 기사 연결 요청 화면)

**파일:** `components/customer/delivery-request-form.tsx`

**증상:** `#pickupContactName` 등 입력 시 "Event handlers on this element blocked UI updates for 263.9ms" 경고.

**원인:**  
- 거리/요금 계산 `useEffect`가 `pickupLat`, `deliveryLat`, `itemType` 등 변경 시 동기적으로 `setCalculatedDistance`, `setEstimatedFee`, `setCustomerAmount` 호출.  
- 주소 동기화 `useEffect`, Geolocation 콜백에서도 여러 `setState` 호출.  
→ 입력 직후 같은 컴포넌트에서 무거운 state 업데이트가 겹쳐 메인 스레드 블로킹.

**조치:**
- 위 **비긴급 state 업데이트**를 모두 `startTransition` 내부에서 수행.
  - 거리·요금 계산 effect
  - URL 주소 반영 effect
  - Geolocation으로 출발지 설정하는 콜백
- 입력 필드 반응(다음 페인트)을 우선하고, 요금/거리 표시 갱신은 그다음으로 지연.

---

## 2. Header (전역 상단 네비게이션)

**파일:** `components/layout/header.tsx`

**증상:** `nav.flex.items-center.gap-2` 등에서 input delay 185ms+ 등 INP에 기여.

**원인:**  
- 세션/프로필 조회(`getSession`, `getUser`, `profiles` select) 후 **동기적으로** `setIsAuthenticated`, `setUserRole`, `setIsLoading` 호출.  
- **pathname이 바뀔 때마다** `refreshSession()` 실행 → 라우트 이동·클릭 시점에 세션 재조회 + setState가 겹침.

**조치:**
- 세션/프로필 조회 콜백 및 `onAuthStateChange` 내부의 **모든 setState**를 `startTransition`으로 감쌈.
- **pathname 의존** `useEffect`에서 `refreshSession()` 호출 제거.  
  → 마운트·auth 변경 시에만 세션 갱신.

---

## 3. BottomNav (전역 하단 네비게이션)

**파일:** `components/layout/bottom-nav.tsx`

**증상:** 고객 모드에서 버튼/링크 클릭 시 INP에 기여.

**원인:**  
- Header와 동일하게 pathname 변경 시마다 `refreshSession()` 호출.  
- `onAuthStateChange`에서 setState를 동기적으로 호출.

**조치:**
- `onAuthStateChange` 내부의 `setIsAuthenticated`, `setUserRole`, `setIsLoading` 호출을 **startTransition**으로 감쌈.
- **pathname 의존** `useEffect`에서 `refreshSession()` 호출 제거.

---

## 4. 기타 (동일 커밋 포함)

**파일:** `app/driver/page.tsx`

- 기사 대시보드 **탭 메뉴** 첫 번째 탭("대기 중 배송") 앞글자 잘림 현상 수정.
- `TabsList`에 `pl-[max(0.75rem, env(safe-area-inset-left))]` 적용해 모바일·노치 환경에서 왼쪽 여백 확보.

---

## 요약 표

| 대상 | 조치 | 기대 효과 |
|------|------|-----------|
| 배송 요청 폼 | 요금/거리/주소 setState를 `startTransition`으로 연기 | 입력 필드 INP 감소, 263ms+ 블로킹 완화 |
| Header | setState를 startTransition 처리, pathname별 refreshSession 제거 | 네비·버튼 클릭 시 INP 개선 |
| BottomNav | setState를 startTransition 처리, pathname별 refreshSession 제거 | 하단 탭 클릭 시 INP 개선 |

---

## 참고

- **INP:** 사용자 상호작용(클릭·입력 등)부터 다음 페인트까지 걸린 시간. Core Web Vitals 반응성 지표.
- **startTransition:** React 18 비긴급 업데이트 표시. 상호작용에 따른 즉시 반응(페인트)을 우선하고, 나머지 state 갱신은 다음 틱으로 미룸.
- 이전 커밋: `fix: 배송 요청 폼 INP 개선 (startTransition으로 비긴급 state 연기)`  
- 이번 커밋: `perf: INP 개선 (Header/BottomNav startTransition, pathname 세션제거) + 기사 탭 왼쪽 여백`
