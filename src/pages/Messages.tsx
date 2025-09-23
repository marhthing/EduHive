import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Paperclip, Mic, MicOff, Plus, History, Trash2, Image, FileText, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Groq from "groq-sdk";
import { AI_BOT_PROFILE } from "@/lib/aiBotProfile";

interface CurrentUserProfile {
  username: string;
  name: string | null;
  profile_pic: string | null;
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // Added state for audio processing
  const [showTranscriptionPreview, setShowTranscriptionPreview] = useState(false); // Show transcription preview

  const { user } = useAuth();
  const { showToast } = useTwitterToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Track previous user ID to handle user switches
  const prevUserIdRef = useRef<string | null>(null);
  // Track current user ID for async operation guards
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;

    if (user && currentUserId !== prevUserId) {
      // User changed or logged in - clear state and load new data
      if (prevUserId !== null) {
        // Clear all state when switching users
        clearAllChatState();
      }
      loadChatSessions();
      fetchCurrentUserProfile();
    } else if (!user && prevUserId !== null) {
      // User logged out - clear all state
      clearAllChatState();
    }

    prevUserIdRef.current = currentUserId;
    activeUserIdRef.current = currentUserId;
  }, [user]);

  const clearAllChatState = () => {
    // Clear all chat state
    setMessages([]);
    setChatSessions([]);
    setCurrentSessionId(null);
    setCurrentUserProfile(null);
    setIsLoadingHistory(false);
    setIsTyping(false);
    setIsSheetOpen(false);
    setIsProcessingAudio(false);
    setShowTranscriptionPreview(false);
    setIsLoading(false);
    
    // Clear compose/input state
    setInputMessage('');
    setSelectedFile(null);
    setIsRecording(false);
    
    // Stop any active media recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const fetchCurrentUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, name, profile_pic')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setCurrentUserProfile(data);
    } catch (error) {
      console.error('Error fetching current user profile:', error);
    }
  };

  // Separate effect to handle initial chat creation - only run once when component mounts
  useEffect(() => {
    if (user && chatSessions.length > 0 && !currentSessionId) {
      // Try to load the last opened chat from localStorage
      const lastOpenedChatId = localStorage.getItem(`lastOpenedChat_${user.id}`);
      const lastOpenedSession = lastOpenedChatId ? 
        chatSessions.find(session => session.id === lastOpenedChatId) : null;

      if (lastOpenedSession) {
        // Load the previously opened chat session
        loadChatMessages(lastOpenedSession.id);
      } else {
        // Fall back to the most recent chat session
        const mostRecentSession = chatSessions[0];
        if (mostRecentSession) {
          loadChatMessages(mostRecentSession.id);
        }
      }
    } else if (user && chatSessions.length === 0 && !currentSessionId) {
      // Only start new chat if user has no chat sessions at all
      startNewChat();
    }
  }, [user, chatSessions.length]);

  const loadChatSessions = async () => {
    if (!user) return;
    
    const requestUserId = user.id;
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Only update state if user hasn't changed
      if (activeUserIdRef.current === requestUserId) {
        setChatSessions(data || []);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const loadChatMessages = async (sessionId: string) => {
    if (!user) return;

    const requestUserId = user.id;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Only update state if user hasn't changed
      if (activeUserIdRef.current === requestUserId) {
        const loadedMessages: Message[] = (data || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          isUser: msg.is_user,
          timestamp: new Date(msg.created_at),
          attachmentUrl: msg.attachment_url || undefined,
          attachmentType: msg.attachment_type || undefined,
          attachmentName: msg.attachment_name || undefined,
        }));

        setMessages(loadedMessages);
        setCurrentSessionId(sessionId);
        setIsSheetOpen(false); // Auto-close the sheet when a chat is loaded

        // Store the last opened chat in localStorage
        if (user) {
          localStorage.setItem(`lastOpenedChat_${user.id}`, sessionId);
        }
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
      if (activeUserIdRef.current === requestUserId) {
        showToast("Failed to load chat history", "error");
      }
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setIsLoadingHistory(false);
      }
    }
  };

  const startNewChat = async () => {
    if (!user) return;

    // Start with a temporary session - don't create in database yet
    setCurrentSessionId(null);
    setMessages([
      {
        id: "welcome",
        content: "Hello! I'm EduHive AI - your intelligent study assistant. I can help you with assignments, solve math problems, explain concepts, and analyze documents, images, or audio files. What would you like to work on today?",
        isUser: false,
        timestamp: new Date()
      }
    ]);

    // Ensure scroll to bottom after message is set
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const createChatSession = async (firstUserMessage: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Create title from first 50 characters of user's message
      const title = firstUserMessage.length > 50 
        ? firstUserMessage.substring(0, 47) + "..."
        : firstUserMessage;

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: title
        })
        .select()
        .single();

      if (error) throw error;

      // Save welcome message to the new session
      await supabase
        .from('chat_messages')
        .insert({
          session_id: data.id,
          content: "Hello! I'm EduHive AI - your intelligent study assistant. I can help you with assignments, solve math problems, explain concepts, and analyze documents, images, or audio files. What would you like to work on today?",
          is_user: false,
        });

      await loadChatSessions();

      // Store the new chat as the last opened chat
      if (user) {
        localStorage.setItem(`lastOpenedChat_${user.id}`, data.id);
      }

      return data.id;
    } catch (error) {
      console.error('Error creating new chat:', error);
      showToast("Failed to create new chat", "error");
      return null;
    }
  };

  const deleteChat = async (sessionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadChatSessions();

      // Clear from localStorage if this was the last opened chat
      if (user) {
        const lastOpenedChatId = localStorage.getItem(`lastOpenedChat_${user.id}`);
        if (lastOpenedChatId === sessionId) {
          localStorage.removeItem(`lastOpenedChat_${user.id}`);
        }
      }

      if (currentSessionId === sessionId) {
        await startNewChat();
      }

      showToast("Chat deleted successfully", "success");
    } catch (error) {
      console.error('Error deleting chat:', error);
      showToast("Failed to delete chat", "error");
    }
  };

  const saveMessage = async (message: Message, sessionId: string) => {
    if (!user || !sessionId) return;

    try {
      await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          content: message.content,
          is_user: message.isUser,
          attachment_url: message.attachmentUrl,
          attachment_type: message.attachmentType,
          attachment_name: message.attachmentName,
        });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const updateChatTitle = async (sessionId: string, newTitle: string) => {
    if (!user) return;

    try {
      await supabase
        .from('chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        showToast("File size must be less than 50MB", "error");
        return;
      }

      // Check file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/markdown',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm'
      ];

      if (!allowedTypes.includes(file.type)) {
        showToast("Unsupported file type. Please upload images, PDFs, documents, or audio files.", "error");
        return;
      }

      setSelectedFile(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
        setSelectedFile(audioFile);
        setIsRecording(false); // Set isRecording to false immediately after stopping

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      showToast("Failed to start recording. Please check microphone permissions.", "error");
      setIsRecording(false); // Ensure recording state is reset on error
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // isRecording is set to false in mediaRecorder.onstop
    }
  };

  const uploadFileToSupabase = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('audio/') ? 'audio' : 'document';

      return { url: publicUrl, type, name: file.name };
    } catch (error) {
      console.error('Error uploading file:', error);
      showToast("Failed to upload file", "error");
      return null;
    }
  };

  const processWithGroq = async (userMessage: Message, onStream: (chunk: string) => void): Promise<string> => {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!groqApiKey) {
      throw new Error("AI_SERVICE_UNAVAILABLE");
    }

    const groq = new Groq({
      apiKey: groqApiKey,
      dangerouslyAllowBrowser: true
    });

    // Handle different attachment types
    if (userMessage.attachmentUrl && userMessage.attachmentType) {
      if (userMessage.attachmentType === 'image') {
        // Vision analysis
        try {
          const response = await fetch(userMessage.attachmentUrl);
          const arrayBuffer = await response.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          const completion = await groq.chat.completions.create({
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: userMessage.content || "Please analyze this image and help me understand what it contains. If there are any problems, questions, or assignments visible, please solve or explain them step by step."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64}`
                    }
                  }
                ]
              }
            ],
            model: "llama-3.2-90b-vision-preview",
            temperature: 0.7,
            max_tokens: 1500,
            stream: true
          });

          let fullResponse = '';
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              onStream(content);
              await new Promise(resolve => setTimeout(resolve, 50)); // Simulate typing speed
            }
          }

          return fullResponse || "I couldn't analyze the image. Please try again.";
        } catch (error) {
          console.error('Vision analysis error:', error);
          throw new Error('Failed to analyze image');
        }
      } else if (userMessage.attachmentType === 'audio') {
        // Speech to text
        try {
          const response = await fetch(userMessage.attachmentUrl);
          const audioBlob = await response.blob();

          const transcription = await groq.audio.transcriptions.create({
            file: new File([audioBlob], "audio.webm", { type: "audio/webm" }),
            model: "whisper-large-v3-turbo",
            response_format: "text",
            temperature: 0.0
          });

          // Now process the transcribed text with AI
          const textToAnalyze = userMessage.content ? 
            `${userMessage.content}\n\nTranscribed audio: "${transcription}"` : 
            `Please help me with this audio content: "${transcription}"`;

          const completion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "You are EduHive AI, specializing in helping students with assignments and academic questions. The user has provided audio content that has been transcribed. Help them with their academic needs."
              },
              {
                role: "user",
                content: textToAnalyze
              }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1500,
            stream: true
          });

          let fullResponse = '';
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              onStream(content);
              await new Promise(resolve => setTimeout(resolve, 50)); // Simulate typing speed
            }
          }

          return fullResponse || "I couldn't process the audio. Please try again.";
        } catch (error) {
          console.error('Audio processing error:', error);
          throw new Error('Failed to process audio');
        }
      } else {
        // Document analysis - attempt to read text content
        try {
          const response = await fetch(userMessage.attachmentUrl);
          let documentText = '';

          if (userMessage.attachmentName?.toLowerCase().endsWith('.pdf')) {
            // For PDFs, we can't extract text in browser, so provide helpful message
            documentText = "I can see you've uploaded a PDF document. While I cannot directly extract text from PDFs in this environment, I can help you in these ways:\n\n1. Copy and paste specific text from the PDF that you need help with\n2. Take screenshots of pages and upload them as images for visual analysis\n3. Tell me what type of document it is and ask specific questions\n\nWhat would you like help with from this document?";
          } else if (userMessage.attachmentName?.toLowerCase().endsWith('.txt') || 
                     userMessage.attachmentName?.toLowerCase().endsWith('.md')) {
            // For text files, we can read the content
            documentText = await response.text();
            const prompt = userMessage.content ? 
              `${userMessage.content}\n\nDocument content: "${documentText}"` : 
              `Please help me analyze this document content: "${documentText}"`;

            const completion = await groq.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content: "You are EduHive AI, specializing in helping students with assignments and academic questions. The user has provided a document. Help them with their academic needs based on the document content."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              model: "llama-3.3-70b-versatile",
              temperature: 0.7,
              max_tokens: 1500,
              stream: true
            });

            let fullResponse = '';
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                onStream(content);
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }

            return fullResponse || "I couldn't process the document content. Please try again.";
          } else {
            documentText = "I can see you've uploaded a document, but I can only directly read plain text (.txt) and markdown (.md) files. For other document types like Word documents or PDFs, please:\n\n1. Copy and paste the relevant text content\n2. Convert to a text file\n3. Take screenshots for visual analysis\n\nHow can I help you with this document?";
          }

          // Simulate streaming for non-AI responses
          for (let i = 0; i < documentText.length; i += 3) {
            const chunk = documentText.slice(i, i + 3);
            onStream(chunk);
            await new Promise(resolve => setTimeout(resolve, 30));
          }

          return documentText;
        } catch (error) {
          console.error('Document processing error:', error);
          throw new Error('Failed to process document');
        }
      }
    }

    // Prepare messages with full conversation context including attachment information
    const conversationMessages = [
      {
        role: "system" as const,
        content: "You are EduHive AI, the intelligent study assistant for the EduHive student community platform. You specialize in helping students with assignments, homework, and academic questions. You're particularly good at solving math problems, explaining concepts clearly, providing step-by-step solutions, and helping with various subjects. Be helpful, educational, and remember you're part of the EduHive educational ecosystem. If you're solving math problems, show your work step by step. Remember the entire conversation context to provide consistent help, including any previously uploaded images, documents, or audio files and their content."
      },
      // Include ALL messages for full context with attachment information
      ...messages.map(msg => {
        let content = msg.content;
        // Add attachment context to message content for AI memory
        if (msg.attachmentUrl && msg.attachmentType) {
          if (msg.attachmentType === 'image') {
            content += ` [Previously uploaded image: ${msg.attachmentName || 'image file'}]`;
          } else if (msg.attachmentType === 'document') {
            content += ` [Previously uploaded document: ${msg.attachmentName || 'document file'}]`;
          }
        }
        return {
          role: msg.isUser ? "user" as const : "assistant" as const,
          content: content
        };
      }),
      {
        role: "user" as const,
        content: userMessage.content
      }
    ];

    // Calculate rough token count (approximation: 1 token ≈ 4 characters)
    const totalTokens = conversationMessages.reduce((acc, msg) => acc + msg.content.length, 0) / 4;

    // If approaching token limit, optimize conversation
    let messagesToSend = conversationMessages;
    if (totalTokens > 6000) {
      // Show optimization message
      onStream("*Optimizing EduHive AI...* ");
      await new Promise(resolve => setTimeout(resolve, 1000));
      onStream("✅ *Optimized!*\n\n");

      // Keep system message, last 6 messages, and current user message
      const systemMsg = conversationMessages[0];
      const recentMessages = messages.slice(-6).map(msg => {
        let content = msg.content;
        if (msg.attachmentUrl && msg.attachmentType) {
          if (msg.attachmentType === 'image') {
            content += ` [Previously uploaded image: ${msg.attachmentName || 'image file'}]`;
          } else if (msg.attachmentType === 'document') {
            content += ` [Previously uploaded document: ${msg.attachmentName || 'document file'}]`;
          }
        }
        return {
          role: msg.isUser ? "user" as const : "assistant" as const,
          content: content
        };
      });
      const currentMsg = conversationMessages[conversationMessages.length - 1];

      messagesToSend = [
        systemMsg,
        {
          role: "assistant" as const,
          content: "I remember our previous conversation context and will continue to help you based on what we've discussed."
        },
        ...recentMessages,
        currentMsg
      ];
    }

    // Regular text processing with streaming
    const completion = await groq.chat.completions.create({
      messages: messagesToSend,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1500,
      stream: true
    });

    let fullResponse = '';
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onStream(content);
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate typing speed
      }
    }

    return fullResponse || "I apologize, but I couldn't generate a response. Please try again.";
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && !selectedFile && !isRecording) || isLoading) return;

    // Set loading state immediately to disable send button
    setIsLoading(true);
    setIsProcessingAudio(isRecording); // Indicate that audio is being processed if recording

    // Declare variables outside try block so they're accessible in catch block
    let aiMessageId: string | null = null;
    let aiMessage: Message | null = null;
    let transcribedText = '';

    try {
      let attachmentData: { url: string; type: string; name: string } | null = null;

      // If recording, stop it and process the audio
      if (isRecording) {
        // Stop recording and get the audio file
        await new Promise<void>((resolve) => {
          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
              setSelectedFile(audioFile);
              setIsRecording(false);
              
              // Stop all tracks to release microphone
              const stream = mediaRecorderRef.current?.stream;
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
              resolve();
            };
            mediaRecorderRef.current.stop();
          } else {
            resolve();
          }
        });

        // Wait a bit for selectedFile to be set
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Process voice note if we have an audio file
      if (selectedFile && selectedFile.type.startsWith('audio/')) {
        try {
          const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
          if (groqApiKey) {
            const groq = new Groq({
              apiKey: groqApiKey,
              dangerouslyAllowBrowser: true
            });

            const transcription = await groq.audio.transcriptions.create({
              file: selectedFile,
              model: "whisper-large-v3-turbo",
              response_format: "text",
              temperature: 0.0
            });

            transcribedText = transcription;
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          transcribedText = 'Audio transcription failed';
        }
      }

      // Upload file if selected (but don't include voice notes as attachments)
      if (selectedFile && !selectedFile.type.startsWith('audio/')) {
        attachmentData = await uploadFileToSupabase(selectedFile);
        if (!attachmentData) {
          setIsLoading(false);
          setIsProcessingAudio(false);
          return; // Failed to upload
        }
      }

      // Use transcribed text as message content for voice notes, otherwise use input
      const userMessageContent = transcribedText || inputMessage.trim() || (attachmentData ? `Uploaded ${attachmentData.name}` : '');

      let sessionId = currentSessionId;
      if (!sessionId && userMessageContent) { // Only create session if there's actual content
        sessionId = await createChatSession(userMessageContent);
        if (!sessionId) {
          setIsLoading(false);
          setIsProcessingAudio(false);
          return; // Failed to create session
        }
        setCurrentSessionId(sessionId);
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        content: userMessageContent,
        isUser: true,
        timestamp: new Date(),
        attachmentUrl: attachmentData?.url,
        attachmentType: attachmentData?.type,
        attachmentName: attachmentData?.name,
      };

      setMessages(prev => [...prev, userMessage]);
      if (sessionId) { // Only save message if a session exists
        await saveMessage(userMessage, sessionId);
      }

      setInputMessage("");
      setSelectedFile(null); // Clear selected file after sending

      // Show typing indicator
      setIsTyping(true);

      // Add empty AI message that will be filled by streaming
      aiMessageId = (Date.now() + 1).toString();
      aiMessage = {
        id: aiMessageId,
        content: "",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

      let fullResponse = '';

      const aiResponse = await processWithGroq(userMessage, (chunk: string) => {
        fullResponse += chunk;
        // Update the AI message with streaming content
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: fullResponse }
            : msg
        ));
      });

      // Save final message to database
      const finalAiMessage = { ...aiMessage, content: aiResponse };
      if (sessionId) { // Only save message if a session exists
        await saveMessage(finalAiMessage, sessionId);
      }

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

      // Update the existing AI message with error
      if (aiMessageId) {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: errorMessage }
            : msg
        ));

        if (aiMessage && currentSessionId) { // Ensure currentSessionId exists before saving
          const errorMessage_obj = { ...aiMessage, content: errorMessage };
          await saveMessage(errorMessage_obj, currentSessionId);
        }
      } else {
        // If no AI message was created yet, add error message as new AI message
        const errorAiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: errorMessage,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorAiMessage]);
        if (currentSessionId) { // Ensure currentSessionId exists before saving
          await saveMessage(errorAiMessage, currentSessionId);
        }
      }
      showToast("Message failed to send", "error");
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setIsProcessingAudio(false); // Reset audio processing state
      setIsRecording(false); // Ensure recording is off
      setSelectedFile(null); // Clear selected file on completion or error
      setShowTranscriptionPreview(false); // Reset transcription preview
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderAttachment = (message: Message) => {
    if (!message.attachmentUrl) return null;

    if (message.attachmentType === 'image') {
      return (
        <div className="mt-2">
          <img 
            src={message.attachmentUrl} 
            alt={message.attachmentName}
            className="max-w-xs rounded-lg cursor-pointer"
            onClick={() => window.open(message.attachmentUrl, '_blank')}
          />
        </div>
      );
    }

    if (message.attachmentType === 'audio') {
      return (
        <div className="mt-2">
          <audio controls className="w-48 h-8 text-xs">
            <source src={message.attachmentUrl} type="audio/webm" />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    return (
      <div className="mt-2 flex items-center gap-2 p-1.5 bg-muted/50 rounded text-xs max-w-xs">
        <FileText className="h-3 w-3 flex-shrink-0" />
        <a 
          href={message.attachmentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate"
        >
          {message.attachmentName}
        </a>
      </div>
    );
  };

  return (
    <div className="h-[calc(100dvh-144px)] md:h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
              EduHive AI Assistant
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-2" />
                  Chat History
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Chat History</SheetTitle>
                  <SheetDescription>
                    Your previous conversations with EduHive AI
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  <Button 
                    onClick={startNewChat} 
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Chat
                  </Button>
                  <ScrollArea className="h-[400px]">
                    {chatSessions.map((session) => (
                      <div key={session.id} className="flex items-center gap-2 p-2">
                        <Button
                          variant={currentSessionId === session.id ? "default" : "ghost"}
                          className="flex-1 justify-start text-left h-auto p-2"
                          onClick={() => loadChatMessages(session.id)}
                        >
                          <div className="truncate">
                            <div className="font-medium truncate">{session.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(session.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Chat</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this chat? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteChat(session.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-0 md:px-6 py-4 pb-4" ref={scrollAreaRef}>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading chat history...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 px-2 md:px-0 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!message.isUser && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src="/logo.svg" alt="EduHive AI" />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <img src="/logo.svg" alt="EduHive" className="h-4 w-4" />
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
                    {renderAttachment(message)}
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
                      <AvatarImage src={currentUserProfile?.profile_pic || user?.user_metadata?.avatar_url || user?.user_metadata?.profile_pic} alt={currentUserProfile?.name || currentUserProfile?.username || user?.user_metadata?.name || user?.user_metadata?.username || user?.email} />
                      <AvatarFallback className="bg-secondary">
                        {(currentUserProfile?.name || currentUserProfile?.username || user?.user_metadata?.name || user?.user_metadata?.username || user?.email)?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {(isLoading || isTyping) && (
                <div className="flex gap-3 justify-start px-2 md:px-0">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src="/logo.svg" alt="EduHive AI" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <img src="/logo.svg" alt="EduHive" className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      {isLoading && !isTyping ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">EduHive AI is analyzing...</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <div className="w-1 h-1 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm text-muted-foreground">EduHive AI is typing...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Fixed Input Footer - Above Mobile Nav */}
      <div className="fixed bottom-[72px] md:bottom-0 left-0 md:left-64 right-0 z-40 bg-background/95 backdrop-blur-sm border-t">
        {/* File Upload Preview */}
        {selectedFile && (
          <div className="px-6 py-2 border-b">
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              {selectedFile.type.startsWith('image/') ? (
                <Image className="h-4 w-4" />
              ) : selectedFile.type.startsWith('audio/') ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="text-sm truncate flex-1">{selectedFile.name}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""; // Clear the file input value
                  }
                }}
              >
                ×
              </Button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 md:p-4">
          {isRecording ? (
            /* Voice Recording UI with Waveform - Like ChatGPT */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      stopRecording();
                      setSelectedFile(null);
                      setShowTranscriptionPreview(false);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!showTranscriptionPreview && selectedFile?.type.startsWith('audio/')) {
                        try {
                          const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
                          if (groqApiKey) {
                            const groq = new Groq({
                              apiKey: groqApiKey,
                              dangerouslyAllowBrowser: true
                            });

                            const transcription = await groq.audio.transcriptions.create({
                              file: selectedFile,
                              model: "whisper-large-v3-turbo",
                              response_format: "text",
                              temperature: 0.0
                            });

                            setInputMessage(transcription);
                            setShowTranscriptionPreview(true);
                          }
                        } catch (error) {
                          console.error('Error transcribing audio:', error);
                          setInputMessage('Audio transcription failed');
                          setShowTranscriptionPreview(true);
                        }
                      } else {
                        setShowTranscriptionPreview(!showTranscriptionPreview);
                      }
                    }}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    <span className="text-sm">See text</span>
                  </Button>
                </div>
                
                {/* Waveform Visualization or Transcription Preview */}
                <div className="flex-1 mx-4 flex items-center justify-center">
                  {showTranscriptionPreview ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 text-center max-w-md truncate">
                      {inputMessage || "Transcribing..."}
                    </div>
                  ) : (
                    <div className="flex items-end gap-1 h-8">
                      {Array.from({ length: 40 }, (_, i) => (
                        <div
                          key={i}
                          className="bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"
                          style={{
                            width: '2px',
                            height: `${Math.random() * 24 + 8}px`,
                            animationDelay: `${i * 0.05}s`,
                            animationDuration: `${0.5 + Math.random() * 0.5}s`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  onClick={sendMessage}
                  disabled={isLoading || isProcessingAudio}
                  size="sm"
                  className="rounded-full w-10 h-10 bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200"
                >
                  {isLoading || isProcessingAudio ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white dark:text-black" />
                  ) : (
                    <div className="w-0 h-0 border-l-[6px] border-l-white dark:border-l-black border-y-[4px] border-y-transparent ml-0.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Normal Input UI */
            <div className="flex gap-2">
              <div className="flex gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf,text/*,.doc,.docx,audio/*"
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={startRecording}
                  disabled={isLoading}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Ask me anything about your studies, or upload files for analysis..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage}
                disabled={(!inputMessage.trim() && !selectedFile) || isLoading}
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}