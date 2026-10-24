export interface ScanHit {
  file: string;
  rule: string;
}

const RULES: { rule: string; pattern: RegExp }[] = [
  { rule: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { rule: "service-account", pattern: /"type"\s*:\s*"service_account"/ },
  { rule: "firebase-private-key", pattern: /FIREBASE_PRIVATE_KEY\s*=\s*\S+/ },
  { rule: "ghl-private-token", pattern: /GHL_PRIVATE_INTEGRATION_TOKEN\s*=\s*\S+/ },
  { rule: "google-client-secret", pattern: /GOCSPX-[A-Za-z0-9_-]{8,}/ },
];

export function scanText(file: string, text: string): ScanHit[] {
  return RULES.filter((rule) => rule.pattern.test(text)).map((rule) => ({ file, rule: rule.rule }));
}

const SKIP = /(^|\/)(node_modules|dist|\.local|\.git|apps\/web\/dist)\//;

export function scannable(path: string): boolean {
  if (SKIP.test(path)) return false;
  return /\.(?:ts|tsx|js|mjs|cjs|json|md|yml|yaml|html|css|example|sh|txt)$/.test(path);
}
