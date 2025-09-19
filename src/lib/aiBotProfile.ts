// Fixed UUID for AI bot to avoid database errors
export const AI_BOT_USER_ID = '00000000-0000-4000-8000-000000000001';

export const AI_BOT_PROFILE = {
  id: "ai-bot-profile-id", // Unique profile id
  user_id: AI_BOT_USER_ID, // This is the key for follows
  username: "eduhive",
  name: "EduHive Assistant", 
  email: "ai@eduhive.com",
  bio: "🤖 Your AI study companion! I help explain educational content and answer questions. Mention me with @eduhive to get started!",
  school: "EduHive Platform",
  department: "AI Assistant", 
  year: null,
  profile_pic: "/logo.svg",
  created_at: "2024-01-01T00:00:00.000Z",
  followers_count: 0,
  following_count: 0
};