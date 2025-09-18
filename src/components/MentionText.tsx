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
    // Regular expression to match @mentions
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;

    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add the text before the mention
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
      }

      const username = match[1];

      // Special handling for AI bot
      if (username === 'eduhive') {
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="text-blue-600 font-medium hover:underline cursor-pointer bg-blue-50 dark:bg-blue-900/30 px-1 rounded transition-colors"
            title="EduHive AI Assistant"
          >
            @{username}
          </span>
        );
      } else {
        // Regular user mention - make it clickable to their profile
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="text-blue-600 font-medium hover:underline hover:text-blue-800 transition-colors cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/profile/${username}`);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            @{username}
          </span>
        );
      }
      lastIndex = mentionRegex.lastIndex;
    }

    // Add any remaining text after the last mention
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <span className={className}>
      {parseText(text)}
    </span>
  );
};