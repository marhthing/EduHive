
// Fixed UUID for AI bot to avoid database errors
export const AI_BOT_USER_ID = '00000000-0000-4000-8000-000000000001';

export const AI_BOT_PROFILE = {
  id: AI_BOT_USER_ID,
  user_id: AI_BOT_USER_ID,
  username: 'eduhive',
  name: 'EduHive Assistant',
  bio: '🤖 Your friendly AI assistant for educational content. Ask me to explain posts or answer questions!',
  profile_pic: '/logo.svg',
  school: 'EduHive Platform',
  department: 'AI Assistant',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  email: 'ai@eduhive.com'
};
