import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    url: text("url"),
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("articles_search_index").using(
      "gin",
      sql`(
        setweight(to_tsvector('english', ${table.title}), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.excerpt}, '')), 'B') ||
        setweight(to_tsvector('english', ${table.content}), 'C')
      )`
    ),
  ]
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
