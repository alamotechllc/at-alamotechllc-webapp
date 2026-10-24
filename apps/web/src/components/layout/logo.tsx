export function AlamoLogo({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    <>
      <img src="/brand/alamo-tech-logo-light.png" alt="Alamo Tech" className={`dark:hidden ${className}`} />
      <img src="/brand/alamo-tech-logo-dark.png" alt="" className={`hidden dark:block ${className}`} />
    </>
  );
}
