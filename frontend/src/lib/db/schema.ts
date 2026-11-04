import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  smallint,
  boolean,
  jsonb,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom bytea type for compressed cel pixel data
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// 1. USERS
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 24 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  displayName: varchar("display_name", { length: 50 }).notNull(),
  avatarUrl: text("avatar_url"),
  bio: varchar("bio", { length: 160 }).default(""),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. SOURCE IMAGES
export const sourceImages = pgTable("source_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  originalFileUrl: text("original_file_url").notNull(),
  originalWidth: integer("original_width").notNull(),
  originalHeight: integer("original_height").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  lastConversionSettings: jsonb("last_conversion_settings").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3. PROJECTS
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceImageId: uuid("source_image_id").references(() => sourceImages.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 80 }).default("Untitled Project").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    fps: integer("fps").default(8).notNull(),
    paletteColors: jsonb("palette_colors").default([]).notNull(),
    status: varchar("status", { length: 16 }).default("draft").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_user_updated").on(table.userId, table.updatedAt),
  ]
);

// 4. LAYERS
export const layers = pgTable(
  "layers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    orderIndex: smallint("order_index").notNull(),
    opacity: smallint("opacity").default(100).notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
  },
  (table) => [
    index("idx_layers_project").on(table.projectId, table.orderIndex),
  ]
);

// 5. FRAMES
export const frames = pgTable(
  "frames",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    orderIndex: smallint("order_index").notNull(),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("idx_frames_project").on(table.projectId, table.orderIndex),
  ]
);

// 6. CELS
export const cels = pgTable(
  "cels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameId: uuid("frame_id")
      .notNull()
      .references(() => frames.id, { onDelete: "cascade" }),
    layerId: uuid("layer_id")
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    pixelData: bytea("pixel_data").notNull(),
  },
  (table) => [
    index("idx_cels_frame_layer").on(table.frameId, table.layerId),
  ]
);

// 7. POSTS
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 80 }).notNull(),
    description: text("description").default(""),
    category: varchar("category", { length: 32 }).notNull(),
    isAnimated: boolean("is_animated").default(false).notNull(),
    previewAssetUrl: text("preview_asset_url").notNull(),
    snapshotPalette: jsonb("snapshot_palette").default([]).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    frameCount: smallint("frame_count").default(1).notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    commentCount: integer("comment_count").default(0).notNull(),
    bookmarkCount: integer("bookmark_count").default(0).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_posts_recent").on(table.publishedAt),
    index("idx_posts_category").on(table.category, table.publishedAt),
    index("idx_posts_user").on(table.userId, table.publishedAt),
  ]
);

// 8. TAGS
export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 24 }).notNull().unique(),
});

// 9. POST_TAGS
export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("idx_post_tags_tag").on(table.tagId, table.postId),
  ]
);

// 10. COMMENTS
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_comments_post").on(table.postId, table.createdAt),
  ]
);

// 11. LIKES
export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
  ]
);

// 12. BOOKMARKS
export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
  ]
);

// 13. FOLLOWS
export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
  ]
);

// ================= RELATIONSHIPS =================

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  sourceImages: many(sourceImages),
  posts: many(posts),
  comments: many(comments),
  likes: many(likes),
  bookmarks: many(bookmarks),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
}));

export const sourceImagesRelations = relations(sourceImages, ({ one, many }) => ({
  user: one(users, {
    fields: [sourceImages.userId],
    references: [users.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  sourceImage: one(sourceImages, {
    fields: [projects.sourceImageId],
    references: [sourceImages.id],
  }),
  layers: many(layers),
  frames: many(frames),
  post: one(posts),
}));

export const layersRelations = relations(layers, ({ one, many }) => ({
  project: one(projects, {
    fields: [layers.projectId],
    references: [projects.id],
  }),
  cels: many(cels),
}));

export const framesRelations = relations(frames, ({ one, many }) => ({
  project: one(projects, {
    fields: [frames.projectId],
    references: [projects.id],
  }),
  cels: many(cels),
}));

export const celsRelations = relations(cels, ({ one }) => ({
  frame: one(frames, {
    fields: [cels.frameId],
    references: [frames.id],
  }),
  layer: one(layers, {
    fields: [cels.layerId],
    references: [layers.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [posts.projectId],
    references: [projects.id],
  }),
  tags: many(postTags),
  comments: many(comments),
  likes: many(likes),
  bookmarks: many(bookmarks),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  post: one(posts, {
    fields: [likes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  post: one(posts, {
    fields: [bookmarks.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));
