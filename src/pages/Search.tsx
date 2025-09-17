import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { useToast } from "@/hooks/use-toast";

interface Post {
  id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: string | null;
  school_tag: string | null;
  course_tag: string | null;
  created_at: string;
  profile: {
    username: string;
    name: string | null;
    profile_pic: string | null;
    school: string | null;
    department: string | null;
  } | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [schoolFilter, setSchoolFilter] = useState(searchParams.get("school") || "");
  const [courseFilter, setCourseFilter] = useState(searchParams.get("course") || "");
  const [schools, setSchools] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchFilterOptions = async () => {
    try {
      const { data: schoolsData } = await supabase
        .from("posts")
        .select("school_tag")
        .not("school_tag", "is", null);
      
      const { data: coursesData } = await supabase
        .from("posts")
        .select("course_tag")
        .not("course_tag", "is", null);

      const uniqueSchools = [...new Set(schoolsData?.map(p => p.school_tag).filter(Boolean) || [])];
      const uniqueCourses = [...new Set(coursesData?.map(p => p.course_tag).filter(Boolean) || [])];
      
      setSchools(uniqueSchools);
      setCourses(uniqueCourses);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const searchPosts = async () => {
    if (!searchQuery.trim() && !schoolFilter && !courseFilter) {
      setPosts([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        query = query.or(`body.ilike.%${searchQuery}%,course_tag.ilike.%${searchQuery}%,school_tag.ilike.%${searchQuery}%`);
      }

      if (schoolFilter) {
        query = query.eq("school_tag", schoolFilter);
      }

      if (courseFilter) {
        query = query.eq("course_tag", courseFilter);
      }

      const { data: postsData, error } = await query;

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      
      const postsWithCounts = await Promise.all(
        (postsData || []).map(async (post) => {
          const [likesResult, commentsResult, userLikeResult, userBookmarkResult, profileResult] = await Promise.all([
            supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
            supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id).is('parent_comment_id', null),
            user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).single() : null,
            user ? supabase.from("bookmarks").select("id").eq("post_id", post.id).eq("user_id", user.id).single() : null,
            supabase.from("profiles").select("username, name, profile_pic, school, department").eq("user_id", post.user_id).single()
          ]);

          return {
            ...post,
            profile: profileResult.data,
            likes_count: likesResult.count || 0,
            comments_count: commentsResult.count || 0,
            is_liked: !!userLikeResult?.data,
            is_bookmarked: !!userBookmarkResult?.data,
          };
        })
      );

      setPosts(postsWithCounts);
    } catch (error) {
      console.error("Error searching posts:", error);
      toast({
        title: "Error",
        description: "Failed to search posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery);
    if (schoolFilter) params.set("school", schoolFilter);
    if (courseFilter) params.set("course", courseFilter);
    
    setSearchParams(params);
    searchPosts();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSchoolFilter("");
    setCourseFilter("");
    setSearchParams({});
    setPosts([]);
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (searchParams.get("q") || searchParams.get("school") || searchParams.get("course")) {
      searchPosts();
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-4">Search Posts</h1>
        
        <Card className="p-4 mb-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search posts, courses, or schools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading}>
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Select value={schoolFilter || "all"} onValueChange={(value) => setSchoolFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school} value={school}>
                      {school}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={courseFilter || "all"} onValueChange={(value) => setCourseFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchQuery || schoolFilter || courseFilter) && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>

            {(searchQuery || schoolFilter || courseFilter) && (
              <div className="flex gap-2 flex-wrap">
                {searchQuery && <Badge variant="secondary">Query: {searchQuery}</Badge>}
                {schoolFilter && <Badge variant="secondary">School: {schoolFilter}</Badge>}
                {courseFilter && <Badge variant="secondary">Course: {courseFilter}</Badge>}
              </div>
            )}
          </div>
        </Card>
      </div>

      {loading && (
        <div className="text-center py-8">
          <img src="/logo-animated.svg" alt="Loading" className="h-16 w-16 mx-auto" />
          <p className="mt-2 text-muted-foreground">Searching...</p>
        </div>
      )}

      {!loading && posts.length === 0 && (searchQuery || schoolFilter || courseFilter) && (
        <Card className="text-center py-8">
          <CardContent>
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && posts.length === 0 && !searchQuery && !schoolFilter && !courseFilter && (
        <Card className="text-center py-8">
          <CardContent>
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Search EduHive</h3>
            <p className="text-muted-foreground">
              Enter keywords, course codes, or school names to find posts
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={() => {}}
            onBookmark={() => {}}
            onComment={() => {}}
          />
        ))}
      </div>
    </div>
  );
}