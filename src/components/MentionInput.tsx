import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

interface MentionUser {
  id: string;
  username: string;
  name: string;
  profile_pic: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: MentionUser[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowAIBot?: boolean; // Whether to allow @eduhive mentions
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder = "What's on your mind?",
  className = "",
  disabled = false,
  allowAIBot = false,
}) => {
  const { user } = useAuth();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentMention, setCurrentMention] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch mutual followers for tagging
  const fetchMutualFollowers = useCallback(async (searchTerm: string = '') => {
    if (!user) return [];
    
    try {
      // Get users that both follow me and I follow them
      const { data: mutualFollows, error } = await supabase
        .from('profiles')
        .select('id, username, name, profile_pic')
        .in('id', 
          // Subquery to get users who follow me AND who I follow (mutual follows)
          supabase.rpc('get_mutual_followers', { user_id: user.id })
        )
        .ilike('username', `%${searchTerm}%`)
        .limit(5);

      if (error) throw error;
      return mutualFollows || [];
    } catch (error) {
      console.error('Error fetching mutual followers:', error);
      return [];
    }
  }, [user]);

  // Handle @ mention detection
  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);
    
    // Find the last @ before cursor
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if we're still in a mention (no space after @)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setCurrentMention(textAfterAt);
        const searchSuggestions: MentionUser[] = [];
        
        // Add AI bot if allowed
        if (allowAIBot && 'eduhive'.includes(textAfterAt.toLowerCase())) {
          searchSuggestions.push({
            id: 'ai-bot',
            username: 'eduhive',
            name: 'EduHive Assistant',
            profile_pic: null
          });
        }
        
        // Add mutual followers
        const mutualUsers = await fetchMutualFollowers(textAfterAt);
        searchSuggestions.push(...mutualUsers);
        
        setSuggestions(searchSuggestions);
        setShowSuggestions(searchSuggestions.length > 0);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
    
    // Extract current mentions from text
    const mentionRegex = /@(\w+)/g;
    const foundMentions: MentionUser[] = [];
    let match;
    
    while ((match = mentionRegex.exec(newValue)) !== null) {
      const username = match[1];
      const existingUser = mentionUsers.find(u => u.username === username);
      if (existingUser) {
        foundMentions.push(existingUser);
      } else if (username === 'eduhive' && allowAIBot) {
        foundMentions.push({
          id: 'ai-bot',
          username: 'eduhive',
          name: 'EduHive Assistant',
          profile_pic: null
        });
      }
    }
    
    onChange(newValue, foundMentions);
  }, [allowAIBot, fetchMutualFollowers, mentionUsers, onChange]);

  // Handle suggestion selection
  const selectSuggestion = useCallback((suggestion: MentionUser) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const newValue = 
        textBeforeCursor.substring(0, lastAtIndex) + 
        `@${suggestion.username} ` + 
        textAfterCursor;
      
      // Update mentions list
      const updatedMentions = [...mentionUsers.filter(u => u.username !== suggestion.username), suggestion];
      setMentionUsers(updatedMentions);
      
      onChange(newValue, updatedMentions);
      setShowSuggestions(false);
      
      // Focus back to textarea
      setTimeout(() => {
        const newCursorPos = lastAtIndex + suggestion.username.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }, [value, cursorPosition, mentionUsers, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex]);
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, selectSuggestion]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
        rows={3}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <Card
          ref={suggestionsRef}
          className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto border shadow-lg bg-white"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
              onClick={() => selectSuggestion(suggestion)}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={suggestion.profile_pic || undefined} />
                <AvatarFallback className={suggestion.id === 'ai-bot' ? 'bg-green-500 text-white' : ''}>
                  {suggestion.id === 'ai-bot' ? '🤖' : suggestion.name?.[0]?.toUpperCase() || suggestion.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">@{suggestion.username}</div>
                <div className="text-sm text-gray-500">{suggestion.name}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};