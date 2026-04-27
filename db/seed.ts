import "dotenv/config";
import fs from "fs";
import path from "path";
import { getDb } from "./index";
import { articles } from "./schema";

const ARTICLES_DIR = path.resolve(process.cwd(), "../articles");

function parseArticle(content: string, filename: string): {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  url: string | null;
} {
  const lines = content.split("\n");

  // Extract title from first H1
  let title = filename
    .replace(/^blog-/, "")
    .replace(/\.md$/, "")
    .replace(/-/g, " ");
  const h1Match = lines.find((l) => l.startsWith("# "));
  if (h1Match) {
    title = h1Match.replace("# ", "").trim();
  }

  // Extract URL from metadata
  let url: string | null = null;
  const urlMatch = content.match(/\*\*URL:\*\*\s*(.+)/);
  if (urlMatch) {
    url = urlMatch[1].trim();
  }

  // Generate excerpt from the first paragraph after metadata
  let excerpt = "";
  const contentStart = lines.findIndex((l) => l.trim().startsWith(">"));
  for (let i = contentStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith("---") && !line.startsWith("##")) {
      excerpt = line.replace(/\*\*/g, "").substring(0, 300);
      break;
    }
  }

  const slug = filename.replace(/\.md$/, "");

  return {
    slug,
    title,
    content,
    excerpt,
    url,
  };
}

async function seed() {
  const db = getDb();
  console.log("Seeding articles...");

  // Clear existing data
  await db.delete(articles);

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} articles`);

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseArticle(content, file);
    await db.insert(articles).values(parsed);
  }

  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
