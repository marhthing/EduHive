
import { supabase } from "@/integrations/supabase/client";
import { AI_BOT_USER_ID } from "@/lib/aiBotProfile";

interface MentionUser {
  id: string;
  username: string;
  name: string;
  profile_pic: string | null;
}

export const createMentionNotifications = async (
  mentions: MentionUser[] | string[],
  fromUserId: string,
  postId?: string,
  commentId?: string
): Promise<void> => {
  try {
    if (!mentions || mentions.length === 0) return;
    
    // Handle both user objects and username strings
    let mentionedUsernames: string[];
    
    if (typeof mentions[0] === 'string') {
      // Already an array of usernames
      mentionedUsernames = mentions as string[];
    } else {
      // Array of user objects - extract usernames and filter out AI bot
      const userMentions = (mentions as MentionUser[]).filter(mention => mention.id !== 'ai-bot' && mention.id !== AI_BOT_USER_ID);
      mentionedUsernames = userMentions.map(mention => mention.username);
    }
    
    // Filter out AI bot username if it exists
    mentionedUsernames = mentionedUsernames.filter(username => username !== 'eduhive');
    
    if (mentionedUsernames.length === 0) return;
    
    // Call the database function to create mention notifications
    const { error } = await supabase.rpc('create_mention_notifications', {
      p_mentioned_usernames: mentionedUsernames,
      p_from_user_id: fromUserId,
      p_post_id: postId || null,
      p_comment_id: commentId || null
    });
    
    if (error) {
      console.error('Error creating mention notifications:', error);
    }
  } catch (error) {
    console.error('Error in createMentionNotifications:', error);
  }
};
