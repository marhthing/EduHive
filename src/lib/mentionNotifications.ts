
import { supabase } from "@/integrations/supabase/client";

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
    console.log('🔍 createMentionNotifications called with:', {
      mentions,
      fromUserId,
      postId,
      commentId,
      mentionsType: typeof mentions[0],
      mentionsLength: mentions?.length
    });

    if (!mentions || mentions.length === 0) {
      console.log('❌ No mentions provided, returning early');
      return;
    }
    
    // Handle both user objects and username strings
    let mentionedUsernames: string[];
    
    if (typeof mentions[0] === 'string') {
      // Already an array of usernames
      mentionedUsernames = mentions as string[];
      console.log('✅ Mentions are already strings:', mentionedUsernames);
    } else {
      // Array of user objects - extract usernames and filter out AI bot
      const userMentions = (mentions as MentionUser[]).filter(mention => mention.id !== 'ai-bot');
      mentionedUsernames = userMentions.map(mention => mention.username);
      console.log('✅ Converted user objects to usernames:', {
        originalMentions: mentions,
        filteredMentions: userMentions,
        usernames: mentionedUsernames
      });
    }
    
    // Filter out AI bot username if it exists
    const originalUsernames = [...mentionedUsernames];
    mentionedUsernames = mentionedUsernames.filter(username => username !== 'eduhive');
    console.log('✅ Filtered out AI bot:', {
      before: originalUsernames,
      after: mentionedUsernames
    });
    
    if (mentionedUsernames.length === 0) {
      console.log('❌ No valid usernames after filtering, returning early');
      return;
    }
    
    console.log('🚀 About to call Supabase RPC with:', {
      function: 'create_mention_notifications',
      parameters: {
        p_mentioned_usernames: mentionedUsernames,
        p_from_user_id: fromUserId,
        p_post_id: postId || null,
        p_comment_id: commentId || null
      }
    });
    
    // Call the database function to create mention notifications
    const { data, error } = await supabase.rpc('create_mention_notifications', {
      p_mentioned_usernames: mentionedUsernames,
      p_from_user_id: fromUserId,
      p_post_id: postId || null,
      p_comment_id: commentId || null
    });
    
    if (error) {
      console.error('❌ Supabase RPC error:', {
        error,
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message
      });
    } else {
      console.log('✅ Mention notifications created successfully!', {
        data,
        usernames: mentionedUsernames
      });
    }
  } catch (error) {
    console.error('❌ Exception in createMentionNotifications:', error);
  }
};
