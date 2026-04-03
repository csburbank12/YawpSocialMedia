export interface Profile {
  id: string
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
  isPlus: boolean
  isDemo?: boolean
  createdAt: number
}

export interface Post {
  id: string
  userId: string
  content: string
  tags: string[]
  heartCount: number
  echoCount: number
  replyCount: number
  createdAt: number
  profile?: Profile
  hearted?: boolean
  echoed?: boolean
  bookmarked?: boolean
}

export interface Reply {
  id: string
  postId: string
  userId: string
  content: string
  heartCount: number
  createdAt: number
  profile?: Profile
  hearted?: boolean
}

export interface Circle {
  id: string
  name: string
  description: string
  color: string
  createdBy: string
  memberCount: number
  createdAt: number
}

export interface CircleMessage {
  id: string
  circleId: string
  userId: string
  content: string
  createdAt: number
  profile?: Profile
}

export interface Conversation {
  id: string
  participants: string[]
  lastMessage: string
  lastMessageAt: number
  otherUser?: Profile
  unreadCount?: number
}

export interface DirectMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  readAt: number | null
  createdAt: number
  sender?: Profile
}
