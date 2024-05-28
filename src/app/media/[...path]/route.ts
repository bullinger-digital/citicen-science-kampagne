import path from "path";
import fs from "fs";
export const dynamic = "force-dynamic"; // defaults to auto

const CONTENT_TYPE_MAP: {
  [key: string]: string;
} = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  _default: "application/octet-stream",
};

// Tina CMS media handler
export async function GET(request: Request) {
  if (request.url.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const currentUrl = new URL(request.url);
  const mediaPath = currentUrl.pathname.replace("/media/", "");
  const contentType =
    CONTENT_TYPE_MAP[mediaPath.split(".").pop() || "_default"];

  // If we're in development, we can just return the file from the file system
  if (process.env.NODE_ENV === "development") {
    // Return response with file content (binary)
    const localPath = path.join(process.cwd(), "media", mediaPath);
    const stream = await fs.promises.readFile(localPath);
    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
      },
    });
  }

  // Get file from GitHub
  const url = `https://raw.githubusercontent.com/bullinger-digital/citizen-science-content/main/media/${mediaPath}`;
  console.log(url);

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${process.env.TINA_CONTENT_REPO_GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.raw",
    },
  });

  if (!response.ok) {
    console.log(response);
    return new Response("Not found", { status: 404 });
  }

  // Return response with file content (binary)
  return new Response(await response.blob(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentType === "application/pdf" ? "inline" : "",
    },
  });
}
