export interface AIBotRequest {
  type: 'explain' | 'question';
  postContent?: string;
  userQuestion?: string;
  context?: string;
}

export const processAIBotMention = async (request: AIBotRequest): Promise<string> => {
  try {
    // For now, return a placeholder response since client-side AI processing is insecure
    // TODO: Move to server-side endpoint for production
    
    if (request.type === 'explain' && request.postContent) {
      return `🤖 Hi! I'm EduHive Assistant. I'd be happy to explain this post content for you. The post discusses: "${request.postContent.substring(0, 100)}${request.postContent.length > 100 ? '...' : ''}"

This appears to be educational content that could help students understand the topic better. For a detailed AI-powered explanation, please contact the administrators to enable the full AI features.

How else can I help you with your studies? 📚`;
    } else if (request.type === 'question' && request.userQuestion) {
      return `🤖 Thanks for your question: "${request.userQuestion}"

I'm EduHive Assistant, and I'd love to help answer that! However, for security reasons, my full AI capabilities are currently being moved to a secure server environment. 

For now, I can help you connect with other students or point you to educational resources. The full AI-powered responses will be available soon! 

Keep learning! 📚✨`;
    } else {
      return "Hi! I'm EduHive Assistant 🤖. You can ask me to explain post content by mentioning '@eduhive explain the content' or ask me questions like '@eduhive what is...'. My full AI capabilities are coming soon! How can I help you today? 📚";
    }
  } catch (error) {
    console.error('Error processing AI bot request:', error);
    return "I'm having trouble processing your request right now. Please try again later! 🤖";
  }
};

export const parseAIBotMention = (text: string): AIBotRequest | null => {
  console.log('Parsing text for AI mention:', text);
  
  const mentionMatch = text.match(/@eduhive\s*(.*)$/i);
  if (!mentionMatch) {
    console.log('No @eduhive mention found');
    return null;
  }
  
  console.log('Found @eduhive mention:', mentionMatch);
  const command = mentionMatch[1].toLowerCase().trim();
  
  // Check for explain command or questions about post content
  if (command.includes('explain') || command.includes('content') || command === '' || 
      command.includes('post about') || command.includes('what is') || command.includes('about')) {
    return { type: 'explain' };
  }
  
  // Everything else is treated as a question
  return { type: 'question', userQuestion: mentionMatch[1] };
};