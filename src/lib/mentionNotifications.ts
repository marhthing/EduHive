
import { supabase } from "@/integrations/supabase/client";

interface MentionUser {
  id: string;
  username: string;
  name: string;
  profile_pic: string | null;
}

export const createMentionNotifications = async (
  mentions: MentionUser[],
  fromUserId: string,
  postId?: string,
  commentId?: string
): Promise<void> => {
  try {
    // Filter out AI bot mentions and extract usernames
    const userMentions = mentions.filter(mention => mention.id !== 'ai-bot');
    
    if (userMentions.length === 0) return;
    
    const mentionedUsernames = userMentions.map(mention => mention.username);
    
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
