
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

// Simple in-memory cache for AI responses
const responseCache = new Map<string, { response: string, timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const processAIBotMention = async (request: AIBotRequest): Promise<string> => {
  try {
    console.log('Processing AI bot request:', request);

    // Create cache key from request
    const cacheKey = JSON.stringify({
      type: request.type,
      content: request.postContent?.substring(0, 200), // First 200 chars
      question: request.userQuestion?.substring(0, 200)
    });

    // Check cache first
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('Returning cached response');
      return cached.response;
    }

    // Check if we have Groq API key
    const apiKey = import.meta.env.VITE_GROQ_API_KEY || "gsk_your_api_key_here";
    if (!apiKey || apiKey === "gsk_your_api_key_here") {
      return "🤖 Service not available";
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (request.type === 'explain' && request.postContent) {
      systemPrompt = `You are EduHive Assistant, an educational AI. Provide clear, complete explanations that help students understand concepts. Write 4-6 complete sentences that thoroughly explain the topic from start to finish. Do NOT use any markdown formatting like asterisks, bold, italics, or special characters. Use plain text only. Don't mention "image" or describe file types. Start with "🤖" and always end with a complete thought and proper punctuation. Ensure your explanation covers all main points and concludes properly.`;

      userPrompt = `Explain this educational content in detail: "${request.postContent}"`;

      // If there are attachments, just analyze them without mentioning they're images
      if (request.attachments && request.attachments.length > 0) {
        userPrompt += `\n\nProvide a thorough explanation of the concepts shown, including any formulas, principles, or key ideas.`;
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
              text: `${userPrompt}\n\nProvide a thorough educational explanation in 4-6 sentences. Focus on the actual concepts, formulas, and principles. Use plain text with no markdown formatting or special characters.`
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
            max_completion_tokens: 250
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

Always start your response with "🤖 Hi! I'm EduHive Assistant." and end with an encouraging message like "Keep learning! 📚✨". Make sure to provide a complete, well-structured response that fully addresses the question.`;

      userPrompt = `A student is asking: "${request.userQuestion}"

${request.context ? `\nContext: ${request.context}` : ''}

Please provide a helpful, educational response.`;

    } else {
      systemPrompt = `You are EduHive Assistant, a friendly AI tutor for students. Help them with their educational needs and encourage learning.`;
      userPrompt = `A student has mentioned me but didn't specify what they need. Please introduce yourself and ask how you can help with their studies.`;
    }

    // Make the API call to Groq with streaming for better completion
    const stream = await groq.chat.completions.create({
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
      max_completion_tokens: 500, // Increased for more complete responses
      stream: true
    });

    let aiResponse = '';
    let lastChunkTime = Date.now();
    const CHUNK_TIMEOUT = 10000; // 10 seconds timeout for chunks

    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          aiResponse += content;
          lastChunkTime = Date.now();
        }
        
        // Check for timeout
        if (Date.now() - lastChunkTime > CHUNK_TIMEOUT) {
          console.warn('Streaming timeout, finalizing response');
          break;
        }
      }
    } catch (streamError) {
      console.warn('Streaming error, using partial response:', streamError);
    }

    // Check if response seems incomplete (ends mid-sentence)
    const isIncomplete = aiResponse && (
      !aiResponse.trim().endsWith('.') && 
      !aiResponse.trim().endsWith('!') && 
      !aiResponse.trim().endsWith('?') &&
      !aiResponse.trim().endsWith('✨') &&
      aiResponse.length > 50 // Only check if response is substantial
    );

    // If incomplete, try to wrap it up properly
    if (isIncomplete) {
      console.log('Response appears incomplete, attempting to complete...');
      try {
        const completionResponse = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are completing a response that was cut off. Provide a brief, natural conclusion to make the response complete. Keep it short (1-2 sentences max)."
            },
            {
              role: "user",
              content: `This response was cut off: "${aiResponse.slice(-200)}"\n\nPlease provide a brief, natural conclusion to complete it properly.`
            }
          ],
          temperature: 0.5,
          max_completion_tokens: 100
        });

        const completion = completionResponse.choices[0]?.message?.content;
        if (completion && completion.trim()) {
          // Clean up any repetition and add the completion
          const cleanCompletion = completion.replace(/^[.!?]*\s*/, '').trim();
          aiResponse = aiResponse.trim() + (cleanCompletion ? ` ${cleanCompletion}` : '.');
        } else {
          // Fallback: just add proper punctuation
          aiResponse = aiResponse.trim() + '.';
        }
      } catch (completionError) {
        console.warn('Could not complete response, adding punctuation:', completionError);
        aiResponse = aiResponse.trim() + '.';
      }
    }
    
    if (!aiResponse || aiResponse.trim().length < 10) {
      throw new Error('No meaningful response from AI');
    }

    // Cache successful responses
    responseCache.set(cacheKey, {
      response: aiResponse,
      timestamp: Date.now()
    });

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
