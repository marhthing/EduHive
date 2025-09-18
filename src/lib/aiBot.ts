import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface AIBotRequest {
  type: 'explain' | 'question';
  postContent?: string;
  userQuestion?: string;
  context?: string;
}

export const processAIBotMention = async (request: AIBotRequest): Promise<string> => {
  try {
    let prompt = "";
    
    if (request.type === 'explain' && request.postContent) {
      prompt = `You are EduHive Assistant, a helpful educational AI bot. A student has asked you to explain this post content. Please provide a clear, educational explanation in a friendly tone suitable for students:

Post content: "${request.postContent}"

Please explain this in simple terms, focusing on the educational aspects. Keep your response concise but informative (2-3 paragraphs maximum).`;
    } else if (request.type === 'question' && request.userQuestion) {
      prompt = `You are EduHive Assistant, a helpful educational AI bot. A student has asked you a question in a comment thread. Please provide a helpful, educational response:

Question: "${request.userQuestion}"
${request.context ? `Context: "${request.context}"` : ''}

Please provide a clear, informative answer suitable for students. Keep your response concise but helpful (2-3 paragraphs maximum).`;
    } else {
      return "Hi! I'm EduHive Assistant 🤖. You can ask me to explain post content by mentioning '@eduhive explain the content' or ask me questions like '@eduhive what is...'. How can I help you today?";
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are EduHive Assistant, a helpful educational AI bot for a student community platform. Keep responses educational, friendly, and concise. Use emojis sparingly and appropriately."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || "I apologize, but I couldn't process your request. Please try again!";
  } catch (error) {
    console.error('Error processing AI bot request:', error);
    return "I'm having trouble processing your request right now. Please try again later! 🤖";
  }
};

export const parseAIBotMention = (text: string): AIBotRequest | null => {
  const mentionMatch = text.match(/@eduhive\s+(.+)/i);
  if (!mentionMatch) return null;
  
  const command = mentionMatch[1].toLowerCase().trim();
  
  // Check for explain command
  if (command.includes('explain') || command.includes('content') || command === '') {
    return { type: 'explain' };
  }
  
  // Everything else is treated as a question
  return { type: 'question', userQuestion: mentionMatch[1] };
};