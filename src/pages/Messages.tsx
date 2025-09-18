
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import Groq from "groq-sdk";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm EduHive AI - your intelligent study assistant for the EduHive student community. I can help you with assignments, solve math problems, explain concepts, and answer academic questions. What would you like to work on today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useTwitterToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
      
      if (!groqApiKey) {
        throw new Error("AI_SERVICE_UNAVAILABLE");
      }

      const groq = new Groq({
        apiKey: groqApiKey,
        dangerouslyAllowBrowser: true
      });

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are EduHive AI, the intelligent study assistant for the EduHive student community platform. You specialize in helping students with assignments, homework, and academic questions. You're particularly good at solving math problems, explaining concepts clearly, providing step-by-step solutions, and helping with various subjects. Be helpful, educational, and remember you're part of the EduHive educational ecosystem. If you're solving math problems, show your work step by step."
          },
          ...messages.slice(-10).map(msg => ({
            role: msg.isUser ? "user" as const : "assistant" as const,
            content: msg.content
          })),
          {
            role: "user",
            content: userMessage.content
          }
        ],
        model: "mixtral-8x7b-32768",
        temperature: 0.7,
        max_tokens: 1024
      });

      const aiResponse = completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error calling Groq API:", error);
      let errorMessage = "I'm currently experiencing technical difficulties. Please try again in a few moments.";
      
      if (error instanceof Error) {
        if (error.message === "AI_SERVICE_UNAVAILABLE") {
          errorMessage = "The AI assistant is currently unavailable. Please check back later or contact support if this issue persists.";
        } else if (error.message.includes("rate limit") || error.message.includes("429")) {
          errorMessage = "I'm receiving too many requests right now. Please wait a moment and try again.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "I'm having trouble connecting to the server. Please check your internet connection and try again.";
        }
      }

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: errorMessage,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorResponse]);
      showToast("Message failed to send", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur-sm p-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
          EduHive AI Assistant
        </h1>
        <p className="text-muted-foreground mt-1">
          Get help with assignments, solve math problems, and ask academic questions
        </p>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!message.isUser && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.isUser
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <span className={`text-xs mt-1 block ${
                    message.isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>

                {message.isUser && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-secondary">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">EduHive AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex-shrink-0 p-6 pt-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about your studies..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
