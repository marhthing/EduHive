import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import Groq from "groq-sdk";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatModalProps {
  children: React.ReactNode;
}

export function ChatModal({ children }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Hello! I'm EduHive AI - your quick study assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Changed from 'open' to 'isOpen' to avoid conflict with Dialog's open prop
  const { showToast } = useTwitterToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Set loading state immediately to disable send button
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    try {
      const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

      if (!groqApiKey) {
        throw new Error("AI_SERVICE_UNAVAILABLE");
      }

      const groq = new Groq({
        apiKey: groqApiKey,
        dangerouslyAllowBrowser: true
      });

      // Simulate typing indicator
      let aiResponse = "";
      const typingMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: typingMessageId, content: "...", isUser: false, timestamp: new Date() }]);

      // Include full conversation context for the modal chat too
      const conversationMessages = [
        {
          role: "system" as const,
          content: "You are EduHive AI, the intelligent study assistant for the EduHive student community platform. You help students with assignments, homework, academic questions, and study-related queries. Give concise, helpful answers. Keep responses brief since this is a quick chat. Remember you're part of the EduHive educational ecosystem and remember our conversation context."
        },
        // Include all previous messages for context
        ...messages.slice(-8).map(msg => ({
          role: msg.isUser ? "user" as const : "assistant" as const,
          content: msg.content
        })),
        {
          role: "user" as const,
          content: userMessage.content
        }
      ];

      const completion = await groq.chat.completions.create({
        messages: conversationMessages,
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 400,
        stream: true // Enable streaming
      });

      // Handle streaming response
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content !== undefined) {
          aiResponse += content;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === typingMessageId ? { ...msg, content: aiResponse } : msg
            )
          );
        }
      }

      // Remove the typing indicator once streaming is done
      setMessages(prev => prev.filter(msg => msg.id !== typingMessageId));

      // Add the final AI message
      const aiMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: aiResponse,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("Error calling Groq API:", error);
      let errorMessage = "Sorry, EduHive AI is having trouble right now. Try the full Messages page for better support!";

      if (error instanceof Error && error.message === "AI_SERVICE_UNAVAILABLE") {
        errorMessage = "The AI assistant is currently unavailable. Please contact support if this issue persists.";
      }

      // Replace the typing indicator with an error message
      setMessages(prev => prev.map(msg =>
        msg.content === "..." ? { ...msg, content: errorMessage } : msg
      ));
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md h-[500px] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <img src="/logo.svg" alt="EduHive Logo" className="h-6 w-6" />
            EduHive AI Assistant
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Quick chat for study help</p>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-6 py-2">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!message.isUser && (
                    <Avatar className="h-6 w-6 mt-1">
                      <AvatarImage src="/logo.svg" alt="EduHive Logo" />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[85%] rounded-lg p-2 text-sm ${
                      message.isUser
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>

                  {message.isUser && (
                    <Avatar className="h-6 w-6 mt-1">
                      <AvatarImage src={user?.avatarUrl || ""} alt="User Avatar" />
                      <AvatarFallback className="bg-secondary">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <Avatar className="h-6 w-6 mt-1">
                    <AvatarImage src="/logo.svg" alt="EduHive Logo" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg p-2 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">EduHive AI is typing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 p-6 pt-3 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a quick question..."
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
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              For longer conversations, visit Messages page
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}