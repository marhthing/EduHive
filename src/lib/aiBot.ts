
import Groq from "groq-sdk";

export interface AIBotRequest {
  type: 'explain' | 'question';
  postContent?: string;
  userQuestion?: string;
  context?: string;
  attachments?: Array<{
    url: string;
    type: string;
    name?: string;
  }>;
}

// Initialize Groq client
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY || "gsk_your_api_key_here", // You'll need to add this to your environment
  dangerouslyAllowBrowser: true // Only for development - move to server-side for production
});

export const processAIBotMention = async (request: AIBotRequest): Promise<string> => {
  try {
    console.log('Processing AI bot request:', request);

    // Check if we have Groq API key
    const apiKey = import.meta.env.VITE_GROQ_API_KEY || "gsk_your_api_key_here";
    if (!apiKey || apiKey === "gsk_your_api_key_here") {
      return "🤖 Service not available";
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (request.type === 'explain' && request.postContent) {
      systemPrompt = `You are EduHive Assistant. Be extremely concise - maximum 3-4 sentences total. Get straight to the key point without verbose explanations. Don't mention "image" or describe file types. Start with "🤖" and summarize the core concept only.`;

      userPrompt = `Explain briefly: "${request.postContent}"`;

      // If there are attachments, just analyze them without mentioning they're images
      if (request.attachments && request.attachments.length > 0) {
        userPrompt += `\n\nSummarize the main concept shown in 2-3 sentences max.`;
      }

      // Handle image analysis if there are image attachments
      if (request.attachments && request.attachments.some(att => att.type?.startsWith('image/'))) {
        const imageAttachments = request.attachments.filter(att => att.type?.startsWith('image/'));
        
        try {
          console.log(`Using Groq Vision to analyze ${imageAttachments.length} image(s)`);
          
          // Build content array with text and all images
          const messageContent = [
            {
              type: "text",
              text: `${userPrompt}\n\nBe extremely brief - 2-3 sentences max. Focus only on the main concept.`
            }
          ];

          // Add all images to the message
          imageAttachments.forEach((attachment, index) => {
            messageContent.push({
              type: "image_url",
              image_url: {
                url: attachment.url
              }
            });
          });
          
          const visionResponse = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
              {
                role: "user", 
                content: messageContent
              }
            ],
            temperature: 0.7,
            max_completion_tokens: 150
          });

          return visionResponse.choices[0]?.message?.content || "I had trouble analyzing the content. Please try again!";
        } catch (visionError) {
          console.error('Vision analysis error, falling back to text-only:', visionError);
          // Fall back to text-only analysis
        }
      }

    } else if (request.type === 'question' && request.userQuestion) {
      systemPrompt = `You are EduHive Assistant, a helpful AI tutor. Your role is to:
1. Answer student questions clearly and comprehensively
2. Provide educational explanations and examples
3. Break down complex topics into understandable parts
4. Encourage further learning and curiosity
5. Be supportive and enthusiastic

Always start your response with "🤖 Hi! I'm EduHive Assistant." and end with an encouraging message.`;

      userPrompt = `A student is asking: "${request.userQuestion}"

${request.context ? `\nContext: ${request.context}` : ''}

Please provide a helpful, educational response.`;

    } else {
      systemPrompt = `You are EduHive Assistant, a friendly AI tutor for students. Help them with their educational needs and encourage learning.`;
      userPrompt = `A student has mentioned me but didn't specify what they need. Please introduce yourself and ask how you can help with their studies.`;
    }

    // Make the API call to Groq
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 200
    });

    const aiResponse = response.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    return aiResponse;

  } catch (error) {
    console.error('Error processing AI bot request:', error);
    
    // More specific error handling
    if (error.message?.includes('404') || error.message?.includes('model')) {
      return `🤖 Hi! I'm EduHive Assistant. I'm currently experiencing technical difficulties with my AI models. Please try again in a few moments.

Keep learning! 📚✨`;
    }
    
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return `🤖 Hi! I'm EduHive Assistant. I'm receiving too many requests right now. Please wait a moment and try again.

Keep learning! 📚✨`;
    }
    
    return `🤖 Hi! I'm EduHive Assistant. I encountered an error while processing your request. Please try again, and if the issue persists, contact the administrators.

Error details: ${error.message || 'Unknown error'}

Keep learning! 📚✨`;
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
