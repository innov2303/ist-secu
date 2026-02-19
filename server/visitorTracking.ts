import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { visitorLogs } from "@shared/schema";

function parseUserAgent(ua: string | undefined): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };

  let browser = "Unknown";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("Opera/") || ua.includes("OPR/")) browser = "Opera";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "Internet Explorer";
  else if (ua.includes("curl/")) browser = "curl";
  else if (ua.includes("bot") || ua.includes("Bot") || ua.includes("crawler") || ua.includes("spider")) browser = "Bot";

  let os = "Unknown";
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("CrOS")) os = "ChromeOS";

  let device = "Desktop";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) device = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) device = "Tablet";
  else if (ua.includes("bot") || ua.includes("Bot") || ua.includes("crawler") || ua.includes("spider")) device = "Bot";

  return { browser, os, device };
}

const skipPaths = [
  "/api/captcha",
  "/api/admin/visitors",
  "/@vite",
  "/__vite",
  "/node_modules",
  "/src/",
  "/@react-refresh",
  "/@id",
];

const skipExtensions = [".js", ".css", ".map", ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".eot"];

export function visitorTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  if (skipPaths.some(p => path.startsWith(p))) return next();
  if (skipExtensions.some(ext => path.endsWith(ext))) return next();
  if (path.includes("hot-update")) return next();

  const user = req.user as any;
  if (user?.isAdmin || user?.role === "admin") return next();

  const startTime = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    const ua = req.headers["user-agent"];
    const { browser, os, device } = parseUserAgent(ua);
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const referer = req.headers["referer"] || req.headers["referrer"] || null;
    const userId = (req.user as any)?.id || null;

    if ((req.user as any)?.isAdmin) return;

    db.insert(visitorLogs).values({
      ipAddress,
      userAgent: ua || null,
      referer: referer as string | null,
      path: path,
      method: req.method,
      browser,
      os,
      device,
      statusCode: res.statusCode,
      responseTime,
      userId: userId ? String(userId) : null,
    }).catch(err => {
      console.error("Failed to log visitor:", err);
    });
  });

  next();
}
