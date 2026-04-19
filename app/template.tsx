/**
 * 네비게이션마다 새 인스턴스가 마운트되어 .page-enter 애니메이션이 매 전환마다 재생됩니다.
 * @see app/globals.css — @keyframes page-enter
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter min-h-0">{children}</div>
}
