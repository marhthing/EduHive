
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
      return `🤖 Hi! I'm EduHive Assistant. I'd love to help analyze this content, but I need an API key to be configured. Please contact the administrators to enable full AI features.

In the meantime, I can see you're asking about: "${request.postContent?.substring(0, 100) || request.userQuestion?.substring(0, 100) || 'this content'}${(request.postContent?.length || 0) > 100 || (request.userQuestion?.length || 0) > 100 ? '...' : ''}"

Once the API key is configured, I'll be able to provide detailed explanations and answer your questions! 📚`;
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (request.type === 'explain' && request.postContent) {
      systemPrompt = `You are EduHive Assistant, a helpful AI tutor for educational content. Your role is to:
1. Analyze educational posts and explain them in a clear, student-friendly way
2. Break down complex concepts into understandable parts
3. Provide additional context and examples when helpful
4. Encourage learning and ask follow-up questions
5. Be enthusiastic and supportive

Always start your response with "🤖 Hi! I'm EduHive Assistant." and end with an encouraging message about learning.`;

      userPrompt = `Please explain this educational post content in detail:

"${request.postContent}"`;

      // If there are attachments, mention them
      if (request.attachments && request.attachments.length > 0) {
        userPrompt += `\n\nThis post also includes ${request.attachments.length} attachment(s):`;
        request.attachments.forEach((attachment, index) => {
          if (attachment.type?.startsWith('image/')) {
            userPrompt += `\n- Image ${index + 1}: ${attachment.name || 'Image file'}`;
          } else {
            userPrompt += `\n- Document ${index + 1}: ${attachment.name || 'File'} (${attachment.type})`;
          }
        });
        userPrompt += `\n\nPlease analyze both the text content and reference the attachments in your explanation.`;
      }

      // Handle image analysis if there are image attachments
      if (request.attachments && request.attachments.some(att => att.type?.startsWith('image/'))) {
        const imageAttachments = request.attachments.filter(att => att.type?.startsWith('image/'));
        
        try {
          // Use Groq's vision model to analyze the first image
          const imageUrl = imageAttachments[0].url;
          
          const visionResponse = await groq.chat.completions.create({
            model: "llama-3.2-90b-vision-preview",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user", 
                content: [
                  {
                    type: "text",
                    text: userPrompt + "\n\nPlease also analyze this image and incorporate it into your explanation:"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageUrl
                    }
                  }
                ]
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
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
      model: "llama-3.1-8b-instant", // Fast model for text-only responses
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
      max_tokens: 800
    });

    const aiResponse = response.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    return aiResponse;

  } catch (error) {
    console.error('Error processing AI bot request:', error);
    return `🤖 Hi! I'm EduHive Assistant. I encountered an error while processing your request. Please try again, and if the issue persists, contact the administrators.

I was trying to help with: "${request.postContent?.substring(0, 100) || request.userQuestion?.substring(0, 100) || 'your request'}${(request.postContent?.length || 0) > 100 || (request.userQuestion?.length || 0) > 100 ? '...' : ''}"

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
