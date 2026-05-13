export type SafeUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: Date | string;
};

export type PostWithUser = {
  id: string;
  content: string | null;
  mediaUrls: string[];
  mediaTypes: string[];
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  viewsCount: number;
  quotesCount: number;
  isPinned: boolean;
  isDeleted: boolean;
  scheduledAt: Date | string | null;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  user: SafeUser;
  replyTo?: PostWithUser | null;
  repostOf?: PostWithUser | null;
  quoteOf?: PostWithUser | null;
  poll?: PollWithOptions | null;
  // viewer state
  isLiked?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
};

export type PollWithOptions = {
  id: string;
  expiresAt: Date | string;
  options: PollOption[];
  userVoteId?: string | null;
  totalVotes: number;
};

export type PollOption = {
  id: string;
  text: string;
  votesCount: number;
};

export type NotificationWithActor = {
  id: string;
  type: "LIKE" | "REPLY" | "REPOST" | "FOLLOW" | "MENTION" | "QUOTE";
  isRead: boolean;
  createdAt: Date | string;
  actor: SafeUser;
  post?: PostWithUser | null;
};

export type ConversationWithMembers = {
  id: string;
  isGroup: boolean;
  name: string | null;
  avatarUrl: string | null;
  isRequest: boolean;
  requesterId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  members: SafeUser[];
  lastMessage?: MessageWithSender | null;
  unreadCount: number;
};

export type MessageReaction = {
  id: string;
  emoji: string;
  user: { id: string; username: string };
};

export type MessageWithSender = {
  id: string;
  conversationId: string;
  content: string | null;
  mediaUrls: string[];
  replyToId: string | null;
  replyTo?: {
    id: string;
    content: string | null;
    mediaUrls: string[];
    sender: { id: string; username: string; displayName: string; avatarUrl: string | null };
  } | null;
  reactions: MessageReaction[];
  isDeleted: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  sender: SafeUser;
};

export type TrendingHashtag = {
  tag: string;
  postsCount: number;
};

export type ApiResponse<T> =
  | { data: T; error?: never }
  | { error: string; data?: never };

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
