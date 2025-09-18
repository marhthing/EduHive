import React from 'react';
import { useNavigate } from 'react-router-dom';

interface MentionTextProps {
  text: string;
  className?: string;
}

export const MentionText: React.FC<MentionTextProps> = ({ text, className = '' }) => {
  const navigate = useNavigate();

  // Function to parse text and make @mentions clickable
  const parseText = (text: string) => {
    // Split by @mentions but keep the mentions in the result
    const parts = text.split(/(@\w+)/g);
    
    return parts.map((part, index) => {
      // Check if this part is a mention
      const mentionMatch = part.match(/^@(\w+)$/);
      
      if (mentionMatch) {
        const username = mentionMatch[1];
        
        // Special handling for AI bot
        if (username === 'eduhive') {
          return (
            <span
              key={index}
              className="text-blue-600 font-medium hover:underline cursor-pointer bg-blue-50 dark:bg-blue-900/30 px-1 rounded transition-colors"
              title="EduHive AI Assistant"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // AI bot doesn't have a profile page, so just show tooltip
              }}
            >
              @{username}
            </span>
          );
        }
        
        // Regular user mention - make it clickable to their profile
        return (
          <span
            key={index}
            className="text-blue-600 font-medium hover:underline hover:text-blue-800 transition-colors cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/profile/${username}`);
            }}
          >
            @{username}
          </span>
        );
      }
      
      // Regular text
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <span className={className}>
      {parseText(text)}
    </span>
  );
};