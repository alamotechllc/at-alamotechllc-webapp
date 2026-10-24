import type { Stop } from "./guards.js";

function meta(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"\\s*/?>`, "i"));
  return match?.[1] ?? null;
}

export function previewAssetPaths(html: string): string[] {
  const paths: string[] = [];
  const pattern = /<(?:script|link)\b[^>]*\b(?:src|href)="(\/assets\/[^"]+)"/g;
  for (const match of html.matchAll(pattern)) paths.push(match[1]!);
  return paths;
}

export function previewSmokeFailure(input: {
  status: number;
  html: string;
  sha: string;
  channel?: string;
}): Stop | null {
  if (input.status !== 200) {
    return { stage: "smoke", message: `Preview returned HTTP ${input.status}.` };
  }
  if (input.html.includes("Site Not Found")) {
    return { stage: "smoke", message: "Preview is the Firebase empty site." };
  }
  if (!input.html.includes("<title>Alamo Tech</title>")) {
    return { stage: "smoke", message: "Preview is missing the application title." };
  }
  const channel = meta(input.html, "raas-channel");
  const expectedChannel = input.channel ?? "dev";
  if (channel !== expectedChannel) {
    return { stage: "smoke", message: `Preview channel is ${channel ?? "missing"}.` };
  }
  const sha = meta(input.html, "raas-git-sha");
  if (sha !== input.sha) {
    return { stage: "smoke", message: "Preview git SHA does not match this commit." };
  }
  if (previewAssetPaths(input.html).length === 0) {
    return { stage: "smoke", message: "Preview HTML has no application assets." };
  }
  return null;
}
